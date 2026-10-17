import os
import sys
from pathlib import Path

# Make `app` importable when running `pytest` from the backend directory.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# app.core.config / app.core.database read these at import time. Dummy values
# are enough for tests: the database is replaced with in-memory SQLite.
os.environ.setdefault("POSTGRES_USER", "test")
os.environ.setdefault("POSTGRES_PASSWORD", "test")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("POSTGRES_PORT", "5432")
os.environ.setdefault("POSTGRES_DB", "test")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
