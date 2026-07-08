"""
backend/main.py

FastAPI application entry point. Handles uploader, query, and session metadata.
"""

import os
import re
import uuid
import logging
from contextlib import asynccontextmanager
from typing import Any, Optional

import numpy as np
import pandas as pd
import sqlparse
from fastapi import FastAPI, UploadFile, File, HTTPException, Body, Query, Depends, Request, BackgroundTasks, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import select, update, text
from sqlalchemy.ext.asyncio import AsyncSession

import asyncio
from auth import get_current_user, get_user_id
from db_models import get_db_session, init_metadata_db, DatabaseConnection, QueryLog, async_engine
from text_to_sql import (
    run_text_to_sql,
    run_raw_sql,
    get_schema_structured,
    DEFAULT_SYSTEM_INSTRUCTION_BASE,
    get_sample_rows_async,
    generate_database_insight_async
)


logger = logging.getLogger(__name__)

# Initialize slowapi rate limiter
limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing metadata database...")
    db_url = os.getenv("METADATA_DATABASE_URL", "")
    if not db_url or "[REGION]" in db_url.upper() or "[PASSWORD]" in db_url:
        logger.warning("METADATA_DATABASE_URL appears to be unconfigured. Skipping automatic database initialization.")
    else:
        try:
            await init_metadata_db()
            logger.info("Metadata database initialized successfully.")
        except Exception as e:
            logger.error("Failed to initialize database: %s", e)
    yield
    logger.info("Shutdown complete.")

app = FastAPI(
    title="Text-to-SQL API",
    version="2.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Global Exception Handler (ensures tracebacks are logged and error responses have CORS headers)
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": f"Internal Server Error: {str(exc)}"},
    )

# CORS Middleware Setup
raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,https://obsidian-two-silk.vercel.app")
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    db_id: str
    question: str
    model: str = "gemini-2.5-flash"
    model_name: Optional[str] = None
    temperature: float = 0.0
    instruction: str = ""

class RawQueryRequest(BaseModel):
    db_id: str
    sql: str

class RenameRequest(BaseModel):
    name: str

class DeleteConfirmRequest(BaseModel):
    confirm: bool

# ---------------------------------------------------------------------------
# Security Helpers (SQL Audit & Ownership Guard)
# ---------------------------------------------------------------------------

def sanitize_column_name(col: str) -> str:
    col = re.sub(r"[^\w]", "_", col.strip())
    if not col or col[0].isdigit():
        col = f"col_{col}" if col else "col"
    return col.lower()[:63]

def deduplicate_columns(cols: list[str]) -> list[str]:
    seen = set()
    result = []
    for col in cols:
        candidate = col
        i = 1
        while candidate in seen:
            candidate = f"{col}_{i}"
            i += 1
        seen.add(candidate)
        result.append(candidate)
    return result

def extract_table_names(token_group) -> list[str]:
    names = []
    from_seen = False
    for token in token_group.tokens:
        if token.is_group:
            names.extend(extract_table_names(token))
            
        if from_seen:
            if isinstance(token, sqlparse.sql.IdentifierList):
                for identifier in token.get_identifiers():
                    real_name = identifier.get_real_name()
                    if real_name:
                        names.append(real_name.lower().strip('"`'))
                from_seen = False
            elif isinstance(token, sqlparse.sql.Identifier):
                real_name = token.get_real_name()
                if real_name:
                    names.append(real_name.lower().strip('"`'))
                from_seen = False
            elif token.ttype in (sqlparse.tokens.Name, sqlparse.tokens.Name.Builtin):
                names.append(token.value.lower().strip('"`'))
                from_seen = False
            elif not token.is_whitespace and not isinstance(token, sqlparse.sql.Comment):
                from_seen = False
                
        if token.ttype is sqlparse.tokens.Keyword and token.value.upper() in ("FROM", "JOIN"):
            from_seen = True
    return names

def audit_table_references(sql: str, allowed_tables: list[str]) -> bool:
    try:
        parsed_statements = sqlparse.parse(sql)
        if len(parsed_statements) != 1:
            return False
        parsed = parsed_statements[0]
        
        first_token = parsed.token_first(skip_cm=True)
        is_cte = (
            first_token is not None
            and first_token.value.upper() == "WITH"
        )
        if parsed.get_type() != "SELECT" and not is_cte:
            return False
    except Exception:
        return False

    cte_names = set()
    tokens = list(parsed.flatten())
    
    mutation_keywords = {
        "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "RENAME", "TRUNCATE", 
        "REPLACE", "MERGE", "COPY", "DO", "CALL", "GRANT", "REVOKE", "VACUUM", "INTO"
    }
    for token in tokens:
        if token.ttype is sqlparse.tokens.Keyword and token.value.upper() in mutation_keywords:
            return False
            
    for i, token in enumerate(tokens):
        if token.ttype in (sqlparse.tokens.Name, sqlparse.tokens.Name.Builtin):
            val_clean = token.value.lower().strip('"`')
            j = i + 1
            while j < len(tokens) and (tokens[j].is_whitespace or isinstance(tokens[j], sqlparse.sql.Comment)):
                j += 1
            if j < len(tokens) and tokens[j].ttype is sqlparse.tokens.Keyword and tokens[j].value.upper() == "AS":
                j += 1
                while j < len(tokens) and (tokens[j].is_whitespace or isinstance(tokens[j], sqlparse.sql.Comment)):
                    j += 1
                if j < len(tokens) and tokens[j].ttype is sqlparse.tokens.Punctuation and tokens[j].value == "(":
                    cte_names.add(val_clean)

    forbidden = {"public", "pg_catalog", "information_schema", "db_connections", "query_logs"}
    table_refs = extract_table_names(parsed)
    
    allowed_lowercased = {t.lower() for t in allowed_tables}
    allowed_lowercased.update(cte_names)

    for token in tokens:
        if token.ttype in (sqlparse.tokens.Name, sqlparse.tokens.Name.Builtin, sqlparse.tokens.Literal.String.Symbol):
            val = token.value.lower().strip('"`')
            if val in forbidden:
                return False

    non_allowed = [t for t in table_refs if t and t not in allowed_lowercased]
    return len(non_allowed) == 0

async def _get_owned_connection(db_id: str, user_id: str, db: AsyncSession) -> DatabaseConnection:
    result = await db.execute(
        select(DatabaseConnection).where(
            DatabaseConnection.db_id == db_id,
            DatabaseConnection.is_deleted == False
        )
    )
    conn = result.scalar_one_or_none()
    if conn is None:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    if conn.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied.")
    return conn

# ---------------------------------------------------------------------------
# Background workers
# ---------------------------------------------------------------------------

async def _hard_drop_schema_table(table_name: str) -> None:
    try:
        async with async_engine.begin() as conn:
            await conn.execute(text(f'DROP TABLE IF EXISTS csv_data."{table_name}" CASCADE;'))
        logger.info("Table csv_data.%s dropped successfully.", table_name)
    except Exception as exc:
        logger.error("Background table drop failed for %s: %s", table_name, exc)

# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

@app.post("/upload-db")
@limiter.limit("5/minute")
async def upload_database(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user),
):
    user_id = get_user_id(user)
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")

    import os
    import sqlite3
    from io import BytesIO

    file_ext = os.path.splitext(file.filename or "")[1].lower()

    if file_ext in [".db", ".sqlite"]:
        # SQLite Upload Processing
        temp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp_uploads")
        os.makedirs(temp_dir, exist_ok=True)
        temp_uuid = str(uuid.uuid4())
        temp_file_path = os.path.join(temp_dir, f"temp_{temp_uuid}{file_ext}")
        
        try:
            # Save raw bytes to temporary file for SQLite connection
            with open(temp_file_path, "wb") as buffer:
                buffer.write(contents)
                
            sqlite_conn = sqlite3.connect(temp_file_path)
            sqlite_cursor = sqlite_conn.cursor()
            sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
            sqlite_tables = [row[0] for row in sqlite_cursor.fetchall()]
            
            if not sqlite_tables:
                sqlite_conn.close()
                if os.path.exists(temp_file_path):
                    os.remove(temp_file_path)
                raise HTTPException(status_code=400, detail="SQLite database contains no queryable tables.")
                
            last_created_db_id = None
            last_created_name = ""
            last_created_table = ""
            
            for tbl in sqlite_tables:
                # Read SQLite table structure into Pandas
                tbl_df = pd.read_sql_query(f'SELECT * FROM "{tbl}"', sqlite_conn)
                if tbl_df.empty:
                    continue
                    
                # Prepare column name layouts
                sanitized_cols = [sanitize_column_name(c) for c in tbl_df.columns]
                sanitized_cols = deduplicate_columns(sanitized_cols)
                tbl_df.columns = sanitized_cols
                
                # Format nullable integer fields
                for col in tbl_df.columns:
                    if tbl_df[col].dtype == "float64" and tbl_df[col].dropna().apply(float.is_integer).all():
                        tbl_df[col] = tbl_df[col].astype("Int64")
                tbl_df = tbl_df.where(tbl_df.notna(), other=None)
                
                records = [
                    tuple(None if pd.isna(v) or v is pd.NA else v for v in row)
                    for row in tbl_df.values.tolist()
                ]
                
                column_defs = []
                tables_json_cols = []
                for col in tbl_df.columns:
                    if pd.api.types.is_datetime64_any_dtype(tbl_df[col]):
                        pg_type = "TIMESTAMP"
                    elif pd.api.types.is_float_dtype(tbl_df[col]):
                        pg_type = "NUMERIC"
                    elif pd.api.types.is_integer_dtype(tbl_df[col]) or isinstance(tbl_df[col].dtype, pd.Int64Dtype):
                        pg_type = "BIGINT"
                    else:
                        pg_type = "TEXT"
                    column_defs.append(f'"{col}" {pg_type}')
                    tables_json_cols.append({"name": col, "type": pg_type})
                    
                db_id = str(uuid.uuid4())
                table_suffix = db_id.replace("-", "")
                table_name_pg = f"upload_{table_suffix}"
                
                # Execute Supabase DDL
                ddl = f'CREATE TABLE csv_data."{table_name_pg}" ({", ".join(column_defs)});'
                try:
                    async with async_engine.begin() as conn:
                        await conn.execute(text(ddl))
                except Exception as e:
                    logger.error("DDL creation failed for SQLite table %s: %s", table_name_pg, e)
                    continue
                    
                # Bulk insert table data
                try:
                    async with async_engine.connect() as conn:
                        raw_conn = await conn.get_raw_connection()
                        await raw_conn.driver_connection.copy_records_to_table(
                            table_name_pg,
                            schema_name="csv_data",
                            records=records,
                            columns=sanitized_cols,
                        )
                except Exception as e:
                    logger.error("Bulk copy insertion failed for SQLite table %s: %s", table_name_pg, e)
                    async with async_engine.begin() as conn:
                        await conn.execute(text(f'DROP TABLE IF EXISTS csv_data."{table_name_pg}" CASCADE;'))
                    continue
                    
                tables_json = [{
                    "table_name": table_name_pg,
                    "display_name": tbl,
                    "columns": tables_json_cols,
                    "row_count": len(tbl_df)
                }]
                
                # Log metadata connection session
                conn_rec = DatabaseConnection(
                    db_id=db_id,
                    user_id=user_id,
                    name=f"{file.filename} - {tbl}",
                    db_type="csv",
                    schema_name="csv_data",
                    table_name=table_name_pg,
                    tables_json=tables_json,
                )
                db.add(conn_rec)
                
                last_created_db_id = db_id
                last_created_name = conn_rec.name
                last_created_table = table_name_pg
                last_created_tables_json = tables_json
                
            await db.commit()
            sqlite_conn.close()
            
            if os.path.exists(temp_file_path):
                os.remove(temp_file_path)
                
            if not last_created_db_id:
                raise HTTPException(status_code=400, detail="No non-empty tables were successfully imported from SQLite database.")
                
            return {"db_id": last_created_db_id, "db_name": last_created_name, "tables": last_created_tables_json}
            
        except HTTPException as he:
            raise he
        except Exception as e:
            if os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except Exception:
                    pass
            logger.error("SQLite db upload processing failed: %s", e)
            raise HTTPException(status_code=500, detail=f"Failed to parse and ingest SQLite database: {str(e)}")
            
    else:
        # Read CSV using Pandas (stream raw bytes)
        df = None
        for encoding in ["utf-8-sig", "utf-8", "utf-16", "latin1", "iso-8859-1", "cp1252"]:
            try:
                df = pd.read_csv(BytesIO(contents), encoding=encoding)
                break
            except Exception:
                continue
        if df is None:
            try:
                df = pd.read_csv(BytesIO(contents))
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {str(e)}")

        if df.empty:
            raise HTTPException(status_code=400, detail="CSV file is empty.")

        # Prepare DataFrame columns and types
        sanitized_cols = [sanitize_column_name(c) for c in df.columns]
        sanitized_cols = deduplicate_columns(sanitized_cols)
        df.columns = sanitized_cols

        # Cast integer columns with nulls back from float64 to nullable Int64 (must run first)
        for col in df.columns:
            if df[col].dtype == "float64" and df[col].dropna().apply(float.is_integer).all():
                df[col] = df[col].astype("Int64")

        # Map all variants of null values to Python None
        df = df.where(df.notna(), other=None)

        records = [
            tuple(None if pd.isna(v) or v is pd.NA else v for v in row)
            for row in df.values.tolist()
        ]

        # Map column PostgreSQL types
        column_defs = []
        tables_json_cols = []
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                pg_type = "TIMESTAMP"
            elif pd.api.types.is_float_dtype(df[col]):
                pg_type = "NUMERIC"
            elif pd.api.types.is_integer_dtype(df[col]) or isinstance(df[col].dtype, pd.Int64Dtype):
                pg_type = "BIGINT"
            else:
                pg_type = "TEXT"
            column_defs.append(f'"{col}" {pg_type}')
            tables_json_cols.append({"name": col, "type": pg_type})

        db_id = str(uuid.uuid4())
        table_suffix = db_id.replace("-", "")
        table_name = f"upload_{table_suffix}"

        # Run DDL to create table
        ddl = f'CREATE TABLE csv_data."{table_name}" ({", ".join(column_defs)});'
        try:
            async with async_engine.begin() as conn:
                await conn.execute(text(ddl))
        except Exception as e:
            logger.error("DDL creation failed for table %s: %s", table_name, e)
            raise HTTPException(status_code=500, detail="Failed to initialize schema for dataset.")

        # Ingest rows via asyncpg COPY
        try:
            async with async_engine.connect() as conn:
                raw_conn = await conn.get_raw_connection()
                await raw_conn.driver_connection.copy_records_to_table(
                    table_name,
                    schema_name="csv_data",
                    records=records,
                    columns=sanitized_cols,
                )
        except Exception as e:
            logger.error("Bulk copy insertion failed for table %s: %s", table_name, e)
            # Drop table if ingestion failed
            async with async_engine.begin() as conn:
                await conn.execute(text(f'DROP TABLE IF EXISTS csv_data."{table_name}" CASCADE;'))
            raise HTTPException(status_code=500, detail=f"Database ingestion failed: {str(e)}")

        # Construct tables_json cache schema
        display_name = file.filename or f"upload_{table_name}"
        if display_name.endswith(".csv"):
            display_name = display_name[:-4]
        tables_json = [{
            "table_name": table_name,
            "display_name": display_name,
            "columns": tables_json_cols,
            "row_count": len(df)
        }]

        # Log connection metadata
        conn_rec = DatabaseConnection(
            db_id=db_id,
            user_id=user_id,
            name=file.filename or f"upload_{table_name}",
            db_type="csv",
            schema_name="csv_data",
            table_name=table_name,
            tables_json=tables_json,
        )
        db.add(conn_rec)
        await db.commit()

        return {"db_id": db_id, "db_name": conn_rec.name, "tables": tables_json}


@app.post("/query")
@limiter.limit("15/minute")
async def query_endpoint(
    request: Request,
    body: QueryRequest,
    db: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user),
):
    user_id = get_user_id(user)
    conn_rec = await _get_owned_connection(body.db_id, user_id, db)

    # Formulate schema-qualified grounding path for LLM pipeline (restrict to current connection's table only)
    db_uri = f'{os.environ["METADATA_DATABASE_URL"]}|schema=csv_data|tables={conn_rec.table_name}'

    # Run query
    active_model = body.model_name if body.model_name else body.model
    result = await run_text_to_sql(
        question=body.question,
        db_path=db_uri,
        model_name=active_model,
        temperature=body.temperature,
        custom_system_instruction=body.instruction,
    )
    
    # Audit final generated SQL
    generated_sql = result.get("sql")
    if generated_sql:
        if not audit_table_references(generated_sql, [conn_rec.table_name]):
            # Block and wipe results to prevent leaks
            return {
                "sql": generated_sql,
                "result": None,
                "columns": [],
                "error": "Query validation failed: attempt to access unauthorized tables or schemas.",
                "attempts": result.get("attempts", 1),
                "execution_time_ms": result.get("execution_time_ms", 0),
                "trace": result.get("trace", []) + [{"step": "safety", "status": "error", "message": "Access Denied. Table or operation is unauthorized."}]
            }
        else:
            if "trace" in result and isinstance(result["trace"], list):
                result["trace"] = result["trace"] + [{"step": "safety", "status": "success", "message": "SELECT-only query and table reference audit passed."}]

    # Persist log
    log = QueryLog(
        db_id=body.db_id,
        user_id=user_id,
        question=body.question,
        sql_query=generated_sql,
        result_json=result.get("result"),
        columns_json=result.get("columns"),
        attempts=result.get("attempts", 1),
        execution_time_ms=result.get("execution_time_ms", 0),
        error=result.get("error"),
        trace_json=result.get("trace"),
    )
    db.add(log)
    await db.commit()

    return result

@app.post("/query/raw")
@limiter.limit("20/minute")
async def raw_query_endpoint(
    request: Request,
    body: RawQueryRequest,
    db: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user),
):
    user_id = get_user_id(user)
    conn_rec = await _get_owned_connection(body.db_id, user_id, db)

    # Audit the raw query (restrict to the current connection's table only)
    if not audit_table_references(body.sql, [conn_rec.table_name]):
        raise HTTPException(status_code=403, detail="Query contains unauthorized table or schema references.")

    db_uri = f'{os.environ["METADATA_DATABASE_URL"]}|schema=csv_data|tables={conn_rec.table_name}'
    result = await run_raw_sql(sql_query=body.sql, db_path=db_uri)
    return result

@app.get("/sessions")
async def list_sessions(
    db: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user),
):
    user_id = get_user_id(user)
    result = await db.execute(
        select(DatabaseConnection).where(
            DatabaseConnection.user_id == user_id,
            DatabaseConnection.is_deleted == False
        )
    )
    connections = result.scalars().all()
    
    # Enrich connection schemas with friendly display_name and row_count on the fly if missing
    dirty_any = False
    for c in connections:
        tables = c.tables_json or []
        dirty_c = False
        for t in tables:
            if "display_name" not in t or "row_count" not in t or t.get("row_count") is None:
                dirty_c = True
                dirty_any = True
                if t["table_name"] == c.table_name:
                    display_name = c.name
                    if " - " in display_name:
                        display_name = display_name.split(" - ", 1)[1]
                    elif display_name.endswith(".csv"):
                        display_name = display_name[:-4]
                    t["display_name"] = display_name
                    
                    try:
                        async with async_engine.connect() as engine_conn:
                            count_res = await engine_conn.execute(text(f'SELECT count(*) FROM csv_data."{c.table_name}"'))
                            t["row_count"] = count_res.scalar() or 0
                    except Exception as ce:
                        logger.error("Failed to count session rows: %s", ce)
                        t["row_count"] = 0
                else:
                    t["display_name"] = t["table_name"]
                    t["row_count"] = 0
        if dirty_c:
            import copy
            c.tables_json = copy.deepcopy(tables)
            
    if dirty_any:
        await db.commit()
        
    return [
        {
            "db_id": c.db_id,
            "db_name": c.name,
            "db_type": c.db_type,
            "schema_name": c.schema_name,
            "table_name": c.table_name,
            "tables": c.tables_json or [],
            "created_at": c.created_at,
        }
        for c in connections
    ]

@app.post("/sessions/rename/{db_id}")
async def rename_session(
    db_id: str,
    body: RenameRequest,
    db: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user),
):
    user_id = get_user_id(user)
    conn = await _get_owned_connection(db_id, user_id, db)
    conn.name = body.name
    await db.commit()
    return {"db_id": db_id, "db_name": body.name}

@app.delete("/sessions/{db_id}")
async def delete_session(
    db_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user),
):

    user_id = get_user_id(user)
    conn = await _get_owned_connection(db_id, user_id, db)

    # 1. Soft delete
    conn.is_deleted = True
    await db.commit()

    # 2. Hard drop in background
    if conn.table_name:
        background_tasks.add_task(_hard_drop_schema_table, conn.table_name)

    return {"status": "deleted", "db_id": db_id}

@app.get("/sessions/{db_id}/history")
async def get_session_history(
    db_id: str,
    db: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user),
):
    user_id = get_user_id(user)
    # Validate connection ownership
    await _get_owned_connection(db_id, user_id, db)
    
    result = await db.execute(
        select(QueryLog).where(
            QueryLog.db_id == db_id,
            QueryLog.user_id == user_id
        ).order_by(QueryLog.created_at.desc())
    )
    logs = result.scalars().all()
    return [
        {
            "question": log.question,
            "sql": log.sql_query,
            "result": log.result_json or [],
            "columns": log.columns_json or [],
            "error": log.error,
            "attempts": log.attempts,
            "execution_time_ms": log.execution_time_ms,
            "trace": log.trace_json or [],
        }
        for log in logs
    ]

@app.get("/schema")
async def get_schema(
    db_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user),
):
    if not db_id:
        return {"db_id": "default", "db_name": "default", "tables": []}
        
    user_id = get_user_id(user)
    conn = await _get_owned_connection(db_id, user_id, db)

    tables = conn.tables_json
    if not tables:
        db_uri = f'{os.environ["METADATA_DATABASE_URL"]}|schema=csv_data|tables={conn.table_name}'
        tables = await get_schema_structured(db_uri=db_uri)
        
        # Enrich dynamic fallback schemas with friendly name and row count
        for t in tables:
            if t["table_name"] == conn.table_name:
                display_name = conn.name
                if " - " in display_name:
                    display_name = display_name.split(" - ", 1)[1]
                elif display_name.endswith(".csv"):
                    display_name = display_name[:-4]
                t["display_name"] = display_name
                
                try:
                    async with async_engine.connect() as engine_conn:
                        count_res = await engine_conn.execute(text(f'SELECT count(*) FROM csv_data."{conn.table_name}"'))
                        t["row_count"] = count_res.scalar() or 0
                except Exception as ce:
                    logger.error("Failed to count fallback rows: %s", ce)
                    t["row_count"] = 0
            else:
                t["display_name"] = t["table_name"]
                t["row_count"] = 0
                
        conn.tables_json = tables
        await db.commit()
    else:
        # Check if table schema is missing display_name or row_count, enrich on the fly
        dirty = False
        for t in tables:
            if "display_name" not in t or "row_count" not in t or t.get("row_count") is None:
                dirty = True
                if t["table_name"] == conn.table_name:
                    display_name = conn.name
                    if " - " in display_name:
                        display_name = display_name.split(" - ", 1)[1]
                    elif display_name.endswith(".csv"):
                        display_name = display_name[:-4]
                    t["display_name"] = display_name
                    
                    try:
                        async with async_engine.connect() as engine_conn:
                            count_res = await engine_conn.execute(text(f'SELECT count(*) FROM csv_data."{conn.table_name}"'))
                            t["row_count"] = count_res.scalar() or 0
                    except Exception as ce:
                        logger.error("Failed to count fallback rows: %s", ce)
                        t["row_count"] = 0
                else:
                    t["display_name"] = t["table_name"]
                    t["row_count"] = 0
        if dirty:
            import copy
            conn.tables_json = copy.deepcopy(tables)
            await db.commit()
        
    return {
        "db_id": conn.db_id,
        "db_name": conn.name,
        "tables": tables
    }


# ---------------------------------------------------------------------------
# Business-Facing Settings & Insights Endpoints
# ---------------------------------------------------------------------------

@app.get("/settings/preview")
async def get_settings_preview(
    db_id: str = Query(...),
    custom_instruction: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user)
):
    """Retrieve full assembled instructions preview and database schema contexts."""
    user_id = get_user_id(user)
    conn = await _get_owned_connection(db_id, user_id, db)
    
    # Get all active tables owned by this user to construct db_uri
    user_conns_res = await db.execute(
        select(DatabaseConnection.table_name).where(
            DatabaseConnection.user_id == user_id,
            DatabaseConnection.is_deleted == False
        )
    )
    owned_tables = [r[0] for r in user_conns_res.all() if r[0]]
    db_uri = f'{os.environ["METADATA_DATABASE_URL"]}|schema=csv_data|tables={",".join(owned_tables)}'

    try:
        # Get structured schema info
        schemas = await get_schema_structured(db_uri)
        schema_lines = []
        for schema_info in schemas:
            table_name = schema_info["table_name"]
            schema_lines.append(f"Table: csv_data.\"{table_name}\"")
            for col in schema_info["columns"]:
                schema_lines.append(f"  - {col['name']} ({col['type']})")
        schema_text = "\n".join(schema_lines)
        
        sample_rows = await get_sample_rows_async(db_uri, limit=3)
        
        sql_dialect = "PostgreSQL"
        base = custom_instruction if custom_instruction else DEFAULT_SYSTEM_INSTRUCTION_BASE
        base_resolved = base.replace("{sql_dialect}", sql_dialect)
        
        full_prompt = (
            f"{base_resolved}\n\n"
            f"Database Schema:\n{schema_text}\n"
            f"Sample Data (for understanding value formats and casing):\n{sample_rows}"
        )
        
        return {
            "default_instruction_base": DEFAULT_SYSTEM_INSTRUCTION_BASE,
            "sql_dialect": sql_dialect,
            "schema_context": schema_text,
            "sample_rows_context": sample_rows,
            "full_system_instruction": full_prompt
        }
    except Exception as e:
        logger.error("Failed to construct settings preview: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to construct settings preview: {str(e)}")


@app.post("/insights")
async def get_insights(
    body: QueryRequest,
    db: AsyncSession = Depends(get_db_session),
    user: dict = Depends(get_current_user)
):
    """Generate high-level database insights using natural language analysis."""
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
        
    user_id = get_user_id(user)
    conn = await _get_owned_connection(body.db_id, user_id, db)
    
    # Get all active tables owned by this user
    user_conns_res = await db.execute(
        select(DatabaseConnection.table_name).where(
            DatabaseConnection.user_id == user_id,
            DatabaseConnection.is_deleted == False
        )
    )
    owned_tables = [r[0] for r in user_conns_res.all() if r[0]]
    db_uri = f'{os.environ["METADATA_DATABASE_URL"]}|schema=csv_data|tables={",".join(owned_tables)}'

    try:
        active_model = body.model_name if body.model_name else body.model
        insight = await generate_database_insight_async(body.question, db_uri, model_name=active_model)
        return {"insight": insight}
    except Exception as e:
        logger.error("Failed to generate insights: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Business-Facing Accuracy Evaluation Suite Endpoints (Multi-Tenant)
# ---------------------------------------------------------------------------

# Multi-tenant evaluation state mapping: user_id -> state dict


