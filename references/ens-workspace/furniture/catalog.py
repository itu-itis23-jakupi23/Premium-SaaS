from copy import deepcopy

from app.extensions import cache

DEFAULT_FURNITURE_CATALOG = [
    {
        "asset_id": "banko",
        "name": "Reception Counter",
        "category": "Counters",
        "price": 3250.0,
        "stock": 999,
        "glb_url": "/static/GLB/banko.glb",
        "color": "#cbd5e1",
        "size": {"width": 1.0, "depth": 0.55, "height": 1.0},
    },
    {
        "asset_id": "banko1",
        "name": "Counter Banko1",
        "category": "Counters",
        "price": 3200.0,
        "stock": 998,
        "glb_url": "/static/GLB/banko1.glb",
        "color": "#cbd5e1",
        "size": {"width": 1.2, "depth": 0.6, "height": 1.0},
    },
    {
        "asset_id": "banko2",
        "name": "Counter Banko2",
        "category": "Counters",
        "price": 3600.0,
        "stock": 998,
        "glb_url": "/static/GLB/banko2.glb",
        "color": "#cbd5e1",
        "size": {"width": 1.5, "depth": 0.6, "height": 1.0},
    },
    {
        "asset_id": "masa",
        "name": "Table",
        "category": "Tables",
        "price": 1500.0,
        "stock": 120,
        "glb_url": "/static/GLB/masa.glb",
        "color": "#c7d2fe",
        "size": {"width": 1.2, "depth": 1.2, "height": 0.75},
    },
    {
        "asset_id": "showcase",
        "name": "Showcase",
        "category": "Displays",
        "price": 4000.0,
        "stock": 36,
        "glb_url": "/static/GLB/showcase.glb",
        "color": "#bfdbfe",
        "size": {"width": 1.02, "depth": 0.52, "height": 0.99},
    },
    {
        "asset_id": "vitrin",
        "name": "Glass Vitrin",
        "category": "Displays",
        "price": 3100.0,
        "stock": 24,
        "glb_url": "/static/GLB/vitrin.glb",
        "color": "#bae6fd",
        "size": {"width": 1.0, "depth": 0.5, "height": 2.0},
    },
    {
        "asset_id": "isiklivitrin",
        "name": "Lit Display 1",
        "category": "Displays",
        "price": 3300.0,
        "stock": 20,
        "glb_url": "/static/GLB/isiklivitrin.glb",
        "color": "#93c5fd",
        "size": {"width": 1.0, "depth": 0.5, "height": 2.0},
    },
    {
        "asset_id": "isiklivitrin2",
        "name": "Lit Display 2",
        "category": "Displays",
        "price": 3300.0,
        "stock": 20,
        "glb_url": "/static/GLB/isiklivitrin2.glb",
        "color": "#93c5fd",
        "size": {"width": 1.0, "depth": 0.5, "height": 2.0},
    },
    {
        "asset_id": "dolap",
        "name": "Wardrobe Cabinet",
        "category": "Storage",
        "price": 2800.0,
        "stock": 18,
        "glb_url": "/static/GLB/dolap.glb",
        "color": "#d8b4fe",
        "size": {"width": 0.96, "depth": 0.455, "height": 1.9},
    },
    {
        "asset_id": "WS-001",
        "code": "WS-001",
        "name": "Shelf",
        "category": "Wall Elements",
        "type": "parametric",
        "shape": "wall_shelf",
        "price": 420.0,
        "stock": 999,
        "color": "#888888",
        "wallMounted": True,
        "size": {"width": 1.0, "depth": 0.3, "height": 0.05},
        "dimensions": {"width": 100, "depth": 30, "height": 5},
    },
]

CATALOG_CACHE_KEY = "workspace:furniture_catalog:v2"


def get_furniture_catalog():
    cached = cache.get(CATALOG_CACHE_KEY)
    if cached is not None:
        return deepcopy(cached)
    payload = deepcopy(DEFAULT_FURNITURE_CATALOG)
    cache.set(CATALOG_CACHE_KEY, payload, timeout=300)
    return deepcopy(payload)
