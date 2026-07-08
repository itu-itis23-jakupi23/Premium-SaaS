import unittest

from app import create_app
from app.extensions import db
from app.models.user import ChiefManager, Client, ProjectManager
from app.models.workspace import Workspace
from app.services.client_subscription_validation_service import (
    ClientSubscriptionRequestError,
    validate_client_workspace_subscription_request,
)
from app.services.workspace_access_validation_service import (
    WorkspaceAccessValidationError,
    require_admin_workspace_access,
    require_client_workspace_access,
    require_project_manager_client_access,
    require_project_manager_workspace_access,
    require_project_workspace_access,
)
from app.services.workspace_review_transition_service import (
    apply_workspace_review_transition,
    WorkspaceReviewTransitionError,
    workspace_review_transition_map,
    require_workspace_send_to_client,
)
from app.services.workspace_workflow_validation_service import (
    WorkspaceWorkflowValidationError,
    validate_client_workspace_action,
)


class WorkflowValidationServiceTests(unittest.TestCase):
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

        pm_one = ProjectManager(
            first_name="Project",
            last_name="One",
            email="pm.one@example.com",
            chief_id=chief.id,
        )
        pm_one.set_password("Password123!")
        pm_two = ProjectManager(
            first_name="Project",
            last_name="Two",
            email="pm.two@example.com",
            chief_id=chief.id,
        )
        pm_two.set_password("Password123!")
        db.session.add_all([pm_one, pm_two])
        db.session.flush()

        client_one = Client(
            first_name="Client",
            last_name="One",
            email="client.one@example.com",
            project_manager_id=pm_one.id,
            status="active",
        )
        client_one.set_password("Password123!")
        client_two = Client(
            first_name="Client",
            last_name="Two",
            email="client.two@example.com",
            project_manager_id=pm_two.id,
            status="active",
        )
        client_two.set_password("Password123!")
        client_unassigned = Client(
            first_name="Client",
            last_name="Unassigned",
            email="client.unassigned@example.com",
            project_manager_id=None,
            status="active",
        )
        client_unassigned.set_password("Password123!")
        db.session.add_all([client_one, client_two, client_unassigned])
        db.session.flush()

        workspace_review = Workspace(
            name="Workspace Review",
            client_id=client_one.id,
            project_manager_id=pm_one.id,
            status="review",
        )
        workspace_approved = Workspace(
            name="Workspace Approved",
            client_id=client_one.id,
            project_manager_id=pm_one.id,
            status="approved",
        )
        workspace_needs_changes = Workspace(
            name="Workspace Needs Changes",
            client_id=client_one.id,
            project_manager_id=pm_one.id,
            status="needs_changes",
        )
        workspace_unassigned = Workspace(
            name="Workspace Unassigned",
            client_id=client_unassigned.id,
            project_manager_id=None,
            status="review",
        )
        workspace_pm_two = Workspace(
            name="Workspace PM Two",
            client_id=client_two.id,
            project_manager_id=pm_two.id,
            status="review",
        )
        db.session.add_all(
            [
                workspace_review,
                workspace_approved,
                workspace_needs_changes,
                workspace_unassigned,
                workspace_pm_two,
            ]
        )
        db.session.commit()

        self.pm_one_id = pm_one.id
        self.pm_two_id = pm_two.id
        self.client_one_id = client_one.id
        self.client_two_id = client_two.id
        self.client_unassigned_id = client_unassigned.id
        self.workspace_review_id = workspace_review.id
        self.workspace_approved_id = workspace_approved.id
        self.workspace_needs_changes_id = workspace_needs_changes.id
        self.workspace_unassigned_id = workspace_unassigned.id
        self.workspace_pm_two_id = workspace_pm_two.id

    def test_require_admin_workspace_access_allows_owner(self):
        workspace = require_admin_workspace_access(
            self.workspace_review_id,
            "project_manager",
            self.pm_one_id,
        )
        self.assertEqual(workspace.id, self.workspace_review_id)

    def test_require_admin_workspace_access_blocks_other_project_manager(self):
        with self.assertRaises(WorkspaceAccessValidationError) as exc:
            require_admin_workspace_access(
                self.workspace_review_id,
                "project_manager",
                self.pm_two_id,
            )
        self.assertEqual(exc.exception.status_code, 403)
        self.assertEqual(str(exc.exception), "Forbidden")

    def test_require_project_workspace_access_resolves_client_target_for_owner(self):
        workspace = require_project_workspace_access(
            self.client_one_id,
            "project_manager",
            self.pm_one_id,
            target="client",
        )
        self.assertEqual(workspace.client_id, self.client_one_id)

    def test_require_client_workspace_access_hides_other_clients_workspace(self):
        with self.assertRaises(WorkspaceAccessValidationError) as exc:
            require_client_workspace_access(self.workspace_review_id, self.client_two_id)
        self.assertEqual(exc.exception.status_code, 404)
        self.assertEqual(str(exc.exception), "Not found")

    def test_require_project_manager_client_access_allows_owner(self):
        client = require_project_manager_client_access(self.client_one_id, self.pm_one_id)
        self.assertEqual(client.id, self.client_one_id)

    def test_require_project_manager_client_access_hides_other_project_manager_client(self):
        with self.assertRaises(WorkspaceAccessValidationError) as exc:
            require_project_manager_client_access(self.client_two_id, self.pm_one_id)
        self.assertEqual(exc.exception.status_code, 404)
        self.assertEqual(str(exc.exception), "Not found")

    def test_require_project_manager_workspace_access_hides_other_project_manager_workspace(self):
        with self.assertRaises(WorkspaceAccessValidationError) as exc:
            require_project_manager_workspace_access(
                self.workspace_pm_two_id,
                self.pm_one_id,
            )
        self.assertEqual(exc.exception.status_code, 404)
        self.assertEqual(str(exc.exception), "Not found")

    def test_require_workspace_send_to_client_allows_known_workflow_status(self):
        workspace = db.session.get(Workspace, self.workspace_review_id)
        status = require_workspace_send_to_client(workspace)
        self.assertEqual(status, "review")

    def test_workspace_review_transition_map_matches_review_workflow(self):
        transition_map = workspace_review_transition_map()
        self.assertEqual(transition_map["draft"], ("send_to_client",))
        self.assertEqual(
            transition_map["review"],
            ("send_to_client", "submit_arrangement", "approve", "request_changes"),
        )
        self.assertEqual(
            transition_map["needs_changes"],
            ("send_to_client",),
        )
        self.assertEqual(transition_map["approved"], ("send_to_client",))

    def test_require_workspace_send_to_client_rejects_ambiguous_status(self):
        workspace = db.session.get(Workspace, self.workspace_review_id)
        workspace.status = "archived"
        with self.assertRaises(WorkspaceReviewTransitionError) as exc:
            require_workspace_send_to_client(workspace)
        self.assertEqual(exc.exception.status_code, 409)
        self.assertIn("not ready", str(exc.exception).lower())

    def test_apply_workspace_review_transition_reopens_review_after_client_changes(self):
        workspace = db.session.get(Workspace, self.workspace_review_id)
        workspace.status = "needs_changes"

        result = apply_workspace_review_transition(workspace, "send_to_client")

        self.assertEqual(result.from_status, "needs_changes")
        self.assertEqual(result.to_status, "review")
        self.assertEqual(workspace.status, "review")

    def test_apply_workspace_review_transition_preserves_approved_status_on_reshare(self):
        workspace = db.session.get(Workspace, self.workspace_approved_id)

        result = apply_workspace_review_transition(workspace, "send_to_client")

        self.assertEqual(result.from_status, "approved")
        self.assertEqual(result.to_status, "approved")
        self.assertEqual(workspace.status, "approved")

    def test_validate_client_workspace_subscription_request_accepts_review_workspace(self):
        workspace = db.session.get(Workspace, self.workspace_review_id)
        result = validate_client_workspace_subscription_request(
            workspace,
            plan_code="starter",
        )
        self.assertEqual(result.plan["code"], "starter")
        self.assertEqual(result.client.id, self.client_one_id)
        self.assertFalse(result.already_active)
        self.assertEqual(result.project_manager.id, self.pm_one_id)

    def test_validate_client_workspace_action_allows_save_scene_when_review_is_open(self):
        workspace = db.session.get(Workspace, self.workspace_review_id)
        result = validate_client_workspace_action(workspace, "save_scene")
        self.assertEqual(result.action, "save_scene")
        self.assertTrue(result.permissions.get("can_save"))

    def test_validate_client_workspace_action_rejects_submit_arrangement_after_approval(self):
        workspace = db.session.get(Workspace, self.workspace_approved_id)
        with self.assertRaises(WorkspaceWorkflowValidationError) as exc:
            validate_client_workspace_action(workspace, "submit_arrangement")
        self.assertEqual(exc.exception.status_code, 403)
        self.assertIn("already approved", str(exc.exception).lower())
        self.assertIsNotNone(exc.exception.permissions)
        self.assertFalse(exc.exception.permissions.get("can_send_arrangement"))

    def test_validate_client_workspace_action_rejects_repeated_submit_arrangement(self):
        workspace = db.session.get(Workspace, self.workspace_needs_changes_id)
        with self.assertRaises(WorkspaceWorkflowValidationError) as exc:
            validate_client_workspace_action(workspace, "submit_arrangement")
        self.assertEqual(exc.exception.status_code, 403)
        self.assertIn("waiting for the project manager", str(exc.exception).lower())
        self.assertIsNotNone(exc.exception.permissions)
        self.assertFalse(exc.exception.permissions.get("can_send_arrangement"))

    def test_validate_client_workspace_subscription_request_rejects_approved_workspace(self):
        workspace = db.session.get(Workspace, self.workspace_approved_id)
        with self.assertRaises(ClientSubscriptionRequestError) as exc:
            validate_client_workspace_subscription_request(
                workspace,
                plan_code="starter",
            )
        self.assertEqual(exc.exception.status_code, 400)
        self.assertIn("approved workspaces", str(exc.exception).lower())

    def test_validate_client_workspace_subscription_request_rejects_unassigned_payment_flow(self):
        workspace = db.session.get(Workspace, self.workspace_unassigned_id)
        with self.assertRaises(ClientSubscriptionRequestError) as exc:
            validate_client_workspace_subscription_request(
                workspace,
                plan_code="starter",
            )
        self.assertEqual(exc.exception.status_code, 409)
        self.assertIn("payment verification is unavailable", str(exc.exception).lower())

    def test_validate_client_workspace_subscription_request_allows_existing_request_without_project_manager(self):
        workspace = db.session.get(Workspace, self.workspace_unassigned_id)
        result = validate_client_workspace_subscription_request(
            workspace,
            plan_code="starter",
            existing_request=object(),
        )
        self.assertEqual(result.plan["code"], "starter")
        self.assertIsNone(result.project_manager)
        self.assertIsNotNone(result.existing_request)


if __name__ == "__main__":
    unittest.main()
