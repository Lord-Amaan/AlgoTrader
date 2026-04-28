Render & Vercel deployment notes

Overview

- This repo contains three deployable parts:
  - Frontend: `client` (Vite / React) — best deployed to Vercel
  - Backend API: `server` (Node / Express) — deploy as a Render Web Service with Root Directory `server`
  - Python engine: `server/python-engine` (FastAPI / Uvicorn) — deploy as a separate Render Web Service with Root Directory `server/python-engine`

Render: creating two services (important)

1. Create first Web Service for the Node backend
   - Root Directory: `server`
   - Environment: Node
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Health check path: `/`
   - Env vars (example):
     - `MONGO_URI` = <your mongodb connection string>
     - `CLERK_SECRET_KEY` = <your Clerk secret key>
     - `BACKTEST_LIMIT_PER_DAY` = 50 (optional)
     - `PYTHON_ENGINE_URL` = will point to your Python service URL (set after python service is deployed)

2. Create second Web Service for the Python engine
   - Root Directory: `server/python-engine`
   - Environment: Python
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Health check path: `/health` (or `/`)
   - Env vars (example):
     - `ALLOWED_ORIGINS` = `https://<your-vercel-site>.vercel.app,https://<your-backend>.onrender.com`

Deploy order

- Deploy the Python service first. Copy its service URL (e.g. `https://algoroom-python.onrender.com`).
- Then set `PYTHON_ENGINE_URL` on the backend service to that URL and redeploy the backend.
- Finally, deploy the frontend to Vercel and add its origin to Clerk and `ALLOWED_ORIGINS` on the python service.

CORS and Clerk

- The Python engine reads `ALLOWED_ORIGINS` (comma-separated) to configure CORS. If unset, it allows `http://localhost:5000` and `http://localhost:5173` for development.
- Add Vercel and Render origins to your Clerk app's allowed origins/redirects.

Local testing

- Run python engine locally on port 8001 (backend uses `http://localhost:8001` by default):

```bash
cd server/python-engine
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

- Run backend locally:

```bash
cd server
npm install
npm run dev
```

Notes

- Each Render service is independent: separate builds, logs, env, autoscale settings. Use clear service names like `algoroom-server` and `algoroom-python-engine`.
- Optionally, add a `render.yaml` or GitHub Actions workflow later to automate deployments.

Contact me if you want I can:

- Patch code to read more env vars or secure CORS further
- Add a `render.yaml` manifest and a GitHub Actions workflow to auto-deploy
- Create a short `DEPLOY.md` under `server/` with exact env var examples
