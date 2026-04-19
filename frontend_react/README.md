# React Frontend (Django orchestrator only)

Modern interface built with Material UI + Markdown rendering.

Features:
- ChatGPT-like dark workspace layout
- Markdown rendering in assistant messages (`**bold**`, lists, line breaks, code)
- Role-based behavior (admin/employee)
- React calls only Django `/api/*`

## Setup

1. Configure environment:

```env
VITE_DJANGO_API_BASE=http://localhost:9000/api
```

2. Install and run:

```bash
npm install
npm run dev
```

Default URL: `http://localhost:5173`
