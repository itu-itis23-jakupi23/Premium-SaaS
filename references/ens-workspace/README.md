# ENS Workspace Reference

This folder contains curated workspace-only material from `C:\ENS` for implementation reference.

Copied reference areas:

- `engine/`: legacy browser workspace engine modules, UI bindings, booth geometry, and scene runtime.
- `furniture/`: legacy workspace service/storage/catalog Python modules.
- `models/`: selected workspace, booth, and workspace workflow service/model references.
- `migrations/`: workspace-related Alembic migrations for schema parity research.
- `tests/`: workspace behavior tests for idempotency, review transitions, room scenes, storage, and upload validation.

Active static assets copied into the app:

- `artifacts/ens-landing/public/ens-workspace-assets/glb/`
- `artifacts/ens-landing/public/ens-workspace-assets/furniture/`

The active React workspace is intentionally not replaced by the legacy UI. Current integration is limited to local ENS GLB asset availability and catalog `modelUrl` metadata in `PMWorkspace.tsx`.

Excluded on purpose:

- `.env` and environment backups
- `.venv`
- `.pytest_cache`
- `__pycache__`
- generated load-test reports
- broad legacy standalone HTML screens unrelated to workspace behavior
