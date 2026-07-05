"""
backend/db_models.py

Production-grade async SQLAlchemy models for Supabase PostgreSQL (Clerk Auth compatible).
"""

import os
import uuid
import datetime

from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)
from sqlalchemy.orm import declarative_base
from sqlalchemy import (
    Column,
    String,
    Integer,
    Text,
    DateTime,
    Boolean,
    ForeignKey,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB

from dotenv import load_dotenv
load_dotenv()

# ---------------------------------------------------------------------------
# Engine Configuration
# ---------------------------------------------------------------------------

_RAW_URL = os.getenv("METADATA_DATABASE_URL", "")

if not _RAW_URL or "[PASSWORD]" in _RAW_URL:
    # Use a valid format dummy postgres URL so imports don't fail during testing
    _RAW_URL = "postgresql://postgres:postgres@localhost:5432/postgres"

# Normalize the scheme to postgresql+asyncpg
if _RAW_URL.startswith("postgres://"):
    DATABASE_URL = _RAW_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif _RAW_URL.startswith("postgresql://"):
    DATABASE_URL = _RAW_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    DATABASE_URL = _RAW_URL

# Remove sslmode parameter since asyncpg doesn't support it in connection strings (we pass ssl="require" in connect_args)
if "sslmode=" in DATABASE_URL:
    import re
    DATABASE_URL = re.sub(r'[?&]sslmode=[^&]+', '', DATABASE_URL)
    if DATABASE_URL.endswith("?"):
        DATABASE_URL = DATABASE_URL[:-1]


async_engine = create_async_engine(
    DATABASE_URL,
    pool_pre_ping=True,

    # Keep pool small; PgBouncer (port 6543) manages the real
    # connection pool on Supabase's side.
    pool_size=5,
    max_overflow=10,
    pool_recycle=300,

    connect_args={
        # CRITICAL: asyncpg caches prepared statements by default.
        # PgBouncer in transaction-pooling mode (port 6543) does NOT support
        # them. Setting statement_cache_size=0 disables caching entirely and
        # prevents the runtime crash.
        "statement_cache_size": 0,

        # Supabase requires SSL on all connections.
        "ssl": "require",
    },
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class DatabaseConnection(Base):
    """
    Stores one record per CSV dataset the user has uploaded.
    Represents metadata about the user's datasets.
    """
    __tablename__ = "db_connections"

    db_id = Column(
        String(50),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        index=True,
    )

    # String user_id for Clerk compatibility (format e.g. "user_...")
    user_id = Column(String(100), nullable=False, index=True)

    name = Column(String(100), nullable=False)
    db_type = Column(String(20), nullable=False, default="csv")  # always "csv"

    schema_name = Column(String(100), nullable=False, default="csv_data")  # always "csv_data"
    table_name = Column(String(100), nullable=True)  # clean hyphenless table name, e.g. "upload_abc123"
    tables_json = Column(JSONB, nullable=True)          # cached schema representation
    is_deleted = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class QueryLog(Base):
    """
    Immutable execution record written after every query run.
    Uses flat foreign key attributes instead of complex ORM relationships.
    """
    __tablename__ = "query_logs"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)

    # Cascade deletes to prevent orphaned logs
    db_id = Column(
        String(50),
        ForeignKey("db_connections.db_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    user_id = Column(String(100), nullable=False, index=True)

    question = Column(Text, nullable=False)
    sql_query = Column(Text, nullable=True)

    result_json = Column(JSONB, nullable=True)   # rows returned by the query
    columns_json = Column(JSONB, nullable=True)  # column header metadata
    trace_json = Column(JSONB, nullable=True)    # self-healing step log

    attempts = Column(Integer, default=1)
    execution_time_ms = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ---------------------------------------------------------------------------
# Session Dependency
# ---------------------------------------------------------------------------

async def get_db_session():
    """
    FastAPI dependency that yields a scoped AsyncSession.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Table Initializer (dev / CI only)
# ---------------------------------------------------------------------------

async def init_metadata_db():
    """
    Creates schemas and tables that do not yet exist. Safe to call on startup.
    """
    async with async_engine.begin() as conn:
        # Create target schema for dynamic CSV uploads
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS csv_data"))
        # Create tables
        await conn.run_sync(Base.metadata.create_all)
