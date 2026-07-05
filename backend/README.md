# Obsidian — Backend

FastAPI server that powers the Obsidian analytics console. Handles CSV/SQLite file uploads, schema extraction, Gemini-powered SQL generation, safety auditing, and self-healing query execution.

## Setup

### Prerequisites

- Python ≥ 3.10
- PostgreSQL database ([Supabase](https://supabase.com) free tier recommended)
- Google Gemini API key
- Clerk account (for JWT authentication)

### Installation

```bash
# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

### Environment Variables

Copy the example file and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `METADATA_DATABASE_URL` | PostgreSQL connection string for storing user sessions and metadata |
| `CLERK_JWKS_URL` | Clerk JWKS endpoint URL for verifying JWT tokens |
| `GEMINI_API_KEYS` | Comma-separated list of Google Gemini API keys (supports key rotation) |

### Running

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload-db` | Upload a CSV or SQLite file for ingestion |
| `POST` | `/query` | Submit a natural language question for SQL generation and execution |
| `GET` | `/sessions` | List all database sessions for the authenticated user |
| `GET` | `/schema` | Retrieve table schema metadata for a specific database |
| `GET` | `/sessions/{db_id}/history` | Get query history for a database session |
| `GET` | `/settings/preview` | Preview the current agent configuration |
| `POST` | `/overview/question` | Ask a natural language question about database overview/insights |

## Key Files

| File | Purpose |
|------|---------|
| `main.py` | FastAPI application with all route handlers |
| `text_to_sql.py` | Gemini AI integration, schema grounding, SQL generation, and self-healing retry logic |
| `db_models.py` | SQLAlchemy models, PostgreSQL session management, and data upload utilities |
| `auth.py` | Clerk JWT token verification middleware |
| `requirements.txt` | Python package dependencies |
