import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from flask import Flask
from docker.errors import ImageNotFound

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

    def test_project_file_manager_supports_safe_file_operations(self):
        volume = db.VOLUMES_DIR / "file-manager-project"
        volume.mkdir(parents=True)
        outside = self.root / "outside.txt"
        outside.write_text("private", encoding="utf-8")
        (volume / "outside-link").symlink_to(outside)
        connection = db.get_db()
        cursor = connection.execute(
            """INSERT INTO projects
               (user_id, name, type, status, ram_mb, storage_mb, cpu_limit, volume_path, created_at)
               VALUES (1, 'file-test', 'python', 'stopped', 256, 1, 0.25, ?, datetime('now'))""",
            (str(volume),),
        )
        connection.commit()
        project_id = cursor.lastrowid
        connection.close()

        listing = self.client.get(f"/api/projects/{project_id}/files")
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.get_json()["entries"], [])

        traversal = self.client.get(f"/api/projects/{project_id}/files?path=../")
        self.assertEqual(traversal.status_code, 400)
        symlink = self.client.get(f"/api/projects/{project_id}/files/content?path=outside-link")
        self.assertEqual(symlink.status_code, 400)

        folder = self.client.post(
            f"/api/projects/{project_id}/files/folders",
            json={"path": "", "name": "config"},
        )
        self.assertEqual(folder.status_code, 201)
        saved = self.client.put(
            f"/api/projects/{project_id}/files/content",
            json={"path": "config/settings.txt", "content": "hello world"},
        )
        self.assertEqual(saved.status_code, 200)
        read = self.client.get(f"/api/projects/{project_id}/files/content?path=config/settings.txt")
        self.assertEqual(read.get_json()["content"], "hello world")

        download = self.client.get(f"/api/projects/{project_id}/files/download?path=config/settings.txt")
        self.assertEqual(download.status_code, 200)
        self.assertEqual(download.data, b"hello world")
        download.close()

        deleted = self.client.delete(f"/api/projects/{project_id}/files?path=config/settings.txt")
        self.assertEqual(deleted.status_code, 200)
        self.assertFalse((volume / "config" / "settings.txt").exists())
        root_delete = self.client.delete(f"/api/projects/{project_id}/files")
        self.assertEqual(root_delete.status_code, 400)

    def test_project_file_upload_sanitizes_filename_and_rejects_collisions(self):
        from io import BytesIO

        volume = db.VOLUMES_DIR / "upload-project"
        volume.mkdir(parents=True)
        connection = db.get_db()
        cursor = connection.execute(
            """INSERT INTO projects
               (user_id, name, type, status, ram_mb, storage_mb, cpu_limit, volume_path, created_at)
               VALUES (1, 'upload-test', 'python', 'stopped', 256, 1, 0.25, ?, datetime('now'))""",
            (str(volume),),
        )
        connection.commit()
        project_id = cursor.lastrowid
        connection.close()

        response = self.client.post(
            f"/api/projects/{project_id}/files/upload",
            data={"path": "", "file": (BytesIO(b"uploaded"), "../../sample.txt")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["name"], "sample.txt")
        self.assertEqual((volume / "sample.txt").read_bytes(), b"uploaded")

        collision = self.client.post(
            f"/api/projects/{project_id}/files/upload",
            data={"path": "", "file": (BytesIO(b"replacement"), "sample.txt")},
            content_type="multipart/form-data",
        )
        self.assertEqual(collision.status_code, 409)
        oversized = self.client.post(
            f"/api/projects/{project_id}/files/upload",
            data={"path": "", "file": (BytesIO(b"x" * (1024 * 1024 + 1)), "too-large.bin")},
            content_type="multipart/form-data",
        )
        self.assertEqual(oversized.status_code, 413)
        self.assertFalse((volume / "too-large.bin").exists())

    def test_local_workload_ports_are_published_only_on_loopback(self):
        container = MagicMock()
        container.id = "container-abc123"
        container.name = "hosting-local-test"
        container.status = "running"
        container.attrs = {"NetworkSettings": {"Ports": {"8000/tcp": [{"HostPort": "45678"}]}}}
        client = SimpleNamespace(
            images=SimpleNamespace(get=MagicMock(return_value=object()), pull=MagicMock()),
            containers=SimpleNamespace(run=MagicMock(return_value=container)),
        )
        volume = self.root / "docker-volume"
        with patch.object(api_module.docker_worker, "get_client", return_value=client):
            result = api_module.docker_worker.run_container(
                image="python:3.11-slim",
                name="hosting-local-test",
                volume_path=str(volume),
                port=8000,
            )
        self.assertEqual(result["host_port"], 45678)
        kwargs = client.containers.run.call_args.kwargs
        self.assertEqual(kwargs["ports"], {"8000/tcp": ("127.0.0.1", None)})
        self.assertEqual(kwargs["volumes"][str(volume)]["bind"], "/data")
        self.assertEqual(kwargs["environment"]["PORT"], "8000")

    def test_worker_pulls_missing_container_images(self):
        container = MagicMock()
        container.id = "container-abc123"
        container.name = "hosting-pull-test"
        container.status = "running"
        images = SimpleNamespace(
            get=MagicMock(side_effect=ImageNotFound("missing")),
            pull=MagicMock(),
        )
        client = SimpleNamespace(images=images, containers=SimpleNamespace(run=MagicMock(return_value=container)))
        with patch.object(api_module.docker_worker, "get_client", return_value=client):
            result = api_module.docker_worker.run_container(image="python:3.11-slim", name="hosting-pull-test")
        self.assertNotIn("error", result)
        images.pull.assert_called_once_with("python:3.11-slim")

    def test_workloads_refuse_root_identity(self):
        with (
            patch.dict(os.environ, {}, clear=False),
            patch.object(api_module.docker_worker.os, "getuid", return_value=0),
        ):
            os.environ.pop("WORKLOAD_UID", None)
            os.environ.pop("WORKLOAD_GID", None)
            result = api_module.docker_worker.run_container(image="python:3.11-slim", name="root-refused")
        self.assertIn("non-root", result["error"])

    def test_project_list_reports_the_loopback_port(self):
        with patch.object(
            api_module.docker_worker,
            "run_container",
            return_value={"id": "container-with-port", "status": "running", "host_port": 45678},
        ) as run_container:
            created = self.client.post(
                "/api/projects",
                json={"name": "local-preview", "type": "nodejs", "ram_mb": 256, "storage_mb": 512},
            )
        self.assertEqual(created.status_code, 201)
        kwargs = run_container.call_args.kwargs
        self.assertEqual(kwargs["command"], "node /data/server.js")
        self.assertEqual(kwargs["port"], 3000)
        self.assertIn("http.createServer", (Path(kwargs["volume_path"]) / "server.js").read_text(encoding="utf-8"))
        listed = self.client.get("/api/projects")
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.get_json()[0]["host_port"], 45678)

    def test_docker_metrics_use_actual_container_stats(self):
        stats = {
            "cpu_stats": {
                "cpu_usage": {"total_usage": 250, "percpu_usage": [1, 2]},
                "system_cpu_usage": 500,
                "online_cpus": 2,
            },
            "precpu_stats": {
                "cpu_usage": {"total_usage": 50},
                "system_cpu_usage": 100,
            },
            "memory_stats": {
                "usage": 100 * 1024 * 1024,
                "limit": 512 * 1024 * 1024,
                "stats": {"inactive_file": 20 * 1024 * 1024},
            },
            "networks": {
                "eth0": {"rx_bytes": 123, "tx_bytes": 456},
                "eth1": {"rx_bytes": 10, "tx_bytes": 20},
            },
        }
        container = MagicMock()
        container.stats.return_value = stats
        client = SimpleNamespace(containers=SimpleNamespace(get=MagicMock(return_value=container)))
        with patch.object(api_module.docker_worker, "get_client", return_value=client):
            measured = api_module.docker_worker.container_metrics("container-1")
        self.assertEqual(measured["cpu_percent"], 100.0)
        self.assertEqual(measured["memory_usage_bytes"], 80 * 1024 * 1024)
        self.assertEqual(measured["memory_limit_bytes"], 512 * 1024 * 1024)
        self.assertEqual(measured["ingress_bytes"], 133)
        self.assertEqual(measured["egress_bytes"], 476)

    def test_monitoring_endpoint_returns_real_samples_for_running_projects(self):
        volume = db.VOLUMES_DIR / "metrics-project"
        volume.mkdir(parents=True)
        (volume / "payload.txt").write_text("payload", encoding="utf-8")
        connection = db.get_db()
        cursor = connection.execute(
            """INSERT INTO projects
               (user_id, name, type, status, ram_mb, storage_mb, cpu_limit, container_id, volume_path, created_at)
               VALUES (1, 'metrics-test', 'python', 'running', 256, 16, 0.25, 'container-1', ?, datetime('now'))""",
            (str(volume),),
        )
        connection.commit()
        project_id = cursor.lastrowid
        connection.close()
        measured = {
            "cpu_percent": 1.5,
            "memory_usage_bytes": 1024,
            "memory_limit_bytes": 256 * 1024 * 1024,
            "ingress_bytes": 20,
            "egress_bytes": 40,
        }
        with (
            patch.object(api_module.docker_worker, "get_client", return_value=object()),
            patch.object(api_module.docker_worker, "container_metrics", return_value=measured) as sample_container,
        ):
            response = self.client.get("/api/monitoring/metrics")
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertEqual(payload["sampling"], "instantaneous")
        project_metrics = next(item for item in payload["metrics"] if item["project_id"] == project_id)
        self.assertEqual(project_metrics["cpu_percent"], 1.5)
        self.assertEqual(project_metrics["storage_used_bytes"], 7)
        sample_container.assert_called_once()

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
            patch.object(api_module.docker_worker, "restart_container", return_value={"status": "running"}) as restart_container,
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
            self.assertEqual(self.client.post(f"/api/projects/{project_id}/restart").status_code, 200)
            restart_container.assert_called_once_with("container-123")
            self.assertEqual(self.client.post("/api/projects/999/restart").status_code, 404)

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
