import io
import os
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

from app import create_app
from app.extensions import db
from app.models.activity import ActivityLog
from app.models.exhibition import Exhibition
from app.models.user import ChiefManager, Client, ProjectManager
from app.models.workspace import Workspace, WorkspaceAsset
from app.workspace.storage import ensure_storage_directories


def _png_image_bytes(color=(255, 0, 0, 255), size=(4, 4)):
    buffer = io.BytesIO()
    Image.new("RGBA", size, color).save(buffer, format="PNG")
    return buffer.getvalue()


def _assert_jpeg_payload(test_case, payload):
    with Image.open(io.BytesIO(payload)) as image:
        test_case.assertEqual(image.format, "JPEG")
        test_case.assertEqual(image.mode, "RGB")


class WorkspaceUploadValidationIntegrationTests(unittest.TestCase):
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
            name="Upload Workspace",
            client_id=client.id,
            project_manager_id=pm.id,
            exhibition_id=exhibition.id,
            status="review",
        )
        db.session.add(workspace)
        db.session.commit()

        self.pm_email = pm.email
        self.workspace_id = workspace.id

    def _login_pm(self):
        response = self.admin_portal.post(
            "/api/admin/auth/pm/login",
            json={"email": self.pm_email, "password": "Password123!"},
        )
        self.assertEqual(response.status_code, 200, response.get_json())

    def _csrf_headers(self):
        cookie = self.admin_portal.get_cookie("csrf_access_token", path="/admin")
        self.assertIsNotNone(cookie)
        return {"X-CSRF-TOKEN": cookie.value}

    def _stored_file_count(self):
        count = 0
        for _, _, files in os.walk(self.asset_root):
            count += len(files)
        return count

    def test_upload_rejects_invalid_kind_without_creating_rows_or_files(self):
        self._login_pm()
        asset_count_before = WorkspaceAsset.query.count()
        activity_count_before = ActivityLog.query.count()
        file_count_before = self._stored_file_count()

        response = self.admin_portal.post(
            f"/api/admin/workspaces/{self.workspace_id}/assets",
            data={
                "kind": "not-a-real-kind",
                "file": (io.BytesIO(_png_image_bytes()), "logo.png", "image/png"),
            },
            headers=self._csrf_headers(),
        )
        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertEqual(
            response.get_json(),
            {"error": "Valid asset kind is required"},
        )
        self.assertEqual(WorkspaceAsset.query.count(), asset_count_before)
        self.assertEqual(ActivityLog.query.count(), activity_count_before)
        self.assertEqual(self._stored_file_count(), file_count_before)

    def test_upload_rejects_unsupported_mime_without_storing_bytes(self):
        self._login_pm()
        asset_count_before = WorkspaceAsset.query.count()
        activity_count_before = ActivityLog.query.count()
        file_count_before = self._stored_file_count()

        response = self.admin_portal.post(
            f"/api/admin/workspaces/{self.workspace_id}/assets",
            data={
                "kind": "logo",
                "file": (io.BytesIO(b"not-an-image"), "note.txt", "text/plain"),
            },
            headers=self._csrf_headers(),
        )
        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertEqual(
            response.get_json(),
            {"error": "Invalid file type"},
        )
        self.assertEqual(WorkspaceAsset.query.count(), asset_count_before)
        self.assertEqual(ActivityLog.query.count(), activity_count_before)
        self.assertEqual(self._stored_file_count(), file_count_before)

    def test_upload_rejects_html_even_when_filename_claims_image(self):
        self._login_pm()
        asset_count_before = WorkspaceAsset.query.count()
        activity_count_before = ActivityLog.query.count()
        file_count_before = self._stored_file_count()

        response = self.admin_portal.post(
            f"/api/admin/workspaces/{self.workspace_id}/assets",
            data={
                "kind": "logo",
                "file": (
                    io.BytesIO(b"<html><script>alert(1)</script></html>"),
                    "logo.jpg",
                    "image/jpeg",
                ),
            },
            headers=self._csrf_headers(),
        )

        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertEqual(response.get_json(), {"error": "Invalid file type"})
        self.assertEqual(WorkspaceAsset.query.count(), asset_count_before)
        self.assertEqual(ActivityLog.query.count(), activity_count_before)
        self.assertEqual(self._stored_file_count(), file_count_before)

    def test_upload_rejects_oversized_payload_without_storing_bytes(self):
        self._login_pm()
        asset_count_before = WorkspaceAsset.query.count()
        activity_count_before = ActivityLog.query.count()
        file_count_before = self._stored_file_count()

        response = self.admin_portal.post(
            f"/api/admin/workspaces/{self.workspace_id}/assets",
            data={
                "kind": "logo",
                "file": (
                    io.BytesIO(b"x" * ((2 * 1024 * 1024) + 1)),
                    "huge.png",
                    "image/png",
                ),
            },
            headers=self._csrf_headers(),
        )
        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertEqual(
            response.get_json(),
            {"error": "File exceeds 2MB limit"},
        )
        self.assertEqual(WorkspaceAsset.query.count(), asset_count_before)
        self.assertEqual(ActivityLog.query.count(), activity_count_before)
        self.assertEqual(self._stored_file_count(), file_count_before)

    def test_upload_success_persists_asset_and_storage_reference(self):
        self._login_pm()

        response = self.admin_portal.post(
            f"/api/admin/workspaces/{self.workspace_id}/assets",
            data={
                "kind": "logo",
                "file": (io.BytesIO(_png_image_bytes()), "logo.png", "image/png"),
            },
            headers=self._csrf_headers(),
        )
        self.assertEqual(response.status_code, 201, response.get_json())

        payload = response.get_json() or {}
        asset_payload = payload.get("asset") or {}
        asset = WorkspaceAsset.query.filter_by(workspace_id=self.workspace_id).first()
        self.assertIsNotNone(asset)
        self.assertEqual(payload.get("message"), "Asset uploaded")
        self.assertEqual(asset_payload.get("kind"), "fascia_logo")
        self.assertEqual(asset_payload.get("id"), asset.id)
        self.assertTrue(
            asset_payload.get("url", "").endswith(
                f"/api/admin/workspaces/{self.workspace_id}/assets/{asset.id}/content"
            )
        )
        self.assertEqual(len(payload.get("assets") or []), 1)
        self.assertFalse(os.path.isabs(asset.file_path))
        self.assertEqual(asset.mime_type, "image/jpeg")
        self.assertTrue(asset.file_name.endswith(".jpg"))

        stored_path = os.path.join(
            self.asset_root, asset.file_path.replace("/", os.sep)
        )
        self.assertTrue(os.path.isfile(stored_path))
        with open(stored_path, "rb") as handle:
            stored_payload = handle.read()
        _assert_jpeg_payload(self, stored_payload)
        self.assertEqual(asset.byte_size, len(stored_payload))

        latest_activity = (
            ActivityLog.query.filter_by(workspace_id=self.workspace_id)
            .order_by(ActivityLog.id.desc())
            .first()
        )
        self.assertIsNotNone(latest_activity)
        self.assertEqual(latest_activity.action, "Workspace asset uploaded: logo.png")

    def test_upload_accepts_image_bytes_with_misleading_extension_and_transcodes(self):
        self._login_pm()

        response = self.admin_portal.post(
            f"/api/admin/workspaces/{self.workspace_id}/assets",
            data={
                "kind": "logo",
                "file": (io.BytesIO(_png_image_bytes()), "logo.html", "text/html"),
            },
            headers=self._csrf_headers(),
        )
        self.assertEqual(response.status_code, 201, response.get_json())

        asset = WorkspaceAsset.query.filter_by(workspace_id=self.workspace_id).first()
        self.assertIsNotNone(asset)
        self.assertEqual(asset.original_name, "logo.html")
        self.assertEqual(asset.mime_type, "image/jpeg")
        self.assertTrue(asset.file_name.endswith(".jpg"))

        stored_path = os.path.join(
            self.asset_root, asset.file_path.replace("/", os.sep)
        )
        with open(stored_path, "rb") as handle:
            stored_payload = handle.read()
        _assert_jpeg_payload(self, stored_payload)
        self.assertEqual(asset.byte_size, len(stored_payload))

    def test_upload_commit_failure_cleans_up_stored_file(self):
        self._login_pm()
        asset_count_before = WorkspaceAsset.query.count()
        activity_count_before = ActivityLog.query.count()
        file_count_before = self._stored_file_count()

        with patch(
            "app.admin.workspace.db.session.commit",
            side_effect=RuntimeError("simulated database outage"),
        ):
            response = self.admin_portal.post(
                f"/api/admin/workspaces/{self.workspace_id}/assets",
                data={
                    "kind": "logo",
                    "file": (io.BytesIO(_png_image_bytes()), "logo.png", "image/png"),
                },
                headers=self._csrf_headers(),
            )

        self.assertEqual(response.status_code, 500, response.get_json())
        self.assertEqual(
            response.get_json(),
            {"error": "Asset upload could not be completed"},
        )
        self.assertEqual(WorkspaceAsset.query.count(), asset_count_before)
        self.assertEqual(ActivityLog.query.count(), activity_count_before)
        self.assertEqual(self._stored_file_count(), file_count_before)

    def test_upload_commit_failure_logs_cleanup_failure(self):
        self._login_pm()
        asset_count_before = WorkspaceAsset.query.count()
        activity_count_before = ActivityLog.query.count()
        file_count_before = self._stored_file_count()

        with patch(
            "app.admin.workspace.db.session.commit",
            side_effect=RuntimeError("simulated database outage"),
        ), patch(
            "app.admin.workspace.delete_workspace_asset_file",
            side_effect=RuntimeError("cleanup unavailable"),
        ), patch.object(self.app.logger, "exception") as mock_log_exception:
            response = self.admin_portal.post(
                f"/api/admin/workspaces/{self.workspace_id}/assets",
                data={
                    "kind": "logo",
                    "file": (io.BytesIO(_png_image_bytes()), "logo.png", "image/png"),
                },
                headers=self._csrf_headers(),
            )

        self.assertEqual(response.status_code, 500, response.get_json())
        self.assertEqual(
            response.get_json(),
            {"error": "Asset upload could not be completed"},
        )
        self.assertEqual(WorkspaceAsset.query.count(), asset_count_before)
        self.assertEqual(ActivityLog.query.count(), activity_count_before)
        self.assertEqual(self._stored_file_count(), file_count_before + 1)
        messages = [call.args[0] for call in mock_log_exception.call_args_list]
        self.assertIn(
            "Workspace asset upload persistence failed; cleaning up stored file",
            messages,
        )
        self.assertIn(
            "Failed to clean up workspace asset after upload persistence failure",
            messages,
        )


if __name__ == "__main__":
    unittest.main()
