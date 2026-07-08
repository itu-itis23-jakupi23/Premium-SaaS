import unittest

from app import create_app
from app.extensions import db
from app.models.activity import ActivityLog
from app.models.user import ChiefManager, Client, ProjectManager
from app.models.workspace import Workspace


class ClientWorkspaceReviewTransitionTests(unittest.TestCase):
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
        self.client_portal = self.app.test_client()
        self._login_client()

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

        workspace_review = Workspace(
            name="Workspace Review",
            client_id=client.id,
            project_manager_id=pm.id,
            status="review",
        )
        workspace_needs_changes = Workspace(
            name="Workspace Needs Changes",
            client_id=client.id,
            project_manager_id=pm.id,
            status="needs_changes",
        )
        workspace_approved = Workspace(
            name="Workspace Approved",
            client_id=client.id,
            project_manager_id=pm.id,
            status="approved",
        )
        workspace_draft = Workspace(
            name="Workspace Draft",
            client_id=client.id,
            project_manager_id=pm.id,
            status="draft",
        )
        db.session.add_all(
            [
                workspace_review,
                workspace_needs_changes,
                workspace_approved,
                workspace_draft,
            ]
        )
        db.session.commit()

        self.client_email = client.email
        self.workspace_review_id = workspace_review.id
        self.workspace_needs_changes_id = workspace_needs_changes.id
        self.workspace_approved_id = workspace_approved.id
        self.workspace_draft_id = workspace_draft.id

    def _login_client(self):
        response = self.client_portal.post(
            "/api/client/auth/login",
            json={"email": self.client_email, "password": "Password123!"},
        )
        self.assertEqual(response.status_code, 200, response.get_json())

    def _csrf_headers(self):
        cookie = self.client_portal.get_cookie("csrf_access_token", path="/app")
        self.assertIsNotNone(cookie)
        return {"X-CSRF-TOKEN": cookie.value}

    def _activity_count(self, workspace_id, action=None):
        query = ActivityLog.query.filter_by(workspace_id=workspace_id)
        if action is not None:
            query = query.filter_by(action=action)
        return query.count()

    def test_client_can_approve_from_review_state(self):
        response = self.client_portal.post(
            f"/api/client/workspaces/{self.workspace_review_id}/approve",
            headers=self._csrf_headers(),
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json()["message"], "Design approved")

        workspace = db.session.get(Workspace, self.workspace_review_id)
        self.assertEqual(workspace.status, "approved")
        latest_activity = (
            ActivityLog.query.filter_by(workspace_id=self.workspace_review_id)
            .order_by(ActivityLog.id.desc())
            .first()
        )
        self.assertIsNotNone(latest_activity)
        self.assertEqual(latest_activity.action, "Client approved final design")

    def test_client_can_request_changes_from_review_state(self):
        response = self.client_portal.post(
            f"/api/client/workspaces/{self.workspace_review_id}/request-changes",
            json={"message": "Please update the reception desk layout."},
            headers=self._csrf_headers(),
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json()["message"], "Changes requested")

        workspace = db.session.get(Workspace, self.workspace_review_id)
        self.assertEqual(workspace.status, "needs_changes")
        latest_activity = (
            ActivityLog.query.filter_by(workspace_id=self.workspace_review_id)
            .order_by(ActivityLog.id.desc())
            .first()
        )
        self.assertIsNotNone(latest_activity)
        self.assertIn("Changes requested:", latest_activity.action)

    def test_client_can_send_arrangement_from_review_state(self):
        response = self.client_portal.post(
            f"/api/client/workspaces/{self.workspace_review_id}/send-arrangement",
            json={"note": "Updated the furniture layout for the next review."},
            headers=self._csrf_headers(),
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(
            response.get_json()["message"],
            "Arrangement sent to project manager",
        )

        workspace = db.session.get(Workspace, self.workspace_review_id)
        self.assertEqual(workspace.status, "needs_changes")
        self.assertEqual(workspace.client_arrangement_rounds_used, 1)
        latest_activity = (
            ActivityLog.query.filter_by(workspace_id=self.workspace_review_id)
            .order_by(ActivityLog.id.desc())
            .first()
        )
        self.assertIsNotNone(latest_activity)
        self.assertIn("Client submitted furniture arrangement", latest_activity.action)

    def test_client_cannot_approve_when_changes_already_requested(self):
        activity_count_before = self._activity_count(self.workspace_needs_changes_id)
        response = self.client_portal.post(
            f"/api/client/workspaces/{self.workspace_needs_changes_id}/approve",
            headers=self._csrf_headers(),
        )
        self.assertEqual(response.status_code, 409, response.get_json())
        payload = response.get_json() or {}
        self.assertIn("Changes have already been requested", payload.get("error", ""))
        self.assertEqual(payload.get("current_status"), "needs_changes")
        self.assertEqual(payload.get("allowed_statuses"), ["review"])

        workspace = db.session.get(Workspace, self.workspace_needs_changes_id)
        self.assertEqual(workspace.status, "needs_changes")
        self.assertEqual(
            self._activity_count(self.workspace_needs_changes_id),
            activity_count_before,
        )

    def test_client_cannot_request_changes_after_approval(self):
        activity_count_before = self._activity_count(self.workspace_approved_id)
        response = self.client_portal.post(
            f"/api/client/workspaces/{self.workspace_approved_id}/request-changes",
            json={"message": "Please reopen this design."},
            headers=self._csrf_headers(),
        )
        self.assertEqual(response.status_code, 409, response.get_json())
        payload = response.get_json() or {}
        self.assertIn("Approved designs cannot request more changes", payload.get("error", ""))
        self.assertEqual(payload.get("current_status"), "approved")
        self.assertEqual(payload.get("allowed_statuses"), ["review"])

        workspace = db.session.get(Workspace, self.workspace_approved_id)
        self.assertEqual(workspace.status, "approved")
        self.assertEqual(
            self._activity_count(self.workspace_approved_id),
            activity_count_before,
        )

    def test_repeated_approve_returns_conflict_without_duplicate_activity(self):
        first_response = self.client_portal.post(
            f"/api/client/workspaces/{self.workspace_review_id}/approve",
            headers=self._csrf_headers(),
        )
        self.assertEqual(first_response.status_code, 200, first_response.get_json())

        second_response = self.client_portal.post(
            f"/api/client/workspaces/{self.workspace_review_id}/approve",
            headers=self._csrf_headers(),
        )
        self.assertEqual(second_response.status_code, 409, second_response.get_json())
        payload = second_response.get_json() or {}
        self.assertIn("already been approved", payload.get("error", ""))
        self.assertEqual(payload.get("current_status"), "approved")

        workspace = db.session.get(Workspace, self.workspace_review_id)
        self.assertEqual(workspace.status, "approved")
        self.assertEqual(
            self._activity_count(
                self.workspace_review_id,
                "Client approved final design",
            ),
            1,
        )

    def test_approve_after_already_approved_returns_conflict_without_activity(self):
        activity_count_before = self._activity_count(self.workspace_approved_id)
        response = self.client_portal.post(
            f"/api/client/workspaces/{self.workspace_approved_id}/approve",
            headers=self._csrf_headers(),
        )
        self.assertEqual(response.status_code, 409, response.get_json())
        payload = response.get_json() or {}
        self.assertIn("already been approved", payload.get("error", ""))
        self.assertEqual(payload.get("current_status"), "approved")

        workspace = db.session.get(Workspace, self.workspace_approved_id)
        self.assertEqual(workspace.status, "approved")
        self.assertEqual(
            self._activity_count(self.workspace_approved_id),
            activity_count_before,
        )

    def test_repeated_request_changes_returns_conflict_without_duplicate_activity(self):
        first_response = self.client_portal.post(
            f"/api/client/workspaces/{self.workspace_review_id}/request-changes",
            json={"message": "Please move the front counter."},
            headers=self._csrf_headers(),
        )
        self.assertEqual(first_response.status_code, 200, first_response.get_json())

        second_response = self.client_portal.post(
            f"/api/client/workspaces/{self.workspace_review_id}/request-changes",
            json={"message": "Duplicate request."},
            headers=self._csrf_headers(),
        )
        self.assertEqual(second_response.status_code, 409, second_response.get_json())
        payload = second_response.get_json() or {}
        self.assertIn("Changes have already been requested", payload.get("error", ""))
        self.assertEqual(payload.get("current_status"), "needs_changes")

        workspace = db.session.get(Workspace, self.workspace_review_id)
        self.assertEqual(workspace.status, "needs_changes")
        self.assertEqual(
            self._activity_count(self.workspace_review_id),
            1,
        )

    def test_client_cannot_request_changes_from_draft_state(self):
        response = self.client_portal.post(
            f"/api/client/workspaces/{self.workspace_draft_id}/request-changes",
            json={"message": "Please revise this draft before review."},
            headers=self._csrf_headers(),
        )
        self.assertEqual(response.status_code, 409, response.get_json())
        payload = response.get_json() or {}
        self.assertIn("not currently awaiting client review", payload.get("error", ""))
        self.assertEqual(payload.get("current_status"), "draft")
        self.assertEqual(payload.get("allowed_statuses"), ["review"])

        workspace = db.session.get(Workspace, self.workspace_draft_id)
        self.assertEqual(workspace.status, "draft")

    def test_client_cannot_approve_from_draft_state(self):
        response = self.client_portal.post(
            f"/api/client/workspaces/{self.workspace_draft_id}/approve",
            headers=self._csrf_headers(),
        )
        self.assertEqual(response.status_code, 409, response.get_json())
        payload = response.get_json() or {}
        self.assertIn("not currently awaiting client approval", payload.get("error", ""))
        self.assertEqual(payload.get("current_status"), "draft")
        self.assertEqual(payload.get("allowed_statuses"), ["review"])

        workspace = db.session.get(Workspace, self.workspace_draft_id)
        self.assertEqual(workspace.status, "draft")

    def test_client_cannot_send_arrangement_after_approval(self):
        response = self.client_portal.post(
            f"/api/client/workspaces/{self.workspace_approved_id}/send-arrangement",
            json={"note": "Trying to reopen an approved design."},
            headers=self._csrf_headers(),
        )
        self.assertEqual(response.status_code, 403, response.get_json())
        payload = response.get_json() or {}
        self.assertIn("already approved", payload.get("error", "").lower())
        self.assertIn("permissions", payload)

        workspace = db.session.get(Workspace, self.workspace_approved_id)
        self.assertEqual(workspace.status, "approved")

    def test_repeated_send_arrangement_is_rejected_without_extra_round_or_activity(self):
        first_response = self.client_portal.post(
            f"/api/client/workspaces/{self.workspace_review_id}/send-arrangement",
            json={"note": "Ready for PM review."},
            headers=self._csrf_headers(),
        )
        self.assertEqual(first_response.status_code, 200, first_response.get_json())

        second_response = self.client_portal.post(
            f"/api/client/workspaces/{self.workspace_review_id}/send-arrangement",
            json={"note": "Duplicate submit."},
            headers=self._csrf_headers(),
        )
        self.assertEqual(second_response.status_code, 403, second_response.get_json())

        workspace = db.session.get(Workspace, self.workspace_review_id)
        self.assertEqual(workspace.status, "needs_changes")
        self.assertEqual(workspace.client_arrangement_rounds_used, 1)
        self.assertEqual(self._activity_count(self.workspace_review_id), 1)


if __name__ == "__main__":
    unittest.main()
