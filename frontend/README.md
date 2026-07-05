# Obsidian — Frontend

Next.js 16 dashboard application for the Obsidian analytics console. Provides the landing page, authentication flow, interactive query console, schema catalog, and documentation.

## Setup

### Prerequisites

- Node.js ≥ 18
- Clerk account ([clerk.com](https://clerk.com))

### Installation

```bash
npm install
```

### Environment Variables

Copy the example file and fill in your credentials:

```bash
cp .env.local.example .env.local
```

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (starts with `pk_test_`) |
| `CLERK_SECRET_KEY` | Clerk secret key (starts with `sk_test_`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Sign-in page route (default: `/sign-in`) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Sign-up page route (default: `/sign-up`) |
| `NEXT_PUBLIC_API_URL` | Backend API URL (default: `http://localhost:8000`) |

### Running

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Key Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with product overview |
| `/dashboard` | Main analytics console (query input, results, schema catalog, settings) |
| `/docs` | Product documentation |
| `/sign-in` | Clerk authentication page |
| `/sign-up` | Clerk registration page |

## Component Structure

| Component | Purpose |
|-----------|---------|
| `QueryInput` | Natural language question input with suggestion cards |
| `ResultsTable` | Interactive data grid for query results |
| `AutoCharts` | Automatic chart generation from query results |
| `SchemaDrawer` | Collapsible sidebar showing table schemas and column metadata |
| `DatabaseOverview` | AI-powered database insights panel |
| `AgentStatusTracker` | Real-time step-by-step AI progress display |
| `SettingsPanel` | Agent configuration (model, temperature, retries, system prompt) |
| `SqlCodeBlock` | Syntax-highlighted SQL display with copy functionality |
| `HistoryPanel` | Query history sidebar |
| `ErDiagram` | Entity-relationship diagram visualization |
| `ApiExporter` | Export query results and API configurations |
