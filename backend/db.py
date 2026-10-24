import sqlite3
import os
import shutil
from pathlib import Path
from datetime import datetime

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).parent.parent / "data")).expanduser()
DB_PATH = Path(os.environ.get("DATABASE_PATH", DATA_DIR / "hosting.db")).expanduser()
VOLUMES_DIR = DATA_DIR / "volumes"
UPLOADS_DIR = DATA_DIR / "uploads"

def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 15000")
    return conn

def _worker_capacity():
    memory_mb = 0
    try:
        memory_mb = os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") // (1024 * 1024)
    except (AttributeError, OSError, ValueError):
        pass
    for limit_file in (Path("/sys/fs/cgroup/memory.max"), Path("/sys/fs/cgroup/memory/memory.limit_in_bytes")):
        try:
            value = limit_file.read_text().strip()
            if value != "max":
                cgroup_memory_mb = int(value) // (1024 * 1024)
                if 0 < cgroup_memory_mb < memory_mb:
                    memory_mb = cgroup_memory_mb
        except (OSError, ValueError):
            continue
    memory_mb = int(os.environ.get("WORKER_MEMORY_LIMIT_MB", int((memory_mb or 2048) * 0.7)))
    try:
        storage_mb = int(shutil.disk_usage(DATA_DIR).free // (1024 * 1024) * 0.8)
    except OSError:
        storage_mb = 1024
    storage_mb = int(os.environ.get("WORKER_STORAGE_LIMIT_MB", storage_mb))
    cpu_count = float(os.cpu_count() or 1)
    try:
        quota, period = Path("/sys/fs/cgroup/cpu.max").read_text().split()
        if quota != "max":
            cpu_count = min(cpu_count, int(quota) / int(period))
    except (OSError, ValueError, ZeroDivisionError):
        try:
            quota = int(Path("/sys/fs/cgroup/cpu/cpu.cfs_quota_us").read_text())
            period = int(Path("/sys/fs/cgroup/cpu/cpu.cfs_period_us").read_text())
            if quota > 0 and period > 0:
                cpu_count = min(cpu_count, quota / period)
        except (OSError, ValueError, ZeroDivisionError):
            pass
    cpu_limit = float(os.environ.get("WORKER_CPU_LIMIT", cpu_count * 0.8))
    return max(memory_mb, 64), max(storage_mb, 0), max(cpu_limit, 0.01)

def init_db():
    for directory in (DATA_DIR, VOLUMES_DIR, UPLOADS_DIR):
        directory.mkdir(parents=True, exist_ok=True)
    conn = get_db()
    c = conn.cursor()
    c.execute("PRAGMA journal_mode = WAL")
    c.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        name TEXT,
        plan_id INTEGER DEFAULT 1,
        created_at TEXT,
        password_hash TEXT,
        status TEXT NOT NULL DEFAULT 'active'
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
        cpu_limit REAL NOT NULL DEFAULT 0.5,
        container_id TEXT,
        volume_path TEXT,
        host_port INTEGER,
        created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS workers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        status TEXT,
        total_ram_mb INTEGER,
        reserved_ram_mb INTEGER DEFAULT 0,
        total_cpu REAL NOT NULL DEFAULT 1.0,
        reserved_cpu REAL NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS auth_login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_key TEXT NOT NULL,
        attempted_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_client_time
        ON auth_login_attempts (client_key, attempted_at);

    INSERT OR IGNORE INTO plans (id, name, ram_mb, storage_mb, cpu_limit, max_deployments, transfer_gb, price_inr)
    VALUES 
        (1, 'Free', 512, 1024, 0.5, 3, 10, 0),
        (2, 'Starter', 2048, 10240, 1.0, 10, 100, NULL),
        (3, 'Pro', 4096, 51200, 2.0, 25, 500, NULL);

    INSERT OR IGNORE INTO users (id, email, name, plan_id, created_at)
    VALUES (1, 'local@pc', 'Local User', 1, datetime('now'));
    """)
    user_columns = {row["name"] for row in c.execute("PRAGMA table_info(users)")}
    if "password_hash" not in user_columns:
        c.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
    if "status" not in user_columns:
        c.execute("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'")
    c.execute("CREATE INDEX IF NOT EXISTS idx_users_status_created ON users(status, created_at)")
    c.execute("UPDATE plans SET price_inr = NULL WHERE id = 2 AND price_inr = 299")
    c.execute("UPDATE plans SET price_inr = NULL WHERE id = 3 AND price_inr = 999")
    project_columns = {row["name"] for row in c.execute("PRAGMA table_info(projects)")}
    if "cpu_limit" not in project_columns:
        c.execute("ALTER TABLE projects ADD COLUMN cpu_limit REAL NOT NULL DEFAULT 0.5")
    if "host_port" not in project_columns:
        c.execute("ALTER TABLE projects ADD COLUMN host_port INTEGER")
    worker_columns = {row["name"] for row in c.execute("PRAGMA table_info(workers)")}
    if "total_cpu" not in worker_columns:
        c.execute("ALTER TABLE workers ADD COLUMN total_cpu REAL NOT NULL DEFAULT 1.0")
    if "reserved_cpu" not in worker_columns:
        c.execute("ALTER TABLE workers ADD COLUMN reserved_cpu REAL NOT NULL DEFAULT 0")
    c.execute("CREATE INDEX IF NOT EXISTS idx_projects_owner_status ON projects(user_id, status)")
    if os.environ.get("RENDER", "").lower() != "true":
        total_ram_mb, total_storage_mb, total_cpu = _worker_capacity()
        c.execute(
            """INSERT OR IGNORE INTO workers
               (id, name, status, total_ram_mb, total_cpu, total_storage_mb, last_seen)
               VALUES (1, 'Local PC Worker', 'healthy', ?, ?, ?, datetime('now'))""",
            (total_ram_mb, total_cpu, total_storage_mb),
        )
        c.execute(
            """UPDATE workers SET total_ram_mb = ?, total_cpu = ?, total_storage_mb = ?
               WHERE id = 1 AND name = 'Local PC Worker'""",
            (total_ram_mb, total_cpu, total_storage_mb),
        )
    conn.commit()
    conn.close()

def dict_from_row(row):
    return dict(row) if row else None

def get_plan(plan_id=1, conn=None):
    owns_connection = conn is None
    conn = conn or get_db()
    row = conn.execute("SELECT * FROM plans WHERE id = ?", (plan_id,)).fetchone()
    if owns_connection:
        conn.close()
    return dict_from_row(row)

def get_user_usage(user_id=1, conn=None):
    owns_connection = conn is None
    conn = conn or get_db()
    row = conn.execute("""
        SELECT 
            COALESCE(SUM(ram_mb), 0) as used_ram,
            COALESCE(SUM(cpu_limit), 0) as used_cpu,
            COALESCE(SUM(storage_mb), 0) as used_storage,
            COUNT(*) as deployments
        FROM projects WHERE user_id = ? AND status = 'running'
    """, (user_id,)).fetchone()
    if owns_connection:
        conn.close()
    return dict(row) if row else {"used_ram": 0, "used_storage": 0, "deployments": 0}
