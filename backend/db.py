import sqlite3
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent.parent / "data" / "hosting.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        name TEXT,
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        ram_mb INTEGER,
        storage_mb INTEGER,
        cpu_limit REAL,
        max_deployments INTEGER,
        price_inr INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT,
        type TEXT,
        status TEXT,
        ram_mb INTEGER,
        storage_mb INTEGER,
        container_id TEXT,
        created_at TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS workers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        status TEXT,
        total_ram_mb INTEGER,
        reserved_ram_mb INTEGER DEFAULT 0,
        total_storage_mb INTEGER,
        reserved_storage_mb INTEGER DEFAULT 0,
        last_seen TEXT
    );

    INSERT OR IGNORE INTO plans (id, name, ram_mb, storage_mb, cpu_limit, max_deployments, price_inr)
    VALUES (1, 'Free', 512, 1024, 0.5, 3, 0);

    INSERT OR IGNORE INTO workers (id, name, status, total_ram_mb, total_storage_mb, last_seen)
    VALUES (1, 'Local PC Worker', 'healthy', 8192, 102400, datetime('now'));
    """)
    conn.commit()
    conn.close()

def dict_from_row(row):
    return dict(row) if row else None
