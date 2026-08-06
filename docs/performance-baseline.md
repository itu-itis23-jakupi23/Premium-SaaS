# Performance Baseline and Budgets

## Purpose

This document defines the release budgets for the ENS staff and client portals. A budget is a release constraint, not a claim that every production environment already meets the target. Measurements without automated evidence remain explicitly unverified.

## Automated Build Baseline

Baseline captured on 2026-08-06 from production Vite builds. `pnpm run performance:budgets` reads the emitted `index.html` files and build artifacts, recomputes raw and gzip sizes, and writes `.release-evidence/frontend-performance.json`.

| Metric                         | Staff baseline | Client baseline | Release budget |
| ------------------------------ | -------------: | --------------: | -------------: |
| Initial JavaScript, raw        |  about 704 KiB |   about 668 KiB |        800 KiB |
| Initial JavaScript, gzip       |  about 223 KiB |   about 214 KiB |        250 KiB |
| Initial CSS, raw               |  about 195 KiB |   about 195 KiB |        220 KiB |
| Initial CSS, gzip              |   about 28 KiB |    about 28 KiB |         35 KiB |
| Largest JavaScript chunk, raw  |  about 584 KiB |   about 584 KiB |        640 KiB |
| Largest JavaScript chunk, gzip |  about 149 KiB |   about 149 KiB |        170 KiB |
| Largest deployed asset         | about 2.37 MiB |  about 2.37 MiB |          3 MiB |

The initial route must not preload `vendor-charts` or `vendor-three`. Charts and the Three.js workspace remain route-loaded. Shared `clsx` and `tailwind-merge` utilities are emitted separately so Recharts cannot pull the full chart runtime into the landing-page preload graph.

## Runtime Budgets

The following targets apply to the staging production topology with optimized builds, PostgreSQL, durable object storage, and no browser extensions. They become verified only after traces are recorded from that environment.

| Area                           | Budget                                                     | Evidence required                                               | Current status |
| ------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------- | -------------- |
| Public landing LCP             | p75 <= 2.5 s on Fast 4G / 4x CPU slowdown                  | Lighthouse or Web Vitals trace                                  | Unverified     |
| Authenticated route navigation | p75 <= 1.5 s from click to stable content                  | Playwright performance trace                                    | Unverified     |
| Read-only API latency          | p95 <= 500 ms, p99 <= 1 s                                  | Server metrics over representative traffic                      | Unverified     |
| Mutation API latency           | p95 <= 750 ms, workspace save p95 <= 1.5 s                 | Server metrics over representative traffic                      | Unverified     |
| Workspace interaction          | median >= 45 FPS; no sustained interval below 30 FPS       | 60-second browser performance trace with a representative booth | Unverified     |
| Workspace memory growth        | <= 100 MiB after 10 minutes and 20 route enter/exit cycles | Browser heap snapshots                                          | Unverified     |
| GLB asset                      | <= 3 MiB each; larger assets require an approved exception | Build budget report and catalogue audit                         | Enforced       |

## Test Fixtures

- Landing measurements use fresh browser storage and an uncached first load.
- Authenticated route measurements use a Chief account with 200 clients, 50 PMs, 500 projects, and 1,000 messages.
- Workspace measurements use a 9 m x 6 m booth with 40 furniture objects, panel artwork, fascia branding, one room, and shadows enabled.
- API latency measurements exclude client network transit and include database query time.

## Release Policy

1. `build:staff` and `build:client` must run before `performance:budgets`.
2. A build-budget failure blocks release; raising a budget requires a documented reason and updated baseline.
3. Runtime targets cannot be marked verified from local development-server observations.
4. Once staging telemetry is available, record the date, commit, fixture, browser, hardware profile, and trace location below.

## Runtime Evidence Log

No staging runtime trace has been recorded yet.
