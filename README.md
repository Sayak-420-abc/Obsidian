<div align="center">

# ◆ Obsidian

**AI-powered analytics console for your data.**

Upload a CSV. Ask a question in plain English. Get instant results.

[Live Demo](#) · [Documentation](frontend/src/app/docs/page.js) · [Report Bug](https://github.com/Sayak-420-abc/Obsidian/issues)

</div>

---

## What is Obsidian?

Obsidian is an open-source AI analytics console that lets anyone — business analysts, product managers, operations teams — query their data using natural language. No SQL knowledge required.

Upload a `.csv` spreadsheet or `.db` SQLite file, ask a question like *"What are the top 5 products by revenue?"*, and get back a formatted table with auto-generated charts. Behind the scenes, Obsidian uses Google's Gemini models to translate your question into safe, read-only SQL, automatically fixes query errors, and never modifies your data.

## Key Features

- **Natural Language Queries** — Ask questions in plain English, get SQL results instantly
- **CSV & SQLite Upload** — Drag-and-drop your data files with automatic encoding detection
- **Auto-Generated Charts** — Bar charts, line charts, and more rendered automatically from query results
- **Read-Only by Design** — Your data can never be modified, deleted, or corrupted through the console
- **Self-Healing Queries** — The AI automatically detects and fixes SQL errors in real-time retry loops
- **Live Agent Tracker** — Watch the AI think step-by-step as it processes your question
- **Schema Catalog** — Browse your table structures, column types, and row counts at a glance
- **Configurable AI** — Adjust model size, temperature, retry limits, and system prompts

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│  Landing Page · Dashboard · Docs · Clerk Authentication │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP API
┌──────────────────────▼──────────────────────────────────┐
│                   BACKEND (FastAPI)                      │
│                                                         │
│  CSV Upload ──► Schema Extraction ──► PostgreSQL Store   │
│                                                         │
│  User Question ──► Gemini AI ──► SQL Generation          │
│       ──► Safety Audit ──► Execution ──► Self-Healing    │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React, Tailwind CSS |
| Authentication | Clerk |
| Backend | Python, FastAPI, SQLAlchemy |
| AI Engine | Google Gemini (gemini-2.5-flash / gemini-2.5-pro) |
| Database | PostgreSQL (Supabase) for data storage, SQLite for local metadata |
| Charts | Recharts |

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **PostgreSQL** database (we recommend [Supabase](https://supabase.com) free tier)
- **Clerk** account for authentication ([clerk.com](https://clerk.com))
- **Google Gemini API key** ([ai.google.dev](https://ai.google.dev))

### 1. Clone the repository

```bash
git clone https://github.com/Sayak-420-abc/Obsidian.git
cd Obsidian
```

### 2. Set up the Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your actual credentials (see table below)

# Start the server
uvicorn main:app --reload --port 8000
```

### 3. Set up the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.local.example .env.local
# Edit .env.local with your actual credentials (see table below)

# Start the dev server
npm run dev
```

### 4. Open the app

Visit [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `METADATA_DATABASE_URL` | PostgreSQL connection string (Supabase pooler URL) |
| `CLERK_JWKS_URL` | Clerk JWKS endpoint for JWT verification |
| `GEMINI_API_KEYS` | Comma-separated Google Gemini API keys |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (starts with `pk_test_`) |
| `CLERK_SECRET_KEY` | Clerk secret key (starts with `sk_test_`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Sign-in route (default: `/sign-in`) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Sign-up route (default: `/sign-up`) |
| `NEXT_PUBLIC_API_URL` | Backend API URL (default: `http://localhost:8000`) |

## Project Structure

```
obsidian/
├── backend/
│   ├── main.py              # FastAPI application & route handlers
│   ├── text_to_sql.py       # Gemini-powered SQL generation engine
│   ├── db_models.py         # SQLAlchemy models & database utilities
│   ├── auth.py              # Clerk JWT authentication middleware
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Environment variable template
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.js          # Landing page
│   │   │   ├── dashboard/       # Main analytics console
│   │   │   └── docs/            # Documentation page
│   │   └── components/          # Reusable UI components
│   ├── package.json
│   └── .env.local.example       # Environment variable template
│
├── .gitignore
└── README.md
```

## License

This project is open source under the [MIT License](LICENSE).
