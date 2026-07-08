import unittest

from app.workspace.catalog import DEFAULT_FURNITURE_CATALOG
from app.workspace.scene import normalize_scene


class WorkspaceRoomSceneTests(unittest.TestCase):
    def test_normalize_scene_preserves_rooms(self):
        scene = normalize_scene(
            {
                "rooms": [
                    {
                        "id": "room-a",
                        "width": 3.4,
                        "depth": 2.6,
                        "height": 2.4,
                        "position": {"x": 1.2, "z": -0.7},
                        "hasDoor": True,
                    }
                ]
            }
        )

        self.assertEqual(len(scene["rooms"]), 1)
        self.assertEqual(scene["rooms"][0]["id"], "room-a")
        self.assertEqual(scene["rooms"][0]["position"], {"x": 1, "y": 0, "z": -1})
        self.assertTrue(scene["rooms"][0]["hasDoor"])

    def test_normalize_scene_preserves_wall_mounted_shelf_thickness(self):
        scene = normalize_scene(
            {
                "models": [
                    {
                        "id": "shelf-a",
                        "asset_id": "WS-001",
                        "shape": "wall_shelf",
                        "wallMounted": True,
                        "size": {"width": 1.0, "depth": 0.3, "height": 0.05},
                        "position": {"x": 0, "y": 1.5, "z": -1.4},
                    }
                ]
            }
        )

        shelf = scene["models"][0]
        self.assertTrue(shelf["wallMounted"])
        self.assertEqual(shelf["shape"], "wall_shelf")
        self.assertEqual(shelf["size"]["height"], 0.05)

    def test_catalog_contains_wall_elements_shelf(self):
        shelf = next(item for item in DEFAULT_FURNITURE_CATALOG if item.get("asset_id") == "WS-001")

        self.assertEqual(shelf["category"], "Wall Elements")
        self.assertEqual(shelf["shape"], "wall_shelf")
        self.assertTrue(shelf["wallMounted"])


if __name__ == "__main__":
    unittest.main()
