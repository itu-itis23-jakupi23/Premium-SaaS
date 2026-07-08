import io
import os
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

from app import create_app
from app.extensions import db
from app.models.exhibition import Exhibition
from app.models.user import ChiefManager, Client, ProjectManager
from app.models.workspace import Workspace, WorkspaceAsset
from app.workspace.storage import (
    delete_workspace_snapshot_file,
    ensure_storage_directories,
    get_workspace_storage_backend,
    read_workspace_snapshot_bytes,
    store_workspace_snapshot_bytes,
    workspace_snapshot_exists,
)


def _png_image_bytes(color=(255, 0, 0, 255), size=(4, 4)):
    buffer = io.BytesIO()
    Image.new("RGBA", size, color).save(buffer, format="PNG")
    return buffer.getvalue()


def _assert_jpeg_payload(test_case, payload):
    with Image.open(io.BytesIO(payload)) as image:
        test_case.assertEqual(image.format, "JPEG")
        test_case.assertEqual(image.mode, "RGB")


class _FakeObjectBody:
    def __init__(self, payload):
        self.payload = payload

    def read(self):
        return self.payload

    def close(self):
        return None


class _FakeS3Client:
    def __init__(self):
        self.objects = {}

    def put_object(self, *, Bucket, Key, Body, ContentType=None, ContentDisposition=None):
        if hasattr(Body, "read"):
            payload = Body.read()
        else:
            payload = Body
        self.objects[(Bucket, Key)] = {
            "Body": bytes(payload),
            "ContentType": ContentType,
            "ContentDisposition": ContentDisposition,
        }
        return {"ETag": "fake"}

    def get_object(self, *, Bucket, Key):
        payload = self.objects.get((Bucket, Key))
        if payload is None:
            raise FileNotFoundError(Key)
        return {"Body": _FakeObjectBody(payload["Body"])}

    def head_object(self, *, Bucket, Key):
        if (Bucket, Key) not in self.objects:
            raise FileNotFoundError(Key)
        return {"ResponseMetadata": {"HTTPStatusCode": 200}}

    def delete_object(self, *, Bucket, Key):
        self.objects.pop((Bucket, Key), None)
        return {"ResponseMetadata": {"HTTPStatusCode": 204}}


class WorkspaceStorageBackendTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.asset_root = os.path.join(self.tempdir.name, "workspace_assets")
        self.snapshot_root = os.path.join(self.tempdir.name, "workspace_snapshots")

        self.app = create_app("testing")
        self.app.config.update(
            ADMIN_DOMAIN="localhost",
            CLIENT_DOMAIN="localhost",
            TESTING=True,
            WORKSPACE_STORAGE_BACKEND="filesystem",
            WORKSPACE_STORAGE_LOCAL_ROOT=self.asset_root,
            WORKSPACE_STORAGE_LOCAL_SNAPSHOT_ROOT=self.snapshot_root,
            WORKSPACE_ASSET_ROOT=self.asset_root,
            WORKSPACE_SNAPSHOT_ROOT=self.snapshot_root,
        )
        self.app.extensions.pop("workspace_storage_backend", None)
        ensure_storage_directories(self.app)

        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()
        self._seed_data()
        self.admin_portal = self.app.test_client()
        self.client_portal = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()
        self.tempdir.cleanup()

    def _seed_data(self):
        chief = ChiefManager(
            first_name="Chief",
            last_name="Manager",
            email="chief@example.com",
        )
        chief.set_password("Password123!")
        db.session.add(chief)
        db.session.flush()

        exhibition = Exhibition(
            name="Expo 2026",
            created_by=chief.id,
            status="active",
        )
        db.session.add(exhibition)
        db.session.flush()

        pm = ProjectManager(
            first_name="Project",
            last_name="Manager",
            email="pm@example.com",
            chief_id=chief.id,
        )
        pm.set_password("Password123!")
        db.session.add(pm)
        db.session.flush()

        client = Client(
            first_name="Client",
            last_name="Owner",
            email="client@example.com",
            company="Client Co",
            project_manager_id=pm.id,
            exhibition_id=exhibition.id,
            status="active",
        )
        client.set_password("Password123!")
        db.session.add(client)
        db.session.flush()

        workspace = Workspace(
            name="Storage Workspace",
            client_id=client.id,
            project_manager_id=pm.id,
            exhibition_id=exhibition.id,
            status="review",
        )
        db.session.add(workspace)
        db.session.commit()

        self.pm_email = pm.email
        self.client_email = client.email
        self.workspace_id = workspace.id

    def _login_pm(self):
        response = self.admin_portal.post(
            "/api/admin/auth/pm/login",
            json={"email": self.pm_email, "password": "Password123!"},
        )
        self.assertEqual(response.status_code, 200, response.get_json())

    def _login_client(self):
        response = self.client_portal.post(
            "/api/client/auth/login",
            json={"email": self.client_email, "password": "Password123!"},
        )
        self.assertEqual(response.status_code, 200, response.get_json())

    def _csrf_headers(self, test_client, portal_path):
        cookie = test_client.get_cookie("csrf_access_token", path=portal_path)
        self.assertIsNotNone(cookie)
        return {"X-CSRF-TOKEN": cookie.value}

    def test_new_uploads_store_backend_managed_reference_and_serve_content(self):
        self._login_pm()
        response = self.admin_portal.post(
            f"/api/admin/workspaces/{self.workspace_id}/assets",
            data={
                "kind": "logo",
                "file": (io.BytesIO(_png_image_bytes()), "logo.png", "image/png"),
            },
            headers=self._csrf_headers(self.admin_portal, "/admin"),
        )
        self.assertEqual(response.status_code, 201, response.get_json())

        asset = WorkspaceAsset.query.filter_by(workspace_id=self.workspace_id).first()
        self.assertIsNotNone(asset)
        self.assertFalse(os.path.isabs(asset.file_path))
        self.assertTrue(asset.file_path.startswith(f"{self.workspace_id}/"))
        self.assertTrue(
            os.path.isfile(os.path.join(self.asset_root, asset.file_path.replace("/", os.sep)))
        )

        self._login_client()
        content_response = self.client_portal.get(
            f"/api/client/workspaces/{self.workspace_id}/assets/{asset.id}/content"
        )
        self.assertEqual(content_response.status_code, 200)
        self.assertEqual(content_response.mimetype, "image/jpeg")
        self.assertIn(
            "attachment",
            content_response.headers.get("Content-Disposition", ""),
        )
        self.assertIn(".jpg", content_response.headers.get("Content-Disposition", ""))
        self.assertEqual(
            content_response.headers.get("X-Content-Type-Options"),
            "nosniff",
        )
        _assert_jpeg_payload(self, content_response.data)
        content_response.close()

    def test_legacy_absolute_asset_references_remain_readable(self):
        legacy_dir = os.path.join(self.asset_root, str(self.workspace_id))
        os.makedirs(legacy_dir, exist_ok=True)
        legacy_path = os.path.join(legacy_dir, "legacy-logo.png")
        with open(legacy_path, "wb") as handle:
            handle.write(b"legacy-bytes")

        asset = WorkspaceAsset(
            workspace_id=self.workspace_id,
            kind="fascia_logo",
            original_name="legacy-logo.png",
            file_name="legacy-logo.png",
            file_path=legacy_path,
            mime_type="image/png",
            byte_size=12,
            actor_type="project_manager",
            actor_id=1,
        )
        db.session.add(asset)
        db.session.commit()

        self._login_client()
        response = self.client_portal.get(
            f"/api/client/workspaces/{self.workspace_id}/assets/{asset.id}/content"
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("attachment", response.headers.get("Content-Disposition", ""))
        self.assertEqual(response.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(response.data, b"legacy-bytes")
        response.close()

    def test_object_storage_backend_uploads_and_serves_content(self):
        fake_client = _FakeS3Client()
        self.app.config.update(
            WORKSPACE_STORAGE_BACKEND="s3",
            WORKSPACE_STORAGE_OBJECT_BUCKET="workspace-bucket",
            WORKSPACE_STORAGE_OBJECT_PREFIX="shared/workspace",
            WORKSPACE_STORAGE_OBJECT_ENDPOINT_URL="http://object-store.local",
        )
        self.app.extensions.pop("workspace_storage_backend", None)

        with patch(
            "app.workspace.storage_backends._build_s3_object_client",
            return_value=fake_client,
        ):
            ensure_storage_directories(self.app)

            self._login_pm()
            response = self.admin_portal.post(
                f"/api/admin/workspaces/{self.workspace_id}/assets",
                data={
                    "kind": "logo",
                    "file": (io.BytesIO(_png_image_bytes()), "logo.png", "image/png"),
                },
                headers=self._csrf_headers(self.admin_portal, "/admin"),
            )
            self.assertEqual(response.status_code, 201, response.get_json())

            asset = WorkspaceAsset.query.filter_by(workspace_id=self.workspace_id).first()
            self.assertIsNotNone(asset)
            self.assertFalse(os.path.isabs(asset.file_path))
            self.assertTrue(asset.file_path.startswith(f"{self.workspace_id}/"))
            object_key = (
                f"shared/workspace/assets/{asset.file_path}"
            )
            self.assertIn(("workspace-bucket", object_key), fake_client.objects)
            stored_object = fake_client.objects[("workspace-bucket", object_key)]
            self.assertEqual(stored_object["ContentType"], "image/jpeg")
            self.assertIn("attachment", stored_object["ContentDisposition"])

            self._login_client()
            content_response = self.client_portal.get(
                f"/api/client/workspaces/{self.workspace_id}/assets/{asset.id}/content"
            )
            self.assertEqual(content_response.status_code, 200)
            self.assertEqual(content_response.mimetype, "image/jpeg")
            self.assertIn(
                "attachment",
                content_response.headers.get("Content-Disposition", ""),
            )
            self.assertEqual(
                content_response.headers.get("X-Content-Type-Options"),
                "nosniff",
            )
            _assert_jpeg_payload(self, content_response.data)
            content_response.close()

    def test_object_storage_backend_redirects_to_public_asset_origin_when_configured(self):
        fake_client = _FakeS3Client()
        asset = WorkspaceAsset(
            workspace_id=self.workspace_id,
            kind="fascia_logo",
            original_name="logo.html",
            file_name="stored-logo.jpg",
            file_path=f"{self.workspace_id}/stored-logo.jpg",
            mime_type="image/jpeg",
            byte_size=16,
            actor_type="project_manager",
            actor_id=1,
        )
        db.session.add(asset)
        db.session.commit()
        object_key = f"shared/workspace/assets/{asset.file_path}"
        fake_client.objects[("workspace-bucket", object_key)] = {
            "Body": _png_image_bytes(),
            "ContentType": "image/jpeg",
            "ContentDisposition": "attachment",
        }
        self.app.config.update(
            WORKSPACE_STORAGE_BACKEND="s3",
            WORKSPACE_STORAGE_OBJECT_BUCKET="workspace-bucket",
            WORKSPACE_STORAGE_OBJECT_PREFIX="shared/workspace",
            WORKSPACE_STORAGE_OBJECT_PUBLIC_BASE_URL="https://assets.example.test",
        )
        self.app.extensions.pop("workspace_storage_backend", None)

        with patch(
            "app.workspace.storage_backends._build_s3_object_client",
            return_value=fake_client,
        ):
            ensure_storage_directories(self.app)

            self._login_client()
            response = self.client_portal.get(
                f"/api/client/workspaces/{self.workspace_id}/assets/{asset.id}/content"
            )
            self.assertEqual(response.status_code, 302)
            self.assertEqual(
                response.headers.get("Location"),
                f"https://assets.example.test/{object_key}",
            )
            self.assertEqual(response.headers.get("X-Content-Type-Options"), "nosniff")
            self.assertIn("attachment", response.headers.get("Content-Disposition", ""))
            self.assertIn("logo.jpg", response.headers.get("Content-Disposition", ""))
            response.close()

    def test_object_storage_backend_round_trips_snapshot_bytes(self):
        fake_client = _FakeS3Client()
        self.app.config.update(
            WORKSPACE_STORAGE_BACKEND="s3",
            WORKSPACE_STORAGE_OBJECT_BUCKET="workspace-bucket",
            WORKSPACE_STORAGE_OBJECT_PREFIX="shared/workspace",
        )
        self.app.extensions.pop("workspace_storage_backend", None)

        with patch(
            "app.workspace.storage_backends._build_s3_object_client",
            return_value=fake_client,
        ):
            ensure_storage_directories(self.app)
            workspace = db.session.get(Workspace, self.workspace_id)
            self.assertIsNotNone(workspace)

            reference = store_workspace_snapshot_bytes(
                workspace,
                "client-submission-1.json",
                b'{"scene":"snapshot"}',
            )
            self.assertEqual(reference, f"{self.workspace_id}/client-submission-1.json")
            self.assertTrue(workspace_snapshot_exists(workspace, reference))
            self.assertEqual(
                read_workspace_snapshot_bytes(workspace, reference),
                b'{"scene":"snapshot"}',
            )
            self.assertTrue(delete_workspace_snapshot_file(workspace, reference))
            self.assertFalse(workspace_snapshot_exists(workspace, reference))

    def test_object_storage_backend_can_fallback_to_filesystem_assets_during_migration(self):
        legacy_dir = os.path.join(self.asset_root, str(self.workspace_id))
        os.makedirs(legacy_dir, exist_ok=True)
        legacy_name = "migrating-logo.png"
        legacy_path = os.path.join(legacy_dir, legacy_name)
        with open(legacy_path, "wb") as handle:
            handle.write(b"legacy-migration-bytes")

        asset = WorkspaceAsset(
            workspace_id=self.workspace_id,
            kind="fascia_logo",
            original_name=legacy_name,
            file_name=legacy_name,
            file_path=f"{self.workspace_id}/{legacy_name}",
            mime_type="image/png",
            byte_size=22,
            actor_type="project_manager",
            actor_id=1,
        )
        db.session.add(asset)
        db.session.commit()

        fake_client = _FakeS3Client()
        self.app.config.update(
            WORKSPACE_STORAGE_BACKEND="object-storage",
            WORKSPACE_STORAGE_OBJECT_BUCKET="workspace-bucket",
            WORKSPACE_STORAGE_OBJECT_PREFIX="shared/workspace",
            WORKSPACE_STORAGE_OBJECT_ENABLE_FILESYSTEM_FALLBACK=True,
        )
        self.app.extensions.pop("workspace_storage_backend", None)

        with patch(
            "app.workspace.storage_backends._build_s3_object_client",
            return_value=fake_client,
        ):
            ensure_storage_directories(self.app)
            backend = get_workspace_storage_backend(self.app)
            self.assertTrue(backend.describe()["filesystem_fallback_enabled"])

            self._login_client()
            response = self.client_portal.get(
                f"/api/client/workspaces/{self.workspace_id}/assets/{asset.id}/content"
            )
            self.assertEqual(response.status_code, 200)
            self.assertIn("attachment", response.headers.get("Content-Disposition", ""))
            self.assertEqual(response.headers.get("X-Content-Type-Options"), "nosniff")
            self.assertEqual(response.data, b"legacy-migration-bytes")
            response.close()

    def test_object_storage_backend_can_fallback_to_filesystem_snapshots_during_migration(self):
        snapshot_dir = os.path.join(self.snapshot_root, str(self.workspace_id))
        os.makedirs(snapshot_dir, exist_ok=True)
        snapshot_name = "client-submission-legacy.json"
        snapshot_path = os.path.join(snapshot_dir, snapshot_name)
        with open(snapshot_path, "wb") as handle:
            handle.write(b'{"scene":"legacy"}')

        fake_client = _FakeS3Client()
        self.app.config.update(
            WORKSPACE_STORAGE_BACKEND="s3",
            WORKSPACE_STORAGE_OBJECT_BUCKET="workspace-bucket",
            WORKSPACE_STORAGE_OBJECT_PREFIX="shared/workspace",
            WORKSPACE_STORAGE_OBJECT_ENABLE_FILESYSTEM_FALLBACK=True,
        )
        self.app.extensions.pop("workspace_storage_backend", None)

        with patch(
            "app.workspace.storage_backends._build_s3_object_client",
            return_value=fake_client,
        ):
            ensure_storage_directories(self.app)
            workspace = db.session.get(Workspace, self.workspace_id)
            self.assertIsNotNone(workspace)

            reference = f"{self.workspace_id}/{snapshot_name}"
            self.assertTrue(workspace_snapshot_exists(workspace, reference))
            self.assertEqual(
                read_workspace_snapshot_bytes(workspace, reference),
                b'{"scene":"legacy"}',
            )
            self.assertTrue(delete_workspace_snapshot_file(workspace, reference))
            self.assertFalse(os.path.exists(snapshot_path))


if __name__ == "__main__":
    unittest.main()
