# Deployment Guide — Birthday Tracker

Complete step-by-step guide for deploying from scratch. Everything is free.

---

## Architecture

| Layer    | Service              | Cost |
|----------|----------------------|------|
| Frontend | GitHub Pages         | Free |
| Backend  | Render (Web Service) | Free |
| Database | Supabase (PostgreSQL)| Free |

---

## Step 1 — Create the database on Supabase

1. Go to [supabase.com](https://supabase.com) and sign up (GitHub login is fastest).
2. Click **New Project**. Choose a name (e.g. `birthday-tracker`), set a strong database password, pick a region close to your team.
3. Wait ~2 minutes for the project to provision.
4. Go to **Project Settings → Database → Connection string → URI**.
5. Copy the connection string — it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
6. **Save this string** — you'll paste it into Render in the next step.

> The schema (table) is created automatically when the backend first starts. No manual SQL needed.

---

## Step 2 — Deploy the backend on Render

1. Go to [render.com](https://render.com) and sign up (GitHub login is fastest).
2. Click **New → Web Service**.
3. Connect your GitHub account and select the `birthday-tracker` repository.
4. Render will detect `render.yaml` automatically. Accept the suggested settings:
   - **Name**: `birthday-tracker-api`
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 30`
   - **Plan**: Free
5. Before clicking **Create Web Service**, scroll down to **Environment Variables** and add:
   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | (paste the Supabase connection string from Step 1) |
   | `FRONTEND_URL` | `https://raghavi18.github.io` |
6. Click **Create Web Service**.
7. Render will build and deploy. Wait ~3 minutes for the first deploy to finish.
8. Once live, note your backend URL — it will be something like:
   ```
   https://birthday-tracker-api.onrender.com
   ```

### Verify the backend is working

Open this URL in your browser — you should see JSON:
```
https://birthday-tracker-api.onrender.com/api/health
```
Expected response: `{"status": "ok", "db": "postgresql", ...}`

---

## Step 3 — Update the frontend config (if needed)

Open [docs/js/config.js](docs/js/config.js). The production URL is already set to:
```
https://birthday-api-skh3.onrender.com
```

If your Render service URL is **different** from this, update the `return` line in `config.js`:
```js
return "https://YOUR-ACTUAL-RENDER-URL.onrender.com";
```
Commit and push the change.

---

## Step 4 — Enable GitHub Pages

1. Go to your repository on GitHub: `https://github.com/raghavi18/birthday-tracker`
2. Click **Settings → Pages** (left sidebar).
3. Under **Source**, select:
   - **Deploy from a branch**
   - Branch: `main`
   - Folder: `/docs`
4. Click **Save**.
5. GitHub will build and publish the site. It usually takes 1–2 minutes.
6. Your live frontend URL will be:
   ```
   https://raghavi18.github.io/birthday-tracker/
   ```

---

## Step 5 — Smoke test

Once both services are live, run through this checklist:

- [ ] Frontend loads: `https://raghavi18.github.io/birthday-tracker/`
- [ ] Backend health: `https://YOUR-RENDER-URL.onrender.com/api/health` → `{"status":"ok","db":"postgresql"}`
- [ ] Add a member via the Members page → confirm it appears in the table
- [ ] Refresh the page → member is still there (confirms DB persistence)
- [ ] Navigate directly to `https://raghavi18.github.io/birthday-tracker/calendar.html` → page loads
- [ ] Dashboard shows correct date
- [ ] Export CSV → file downloads with real data
- [ ] Export Excel → file downloads with real data

---

## Subsequent deploys

**Backend**: Push to `main`. Render auto-deploys on every push (if Auto-Deploy is enabled in Render settings — it is by default).

**Frontend**: Push to `main`. GitHub Pages re-publishes automatically.

No manual steps needed after the initial setup.

---

## Free tier limits

| Service | Limit | Impact |
|---------|-------|--------|
| Render free web service | Spins down after 15 min of inactivity; first request after sleep takes ~30s | First page load after idle period will be slow; subsequent loads are fast |
| Supabase free tier | 500 MB database, 2 GB bandwidth/month, unlimited rows | More than enough for a team directory |
| GitHub Pages | 1 GB storage, 100 GB bandwidth/month | No realistic limit for this app |

### Render cold-start tip

The free tier web service sleeps after 15 minutes of no traffic. To keep it warm, you can use a free uptime monitor (e.g. [UptimeRobot](https://uptimerobot.com)) to ping `/api/health` every 10 minutes. This keeps the service awake during business hours with zero cost.

---

## Environment variables reference

| Variable | Where set | Description |
|----------|-----------|-------------|
| `DATABASE_URL` | Render dashboard | PostgreSQL connection string from Supabase (or any PG provider) |
| `FRONTEND_URL` | Render dashboard / `render.yaml` | GitHub Pages origin for CORS. Default: `https://raghavi18.github.io` |
| `PORT` | Set by Render automatically | Port gunicorn binds to. Do not override. |
| `DB_PATH` | Optional, local dev only | Path to SQLite file (used when `DATABASE_URL` is not set) |
| `BACKUP_DIR` | Optional, local dev only | Path to JSON backup directory (SQLite mode only) |

---

## Restoring data (disaster recovery)

With PostgreSQL on Supabase, your data is never lost across Render restarts or redeployments. Supabase itself handles replication and backups.

If you need to recover from a Supabase accidental deletion:
1. Go to your Supabase project → **Database → Backups**.
2. Restore from a point-in-time backup (available on free tier for last 7 days via support request).

---

## Local development

```bash
# Backend (uses SQLite by default — no DATABASE_URL needed)
cd backend
pip install -r requirements.txt
python app.py
# API is live on http://localhost:5050

# Frontend (open in a second terminal)
cd docs
python -m http.server 8000
# Open http://localhost:8000 in your browser
```

To develop against the production PostgreSQL database locally:
```bash
export DATABASE_URL="postgresql://postgres:..."
cd backend && python app.py
```
