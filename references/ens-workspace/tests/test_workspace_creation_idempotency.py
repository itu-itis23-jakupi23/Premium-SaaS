import unittest
from unittest.mock import patch

from app import create_app
from app.extensions import db
from app.models.activity import ActivityLog
from app.models.exhibition import Exhibition
from app.models.user import ChiefManager, Client, ProjectManager
from app.models.workspace import Workspace
from app.workspace.storage import ensure_project_workspace


class WorkspaceCreationIdempotencyTests(unittest.TestCase):
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
            last_name="Owner",
            email="chief@example.com",
        )
        chief.set_password("ChiefPass123!")
        db.session.add(chief)
        db.session.flush()

        exhibition = Exhibition(
            name="Expo 2026",
            city="Istanbul",
            venue="Hall A",
            status="active",
            created_by=chief.id,
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
            project_manager_id=pm.id,
            exhibition_id=exhibition.id,
            status="active",
        )
        client.set_password("Password123!")
        db.session.add(client)
        db.session.commit()

        self.pm_id = pm.id
        self.client_id = client.id
        self.project_workspace_key = f"client:{client.id}"

    def _workspace_count(self):
        return Workspace.query.filter_by(client_id=self.client_id).count()

    def test_repeated_project_workspace_create_returns_existing_workspace(self):
        first_workspace, first_error, first_created = ensure_project_workspace(
            self.client_id,
            "project_manager",
            self.pm_id,
            target="client",
        )
        second_workspace, second_error, second_created = ensure_project_workspace(
            self.client_id,
            "project_manager",
            self.pm_id,
            target="client",
        )

        self.assertIsNone(first_error)
        self.assertIsNone(second_error)
        self.assertTrue(first_created)
        self.assertFalse(second_created)
        self.assertEqual(first_workspace.id, second_workspace.id)
        self.assertEqual(first_workspace.project_workspace_key, self.project_workspace_key)
        self.assertEqual(self._workspace_count(), 1)
        self.assertEqual(
            ActivityLog.query.filter_by(
                workspace_id=first_workspace.id,
                action="Workspace created from dashboard",
            ).count(),
            1,
        )

    def test_stale_latest_workspace_read_does_not_create_duplicate(self):
        with patch(
            "app.workspace.storage._latest_workspace_for_client",
            return_value=None,
        ):
            first_workspace, first_error, first_created = ensure_project_workspace(
                self.client_id,
                "project_manager",
                self.pm_id,
                target="client",
            )
            second_workspace, second_error, second_created = ensure_project_workspace(
                self.client_id,
                "project_manager",
                self.pm_id,
                target="client",
            )

        self.assertIsNone(first_error)
        self.assertIsNone(second_error)
        self.assertTrue(first_created)
        self.assertFalse(second_created)
        self.assertEqual(first_workspace.id, second_workspace.id)
        self.assertEqual(self._workspace_count(), 1)

    def test_integrity_error_from_concurrent_create_recovers_existing_workspace(self):
        existing = Workspace(
            name="Existing Project Workspace",
            client_id=self.client_id,
            project_workspace_key=self.project_workspace_key,
            project_manager_id=self.pm_id,
            status="draft",
        )
        db.session.add(existing)
        db.session.commit()
        existing_id = existing.id

        lookup_calls = []

        def stale_project_workspace_lookup(client_id):
            lookup_calls.append(client_id)
            if len(lookup_calls) == 1:
                return None
            return Workspace.query.filter_by(
                project_workspace_key=f"client:{int(client_id)}"
            ).first()

        with patch(
            "app.workspace.storage._project_workspace_for_client",
            side_effect=stale_project_workspace_lookup,
        ), patch(
            "app.workspace.storage._latest_workspace_for_client",
            return_value=None,
        ):
            workspace, error, created = ensure_project_workspace(
                self.client_id,
                "project_manager",
                self.pm_id,
                target="client",
            )

        self.assertIsNone(error)
        self.assertFalse(created)
        self.assertEqual(workspace.id, existing_id)
        self.assertGreaterEqual(len(lookup_calls), 2)
        self.assertEqual(self._workspace_count(), 1)


if __name__ == "__main__":
    unittest.main()
