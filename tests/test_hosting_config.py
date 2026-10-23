import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class HostingConfigurationTests(unittest.TestCase):
    def run_python(self, script, environment):
        return subprocess.run(
            [sys.executable, "-c", script],
            cwd=Path(__file__).resolve().parents[1],
            env=environment,
            text=True,
            capture_output=True,
            check=False,
        )

    def render_environment(self, data_dir):
        environment = os.environ.copy()
        for key in ("SECRET_KEY", "RENDER", "DATA_DIR", "PERSISTENT_STORAGE", "ADMIN_EMAIL", "ADMIN_PASSWORD"):
            environment.pop(key, None)
        environment.update({
            "RENDER": "true",
            "DATA_DIR": str(data_dir),
            "PERSISTENT_STORAGE": "true",
            "ADMIN_EMAIL": "admin@gmail.com",
            "ADMIN_PASSWORD": "generated-password-for-test",
            "PYTHONDONTWRITEBYTECODE": "1",
        })
        return environment

    def test_render_generates_private_reusable_key_on_persistent_disk(self):
        script = r"""
import os
from pathlib import Path
real_is_mount = Path.is_mount
Path.is_mount = lambda self: self == Path(os.environ["DATA_DIR"]) or real_is_mount(self)
from hosting import app
key_path = Path(os.environ["DATA_DIR"]) / ".flask_secret_key"
assert key_path.is_file() and not key_path.is_symlink()
assert key_path.stat().st_mode & 0o777 == 0o600
assert len(app.secret_key) == 64
client = app.test_client()
assert client.get("/api/health").get_json()["storage"] == "persistent"
login = client.post("/api/auth/login", json={
    "email": "admin@gmail.com",
    "password": "generated-password-for-test",
})
assert login.status_code == 200
assert "Secure" in login.headers["Set-Cookie"]
print(app.secret_key)
"""
        with tempfile.TemporaryDirectory(prefix="hosting-key-persistence-") as data_dir:
            environment = self.render_environment(data_dir)
            first = self.run_python(script, environment)
            self.assertEqual(first.returncode, 0, first.stderr)
            second = self.run_python(script, environment)
            self.assertEqual(second.returncode, 0, second.stderr)
            self.assertEqual(first.stdout.strip(), second.stdout.strip())
            self.assertEqual(len(first.stdout.strip()), 64)

    def test_render_without_secret_and_persistent_disk_fails_closed(self):
        script = "import hosting"
        with tempfile.TemporaryDirectory(prefix="hosting-key-no-disk-") as data_dir:
            environment = self.render_environment(data_dir)
            environment["PERSISTENT_STORAGE"] = "false"
            result = self.run_python(script, environment)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("persistent storage is unavailable", result.stderr)


if __name__ == "__main__":
    unittest.main()
