"""
backend/text_to_sql.py

Text-to-SQL logic using Google Gemini API, including schema extraction,
raw query execution, and an agentic self-healing error correction loop.
"""

import os
import re
import time
import random
import logging
import datetime
from decimal import Decimal
from typing import Any, Optional

import google.generativeai as genai
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helper: Parse db_uri
# ---------------------------------------------------------------------------

def parse_db_uri(db_uri: str) -> tuple[str, str, list[str]]:
    """
    Parses a combined URI containing connection info and metadata.
    Format: postgresql://...|schema=csv_data|tables=table1,table2
    Returns: (clean_db_url, schema_name, table_names)
    """
    parts = db_uri.split("|")
    base_url = parts[0]
    schema = "csv_data"
    tables = []

    for part in parts[1:]:
        if part.startswith("schema="):
            schema = part.split("=")[1]
        elif part.startswith("tables="):
            tables_str = part.split("=")[1]
            tables = [t.strip() for t in tables_str.split(",") if t.strip()]

    # Normalize driver to asyncpg if needed
    if base_url.startswith("postgres://"):
        base_url = base_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif base_url.startswith("postgresql://"):
        base_url = base_url.replace("postgresql://", "postgresql+asyncpg://", 1)

    # Remove sslmode parameter since asyncpg doesn't support it in connection strings
    if "sslmode=" in base_url:
        base_url = re.sub(r'[?&]sslmode=[^&]+', '', base_url)

    return base_url, schema, tables


def get_sync_db_url(async_url: str) -> str:
    """
    Convert postgresql+asyncpg:// to postgresql:// for synchronous operations.
    """
    if async_url.startswith("postgresql+asyncpg://"):
        return async_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    return async_url

# ---------------------------------------------------------------------------
# API Key Rotation Helper
# ---------------------------------------------------------------------------

def generate_content_with_failover(
    model_name: str,
    system_instruction: str,
    generation_config: dict,
    prompt: str
) -> str:
    """
    Shuffles API keys and attempts to generate content, failing over if key limits are hit.
    """
    raw_keys = os.getenv("GEMINI_API_KEYS", "") or os.getenv("GEMINI_API_KEY", "")
    keys = [k.strip() for k in raw_keys.split(",") if k.strip()]
    if not keys:
        raise ValueError("GEMINI_API_KEYS is not set or empty in environment.")

    # Shuffle the keys list to randomize order on each execution call
    shuffled_keys = list(keys)
    random.shuffle(shuffled_keys)

    last_exc = None
    for idx, key in enumerate(shuffled_keys):
        try:
            # Globally configure the selected API key
            genai.configure(api_key=key)
            
            # Re-instantiate the model to use the newly configured key
            model = genai.GenerativeModel(
                model_name=model_name,
                generation_config=generation_config,
                system_instruction=system_instruction
            )
            
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            logger.warning("Gemini key index %d failed: %s. Trying next key...", idx, e)
            last_exc = e

    # If all keys failed
    raise last_exc or ValueError("All Gemini keys failed.")

# ---------------------------------------------------------------------------
# Schema Retrieval
# ---------------------------------------------------------------------------

async def get_schema_structured(db_uri: str) -> list[dict[str, Any]]:
    """
    Queries information_schema to extract structured columns and types.
    """
    base_url, schema, tables = parse_db_uri(db_uri)
    if not tables:
        return []

    # Using asyncpg via create_async_engine
    engine = create_async_engine(
        base_url,
        connect_args={
            "statement_cache_size": 0,
            "ssl": "require",
        }
    )

    query = text("""
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = :schema AND table_name = ANY(:tables)
        ORDER BY table_name, ordinal_position;
    """)

    schema_map = {}
    try:
        async with engine.connect() as conn:
            # table = ANY(:tables) accepts a list for PostgreSQL array mapping
            result = await conn.execute(query, {"schema": schema, "tables": list(tables)})
            rows = result.fetchall()
            
            for row in rows:
                t_name, c_name, d_type = row[0], row[1], row[2]
                if t_name not in schema_map:
                    schema_map[t_name] = []
                schema_map[t_name].append({"name": c_name, "type": d_type})
    except Exception as e:
        logger.error("Error retrieving schema from database: %s", e)
        # Fallback empty schemas
        for t in tables:
            schema_map[t] = []
    finally:
        await engine.dispose()

    return [
        {"table_name": t_name, "columns": cols}
        for t_name, cols in schema_map.items()
    ]

# ---------------------------------------------------------------------------
# Query Execution Helpers
# ---------------------------------------------------------------------------

def serialize_row_data(val: Any) -> Any:
    """
    Converts database types to JSON serializable formats.
    """
    if isinstance(val, (datetime.datetime, datetime.date, datetime.time)):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, (bytes, bytearray)):
        return val.decode("utf-8", errors="ignore")
    return val


async def run_raw_sql(sql_query: str, db_path: str) -> dict[str, Any]:
    """
    Runs a read-only SQL query against the database and formats the results.
    """
    base_url, _, _ = parse_db_uri(db_path)
    engine = create_async_engine(
        base_url,
        connect_args={
            "statement_cache_size": 0,
            "ssl": "require",
        }
    )

    try:
        async with engine.connect() as conn:
            # Set statements timeout to prevent infinite hangs
            await conn.execute(text("SET statement_timeout = 10000;")) # 10 seconds timeout
            result = await conn.execute(text(sql_query))
            
            # If the query returns rows (like a SELECT statement)
            if result.returns_rows:
                columns = list(result.keys())
                rows = result.fetchall()
                serialized_rows = []
                for row in rows:
                    row_dict = {}
                    for col, val in zip(columns, row):
                        row_dict[col] = serialize_row_data(val)
                    serialized_rows.append(row_dict)
                return {
                    "result": serialized_rows,
                    "columns": columns,
                    "error": None
                }
            else:
                return {
                    "result": [],
                    "columns": [],
                    "error": "Query executed successfully but returned no rows."
                }
    except Exception as e:
        logger.warning("SQL execution failed: %s", e)
        return {
            "result": None,
            "columns": [],
            "error": str(e)
        }
    finally:
        await engine.dispose()

# ---------------------------------------------------------------------------
# Text-to-SQL LLM Loop & Self-Healing
# ---------------------------------------------------------------------------

def clean_generated_sql(sql: str) -> str:
    """
    Extracts raw SQL from Markdown formatting (e.g. ```sql ... ```).
    """
    sql = sql.strip()
    match = re.search(r"```sql\s*(.*?)\s*```", sql, re.DOTALL | re.IGNORECASE)
    if match:
        sql = match.group(1)
    else:
        # Strip generic markdown block if model didn't specify sql language
        match_generic = re.search(r"```\s*(.*?)\s*```", sql, re.DOTALL)
        if match_generic:
            sql = match_generic.group(1)
    
    # Strip trailing/leading whitespace and semicolon
    sql = sql.strip().rstrip(";")
    return sql


def build_system_prompt(schema_str: str, custom_instruction: str = "") -> str:
    return f"""You are an expert PostgreSQL Text-to-SQL agent.
Your goal is to translate a user's natural language question into a single syntactically correct PostgreSQL SELECT query.

You must strictly adhere to the following rules:
1. ONLY write read-only SELECT queries. Do not write INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, etc.
2. Tables are stored inside the schema 'csv_data'. All tables and references MUST be fully qualified using the schema, e.g. csv_data."table_name".
3. Use double quotes around table names and column names if they contain special characters, uppercase, or are PostgreSQL keywords.
4. Output ONLY the raw SQL query. Do not wrap it in explanations or any extra conversational text.
5. If you must use CTEs (WITH clause), ensure it's structured properly in PostgreSQL syntax.
6. If joins are required, join the tables using their matching keys.

DATABASE SCHEMA:
{schema_str}

{custom_instruction}
"""


async def run_text_to_sql(
    question: str,
    db_path: str,
    model_name: str = "gemini-2.5-flash",
    temperature: float = 0.0,
    custom_system_instruction: str = "",
) -> dict[str, Any]:
    """
    Generates PostgreSQL query, executes it, and heals errors via a re-prompting loop.
    """
    start_time = time.time()
    
    # 1. Fetch live schema info
    schemas = await get_schema_structured(db_path)
    if not schemas:
        return {
            "sql": None,
            "result": None,
            "columns": [],
            "error": "No tables or schemas configured for querying.",
            "attempts": 0,
            "execution_time_ms": int((time.time() - start_time) * 1000),
            "trace": [{"step": "initialization", "status": "error", "message": "No schemas loaded."}]
        }

    # Format schema for prompt
    schema_lines = []
    for schema_info in schemas:
        table_name = schema_info["table_name"]
        schema_lines.append(f"Table: csv_data.\"{table_name}\"")
        for col in schema_info["columns"]:
            schema_lines.append(f"  - {col['name']} ({col['type']})")
    schema_str = "\n".join(schema_lines)

    # 2. Model configuration
    generation_config = {
        "temperature": temperature,
        "top_p": 0.95,
        "max_output_tokens": 1024,
    }
    
    system_instruction = build_system_prompt(schema_str, custom_instruction=custom_system_instruction)
    
    # Self-healing loop parameters
    max_attempts = 3
    attempts = 0
    trace = []
    
    # 2. Add schema mapping step
    trace.append({
        "step": "schema",
        "status": "success",
        "message": f"Mapped database schema with {len(schemas)} table(s)."
    })
    
    current_prompt = f"Translate this question to SQL: {question}"

    last_generated_sql = ""
    last_error = ""

    while attempts < max_attempts:
        attempts += 1
        
        # Generation step
        gen_trace = {
            "step": "generation",
            "attempt": attempts,
            "status": "running",
            "message": f"Synthesizing SQL query (Attempt {attempts}/{max_attempts})..."
        }
        
        try:
            # Generate SQL with key-shuffle failover
            generated_text = generate_content_with_failover(
                model_name=model_name,
                system_instruction=system_instruction,
                generation_config=generation_config,
                prompt=current_prompt
            )
            sql_query = clean_generated_sql(generated_text)
            last_generated_sql = sql_query
            gen_trace["status"] = "success"
            gen_trace["message"] = "SQL synthesis complete."
            gen_trace["sql"] = sql_query
            trace.append(gen_trace)
            
            logger.info("Attempt %d generated SQL: %s", attempts, sql_query)
        except Exception as e:
            last_error = f"Gemini API generation failed: {str(e)}"
            gen_trace["status"] = "error"
            gen_trace["message"] = last_error
            trace.append(gen_trace)
            continue

        # Dry-run execution step
        exec_trace = {
            "step": "execution",
            "status": "running",
            "message": "Running query on target database..."
        }
        
        exec_res = await run_raw_sql(sql_query, db_path)
        
        if exec_res["error"] is None:
            # Success!
            exec_trace["status"] = "success"
            exec_trace["message"] = f"Query executed successfully. Returned {len(exec_res['result'])} rows."
            trace.append(exec_trace)
            
            execution_time_ms = int((time.time() - start_time) * 1000)
            return {
                "sql": sql_query,
                "result": exec_res["result"],
                "columns": exec_res["columns"],
                "error": None,
                "attempts": attempts,
                "execution_time_ms": execution_time_ms,
                "trace": trace
            }
        else:
            # DB Error occurred - feedback loop
            last_error = exec_res["error"]
            exec_trace["status"] = "error"
            exec_trace["message"] = f"Execution failed: {last_error}"
            trace.append(exec_trace)
            
            # Formulate healing prompt
            current_prompt = f"""The SQL query you generated failed with a database error:
SQL generated: {sql_query}
Database Error message: {last_error}

Please identify the bug (e.g. syntax, typo, column namespace, invalid cast) and rewrite the SQL query. Output ONLY the raw SQL query.
"""

    # If we exited the loop without success
    execution_time_ms = int((time.time() - start_time) * 1000)
    return {
        "sql": last_generated_sql,
        "result": None,
        "columns": [],
        "error": f"Failed after {max_attempts} attempts. Last error: {last_error}",
        "attempts": attempts,
        "execution_time_ms": execution_time_ms,
        "trace": trace
    }


# ---------------------------------------------------------------------------
# Default Instruction Base and Additional Business Insights helpers
# ---------------------------------------------------------------------------

DEFAULT_SYSTEM_INSTRUCTION_BASE = """You are an expert {sql_dialect} Text-to-SQL agent.
Your goal is to translate a user's natural language question into a single syntactically correct {sql_dialect} SELECT query.

You must strictly adhere to the following rules:
1. ONLY write read-only SELECT queries. Do not write INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, etc.
2. Tables are stored inside the schema 'csv_data'. All tables and references MUST be fully qualified using the schema, e.g. csv_data."table_name".
3. Use double quotes around table names and column names if they contain special characters, uppercase, or are PostgreSQL keywords.
4. Output ONLY the raw SQL query. Do not wrap it in explanations or any extra conversational text.
5. If you must use CTEs (WITH clause), ensure it's structured properly in PostgreSQL syntax.
6. If joins are required, join the tables using their matching keys.
"""

async def get_sample_rows_async(db_path: str, limit: int = 3) -> str:
    base_url, schema, tables = parse_db_uri(db_path)
    if not tables:
        return "No sample data available."
        
    engine = create_async_engine(
        base_url,
        connect_args={
            "statement_cache_size": 0,
            "ssl": "require",
        }
    )
    
    sample_lines = []
    try:
        async with engine.connect() as conn:
            for table in tables:
                query = text(f'SELECT * FROM "{schema}"."{table}" LIMIT :limit')
                res = await conn.execute(query, {"limit": limit})
                columns = list(res.keys())
                rows = res.fetchall()
                sample_lines.append(f"Table: {schema}.\"{table}\"")
                sample_lines.append("Columns: " + ", ".join(columns))
                if rows:
                    for i, row in enumerate(rows):
                        serialized_row = [str(serialize_row_data(val)) for val in row]
                        sample_lines.append(f"Row {i+1}: " + ", ".join(serialized_row))
                else:
                    sample_lines.append("No rows in this table.")
                sample_lines.append("")
    except Exception as e:
        logger.error("Error retrieving sample rows: %s", e)
        return f"Error retrieving sample rows: {str(e)}"
    finally:
        await engine.dispose()
        
    return "\n".join(sample_lines)


async def generate_database_insight_async(
    question: str,
    db_path: str,
    model_name: str = "gemini-2.5-flash",
) -> str:
    # 1. Fetch live schema info
    schemas = await get_schema_structured(db_path)
    if not schemas:
        return "No database schema loaded to generate insights."

    # Format schema for prompt
    schema_lines = []
    for schema_info in schemas:
        table_name = schema_info["table_name"]
        schema_lines.append(f"Table: csv_data.\"{table_name}\"")
        for col in schema_info["columns"]:
            schema_lines.append(f"  - {col['name']} ({col['type']})")
    schema_str = "\n".join(schema_lines)

    # 2. Get sample rows
    sample_rows = await get_sample_rows_async(db_path, limit=3)

    # 3. Call Gemini to provide insights
    prompt = f"""You are a senior business intelligence and database analyst.
A business user has uploaded one or more CSV files into a SQL database as tables.
They have asked for insights about this database connection, or asked a question about it:
User Question: "{question}"

Here is the Database Schema:
{schema_str}

Here is a sample of the data:
{sample_rows}

Please analyze the schema and data samples and provide a highly detailed, professional, and structured database analysis report.
Structure your response exactly as follows:

# Database Insight Report

## Executive Summary & Domain Context
Provide a detailed paragraph classifying the business domain(s) represented by this dataset (e.g. E-commerce Sales, CRM, Operations, Marketing Analytics, Product Usage). Explain the overall business value of this data and what kinds of operational or strategic decisions it can support.

## Schema & Data Profile
Provide a detailed breakdown of the available tables. For each table, use a markdown table matching this format:
| Column | Data Type | Analytical Role | Description / Business Meaning |
|---|---|---|---|
| `column_name` | type | Metric / Dimension / Key | Inferred business meaning and purpose of this field based on sample data. |

## Inferred Relationships & Join Graph
Analyze how tables relate to one another logically. Explain the inferred primary and foreign keys (e.g., column connections like `customer_id` or `id`) and detail exactly how a user should link the tables (e.g., "Join `orders` and `customers` using `customer_id`") to query related data across tables.

## Key Metrics & Analytical Dimensions
- **Key Metrics (KPIs)**: List specific numbers, sums, ratios, or averages that can be computed from the columns (e.g., Total Revenue, Average Sales Price, Active User Count, Conversion Rate).
- **Analytical Dimensions**: List the categorizations, attributes, or time periods that can be used to group and filter the metrics (e.g., Region, Product Category, Order Date, Customer Status).
- **Analysis Combinations**: Give 2-3 examples of how combining metrics and dimensions yields business value (e.g., "Calculating Total Revenue segmented by Product Category to see top product segments").

## Recommended Questions for Text-to-SQL
Provide exactly 6 practical, high-value questions that the user can ask the Text-to-SQL console to generate reports. Categorize them into the following levels:

### Quick Insights (Basic)
1. *[Question 1]* - Explain why this question is valuable (e.g. to quickly establish a baseline or check basic volume).
2. *[Question 2]* - Explain why this question is valuable.

### Segment Analysis (Intermediate)
3. *[Question 3]* - Explain why this question is valuable (e.g. to compare performance across groups or track monthly changes).
4. *[Question 4]* - Explain why this question is valuable.

### Deep Insights (Advanced)
5. *[Question 5]* - Explain why this question is valuable (e.g. to perform multi-table joins, subqueries, or calculate percentages / growth rates).
6. *[Question 6]* - Explain why this question is valuable.

---
**Markdown Formatting Guidelines**:
- Use `#` only for the main report title.
- Use `##` for major sections.
- Use `###` for subheadings (rendered in uppercase accent styling in the UI).
- Use standard markdown lists (`- ` or `* `) and sublists for details.
- Use standard markdown tables with a separator line `|---|---|` for table profiles.
- Use backticks (`` ` ``) for all table names, column names, or queries.
- Tailor the terminology for business stakeholders (avoid excessive technical database jargon where possible).
"""

    generation_config = {
        "temperature": 0.2,
        "top_p": 0.95,
        "max_output_tokens": 2048,
    }

    try:
        insight = generate_content_with_failover(
            model_name=model_name,
            system_instruction="You are a senior database administrator, analytics engineer, and business intelligence analyst.",
            generation_config=generation_config,
            prompt=prompt
        )
        return insight
    except Exception as e:
        logger.error("Failed to generate database insight: %s", e)
        return f"Failed to generate database insight: {str(e)}"
