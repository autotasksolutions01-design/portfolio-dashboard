from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from database import engine, Base
import models  # noqa: F401 — ensure models are registered
from routers import auth, portfolio, prices

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Portfolio Dashboard API",
    description="Investment portfolio tracker with real-time prices",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(auth.router)
app.include_router(portfolio.router)
app.include_router(prices.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "portfolio-dashboard"}


# Serve frontend static files (if present)
FRONTEND_DIR = os.environ.get("FRONTEND_DIR", "/app/frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/static", StaticFiles(directory=f"{FRONTEND_DIR}/static"), name="static")

    @app.get("/")
    def serve_index():
        return FileResponse(f"{FRONTEND_DIR}/index.html")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        file_path = f"{FRONTEND_DIR}/{full_path}"
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(f"{FRONTEND_DIR}/index.html")
