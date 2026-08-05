# Service Level Objectives

These initial SLOs apply to production after observability exports are connected. They are targets, not claims about current measured performance.

## Availability And Correctness

| Service indicator                                           | Objective | Window          |
| ----------------------------------------------------------- | --------- | --------------- |
| Authenticated API availability excluding valid 4xx          | 99.9%     | Rolling 30 days |
| Login and refresh success for valid credentials             | 99.9%     | Rolling 30 days |
| Workspace read/save/submit success excluding validation 4xx | 99.95%    | Rolling 30 days |
| Authorized attachment upload/download success               | 99.9%     | Rolling 30 days |
| Message send/read success                                   | 99.9%     | Rolling 30 days |
| Invitation/password email accepted by provider              | 99.5%     | Rolling 30 days |
| Cross-tenant authorization violations                       | 0         | Always          |
| Lost acknowledged workspace saves/messages/uploads          | 0         | Always          |

## Latency

| Operation                             | p95 target | p99 target |
| ------------------------------------- | ---------- | ---------- |
| Cached/static portal navigation       | 250 ms     | 750 ms     |
| Standard API read                     | 500 ms     | 1.5 s      |
| Standard API mutation                 | 750 ms     | 2 s        |
| Workspace save excluding asset upload | 1.5 s      | 3 s        |
| Message send                          | 750 ms     | 2 s        |
| Readiness probe                       | 250 ms     | 1 s        |

## Recovery Objectives

- **RPO:** 15 minutes for PostgreSQL and durable object metadata; zero acknowledged-write loss is the application target.
- **RTO:** 60 minutes for SEV-1 service restoration.
- **Backup verification:** automated daily backup plus successful isolated restore exercise at least weekly.
- **Release rollback:** previous immutable application version routable within 15 minutes, subject to schema compatibility.

## Error Budget Policy

At 99.9% monthly availability the error budget is approximately 43 minutes. At 50% budget consumption, pause non-essential reliability-risking changes. At 75%, require reliability owner approval. At 100%, freeze feature releases until the causal reliability work is complete and verified.

SLO calculations must exclude only documented maintenance and invalid client requests. They must not exclude internal failures, dependency failures, authorization mistakes, or deployment incidents.
