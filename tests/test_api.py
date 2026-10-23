import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from flask import Flask

from backend import api as api_module
from backend import db


class ApiTestCase(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.root = Path(self.temp_dir.name)
        self.environment = patch.dict(os.environ, {}, clear=False)
        self.environment.start()
        self.addCleanup(self.environment.stop)
        os.environ["WORKER_MEMORY_LIMIT_MB"] = "4096"
        os.environ["WORKER_STORAGE_LIMIT_MB"] = "8192"
        os.environ["WORKER_CPU_LIMIT"] = "4"
        self.set_mode("local-pc")
        self.configure_database()
        db.init_db()
        self.app = Flask(__name__)
        self.app.secret_key = "test-session-key"
        self.app.register_blueprint(api_module.api)
        self.client = self.app.test_client()

    def configure_database(self):
        db.DATA_DIR = self.root / "data"
        db.DB_PATH = db.DATA_DIR / "hosting.db"
        db.VOLUMES_DIR = db.DATA_DIR / "volumes"
        db.UPLOADS_DIR = db.DATA_DIR / "uploads"
        api_module.DATA_DIR = db.DATA_DIR
        api_module.VOLUMES_DIR = db.VOLUMES_DIR
        api_module.UPLOADS_DIR = db.UPLOADS_DIR

    def set_mode(self, mode):
        if mode == "render":
            os.environ["RENDER"] = "true"
        else:
            os.environ.pop("RENDER", None)

    def test_render_requires_admin_login_and_csrf(self):
        self.set_mode("render")
        os.environ["ADMIN_EMAIL"] = "owner@example.test"
        os.environ["ADMIN_PASSWORD"] = "correct-horse-battery"

        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.get_json()["storage"], "ephemeral")
        self.assertEqual(self.client.get("/api/projects").status_code, 401)

        failed_login = self.client.post(
            "/api/auth/login",
            json={"email": "owner@example.test", "password": "wrong"},
        )
        self.assertEqual(failed_login.status_code, 401)
        self.assertEqual(
            self.client.post(
                "/api/auth/login",
                json={"email": "owner@example.test", "password": "correct-horse-battery"},
            ).status_code,
            200,
        )
        token = self.client.get("/api/auth/me").get_json()["csrf_token"]
        self.assertEqual(self.client.get("/api/projects").status_code, 200)
        self.assertEqual(self.client.post("/api/auth/logout").status_code, 403)
        self.assertEqual(
            self.client.post("/api/auth/logout", headers={"X-CSRF-Token": token}).status_code,
            200,
        )
        self.assertEqual(self.client.get("/api/projects").status_code, 401)

    def test_render_without_credentials_fails_closed(self):
        self.set_mode("render")
        os.environ.pop("ADMIN_EMAIL", None)
        os.environ.pop("ADMIN_PASSWORD", None)
        self.assertEqual(self.client.get("/api/projects").status_code, 503)
        self.assertEqual(self.client.post("/api/auth/login", json={}).status_code, 503)

    def test_weak_admin_password_is_rejected_and_rotation_expires_sessions(self):
        self.set_mode("render")
        os.environ["ADMIN_EMAIL"] = "owner@example.test"
        os.environ["ADMIN_PASSWORD"] = "too-short"
        self.assertEqual(self.client.get("/api/auth/me").status_code, 503)

        os.environ["ADMIN_PASSWORD"] = "correct-horse-battery"
        login = self.client.post(
            "/api/auth/login",
            json={"email": "owner@example.test", "password": "correct-horse-battery"},
        )
        self.assertEqual(login.status_code, 200)
        token = login.get_json()["csrf_token"]
        self.assertEqual(self.client.get("/api/projects").status_code, 200)

        os.environ["ADMIN_PASSWORD"] = "a-different-strong-password"
        self.assertEqual(self.client.get("/api/projects").status_code, 401)
        self.assertFalse(self.client.get("/api/auth/me").get_json()["authenticated"])
        self.assertNotEqual(token, "")

    def test_login_rate_limit_and_local_network_exposure_require_auth(self):
        self.set_mode("render")
        os.environ["ADMIN_EMAIL"] = "owner@example.test"
        os.environ["ADMIN_PASSWORD"] = "correct-horse-battery"
        for _ in range(5):
            response = self.client.post(
                "/api/auth/login",
                json={"email": "owner@example.test", "password": "wrong"},
            )
            self.assertEqual(response.status_code, 401)
        limited = self.client.post(
            "/api/auth/login",
            json={"email": "owner@example.test", "password": "correct-horse-battery"},
        )
        self.assertEqual(limited.status_code, 429)

        self.client.delete_cookie("session")
        db.DB_PATH = self.root / "local.db"
        db.DATA_DIR = self.root / "local-data"
        db.VOLUMES_DIR = db.DATA_DIR / "volumes"
        db.UPLOADS_DIR = db.DATA_DIR / "uploads"
        api_module.DATA_DIR = db.DATA_DIR
        api_module.VOLUMES_DIR = db.VOLUMES_DIR
        api_module.UPLOADS_DIR = db.UPLOADS_DIR
        db.init_db()
        self.set_mode("local-pc")
        os.environ["HOSTING_HOST"] = "0.0.0.0"
        self.assertEqual(self.client.get("/api/projects").status_code, 401)
        login = self.client.post(
            "/api/auth/login",
            json={"email": "owner@example.test", "password": "correct-horse-battery"},
        )
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.get_json()["auth_required"])
        token = login.get_json()["csrf_token"]
        self.assertEqual(self.client.get("/api/projects").status_code, 200)
        self.assertEqual(
            self.client.post("/api/auth/logout", headers={"X-CSRF-Token": token}).status_code,
            200,
        )

    def test_render_deployment_is_rejected_even_after_login(self):
        self.set_mode("render")
        os.environ["ADMIN_EMAIL"] = "owner@example.test"
        os.environ["ADMIN_PASSWORD"] = "correct-horse-battery"
        self.client.post(
            "/api/auth/login",
            json={"email": "owner@example.test", "password": "correct-horse-battery"},
        )
        response = self.client.post(
            "/api/projects",
            json={"name": "api", "type": "python"},
            headers={"X-CSRF-Token": self.client.get("/api/auth/me").get_json()["csrf_token"]},
        )
        self.assertEqual(response.status_code, 503)
        self.assertIn("No worker is enrolled", response.get_json()["error"])

    def test_deployment_enforces_plan_before_calling_docker(self):
        connection = db.get_db()
        paid_prices = connection.execute(
            "SELECT price_inr FROM plans WHERE id IN (2, 3) ORDER BY id"
        ).fetchall()
        connection.close()
        self.assertEqual([row["price_inr"] for row in paid_prices], [None, None])

        with patch.object(api_module.docker_worker, "run_container") as run_container:
            response = self.client.post(
                "/api/projects",
                json={"name": "too-large", "type": "python", "ram_mb": 1024, "storage_mb": 512},
            )
        self.assertEqual(response.status_code, 400)
        run_container.assert_not_called()

        response = self.client.post(
            "/api/projects",
            json={"name": "too-much-storage", "type": "python", "ram_mb": 256, "storage_mb": 2048},
        )
        self.assertEqual(response.status_code, 400)
        response = self.client.post(
            "/api/projects",
            json={"name": "too-much-cpu", "type": "python", "ram_mb": 256, "storage_mb": 512, "cpu_limit": 1},
        )
        self.assertEqual(response.status_code, 400)

        response = self.client.post(
            "/api/projects",
            json={"name": "bad-template", "type": "unsupported"},
        )
        self.assertEqual(response.status_code, 400)

    def test_worker_cpu_reservations_prevent_overcommit(self):
        connection = db.get_db()
        connection.execute("UPDATE workers SET total_cpu = 0.75 WHERE id = 1")
        connection.commit()
        connection.close()

        with patch.object(api_module.docker_worker, "run_container", return_value={"id": "container-123"}):
            first = self.client.post(
                "/api/projects",
                json={"name": "first-app", "type": "python", "ram_mb": 256, "storage_mb": 512},
            )
            second = self.client.post(
                "/api/projects",
                json={"name": "second-app", "type": "python", "ram_mb": 256, "storage_mb": 512},
            )
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 409)
        self.assertIn("CPU capacity", second.get_json()["error"])

    def test_real_project_lifecycle_updates_reservations_once(self):
        container = MagicMock()
        client = SimpleNamespace(containers=SimpleNamespace(get=MagicMock(return_value=container)))
        with (
            patch.object(api_module.docker_worker, "run_container", return_value={"id": "container-123", "status": "running"}) as run_container,
            patch.object(api_module.docker_worker, "stop_container", return_value={"status": "stopped"}) as stop_container,
            patch.object(api_module.docker_worker, "get_client", return_value=client),
            patch.object(api_module.docker_worker, "remove_container", return_value={"status": "removed"}) as remove_container,
        ):
            created = self.client.post(
                "/api/projects",
                json={"name": "my-app", "type": "python", "ram_mb": 256, "storage_mb": 512},
            )
            self.assertEqual(created.status_code, 201, created.get_json())
            project_id = created.get_json()["id"]
            run_container.assert_called_once()
            self.assertEqual(run_container.call_args.kwargs["ram_mb"], 256)
            self.assertEqual(run_container.call_args.kwargs["cpu_limit"], 0.5)

            self.assertEqual(self.client.post(f"/api/projects/{project_id}/stop").status_code, 200)
            self.assertEqual(self.client.post(f"/api/projects/{project_id}/stop").status_code, 200)
            stop_container.assert_called_once_with("container-123")

            self.assertEqual(self.client.post(f"/api/projects/{project_id}/start").status_code, 200)
            self.assertEqual(self.client.post(f"/api/projects/{project_id}/start").status_code, 200)
            container.start.assert_called_once()

            connection = db.get_db()
            worker = connection.execute("SELECT * FROM workers WHERE id = 1").fetchone()
            self.assertEqual(worker["reserved_ram_mb"], 256)
            self.assertEqual(worker["reserved_cpu"], 0.5)
            self.assertEqual(worker["reserved_storage_mb"], 512)
            connection.close()

            self.assertEqual(self.client.delete(f"/api/projects/{project_id}").status_code, 200)
            remove_container.assert_called_once_with("container-123")
            connection = db.get_db()
            worker = connection.execute("SELECT * FROM workers WHERE id = 1").fetchone()
            self.assertEqual(worker["reserved_ram_mb"], 0)
            self.assertEqual(worker["reserved_cpu"], 0)
            self.assertEqual(worker["reserved_storage_mb"], 0)
            connection.close()

    def test_failed_container_start_rolls_back_reserved_capacity(self):
        with patch.object(api_module.docker_worker, "run_container", return_value={"error": "Docker unavailable"}):
            response = self.client.post(
                "/api/projects",
                json={"name": "failed-app", "type": "python", "ram_mb": 256, "storage_mb": 512},
            )
        self.assertEqual(response.status_code, 502)
        connection = db.get_db()
        worker = connection.execute("SELECT * FROM workers WHERE id = 1").fetchone()
        projects = connection.execute("SELECT COUNT(*) AS count FROM projects").fetchone()["count"]
        connection.close()
        self.assertEqual(worker["reserved_ram_mb"], 0)
        self.assertEqual(worker["reserved_storage_mb"], 0)
        self.assertEqual(projects, 0)


if __name__ == "__main__":
    unittest.main()
