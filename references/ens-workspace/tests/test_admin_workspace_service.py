import json
import unittest

from app import create_app
from app.extensions import db
from app.models.activity import ActivityLog
from app.models.user import ChiefManager, Client, ProjectManager
from app.models.workspace import Workspace, WorkspaceFeedbackRequest, WorkspaceVersion
from app.services.admin_workspace_service import (
    build_admin_workspace_payload,
    create_admin_workspace_feedback,
    create_admin_workspace_version,
    restore_admin_workspace_version,
    save_admin_workspace_scene,
    share_admin_workspace_with_client,
)
from app.services.workspace_review_transition_service import WorkspaceReviewTransitionError


class AdminWorkspaceServiceTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app("testing")
        self.app.config.update(
            ADMIN_DOMAIN="localhost",
            CLIENT_DOMAIN="localhost",
            TESTING=True,
        )
        self.app_context = self.app.app_context()
        self.app_context.push()
        db.create_all()
        self._seed_data()
        self.admin_portal = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def _seed_data(self):
        chief = ChiefManager(
            first_name="Chief",
            last_name="Manager",
            email="chief@example.com",
        )
        chief.set_password("Password123!")
        db.session.add(chief)
        db.session.flush()

        pm = ProjectManager(
            first_name="Project",
            last_name="Manager",
            email="pm.one@example.com",
            chief_id=chief.id,
        )
        pm.set_password("Password123!")
        db.session.add(pm)
        db.session.flush()

        client = Client(
            first_name="Client",
            last_name="One",
            email="client.one@example.com",
            project_manager_id=pm.id,
            status="active",
        )
        client.set_password("Password123!")
        db.session.add(client)
        db.session.flush()

        workspace = Workspace(
            name="Workspace One",
            client_id=client.id,
            project_manager_id=None,
            exhibition_id=None,
            status="draft",
            scene_data="",
            client_draft_scene_data="",
            version=1,
        )
        db.session.add(workspace)
        db.session.commit()

        self.pm_id = pm.id
        self.pm_email = pm.email
        self.client_id = client.id
        self.workspace_id = workspace.id

    def _workspace(self):
        return db.session.get(Workspace, self.workspace_id)

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

    def _base_scene(self):
        return {
            "dims": {"width": 6, "depth": 3, "height": 2.48},
            "models": [],
            "siteObjects": [],
            "items": [],
            "booth": {"openSides": {"front": True}},
        }

    def test_build_admin_workspace_payload_includes_expected_editor_context(self):
        workspace = self._workspace()
        workspace.scene_data = json.dumps(self._base_scene())
        db.session.commit()

        payload = build_admin_workspace_payload(workspace)

        self.assertEqual(payload["workspace"]["id"], workspace.id)
        self.assertIn("scene", payload)
        self.assertIn("assets", payload)
        self.assertIn("versions", payload)
        self.assertIn("review", payload)
        self.assertEqual(payload["permissions"], {"can_edit": True, "can_save": True})

    def test_save_admin_workspace_scene_increments_version_and_logs_activity(self):
        workspace = self._workspace()

        outcome = save_admin_workspace_scene(
            workspace,
            self._base_scene(),
            role="project_manager",
            actor_id=self.pm_id,
        )

        self.assertEqual(outcome.version, 2)
        self.assertEqual(db.session.get(Workspace, self.workspace_id).version, 2)
        latest_activity = (
            ActivityLog.query.filter_by(workspace_id=self.workspace_id)
            .order_by(ActivityLog.id.desc())
            .first()
        )
        self.assertIsNotNone(latest_activity)
        self.assertIn("Admin workspace saved", latest_activity.action)

    def test_share_admin_workspace_with_client_creates_review_share(self):
        workspace = self._workspace()
        workspace.scene_data = json.dumps(self._base_scene())
        db.session.commit()

        outcome = share_admin_workspace_with_client(
            workspace,
            note="Client review ready.",
            role="project_manager",
            actor_id=self.pm_id,
        )

        refreshed = self._workspace()
        self.assertEqual(refreshed.status, "review")
        self.assertEqual(refreshed.project_manager_id, self.pm_id)
        self.assertIsNotNone(refreshed.client_draft_scene_data)
        self.assertEqual(outcome.context["workspace"]["status"], "review")

        share_version = (
            WorkspaceVersion.query.filter_by(
                workspace_id=self.workspace_id,
                version_kind="pm_share",
            )
            .order_by(WorkspaceVersion.id.desc())
            .first()
        )
        self.assertIsNotNone(share_version)
        self.assertEqual(share_version.notes, "Client review ready.")

    def test_share_admin_workspace_with_client_preserves_approved_status_on_reshare(self):
        workspace = self._workspace()
        workspace.scene_data = json.dumps(self._base_scene())
        workspace.status = "approved"
        db.session.commit()

        outcome = share_admin_workspace_with_client(
            workspace,
            note="Approved copy re-shared.",
            role="project_manager",
            actor_id=self.pm_id,
        )

        refreshed = self._workspace()
        self.assertEqual(refreshed.status, "approved")
        self.assertEqual(outcome.context["workspace"]["status"], "approved")

    def test_duplicate_share_with_same_scene_and_note_is_noop(self):
        workspace = self._workspace()
        workspace.scene_data = json.dumps(self._base_scene())
        db.session.commit()

        first = share_admin_workspace_with_client(
            workspace,
            note="Client review ready.",
            role="project_manager",
            actor_id=self.pm_id,
        )
        self.assertEqual(first.context["workspace"]["status"], "review")
        version_count_after_first = WorkspaceVersion.query.filter_by(
            workspace_id=self.workspace_id,
            version_kind="pm_share",
        ).count()
        activity_count_after_first = ActivityLog.query.filter_by(
            workspace_id=self.workspace_id,
            action="Design sent to client for review: Client review ready.",
        ).count()

        second = share_admin_workspace_with_client(
            workspace,
            note="Client review ready.",
            role="project_manager",
            actor_id=self.pm_id,
        )

        self.assertEqual(second.context["workspace"]["status"], "review")
        self.assertEqual(
            WorkspaceVersion.query.filter_by(
                workspace_id=self.workspace_id,
                version_kind="pm_share",
            ).count(),
            version_count_after_first,
        )
        self.assertEqual(
            ActivityLog.query.filter_by(
                workspace_id=self.workspace_id,
                action="Design sent to client for review: Client review ready.",
            ).count(),
            activity_count_after_first,
        )

    def test_create_and_restore_admin_workspace_version_preserve_scene_history(self):
        workspace = self._workspace()
        workspace.scene_data = json.dumps(self._base_scene())
        db.session.commit()

        created = create_admin_workspace_version(
            workspace,
            label="Checkpoint A",
            scene=self._base_scene(),
            role="project_manager",
            actor_id=self.pm_id,
        )
        self.assertEqual(created.version.label, "Checkpoint A")

        updated_scene = self._base_scene()
        updated_scene["dims"]["width"] = 8
        workspace.scene_data = json.dumps(updated_scene)
        db.session.commit()

        restored = restore_admin_workspace_version(
            workspace,
            created.version,
            role="project_manager",
            actor_id=self.pm_id,
        )

        self.assertEqual(restored.scene["dims"]["width"], 6)
        self.assertEqual(db.session.get(Workspace, self.workspace_id).version, 2)

    def test_create_admin_workspace_feedback_marks_needs_changes_and_targets_latest_submission(self):
        workspace = self._workspace()
        workspace.status = "review"
        workspace.scene_data = json.dumps(self._base_scene())
        db.session.add(
            WorkspaceVersion(
                workspace_id=workspace.id,
                label="Client submission 1",
                scene_data=json.dumps(self._base_scene()),
                version_kind="client_submission",
                actor_type="client",
                actor_id=self.client_id,
                submission_round=1,
            )
        )
        db.session.commit()

        outcome = create_admin_workspace_feedback(
            workspace,
            summary="Adjust the front desk",
            items=["Move the desk", "Open the left side"],
            role="project_manager",
            actor_id=self.pm_id,
        )

        refreshed = self._workspace()
        self.assertEqual(refreshed.status, "needs_changes")
        feedback = WorkspaceFeedbackRequest.query.filter_by(
            workspace_id=self.workspace_id
        ).first()
        self.assertIsNotNone(feedback)
        self.assertIsNotNone(feedback.target_version_id)
        self.assertEqual(outcome.feedback["summary"], "Adjust the front desk")
        self.assertIn("timeline", outcome.review)

    def test_repeated_admin_feedback_is_rejected_without_duplicate_activity(self):
        workspace = self._workspace()
        workspace.status = "review"
        workspace.project_manager_id = self.pm_id
        workspace.scene_data = json.dumps(self._base_scene())
        db.session.commit()

        create_admin_workspace_feedback(
            workspace,
            summary="Adjust the front desk",
            items=["Move the desk"],
            role="project_manager",
            actor_id=self.pm_id,
        )
        feedback_count_after_first = WorkspaceFeedbackRequest.query.filter_by(
            workspace_id=self.workspace_id
        ).count()
        activity_count_after_first = ActivityLog.query.filter_by(
            workspace_id=self.workspace_id
        ).count()

        with self.assertRaises(WorkspaceReviewTransitionError) as exc:
            create_admin_workspace_feedback(
                workspace,
                summary="Duplicate change request",
                items=["Move the desk again"],
                role="project_manager",
                actor_id=self.pm_id,
            )

        self.assertEqual(exc.exception.status_code, 409)
        self.assertEqual(self._workspace().status, "needs_changes")
        self.assertEqual(
            WorkspaceFeedbackRequest.query.filter_by(
                workspace_id=self.workspace_id
            ).count(),
            feedback_count_after_first,
        )
        self.assertEqual(
            ActivityLog.query.filter_by(workspace_id=self.workspace_id).count(),
            activity_count_after_first,
        )

    def test_admin_feedback_rejects_approved_terminal_state_without_mutation(self):
        workspace = self._workspace()
        workspace.status = "approved"
        workspace.project_manager_id = self.pm_id
        workspace.scene_data = json.dumps(self._base_scene())
        db.session.commit()
        feedback_count_before = WorkspaceFeedbackRequest.query.count()
        activity_count_before = ActivityLog.query.count()

        with self.assertRaises(WorkspaceReviewTransitionError) as exc:
            create_admin_workspace_feedback(
                workspace,
                summary="Reopen approved design",
                items=["Move the desk"],
                role="project_manager",
                actor_id=self.pm_id,
            )

        self.assertEqual(exc.exception.status_code, 409)
        self.assertEqual(self._workspace().status, "approved")
        self.assertEqual(WorkspaceFeedbackRequest.query.count(), feedback_count_before)
        self.assertEqual(ActivityLog.query.count(), activity_count_before)

    def test_feedback_route_rejects_repeated_request_without_duplicate_rows(self):
        workspace = self._workspace()
        workspace.status = "review"
        workspace.project_manager_id = self.pm_id
        workspace.scene_data = json.dumps(self._base_scene())
        db.session.commit()
        self._login_pm()

        first = self.admin_portal.post(
            f"/api/admin/workspaces/{self.workspace_id}/feedback",
            json={"summary": "Adjust the front desk", "items": ["Move the desk"]},
            headers=self._csrf_headers(),
        )
        self.assertEqual(first.status_code, 201, first.get_json())
        feedback_count_after_first = WorkspaceFeedbackRequest.query.filter_by(
            workspace_id=self.workspace_id
        ).count()
        activity_count_after_first = ActivityLog.query.filter_by(
            workspace_id=self.workspace_id
        ).count()

        second = self.admin_portal.post(
            f"/api/admin/workspaces/{self.workspace_id}/feedback",
            json={
                "summary": "Duplicate change request",
                "items": ["Move the desk again"],
            },
            headers=self._csrf_headers(),
        )
        self.assertEqual(second.status_code, 409, second.get_json())

        self.assertEqual(self._workspace().status, "needs_changes")
        self.assertEqual(
            WorkspaceFeedbackRequest.query.filter_by(
                workspace_id=self.workspace_id
            ).count(),
            feedback_count_after_first,
        )
        self.assertEqual(
            ActivityLog.query.filter_by(workspace_id=self.workspace_id).count(),
            activity_count_after_first,
        )

    def test_feedback_route_rejects_approved_terminal_state_without_mutation(self):
        workspace = self._workspace()
        workspace.status = "approved"
        workspace.project_manager_id = self.pm_id
        workspace.scene_data = json.dumps(self._base_scene())
        db.session.commit()
        feedback_count_before = WorkspaceFeedbackRequest.query.count()
        activity_count_before = ActivityLog.query.count()
        self._login_pm()

        response = self.admin_portal.post(
            f"/api/admin/workspaces/{self.workspace_id}/feedback",
            json={"summary": "Reopen approved design", "items": ["Move the desk"]},
            headers=self._csrf_headers(),
        )
        self.assertEqual(response.status_code, 409, response.get_json())

        self.assertEqual(self._workspace().status, "approved")
        self.assertEqual(WorkspaceFeedbackRequest.query.count(), feedback_count_before)
        self.assertEqual(ActivityLog.query.count(), activity_count_before)


if __name__ == "__main__":
    unittest.main()
