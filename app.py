#!/usr/bin/env python3
"""
app.py - AI MongoDB real-time query tool for the iqac-system database.
CLI: python app.py --dump
Server: python app.py --server (http://localhost:8000/docs)
POST /query {"question": str} for natural language queries
"""

import argparse
import json
import os
import re
from pathlib import Path
from typing import Any, Dict

import uvicorn
from bson import json_util
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from pymongo import MongoClient


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


BASE_DIR = Path(__file__).resolve().parent
load_env_file(BASE_DIR / ".env")
load_env_file(BASE_DIR / "backend" / ".env")

MONGO_URI = os.getenv("IQAC_MONGO_URI") or os.getenv("MONGO_URI")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "iqac_system")

client = MongoClient(MONGO_URI) if MONGO_URI else None
db = None
if client:
    try:
        db = client.get_default_database()
    except Exception:
        db = None
    if db is None:
        db = client[MONGO_DB_NAME]

COLLECTIONS = [
    "attendances",
    "departments",
    "documents",
    "events",
    "faculties",
    "facultyachievements",
    "marks",
    "naacriteria",
    "nbacriteria",
    "placements",
    "researchpapers",
    "students",
    "subjects",
    "users",
]

app = FastAPI(title="IQAC MongoDB AI Query API (Atlas)")


class QueryRequest(BaseModel):
    question: str


def ensure_db():
    if db is None:
        raise RuntimeError(
            "MONGO_URI is not configured. Set it in the environment or backend/.env before running app.py."
        )
    return db


def get_collection_stats() -> Dict[str, int]:
    stats = {}
    database = ensure_db()
    all_colls = database.list_collection_names()
    for name in COLLECTIONS:
        if name in all_colls:
            stats[name] = database[name].count_documents({})
    return stats


def parse_query(question: str, limit: int = 20) -> Dict[str, Any]:
    q_lower = question.lower()
    coll_map = {
        "student": "students",
        "cgpa": "students",
        "roll": "students",
        "backlog": "students",
        "faculty": "faculties",
        "professor": "faculties",
        "department": "departments",
        "hod": "departments",
        "placement": "placements",
        "package": "placements",
        "mark": "marks",
        "grade": "marks",
        "attendance": "attendances",
        "research": "researchpapers",
        "document": "documents",
        "user": "users",
    }
    coll = next((c for k, c in coll_map.items() if k in q_lower), "students")

    filter_dict = {}
    numbers = re.findall(r"\d+\.\d+|\d+", question)
    if "cgpa" in q_lower and numbers:
        filter_dict["cgpa"] = {"$gte": float(numbers[0])}
    if "backlog" in q_lower:
        filter_dict["currentBacklogs"] = {"$gt": 0}
    if "active" in q_lower:
        filter_dict["isActive"] = True

    if not filter_dict:
        filter_dict = {
            "$or": [
                {"name": {"$regex": re.sub(r"\W+", " ", q_lower), "$options": "i"}},
                {"rollNumber": {"$regex": re.sub(r"\W+", " ", q_lower), "$options": "i"}},
            ]
        }

    return {"collection": coll, "filter": filter_dict, "limit": limit}


@app.post("/query")
async def query_db(request: QueryRequest):
    limit = request.dict().get("limit", 20) or 1000
    parsed = parse_query(request.question, limit)
    try:
        database = ensure_db()
        coll = database[parsed["collection"]]
        cursor = coll.find(parsed["filter"]).limit(parsed["limit"]).sort([("_id", -1)])
        docs = list(cursor)
        return {
            "question": request.question,
            "collection": parsed["collection"],
            "filter": parsed["filter"],
            "limit": parsed["limit"],
            "found": len(docs),
            "data": json.loads(json_util.dumps(docs)),
        }
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error))
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/collections")
async def collections():
    try:
        return get_collection_stats()
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error))


@app.get("/health")
async def health():
    try:
        database = ensure_db()
        return {
            "status": "alive",
            "db": database.name,
            "collections": list(database.list_collection_names()),
        }
    except RuntimeError as error:
        raise HTTPException(status_code=500, detail=str(error))


def main_cli():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dump", action="store_true", help="Dump collection stats")
    parser.add_argument("--server", action="store_true", help="Start API server")
    args = parser.parse_args()

    if args.dump:
        try:
            stats = get_collection_stats()
        except RuntimeError as error:
            print(str(error))
            raise SystemExit(1) from error
        print("Real-time iqac_system collections:")
        print(json.dumps(stats, indent=2))
        print(f"Total docs: {sum(stats.values())}")
    elif args.server:
        if not MONGO_URI:
            print("MONGO_URI is not configured. Set it in the environment or backend/.env before running app.py.")
            raise SystemExit(1)
        print("API running: http://localhost:8000/docs")
        uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
    else:
        print("Usage: python app.py --dump | --server")
        print("Query example: curl -X POST http://localhost:8000/query -d '{\"question\":\"faculties\"}'")


if __name__ == "__main__":
    main_cli()
