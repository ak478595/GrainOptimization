"""
Main FastAPI Application for GrainOpt 2.0.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as api_router

app = FastAPI(
    title="GrainOpt 2.0 API",
    description="Solver-backed Seasonal Grain Production Optimization REST Service",
    version="2.0.0"
)

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
def root():
    return {
        "project": "GrainOpt 2.0",
        "description": "Seasonal-Demand-Aware Grain Production Optimization Using MILP",
        "status": "online",
        "docs_url": "/docs"
    }

