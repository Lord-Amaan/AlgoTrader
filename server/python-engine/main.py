from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import os

from app.routers import backtest, health


app = FastAPI(title="python-engine")

# Allow configuring CORS origins via the ALLOWED_ORIGINS env var (comma-separated).
# Defaults keep localhost dev entries for local testing.
default_origins = "http://localhost:5000,http://localhost:5173"
allowed = os.getenv("ALLOWED_ORIGINS", default_origins)
allow_origins = [o.strip() for o in allowed.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(backtest.router)


if __name__ == "__main__":
    # Use PORT env var when provided (Render sets $PORT). Bind 0.0.0.0 for container hosts.
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8001))
    uvicorn.run("main:app", host=host, port=port, reload=False)

