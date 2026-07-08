import json
import math
import uuid

DEFAULT_DIMS = {"width": 6.0, "depth": 3.0, "height": 2.48}
DEFAULT_OPEN_SIDES = {"front": True, "back": False, "left": False, "right": False}
DEFAULT_PERMISSIONS = {
    "managerQuotes": True,
    "managerAssets": True,
    "managerLogs": True,
}
DEFAULT_BRANDING = {"mode": "text", "scope": "front", "logoAssetId": None}
DEFAULT_QUOTE = {
    "currency": "USD",
    "includeVat": False,
    "vatRate": 0.2,
    "billingStatus": "draft",
}
ALLOWED_LIGHTING_PRESETS = {
    "neutral",
    "exhibition",
    "accent",
    "spotlight",
    "ambient",
    "led",
    "pendant",
}
ALLOWED_FASCIA_OPTIONS = {"classic", "full", "custom"}
ALLOWED_BRANDING_MODES = {"text", "logo", "logo_text"}
ALLOWED_BRANDING_SCOPES = {"front", "all_visible"}
ALLOWED_BOOTH_STYLES = {"octanorm", "maxima"}
ALLOWED_BUILD_MODES = {"panel", "yekpare"}


def as_float(value, fallback):
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(fallback)


def normalize_choice(value, allowed, fallback):
    raw = str(value or "").strip().lower()
    return raw if raw in allowed else fallback


def normalize_bool(value, fallback=False):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        raw = value.strip().lower()
        if raw in {"true", "1", "yes", "on"}:
            return True
        if raw in {"false", "0", "no", "off"}:
            return False
    if value is None:
        return fallback
    return bool(value)


def normalize_dims(raw_dims=None):
    raw_dims = raw_dims or {}
    return {
        "width": max(2.0, round(as_float(raw_dims.get("width"), DEFAULT_DIMS["width"]), 2)),
        "depth": max(2.0, round(as_float(raw_dims.get("depth"), DEFAULT_DIMS["depth"]), 2)),
        "height": max(2.2, round(as_float(raw_dims.get("height"), DEFAULT_DIMS["height"]), 2)),
    }


def clamp_scalar(value, minimum, maximum):
    return min(maximum, max(minimum, value))


def round_half_away_from_zero(value):
    # Mirror Math.round so save/load keeps the same cell choice as the editor.
    return math.floor(value + 0.5)


def get_grid_alignment_offset(span):
    half_span = max(0.0, as_float(span, 0.0)) / 2.0
    fractional = ((half_span % 1.0) + 1.0) % 1.0
    if fractional < 0.0001 or fractional > 0.9999:
        return 0.0
    if abs(fractional - 0.5) < 0.0001:
        return 0.5
    return fractional if fractional <= 0.5 else fractional - 1.0


def normalize_unit_offset(value):
    fractional = ((as_float(value, 0.0) % 1.0) + 1.0) % 1.0
    if fractional < 0.0001 or fractional > 0.9999:
        return 0.0
    return fractional if fractional <= 0.5 else fractional - 1.0


def get_grid_snap_anchor(grid_span, occupied_span=0.0):
    return normalize_unit_offset(
        get_grid_alignment_offset(grid_span) + get_grid_alignment_offset(occupied_span)
    )


def snap_aligned_value(
    value,
    grid_span=0.0,
    occupied_span=0.0,
    minimum=None,
    maximum=None,
    step=1.0,
):
    safe_step = max(0.1, as_float(step, 1.0))
    anchor = get_grid_snap_anchor(grid_span, occupied_span)
    raw = as_float(value, 0.0)
    if minimum is None or maximum is None:
        snapped_index = round_half_away_from_zero((raw - anchor) / safe_step)
        return round(anchor + (snapped_index * safe_step), 4)
    lower = as_float(minimum, raw)
    upper = as_float(maximum, raw)
    if lower > upper:
        return round(raw, 4)
    min_index = math.ceil(((lower - anchor) / safe_step) - 0.0001)
    max_index = math.floor(((upper - anchor) / safe_step) + 0.0001)
    if min_index > max_index:
        return round(clamp_scalar(raw, lower, upper), 4)
    clamped = clamp_scalar(raw, lower, upper)
    snapped_index = round_half_away_from_zero((clamped - anchor) / safe_step)
    snapped_index = max(min_index, min(max_index, snapped_index))
    return round(anchor + (snapped_index * safe_step), 4)


def normalize_door_position(value):
    normalized = str(value or "center").strip().lower()
    return normalized if normalized in {"left", "center", "right"} else "center"


def normalize_room_position(position=None, width=3.0, depth=3.0, dims=None):
    position = position if isinstance(position, dict) else {}
    return {
        "x": snap_aligned_value(position.get("x")),
        "y": 0,
        "z": snap_aligned_value(position.get("z")),
    }


def normalize_open_sides(raw_open_sides=None):
    raw_open_sides = raw_open_sides or {}
    normalized = {
        key: normalize_bool(raw_open_sides.get(key), default)
        for key, default in DEFAULT_OPEN_SIDES.items()
    }
    normalized["back"] = normalize_bool(raw_open_sides.get("back"), False)
    return normalized


def normalize_permissions(raw_permissions=None):
    raw_permissions = raw_permissions if isinstance(raw_permissions, dict) else {}
    return {
        key: normalize_bool(raw_permissions.get(key), default)
        for key, default in DEFAULT_PERMISSIONS.items()
    }


def normalize_branding(raw_branding=None):
    raw_branding = raw_branding if isinstance(raw_branding, dict) else {}
    logo_asset_id = raw_branding.get("logoAssetId") or raw_branding.get("logo_asset_id")
    try:
        logo_asset_id = int(logo_asset_id)
    except (TypeError, ValueError):
        logo_asset_id = None
    if not (isinstance(logo_asset_id, int) and logo_asset_id > 0):
        logo_asset_id = None
    return {
        "mode": normalize_choice(
            raw_branding.get("mode") or raw_branding.get("brandingMode"),
            ALLOWED_BRANDING_MODES,
            DEFAULT_BRANDING["mode"],
        ),
        "scope": normalize_choice(
            raw_branding.get("scope") or raw_branding.get("brandingScope"),
            ALLOWED_BRANDING_SCOPES,
            DEFAULT_BRANDING["scope"],
        ),
        "logoAssetId": logo_asset_id,
    }


def normalize_quote(raw_quote=None, booth=None):
    raw_quote = raw_quote if isinstance(raw_quote, dict) else {}
    booth = booth if isinstance(booth, dict) else {}
    currency = str(
        raw_quote.get("currency")
        or booth.get("currency")
        or DEFAULT_QUOTE["currency"]
    ).upper()
    vat_rate = as_float(
        raw_quote.get("vatRate", booth.get("vatRate")), DEFAULT_QUOTE["vatRate"]
    )
    return {
        "currency": currency if currency in {"USD", "EUR", "GBP", "TRY"} else "USD",
        "includeVat": normalize_bool(
            raw_quote.get("includeVat", booth.get("includeVat")),
            DEFAULT_QUOTE["includeVat"],
        ),
        "vatRate": round(max(0.0, min(vat_rate, 1.0)), 4),
        "billingStatus": normalize_choice(
            raw_quote.get("billingStatus", booth.get("billingStatus")),
            {"draft", "issued", "paid"},
            DEFAULT_QUOTE["billingStatus"],
        ),
    }


def create_structure_layout(dims):
    width = dims["width"]
    depth = dims["depth"]
    height = dims["height"]
    wall_thickness = 0.08
    column_radius = 0.05

    panels = [
        {
            "id": "panel-back",
            "side": "back",
            "width": width,
            "height": height,
            "thickness": wall_thickness,
            "position": {"x": 0.0, "y": round(height / 2, 3), "z": round(-depth / 2, 3)},
            "rotation": {"x": 0.0, "y": 0.0, "z": 0.0},
        },
        {
            "id": "panel-left",
            "side": "left",
            "width": depth,
            "height": height,
            "thickness": wall_thickness,
            "position": {"x": round(-width / 2, 3), "y": round(height / 2, 3), "z": 0.0},
            "rotation": {"x": 0.0, "y": 90.0, "z": 0.0},
        },
        {
            "id": "panel-right",
            "side": "right",
            "width": depth,
            "height": height,
            "thickness": wall_thickness,
            "position": {"x": round(width / 2, 3), "y": round(height / 2, 3), "z": 0.0},
            "rotation": {"x": 0.0, "y": -90.0, "z": 0.0},
        },
    ]

    columns = []
    for index, (x_pos, z_pos) in enumerate(
        [
            (-width / 2, -depth / 2),
            (width / 2, -depth / 2),
            (-width / 2, depth / 2),
            (width / 2, depth / 2),
        ],
        start=1,
    ):
        columns.append(
            {
                "id": f"column-{index}",
                "radius": column_radius,
                "height": height,
                "position": {"x": round(x_pos, 3), "y": round(height / 2, 3), "z": round(z_pos, 3)},
            }
        )

    return {"panels": panels, "columns": columns}


def normalize_position(raw_position=None):
    raw_position = raw_position or {}
    return {
        "x": round(as_float(raw_position.get("x"), 0.0), 4),
        "y": round(as_float(raw_position.get("y"), 0.0), 4),
        "z": round(as_float(raw_position.get("z"), 0.0), 4),
    }


def normalize_rotation(raw_rotation=None):
    raw_rotation = raw_rotation or {}
    return {
        "x": round(as_float(raw_rotation.get("x"), 0.0), 4),
        "y": round(as_float(raw_rotation.get("y"), 0.0), 4),
        "z": round(as_float(raw_rotation.get("z"), 0.0), 4),
    }


def normalize_size(raw_size=None, min_size=0.2):
    raw_size = raw_size or {}
    safe_min = max(0.01, as_float(min_size, 0.2))
    return {
        "width": max(safe_min, round(as_float(raw_size.get("width"), 1.0), 3)),
        "depth": max(safe_min, round(as_float(raw_size.get("depth"), 1.0), 3)),
        "height": max(safe_min, round(as_float(raw_size.get("height"), 1.0), 3)),
    }


def normalize_dimensions(raw_dimensions=None, size=None):
    raw_dimensions = raw_dimensions if isinstance(raw_dimensions, dict) else {}
    size = size if isinstance(size, dict) else {}
    normalized = {}

    width = as_float(raw_dimensions.get("width", raw_dimensions.get("diameter")), 0.0)
    depth = as_float(
        raw_dimensions.get("depth", raw_dimensions.get("width", raw_dimensions.get("diameter"))),
        0.0,
    )
    height = as_float(raw_dimensions.get("height"), 0.0)
    diameter = as_float(raw_dimensions.get("diameter"), 0.0)

    if width <= 0 and size:
        width = as_float(size.get("width"), 0.0) * 100.0
    if depth <= 0 and size:
        depth = as_float(size.get("depth"), 0.0) * 100.0
    if height <= 0 and size:
        height = as_float(size.get("height"), 0.0) * 100.0

    if width > 0:
        normalized["width"] = round(width, 2)
    if depth > 0:
        normalized["depth"] = round(depth, 2)
    if height > 0:
        normalized["height"] = round(height, 2)
    if diameter > 0:
        normalized["diameter"] = round(diameter, 2)
    return normalized


def legacy_position(raw_model, dims):
    width = dims["width"]
    depth = dims["depth"]
    try:
        x_pct = float(raw_model.get("x"))
        y_pct = float(raw_model.get("y"))
    except (TypeError, ValueError):
        return {"x": 0.0, "y": 0.0, "z": 0.0}
    return {
        "x": round((-width / 2) + ((x_pct / 100.0) * width), 4),
        "y": 0.0,
        "z": round((depth / 2) - ((y_pct / 100.0) * depth), 4),
    }


def normalize_models(raw_models=None, dims=None):
    raw_models = raw_models or []
    dims = dims or DEFAULT_DIMS
    normalized = []
    for index, raw_model in enumerate(raw_models, start=1):
        if not isinstance(raw_model, dict):
            continue
        code = str(
            raw_model.get("code")
            or raw_model.get("id")
            or raw_model.get("asset_id")
            or raw_model.get("assetId")
            or ""
        ).strip()
        asset_id = str(
            raw_model.get("asset_id")
            or raw_model.get("assetId")
            or code
            or raw_model.get("sku")
            or raw_model.get("type")
            or f"asset-{index}"
        )
        model_type = str(
            raw_model.get("type") or ("parametric" if raw_model.get("shape") else "asset")
        ).strip().lower()
        shape = str(raw_model.get("shape") or "").strip().lower() or None
        wall_mounted = normalize_bool(
            raw_model.get("wallMounted", raw_model.get("wall_mounted")),
            shape == "wall_shelf",
        )
        size = normalize_size(raw_model.get("size"), min_size=0.03 if wall_mounted else 0.2)
        object_kind = str(
            raw_model.get("objectKind")
            or raw_model.get("object_kind")
            or ("light" if shape == "rail_light" else "furniture")
        ).strip().lower()
        light_type = str(
            raw_model.get("lightType") or raw_model.get("light_type") or ""
        ).strip().lower() or None
        try:
            rail_position = float(
                raw_model.get("railPosition", raw_model.get("rail_position"))
            )
        except (TypeError, ValueError):
            rail_position = None
        if rail_position is not None:
            rail_position = round(max(0.0, min(1.0, rail_position)), 4)
        normalized.append(
            {
                "id": str(raw_model.get("id") or uuid.uuid4().hex),
                "asset_id": asset_id,
                "code": code,
                "name": str(raw_model.get("name") or asset_id.replace("-", " ").title()),
                "category": str(raw_model.get("category") or "Furniture"),
                "type": model_type,
                "shape": shape,
                "objectKind": object_kind,
                "lightType": light_type,
                "railPosition": rail_position,
                "wallMounted": wall_mounted,
                "wallId": raw_model.get("wallId") or raw_model.get("wall_id"),
                "dimensions": normalize_dimensions(raw_model.get("dimensions"), size),
                "reference_image": raw_model.get("reference_image")
                or raw_model.get("referenceImage")
                or raw_model.get("reference_image_path"),
                "price": round(as_float(raw_model.get("price"), 0.0), 2),
                "color": str(raw_model.get("color") or "#cbd5e1"),
                "glb_url": raw_model.get("glb_url") or raw_model.get("glbUrl"),
                "size": size,
                "position": (
                    normalize_position(raw_model.get("position"))
                    if isinstance(raw_model.get("position"), dict)
                    else legacy_position(raw_model, dims)
                ),
                "rotation": normalize_rotation(raw_model.get("rotation")),
                "scale": round(max(0.1, as_float(raw_model.get("scale"), 1.0)), 3),
            }
        )
    return normalized


def normalize_rooms(raw_rooms=None, dims=None):
    raw_rooms = raw_rooms or []
    normalized = []
    dims = dims if isinstance(dims, dict) else DEFAULT_DIMS
    for index, raw_room in enumerate(raw_rooms, start=1):
        if not isinstance(raw_room, dict):
            continue
        position = raw_room.get("position") if isinstance(raw_room.get("position"), dict) else {}
        width = max(1.0, min(round(as_float(raw_room.get("width"), 3.0), 3), 30.0))
        depth = max(1.0, min(round(as_float(raw_room.get("depth"), 3.0), 3), 30.0))
        height = max(1.8, min(round(as_float(raw_room.get("height"), 2.4), 3), 10.0))
        normalized.append(
            {
                "id": str(raw_room.get("id") or f"room-{index}"),
                "width": width,
                "depth": depth,
                "height": height,
                "position": normalize_room_position(position, width, depth, dims),
                "hasDoor": normalize_bool(raw_room.get("hasDoor"), True),
                "hasCeiling": normalize_bool(raw_room.get("hasCeiling"), False),
                "doorPosition": normalize_door_position(raw_room.get("doorPosition")),
            }
        )
    return normalized


def normalize_site_objects(raw_site_objects=None):
    raw_site_objects = raw_site_objects or []
    normalized = []
    for index, raw_object in enumerate(raw_site_objects, start=1):
        if not isinstance(raw_object, dict):
            continue
        object_type = str(raw_object.get("type") or "text").strip().lower()
        if object_type != "text":
            object_type = "text"
        text = str(raw_object.get("text") or raw_object.get("content") or f"Text {index}")
        font_size = round(
            max(
                18.0,
                min(
                    as_float(raw_object.get("fontSize", raw_object.get("font_size")), 40.0),
                    120.0,
                ),
            )
        )
        width = round(
            max(
                0.8,
                as_float(raw_object.get("width"), min(3.4, max(1.2, len(text) * 0.12))),
            ),
            3,
        )
        height = round(max(0.2, as_float(raw_object.get("height"), 0.48)), 3)
        normalized.append(
            {
                "id": str(raw_object.get("id") or uuid.uuid4().hex),
                "type": object_type,
                "text": text,
                "color": str(raw_object.get("color") or "#4b5563"),
                "fontSize": int(font_size),
                "width": width,
                "height": height,
                "position": normalize_position(raw_object.get("position")),
                "rotation": normalize_rotation(raw_object.get("rotation")),
                "scale": round(max(0.1, as_float(raw_object.get("scale"), 1.0)), 3),
            }
        )
    return normalized


def normalize_scene(raw_scene=None):
    layout_source = raw_scene if isinstance(raw_scene, dict) else {}
    dims = normalize_dims(layout_source.get("dims"))
    structure = create_structure_layout(dims)
    booth = layout_source.get("booth") if isinstance(layout_source.get("booth"), dict) else {}
    scene_branding = (
        layout_source.get("branding")
        if isinstance(layout_source.get("branding"), dict)
        else booth.get("branding")
    )
    scene_quote = (
        layout_source.get("quote")
        if isinstance(layout_source.get("quote"), dict)
        else booth.get("quote")
    )
    scene_permissions = (
        layout_source.get("permissions")
        if isinstance(layout_source.get("permissions"), dict)
        else booth.get("permissions")
    )
    branding = normalize_branding(scene_branding)
    quote = normalize_quote(scene_quote, booth)
    permissions = normalize_permissions(scene_permissions)
    build_mode = normalize_choice(
        booth.get("buildMode") or booth.get("mode"),
        ALLOWED_BUILD_MODES,
        "panel",
    )

    return {
        "dims": dims,
        "booth": {
            "openSides": normalize_open_sides(booth.get("openSides")),
            "fascia": normalize_bool(booth.get("fascia"), True),
            "fasciaOption": normalize_choice(
                booth.get("fasciaOption") or booth.get("fasciaMode"),
                ALLOWED_FASCIA_OPTIONS,
                "classic",
            ),
            "fasciaText": str(booth.get("fasciaText") or "Company Name"),
            "buildMode": build_mode,
            "mode": build_mode,
            "boothStyle": normalize_choice(
                booth.get("boothStyle"),
                ALLOWED_BOOTH_STYLES,
                "octanorm",
            ),
        },
        "branding": branding,
        "quote": quote,
        "permissions": permissions,
        "panels": layout_source.get("panels")
        if isinstance(layout_source.get("panels"), list)
        else structure["panels"],
        "columns": layout_source.get("columns")
        if isinstance(layout_source.get("columns"), list)
        else structure["columns"],
        "rooms": normalize_rooms(layout_source.get("rooms"), dims),
        "models": normalize_models(layout_source.get("models"), dims),
        "siteObjects": normalize_site_objects(layout_source.get("siteObjects")),
        "items": layout_source.get("items")
        if isinstance(layout_source.get("items"), list)
        else [],
        "view": "Top" if str(layout_source.get("view")).strip().lower() == "top" else "Perspective",
        "lightingPreset": normalize_choice(
            layout_source.get("lightingPreset"),
            ALLOWED_LIGHTING_PRESETS,
            "exhibition",
        ),
        "grid": normalize_bool(layout_source.get("grid"), True),
        "preview": normalize_bool(layout_source.get("preview"), False),
        "snap": normalize_bool(layout_source.get("snap"), True),
        "snapStep": round(
            max(
                0.1,
                min(as_float(layout_source.get("snapStep", layout_source.get("snap_step")), 0.5), 2.0),
            ),
            2,
        ),
        "rotationSnap": int(
            round(
                max(
                    1.0,
                    min(
                        as_float(
                            layout_source.get(
                                "rotationSnap", layout_source.get("rotation_snap")
                            ),
                            90.0,
                        ),
                        180.0,
                    ),
                )
            )
        ),
        "measure": normalize_bool(layout_source.get("measure"), False),
    }


def parse_normalized_scene(scene_data):
    if not scene_data:
        return normalize_scene()
    if isinstance(scene_data, dict):
        return normalize_scene(scene_data)
    try:
        return normalize_scene(json.loads(scene_data))
    except (TypeError, ValueError, json.JSONDecodeError):
        return normalize_scene()
