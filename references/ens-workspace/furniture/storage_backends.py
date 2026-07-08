"""Workspace storage backend interface.

The storage backend owns two blob namespaces:

- assets: uploaded artwork/logo files referenced by ``WorkspaceAsset.file_path``
- snapshots: optional scene/version blob storage used by staged shared-storage flows

Backend contract:

- callers store only the backend-managed reference returned by the backend
- references remain opaque to callers and should be treated as storage-managed IDs
- reads and deletes must fail closed when a reference is unsafe or missing
- the filesystem backend remains the default for local/dev compatibility
- shared object storage can be enabled explicitly without changing route behavior

Migration notes:

- existing filesystem references remain valid under the filesystem backend
- the S3-compatible backend can optionally read/delete legacy filesystem blobs
  during migration when ``WORKSPACE_STORAGE_OBJECT_ENABLE_FILESYSTEM_FALLBACK``
  is enabled
- new writes always go to the active backend, so migration can stay staged and
  reversible
"""

import io
import os
import posixpath
from urllib.parse import quote

from flask import redirect, send_file
from werkzeug.http import dump_options_header
from werkzeug.utils import secure_filename

from app.config import resolve_workspace_storage_backend


SAFE_IMAGE_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
}
DEFAULT_UNTRUSTED_MIME_TYPE = "application/octet-stream"


class WorkspaceStorageConfigurationError(RuntimeError):
    """Raised when workspace storage is misconfigured."""


def _normalize_relative_reference(workspace_id, reference):
    raw = str(reference or "").strip().replace("\\", "/")
    if not raw:
        return None
    if os.path.isabs(raw):
        return None
    normalized = posixpath.normpath(raw).strip("/")
    if not normalized or normalized == ".":
        return None
    parts = [segment for segment in normalized.split("/") if segment]
    if not parts or any(segment in {".", ".."} for segment in parts):
        return None
    if parts[0] != str(int(workspace_id)):
        return None
    return "/".join(parts)


def _normalize_object_prefix(value):
    cleaned = str(value or "").strip().replace("\\", "/").strip("/")
    return cleaned


def _normalize_snapshot_payload(payload):
    if isinstance(payload, bytes):
        return payload
    if isinstance(payload, bytearray):
        return bytes(payload)
    if isinstance(payload, str):
        return payload.encode("utf-8")
    raise WorkspaceStorageConfigurationError(
        "Workspace snapshot payload must be bytes, bytearray, or str."
    )


def _object_not_found(error):
    if isinstance(error, FileNotFoundError):
        return True
    response = getattr(error, "response", None) or {}
    payload = response.get("Error", {}) if isinstance(response, dict) else {}
    code = str(payload.get("Code") or "").strip()
    return code in {"404", "NoSuchKey", "NotFound"}


def _read_object_body(payload):
    body = payload.get("Body") if isinstance(payload, dict) else None
    if body is None:
        raise FileNotFoundError("Object body is missing.")
    if hasattr(body, "read"):
        try:
            return body.read()
        finally:
            close_method = getattr(body, "close", None)
            if callable(close_method):
                close_method()
    return bytes(body)


def _safe_asset_mimetype(value):
    mimetype = str(value or "").split(";", 1)[0].strip().lower()
    return mimetype if mimetype in SAFE_IMAGE_MIME_TYPES else DEFAULT_UNTRUSTED_MIME_TYPE


def _safe_asset_download_name(asset, mimetype):
    raw_name = str(
        getattr(asset, "original_name", None)
        or getattr(asset, "file_name", None)
        or "workspace-asset"
    )
    sanitized = secure_filename(os.path.basename(raw_name)) or "workspace-asset"
    stem, _extension = os.path.splitext(sanitized)
    safe_stem = stem or "workspace-asset"
    safe_extension = SAFE_IMAGE_MIME_TYPES.get(mimetype, ".bin")
    return f"{safe_stem}{safe_extension}"


def _attachment_content_disposition(download_name):
    return dump_options_header("attachment", {"filename": download_name})


def _harden_untrusted_asset_response(response, asset):
    mimetype = _safe_asset_mimetype(getattr(asset, "mime_type", None))
    download_name = _safe_asset_download_name(asset, mimetype)
    response.headers["Content-Disposition"] = _attachment_content_disposition(
        download_name
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


def _public_asset_url(base_url, object_key):
    base = str(base_url or "").strip().rstrip("/")
    if not base:
        return None
    return f"{base}/{quote(object_key, safe='/')}"


def _build_s3_object_client(app_config):
    try:
        import boto3
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise WorkspaceStorageConfigurationError(
            "boto3 is required when WORKSPACE_STORAGE_BACKEND uses S3-compatible object storage."
        ) from exc

    client_kwargs = {}
    endpoint_url = str(
        app_config.get("WORKSPACE_STORAGE_OBJECT_ENDPOINT_URL") or ""
    ).strip()
    if endpoint_url:
        client_kwargs["endpoint_url"] = endpoint_url

    region_name = str(app_config.get("WORKSPACE_STORAGE_OBJECT_REGION") or "").strip()
    if region_name:
        client_kwargs["region_name"] = region_name

    access_key = str(
        app_config.get("WORKSPACE_STORAGE_OBJECT_ACCESS_KEY_ID") or ""
    ).strip()
    secret_key = str(
        app_config.get("WORKSPACE_STORAGE_OBJECT_SECRET_ACCESS_KEY") or ""
    ).strip()
    session_token = str(
        app_config.get("WORKSPACE_STORAGE_OBJECT_SESSION_TOKEN") or ""
    ).strip()
    if access_key and secret_key:
        client_kwargs["aws_access_key_id"] = access_key
        client_kwargs["aws_secret_access_key"] = secret_key
    if session_token:
        client_kwargs["aws_session_token"] = session_token

    addressing_style = str(
        app_config.get("WORKSPACE_STORAGE_OBJECT_ADDRESSING_STYLE") or "auto"
    ).strip().lower()
    if addressing_style in {"path", "virtual"}:
        try:
            from botocore.config import Config as BotoConfig
        except ImportError as exc:  # pragma: no cover - optional dependency
            raise WorkspaceStorageConfigurationError(
                "botocore is required for custom S3 addressing styles."
            ) from exc
        client_kwargs["config"] = BotoConfig(
            s3={"addressing_style": addressing_style}
        )

    return boto3.client("s3", **client_kwargs)


class BaseWorkspaceStorageBackend:
    """Interface for workspace blob storage backends."""

    name = "base"
    is_shared_storage = False
    supports_local_directories = False
    filesystem_fallback_enabled = False

    def ensure_directories(self):
        return None

    def describe(self):
        """Return a conservative capability summary for diagnostics/docs."""

        return {
            "name": self.name,
            "is_shared_storage": bool(self.is_shared_storage),
            "supports_local_directories": bool(self.supports_local_directories),
            "filesystem_fallback_enabled": bool(self.filesystem_fallback_enabled),
        }

    def asset_storage_dir(self, workspace_id):
        raise WorkspaceStorageConfigurationError(
            f"{self.name} storage backend does not expose local asset directories."
        )

    def snapshot_storage_dir(self, workspace_id):
        raise WorkspaceStorageConfigurationError(
            f"{self.name} storage backend does not expose local snapshot directories."
        )

    def store_workspace_asset(self, workspace, file_name, upload):
        raise NotImplementedError

    def store_workspace_snapshot(self, workspace, file_name, payload):
        raise NotImplementedError

    def read_workspace_snapshot(self, workspace, snapshot_reference):
        raise NotImplementedError

    def asset_reference_safe(self, workspace, asset_reference):
        raise NotImplementedError

    def snapshot_reference_safe(self, workspace, snapshot_reference):
        raise NotImplementedError

    def asset_exists(self, workspace, asset_reference):
        raise NotImplementedError

    def snapshot_exists(self, workspace, snapshot_reference):
        raise NotImplementedError

    def delete_workspace_asset(self, workspace, asset_reference):
        raise NotImplementedError

    def delete_workspace_snapshot(self, workspace, snapshot_reference):
        raise NotImplementedError

    def send_workspace_asset(self, workspace, asset):
        raise NotImplementedError


class FilesystemWorkspaceStorageBackend(BaseWorkspaceStorageBackend):
    name = "filesystem"
    supports_local_directories = True

    def __init__(self, app_config):
        self.asset_root = os.path.abspath(app_config["WORKSPACE_STORAGE_LOCAL_ROOT"])
        self.snapshot_root = os.path.abspath(
            app_config["WORKSPACE_STORAGE_LOCAL_SNAPSHOT_ROOT"]
        )

    def ensure_directories(self):
        for target in (self.asset_root, self.snapshot_root):
            if target:
                os.makedirs(target, exist_ok=True)

    def asset_storage_dir(self, workspace_id):
        target = os.path.abspath(os.path.join(self.asset_root, str(int(workspace_id))))
        os.makedirs(target, exist_ok=True)
        return target

    def snapshot_storage_dir(self, workspace_id):
        target = os.path.abspath(
            os.path.join(self.snapshot_root, str(int(workspace_id)))
        )
        os.makedirs(target, exist_ok=True)
        return target

    def store_workspace_asset(self, workspace, file_name, upload):
        storage_reference = posixpath.join(str(int(workspace.id)), str(file_name))
        target_path = self._resolve_asset_reference(workspace, storage_reference)
        if not target_path:
            raise WorkspaceStorageConfigurationError(
                "Unable to resolve a safe workspace asset path."
            )
        upload.save(target_path)
        return storage_reference

    def store_workspace_snapshot(self, workspace, file_name, payload):
        storage_reference = posixpath.join(str(int(workspace.id)), str(file_name))
        target_path = self._resolve_snapshot_reference(workspace, storage_reference)
        if not target_path:
            raise WorkspaceStorageConfigurationError(
                "Unable to resolve a safe workspace snapshot path."
            )
        with open(target_path, "wb") as handle:
            handle.write(_normalize_snapshot_payload(payload))
        return storage_reference

    def read_workspace_snapshot(self, workspace, snapshot_reference):
        target_path = self._resolve_snapshot_reference(workspace, snapshot_reference)
        if not target_path or not os.path.isfile(target_path):
            raise FileNotFoundError("Workspace snapshot not found.")
        with open(target_path, "rb") as handle:
            return handle.read()

    def asset_reference_safe(self, workspace, asset_reference):
        return bool(self._resolve_asset_reference(workspace, asset_reference))

    def snapshot_reference_safe(self, workspace, snapshot_reference):
        return bool(self._resolve_snapshot_reference(workspace, snapshot_reference))

    def asset_exists(self, workspace, asset_reference):
        target_path = self._resolve_asset_reference(workspace, asset_reference)
        return bool(target_path and os.path.isfile(target_path))

    def snapshot_exists(self, workspace, snapshot_reference):
        target_path = self._resolve_snapshot_reference(workspace, snapshot_reference)
        return bool(target_path and os.path.isfile(target_path))

    def delete_workspace_asset(self, workspace, asset_reference):
        target_path = self._resolve_asset_reference(workspace, asset_reference)
        if not target_path or not os.path.isfile(target_path):
            return False
        os.remove(target_path)
        return True

    def delete_workspace_snapshot(self, workspace, snapshot_reference):
        target_path = self._resolve_snapshot_reference(workspace, snapshot_reference)
        if not target_path or not os.path.isfile(target_path):
            return False
        os.remove(target_path)
        return True

    def send_workspace_asset(self, workspace, asset):
        target_path = self._resolve_asset_reference(workspace, asset.file_path)
        if not target_path or not os.path.isfile(target_path):
            return None
        mimetype = _safe_asset_mimetype(asset.mime_type)
        response = send_file(
            target_path,
            mimetype=mimetype,
            as_attachment=True,
            download_name=_safe_asset_download_name(asset, mimetype),
            max_age=0,
        )
        return _harden_untrusted_asset_response(response, asset)

    def _resolve_asset_reference(self, workspace, asset_reference):
        return self._resolve_reference(
            self.asset_root,
            self.asset_storage_dir(workspace.id),
            workspace.id,
            asset_reference,
            allow_legacy_absolute=True,
        )

    def _resolve_snapshot_reference(self, workspace, snapshot_reference):
        return self._resolve_reference(
            self.snapshot_root,
            self.snapshot_storage_dir(workspace.id),
            workspace.id,
            snapshot_reference,
            allow_legacy_absolute=False,
        )

    def _resolve_reference(
        self,
        root,
        workspace_dir,
        workspace_id,
        reference,
        *,
        allow_legacy_absolute,
    ):
        raw_reference = str(reference or "").strip()
        if not raw_reference:
            return None

        if allow_legacy_absolute and os.path.isabs(raw_reference):
            target_path = os.path.abspath(raw_reference)
        else:
            normalized_reference = _normalize_relative_reference(
                workspace_id, raw_reference
            )
            if not normalized_reference:
                return None
            target_path = os.path.abspath(
                os.path.join(root, normalized_reference.replace("/", os.sep))
            )

        try:
            if os.path.commonpath([workspace_dir, target_path]) != workspace_dir:
                return None
        except ValueError:
            return None
        return target_path


class S3CompatibleWorkspaceStorageBackend(BaseWorkspaceStorageBackend):
    name = "s3"
    is_shared_storage = True
    reference_kinds = {
        "asset": "assets",
        "snapshot": "snapshots",
    }

    def __init__(self, app_config, *, client=None):
        self.bucket = str(app_config.get("WORKSPACE_STORAGE_OBJECT_BUCKET") or "").strip()
        if not self.bucket:
            raise WorkspaceStorageConfigurationError(
                "WORKSPACE_STORAGE_OBJECT_BUCKET must be configured for S3-compatible workspace storage."
            )
        self.object_prefix = _normalize_object_prefix(
            app_config.get("WORKSPACE_STORAGE_OBJECT_PREFIX")
        )
        self.public_base_url = str(
            app_config.get("WORKSPACE_STORAGE_OBJECT_PUBLIC_BASE_URL") or ""
        ).strip() or None
        self.filesystem_fallback_enabled = bool(
            app_config.get("WORKSPACE_STORAGE_OBJECT_ENABLE_FILESYSTEM_FALLBACK", False)
        )
        self.filesystem_fallback = (
            FilesystemWorkspaceStorageBackend(app_config)
            if self.filesystem_fallback_enabled
            else None
        )
        self.client = client or _build_s3_object_client(app_config)

    def ensure_directories(self):
        if self.filesystem_fallback:
            self.filesystem_fallback.ensure_directories()

    def store_workspace_asset(self, workspace, file_name, upload):
        storage_reference = posixpath.join(str(int(workspace.id)), str(file_name))
        object_key = self._object_key("asset", workspace.id, storage_reference)
        content_type = _safe_asset_mimetype(
            getattr(upload, "mimetype", None) or getattr(upload, "content_type", None)
        )
        upload.stream.seek(0)
        self.client.put_object(
            Bucket=self.bucket,
            Key=object_key,
            Body=upload.stream,
            ContentType=content_type,
            ContentDisposition=_attachment_content_disposition(str(file_name)),
        )
        return storage_reference

    def store_workspace_snapshot(self, workspace, file_name, payload):
        storage_reference = posixpath.join(str(int(workspace.id)), str(file_name))
        object_key = self._object_key("snapshot", workspace.id, storage_reference)
        self.client.put_object(
            Bucket=self.bucket,
            Key=object_key,
            Body=_normalize_snapshot_payload(payload),
            ContentType="application/json",
        )
        return storage_reference

    def read_workspace_snapshot(self, workspace, snapshot_reference):
        object_key = self._object_key_or_none(
            "snapshot", workspace.id, snapshot_reference
        )
        if not object_key:
            if self.filesystem_fallback:
                return self.filesystem_fallback.read_workspace_snapshot(
                    workspace, snapshot_reference
                )
            raise FileNotFoundError("Workspace snapshot not found.")
        try:
            payload = self.client.get_object(Bucket=self.bucket, Key=object_key)
        except Exception as exc:
            if _object_not_found(exc):
                if self.filesystem_fallback:
                    return self.filesystem_fallback.read_workspace_snapshot(
                        workspace, snapshot_reference
                    )
                raise FileNotFoundError("Workspace snapshot not found.") from exc
            raise
        return _read_object_body(payload)

    def asset_reference_safe(self, workspace, asset_reference):
        if _normalize_relative_reference(workspace.id, asset_reference):
            return True
        if self.filesystem_fallback:
            return self.filesystem_fallback.asset_reference_safe(
                workspace, asset_reference
            )
        return False

    def snapshot_reference_safe(self, workspace, snapshot_reference):
        if _normalize_relative_reference(workspace.id, snapshot_reference):
            return True
        if self.filesystem_fallback:
            return self.filesystem_fallback.snapshot_reference_safe(
                workspace, snapshot_reference
            )
        return False

    def asset_exists(self, workspace, asset_reference):
        object_key = self._object_key_or_none("asset", workspace.id, asset_reference)
        if object_key:
            try:
                self.client.head_object(Bucket=self.bucket, Key=object_key)
                return True
            except Exception as exc:
                if not _object_not_found(exc):
                    raise
        if self.filesystem_fallback:
            return self.filesystem_fallback.asset_exists(workspace, asset_reference)
        return False

    def snapshot_exists(self, workspace, snapshot_reference):
        object_key = self._object_key_or_none(
            "snapshot", workspace.id, snapshot_reference
        )
        if object_key:
            try:
                self.client.head_object(Bucket=self.bucket, Key=object_key)
                return True
            except Exception as exc:
                if not _object_not_found(exc):
                    raise
        if self.filesystem_fallback:
            return self.filesystem_fallback.snapshot_exists(workspace, snapshot_reference)
        return False

    def delete_workspace_asset(self, workspace, asset_reference):
        removed = False
        object_key = self._object_key_or_none("asset", workspace.id, asset_reference)
        if object_key:
            try:
                self.client.head_object(Bucket=self.bucket, Key=object_key)
                self.client.delete_object(Bucket=self.bucket, Key=object_key)
                removed = True
            except Exception as exc:
                if not _object_not_found(exc):
                    raise
        if self.filesystem_fallback:
            removed = (
                self.filesystem_fallback.delete_workspace_asset(
                    workspace, asset_reference
                )
                or removed
            )
        return removed

    def delete_workspace_snapshot(self, workspace, snapshot_reference):
        removed = False
        object_key = self._object_key_or_none(
            "snapshot", workspace.id, snapshot_reference
        )
        if object_key:
            try:
                self.client.head_object(Bucket=self.bucket, Key=object_key)
                self.client.delete_object(Bucket=self.bucket, Key=object_key)
                removed = True
            except Exception as exc:
                if not _object_not_found(exc):
                    raise
        if self.filesystem_fallback:
            removed = (
                self.filesystem_fallback.delete_workspace_snapshot(
                    workspace, snapshot_reference
                )
                or removed
            )
        return removed

    def send_workspace_asset(self, workspace, asset):
        object_key = self._object_key_or_none("asset", workspace.id, asset.file_path)
        if object_key:
            try:
                if self.public_base_url:
                    self.client.head_object(Bucket=self.bucket, Key=object_key)
                    response = redirect(
                        _public_asset_url(self.public_base_url, object_key),
                        code=302,
                    )
                    return _harden_untrusted_asset_response(response, asset)
                payload = self.client.get_object(Bucket=self.bucket, Key=object_key)
                mimetype = _safe_asset_mimetype(asset.mime_type)
                response = send_file(
                    io.BytesIO(_read_object_body(payload)),
                    mimetype=mimetype,
                    as_attachment=True,
                    download_name=_safe_asset_download_name(asset, mimetype),
                    max_age=0,
                )
                return _harden_untrusted_asset_response(response, asset)
            except Exception as exc:
                if not _object_not_found(exc):
                    raise
        if self.filesystem_fallback:
            return self.filesystem_fallback.send_workspace_asset(workspace, asset)
        return None

    def _object_key_or_none(self, kind, workspace_id, reference):
        normalized_reference = _normalize_relative_reference(workspace_id, reference)
        if not normalized_reference:
            return None
        key_parts = [self.reference_kinds[kind], normalized_reference]
        if self.object_prefix:
            key_parts.insert(0, self.object_prefix)
        return "/".join(part.strip("/") for part in key_parts if part)

    def _object_key(self, kind, workspace_id, reference):
        object_key = self._object_key_or_none(kind, workspace_id, reference)
        if not object_key:
            raise WorkspaceStorageConfigurationError(
                f"Unsafe {kind} reference for workspace storage backend."
            )
        return object_key


SUPPORTED_WORKSPACE_STORAGE_BACKENDS = {
    FilesystemWorkspaceStorageBackend.name: FilesystemWorkspaceStorageBackend,
    S3CompatibleWorkspaceStorageBackend.name: S3CompatibleWorkspaceStorageBackend,
    "s3-compatible": S3CompatibleWorkspaceStorageBackend,
    "object-storage": S3CompatibleWorkspaceStorageBackend,
    "object": S3CompatibleWorkspaceStorageBackend,
    "blob": S3CompatibleWorkspaceStorageBackend,
}


def build_workspace_storage_backend(app_config):
    backend_name = resolve_workspace_storage_backend(app_config, default="filesystem")
    backend_cls = SUPPORTED_WORKSPACE_STORAGE_BACKENDS.get(backend_name)
    if backend_cls is None:
        supported = ", ".join(sorted(SUPPORTED_WORKSPACE_STORAGE_BACKENDS))
        raise WorkspaceStorageConfigurationError(
            "Unsupported WORKSPACE_STORAGE_BACKEND "
            f"'{backend_name}'. Supported backends: {supported}."
        )
    return backend_cls(app_config)
