# Authorization Matrix

This document is the production authorization contract for Premium SaaS. Access is denied unless both the role and the resource scope permit it. A role grant never bypasses organization, project-membership, assignment, status-transition, or ownership checks.

## Roles

| Role                 | Meaning                                  | Default scope                               |
| -------------------- | ---------------------------------------- | ------------------------------------------- |
| Owner/Admin          | Service-level aliases for the Chief role | Current organization                        |
| Chief                | Organization administrator               | Current organization                        |
| Project Manager (PM) | Operational designer                     | Assigned clients and projects               |
| Client               | Exhibitor reviewer                       | Own client identity and project memberships |

All `/api/platform/**`, `/api/db/**`, and billing operations require an active, non-revoked session and active organization membership unless explicitly listed as public. Authentication uses portal-specific cookies; staff and client sessions are isolated.

## Public Routes

| Route family                              | Access                      | Additional controls                                           |
| ----------------------------------------- | --------------------------- | ------------------------------------------------------------- |
| Health and readiness probes               | Public                      | Must not expose secrets or customer data                      |
| Login, refresh, logout, password recovery | Public/session-aware        | Rate limiting, generic account-discovery responses            |
| Client signup                             | Public                      | Valid agency code and intake validation                       |
| Initial Chief bootstrap                   | Setup-key controlled        | Disabled after an organization Chief exists                   |
| Invitation validate/accept                | Signed token or invite code | Expiry, revocation, email binding, one-time atomic acceptance |
| Stripe webhook                            | Signature verified          | Event idempotency                                             |

## Organization Operations

| Capability                            | Chief         | PM                     | Client              | Required resource checks                  |
| ------------------------------------- | ------------- | ---------------------- | ------------------- | ----------------------------------------- |
| Read organization overview            | Yes           | Assigned summary       | Own summary         | Organization tenant                       |
| System readiness/database status      | Yes           | No                     | No                  | Organization tenant                       |
| List/create/update exhibitions        | Yes           | Read assigned          | Read own            | Tenant plus assignment/membership         |
| List projects                         | All in tenant | Assigned only          | Own only            | Tenant plus assignment/membership         |
| Create/update/archive project         | Yes           | Assigned projects only | No                  | Tenant plus assignment                    |
| Change project pipeline stage         | Yes           | Assigned projects only | No                  | Valid transition                          |
| List clients                          | All in tenant | Assigned only          | No directory access | Tenant plus assignment                    |
| Create/update/archive client          | Yes           | No                     | No                  | Tenant                                    |
| Approve/reject pending client         | Yes           | No                     | No                  | Pending status; PM assignment on approval |
| Assign PM/client/project              | Yes           | No                     | No                  | Same tenant; capacity confirmation        |
| View assignment history               | Yes           | Own assignments        | No                  | Tenant plus PM identity                   |
| Manage PM invitations/status/capacity | Yes           | No                     | No                  | Tenant                                    |
| Manage organization calendar          | Yes           | Read assigned          | No                  | Tenant plus assignment                    |
| Manage own tasks                      | Yes           | Yes                    | No                  | Tenant plus task owner/assignee           |
| Read Chief reports/workspace monitor  | Yes           | No                     | No                  | Tenant                                    |
| Read PM reports                       | Yes           | Own report             | No                  | Tenant plus PM identity                   |
| Export operational reports            | Yes           | Own assigned data      | No                  | Tenant plus assignment                    |

## Workspace Lifecycle

| Capability                       | Chief         | PM               | Client      | Required resource checks                |
| -------------------------------- | ------------- | ---------------- | ----------- | --------------------------------------- |
| Open workspace                   | All in tenant | Assigned project | Own project | Tenant plus project access              |
| Edit/save workspace              | Yes           | Assigned project | No          | Draft/revision state and project access |
| Upload workspace asset           | Yes           | Assigned project | No          | File policy and project access          |
| Submit version to client         | Yes           | Assigned project | No          | Saved version and valid transition      |
| Mark submitted version viewed    | No            | No               | Own project | Exact submitted version                 |
| Add feedback/comment             | Yes           | Assigned project | Own project | Project access                          |
| Resolve feedback                 | Yes           | Assigned project | No          | Project access                          |
| Request revision                 | Yes           | No               | Own project | Reviewable submitted version            |
| Approve design                   | Yes           | No               | Own project | Reviewable submitted version            |
| Change element production status | Yes           | Assigned project | No          | Project access                          |
| View billing simulation          | Yes           | Assigned project | Own project | Project access                          |

The canonical state flow is `draft -> submitted -> viewed -> revision_requested -> submitted -> approved`. Server validation, not the UI, enforces transitions.

## Messages And Documents

| Capability                               | Chief                    | PM                                   | Client                   | Required resource checks                      |
| ---------------------------------------- | ------------------------ | ------------------------------------ | ------------------------ | --------------------------------------------- |
| List message contacts                    | Tenant staff/clients     | Reachable Chief and assigned clients | Assigned PM/Chief        | Reachability graph                            |
| Read/send direct message                 | Reachable contact        | Reachable contact                    | Reachable contact        | Same tenant and allowed relationship          |
| Read/send project message                | Project member           | Assigned project                     | Own project              | Same project membership                       |
| Upload/download message attachment       | Conversation participant | Conversation participant             | Conversation participant | Attachment belongs to authorized conversation |
| List/download visible document           | Tenant-visible           | Assigned/visible                     | Own and client-visible   | Tenant, project access, visibility            |
| Create/change visibility/delete document | Yes                      | Assigned project                     | No                       | Tenant plus project access                    |

Direct object identifiers never grant access. Every data query must include `organization_id`; PM and client queries must additionally include assignment, client identity, project membership, or conversation participation as appropriate.

## Account Operations

All roles can read/update their own profile, change their own password, list their own sessions, revoke their own sessions, and read/mark their own notifications. They cannot target another user's account through these endpoints. A role, membership, password, or disabled-state change must invalidate affected sessions.

## Verification Requirements

1. Every protected route returns `401 auth_required` without a valid session.
2. Every role-restricted route returns `403 permission_denied` for a valid but disallowed role before its business handler runs.
3. Cross-organization identifiers return `403` or `404` without revealing resource existence.
4. PMs cannot access unassigned clients/projects; clients cannot access another client's project.
5. Attachment and document download authorization is re-evaluated on every request.
6. New routes must update this matrix and add positive, negative-role, and cross-tenant tests before merge.
