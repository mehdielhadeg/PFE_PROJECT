# Microservices + Django Orchestrator

This setup keeps your existing microservices and places Django as the only orchestrator between Streamlit and services.

## Architecture

- `services/ingestion_service`: document storage + text ingestion
- `services/indexing_service`: vector index + hybrid retrieval + reranking
- `services/llm_service`: answer generation from retrieved context
- `orchestrator_backend`: Django API with auth/roles and orchestration logic
- `services/frontend_service`: Streamlit UI that talks only to Django API

## Roles

- `admin`: upload documents, list documents, delete documents, chat
- `employee`: list documents, chat

## 1) Start microservices (from `microservices/services`)

```bash
uvicorn ingestion_service.app.main:app --reload --port 8001
uvicorn indexing_service.app.main:app --reload --port 8002
uvicorn llm_service.app.main:app --reload --port 8003
```

## 2) Start Django orchestrator (from `microservices/orchestrator_backend`)

Install backend deps:

```bash
pip install -r requirements.txt
```

Apply database migrations (SQLite):

```bash
python manage.py migrate
```

Create default roles/users:

```bash
python manage.py bootstrap_roles
```

Run backend:

```bash
python manage.py runserver 0.0.0.0:9000
```

Default users created by bootstrap command:

- Admin: `admin` / `admin1234`
- Employee: `employee` / `employee1234`

## 3) Run Streamlit frontend (from `microservices/services`)

```bash
set DJANGO_BACKEND_URL=http://localhost:9000
streamlit run frontend_service/app/main.py --server.port 8501
```

## API flow

Streamlit never calls microservices directly.

All operations go through Django `/api/*` endpoints:

- `/api/auth/login/admin`
- `/api/auth/login/employee`
- `/api/chat`
- `/api/documents`
- `/api/documents/signed-url`
- `/api/documents/upload` (admin only)
- `/api/documents/<filename>` DELETE (admin only)

## 4) Run React frontend (optional)

From `microservices/frontend_react`:

```bash
copy .env.example .env
npm install
npm run dev
```

Default URL: `http://localhost:5173`

React frontend also talks only to Django `/api/*` endpoints.

## React login routes

- Employee login: `/login/employee` (default)
- Admin login: `/login/admin`

If frontend shows `Failed to fetch`, ensure Django backend is running on port `9000` and CORS dependency is installed:

```bash
cd orchestrator_backend
pip install -r requirements.txt
python manage.py runserver 0.0.0.0:9000
```

## Conversation persistence (Supabase)

Django now persists each authenticated user's conversation to Supabase.

Create this table in Supabase SQL editor:

```sql
create table if not exists conversation_sessions (
  user_id text primary key,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
```

Set backend env values in `orchestrator_backend/.env`:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
SUPABASE_CONVERSATIONS_TABLE=conversation_sessions
```

API endpoints:

- `GET /api/conversations/current`
- `PUT /api/conversations/current`
- `DELETE /api/conversations/current`

## Move Django data from SQLite to Supabase Postgres (one-time)

Goal: use Supabase Postgres as your only Django database (users, roles, tokens, sessions, etc.).

### 1) Configure DB env in `orchestrator_backend/.env`

Use one variable only:

```env
# Leave empty for SQLite, or set to Supabase Postgres URL
DATABASE_URL=postgresql://postgres.xxxxxxxxxxxxx:your_password%40with_special@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require
```

Important:
- If your password contains `@`, `:`, `/`, `?`, `#`, encode it in URL format.
- Example: `mehdi@supabase` must be `mehdi%40supabase`.

### 2) Install backend dependencies

```bash
cd orchestrator_backend
pip install -r requirements.txt
```

### 3) Export current SQLite data

Before switching DB in running process, export from current SQLite state:

```bash
python manage.py dumpdata --exclude contenttypes --exclude auth.permission --indent 2 > sqlite_data.json
```

### 4) Migrate schema on Supabase Postgres

Make sure `.env` has `DATABASE_URL=...`, then:

```bash
python manage.py migrate
```

### 5) Import old data into Supabase Postgres

```bash
python manage.py loaddata sqlite_data.json
```

### 6) Start backend normally

```bash
python manage.py runserver 0.0.0.0:9000
```

After validation, you can archive/remove local `db.sqlite3`.

## Docker (full stack)

From `microservices` root:

```bash
docker compose up --build
```

Services exposed:
- Ingestion: http://localhost:8001
- Indexing: http://localhost:8002
- LLM: http://localhost:8003
- Django: http://localhost:9000
- Streamlit: http://localhost:8501
- React: http://localhost:5173
