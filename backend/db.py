import sqlite3
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent.parent / "data" / "hosting.db"
DATA_DIR = Path(__file__).parent.parent / "data"
VOLUMES_DIR = DATA_DIR / "volumes"
UPLOADS_DIR = DATA_DIR / "uploads"

for d in (DATA_DIR, VOLUMES_DIR, UPLOADS_DIR):
    d.mkdir(parents=True, exist_ok=True)

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
        plan_id INTEGER DEFAULT 1,
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        ram_mb INTEGER,
        storage_mb INTEGER,
        cpu_limit REAL,
        max_deployments INTEGER,
        transfer_gb INTEGER DEFAULT 10,
        price_inr INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER DEFAULT 1,
        name TEXT,
        type TEXT,
        status TEXT,
        ram_mb INTEGER,
        storage_mb INTEGER,
        container_id TEXT,
        volume_path TEXT,
        created_at TEXT
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

    CREATE TABLE IF NOT EXISTS usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        cpu_seconds REAL DEFAULT 0,
        ram_mb_hours REAL DEFAULT 0,
        storage_mb REAL DEFAULT 0,
        transfer_mb REAL DEFAULT 0,
        recorded_at TEXT
    );

    INSERT OR IGNORE INTO plans (id, name, ram_mb, storage_mb, cpu_limit, max_deployments, transfer_gb, price_inr)
    VALUES 
        (1, 'Free', 512, 1024, 0.5, 3, 10, 0),
        (2, 'Starter', 2048, 10240, 1.0, 10, 100, 299),
        (3, 'Pro', 4096, 51200, 2.0, 25, 500, 999);

    INSERT OR IGNORE INTO workers (id, name, status, total_ram_mb, total_storage_mb, last_seen)
    VALUES (1, 'Local PC Worker', 'healthy', 8192, 102400, datetime('now'));

    INSERT OR IGNORE INTO users (id, email, name, plan_id, created_at)
    VALUES (1, 'local@pc', 'Local User', 1, datetime('now'));
    """)
    conn.commit()
    conn.close()

def dict_from_row(row):
    return dict(row) if row else None

def get_plan(plan_id=1):
    conn = get_db()
    row = conn.execute("SELECT * FROM plans WHERE id = ?", (plan_id,)).fetchone()
    conn.close()
    return dict_from_row(row)

def get_user_usage(user_id=1):
    conn = get_db()
    row = conn.execute("""
        SELECT 
            COALESCE(SUM(ram_mb), 0) as used_ram,
            COALESCE(SUM(storage_mb), 0) as used_storage,
            COUNT(*) as deployments
        FROM projects WHERE user_id = ? AND status = 'running'
    """, (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else {"used_ram": 0, "used_storage": 0, "deployments": 0}
