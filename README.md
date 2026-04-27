# Team Birthday Tracker

A lightweight, multi-page web app for tracking team birthdays. Static frontend (vanilla HTML/CSS/JS) suitable for GitHub Pages, with a small Flask + SQLite backend deployable on any free-tier service like Render or Railway.

Built with a McKinsey-style consulting visual aesthetic: editorial typography, sharp lines, generous whitespace.

---

## Live URL

> Replace this section with your published URL once deployed:
> - Frontend: `https://YOUR-ORG.github.io/birthday-tracker/`
> - Backend:  `https://YOUR-BACKEND.onrender.com/`

---

## Features

- **Dashboard** — today's birthdays (with one-click pre-filled `mailto:` wishes) and a 7-day upcoming feed.
- **Calendar** — full month grid with chips on every dated cell, navigable across months/years.
- **Members** — add, edit, soft-delete, search and paginate. Email is the unique identifier.
- **Validation** — month-aware day picker, leap-day support (Feb 29 observed on Feb 28 in non-leap years), duplicate-email blocking, soft-warning when the same name + birthday recurs with a different email.
- **Export** — one-click CSV and Excel (.xlsx) downloads.
- **Auto-backup** — every write produces a timestamped JSON snapshot in `backend/backups/` plus a `latest.json` for quick recovery.

---

## Project Layout

```
birthday-tracker/
├── backend/
│   ├── app.py              # Flask app — routes, validation, SQLite, exports
│   ├── requirements.txt
│   ├── Procfile            # for Render/Railway
│   ├── birthdays.db        # SQLite (created on first run; gitignored)
│   └── backups/            # JSON snapshots (created on first write)
├── frontend/
│   ├── index.html          # Dashboard
│   ├── calendar.html
│   ├── members.html
│   ├── export.html
│   ├── css/style.css
│   └── js/
│       ├── config.js       # backend URL — edit this for production
│       ├── api.js          # shared API client + UI helpers
│       ├── dashboard.js
│       ├── calendar.js
│       ├── members.js
│       └── export.js
└── README.md
```

---

## Run Locally

### 1. Backend

Requires Python 3.10+.

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The API will be live on `http://localhost:5050`. On first boot it creates `birthdays.db`. The frontend's `config.js` already points at `localhost:5050` when you open it locally.

### 2. Frontend

The frontend is fully static. The simplest dev option:

```bash
cd frontend
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser. Or open the HTML files directly with `file://` — they'll still talk to the local backend.

---

## Deploy

### Backend on Render

1. Push this repo to GitHub.
2. Create a new **Web Service** on [Render](https://render.com).
3. Point it at the repo, set the **Root Directory** to `backend/`.
4. Build command: `pip install -r requirements.txt`
5. Start command: `gunicorn app:app --bind 0.0.0.0:$PORT` (also set in `Procfile`).
6. Once it's live, copy the public URL (e.g. `https://birthday-api.onrender.com`).

> Note: Render's free tier uses an ephemeral filesystem. For permanent SQLite persistence, attach a disk in Render's dashboard and set `DB_PATH` and `BACKUP_DIR` env vars to point at the mounted disk path. For a small team this isn't usually critical because the auto-backup JSON can be downloaded periodically.

### Frontend on GitHub Pages

1. In `frontend/js/config.js` replace `https://YOUR-BACKEND.onrender.com` with your real backend URL.
2. Commit and push.
3. In your repo settings, enable **GitHub Pages** with source = `main` branch, folder = `/frontend`.
4. The site will be served at `https://YOUR-USERNAME.github.io/REPO-NAME/`.

---

## Exporting Data

From the **Export** page in the app: click "Export to CSV" or "Export to Excel". Files are downloaded directly from the API.

You can also hit the endpoints directly:

```bash
curl -OJ http://localhost:5050/api/export/csv
curl -OJ http://localhost:5050/api/export/xlsx
```

---

## Restoring from Backup

Every successful write creates a timestamped snapshot in `backend/backups/` (e.g. `members_20251018T091245Z.json`) and overwrites `backend/backups/latest.json`. On startup, if the SQLite database is missing or unreadable, the app automatically rebuilds it from `latest.json`.

To restore a specific older snapshot manually:

1. Stop the backend.
2. Copy the snapshot file you want over `backups/latest.json`:
   ```bash
   cp backend/backups/members_20251018T091245Z.json backend/backups/latest.json
   ```
3. Delete or rename the live database:
   ```bash
   mv backend/birthdays.db backend/birthdays.db.old
   ```
4. Start the backend. It will detect the missing DB and rebuild from `latest.json`.

---

## API Reference

| Method | Path | Notes |
|---|---|---|
| `GET`    | `/api/health`              | Liveness check |
| `GET`    | `/api/members`             | List active members |
| `POST`   | `/api/members`             | Create. Pass `confirm_duplicate: true` to override the soft duplicate warning |
| `PUT`    | `/api/members/<id>`        | Update |
| `DELETE` | `/api/members/<id>`        | Soft delete |
| `GET`    | `/api/dashboard`           | Today + next-7-day birthdays |
| `GET`    | `/api/export/csv`          | CSV download |
| `GET`    | `/api/export/xlsx`         | Excel download |
| `GET`    | `/api/backup/latest`       | Last-backup metadata |

### Member payload

```json
{
  "name": "Alice Anderson",
  "role": "Senior Consultant",
  "birthday_month": 10,
  "birthday_day": 18,
  "email": "alice@example.com"
}
```

### Validation rules

- `name` — 2–60 characters; letters, spaces, hyphens, apostrophes only.
- `role` — required, max 80 characters.
- `birthday_month` — 1–12.
- `birthday_day` — 1–N where N is days-in-month (Feb caps at 29 to allow leap-day birthdays).
- `email` — must match a standard email regex; unique among active members.

---

## Tech Choices

| Layer       | Tech                              | Why |
|-------------|-----------------------------------|-----|
| Frontend    | Plain HTML / CSS / vanilla JS     | No framework overhead; loads in <1s; deployable as a static site |
| Backend     | Flask + Flask-CORS                | Smallest possible Python web stack |
| Database    | SQLite                            | File-based, zero-ops, plenty for ≤500 members |
| Excel       | openpyxl                          | Pure-Python, no system dependencies |
| Hosting     | GitHub Pages + Render free tier   | Zero monthly cost |

No npm, no bundler, no build step. Open the HTML files and they work.
