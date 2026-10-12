# Revita Authorization and Ownership Matrix — Baseline v0

Spec Source: `docs/plans/backend-api-migration/2026-10-12-spec.md`
Route Source: `docs/plans/backend-api-migration/2026-10-12-contract-matrix.md`
Generated: `2026-10-13`
Status: `Baseline policy expanded; route-level ownership review and desktop-auth decision required before implementation`

## 1. Scope

This document turns the existing NestJS guard signals into a migration policy. The route-level `Auth signal` column is in the contract matrix; this document adds the resource ownership rule that cannot be inferred safely from the URL alone.

The same authorization and ownership policy applies to both `/api/v1/...` canonical routes and `/api/...` legacy aliases. The compatibility adapter must not bypass JWT, role, ownership, 401/403 handling or audit requirements.

## 1.1. Route-level source coverage

The 294 source route rows currently classify as follows:

| Source signal | Count | Target decision |
|---|---:|---|
| Explicit role guard | 153 | Preserve role set, then add ownership/resource check |
| Explicit JWT-only guard | 13 | Require JWT; define resource scope per route |
| Explicit `@Public` | 28 | Public only if response contains no private data; rate-limit where applicable |
| No visible guard / `UNGUARDED/REVIEW` | 100 | Not approved as public; assign explicit target policy before implementation |

The 24 frontend/desktop compatibility rows are `REVIEW` until their consumer, target v1 mapping and security behavior are approved.

## 2. Roles

| Role | Allowed scope | Must still pass ownership check |
|---|---|---|
| `ADMIN` | System administration, configuration, reports and approved cross-resource operations | Yes for patient/clinical/payment data unless explicitly role-wide |
| `DOCTOR` | Assigned appointments, clinical records, prescriptions and work sessions | Yes; doctor must be assigned or explicitly authorized |
| `PATIENT` | Own profile, own appointments, own medical/payment/prescription views and own rating | Always |
| `RECEPTIONIST` | Reception, patient registration, appointment check-in, counter and queue operations | Yes for patient and appointment context |
| `CASHIER` | Invoice and payment operations within cashier scope | Yes for patient/invoice context |
| `TECHNICIAN` | Assigned service queue, work session and service results | Yes; technician must be assigned to the work/service context |

## 3. Resource policy

| Resource / route group | Authentication | Role policy | Ownership rule | Target behavior |
|---|---|---|---|---|
| `/api/auth/login`, `/api/auth/refresh`, `/api/auth/google/**`, `/api/auth/callback`, `/api/register/**` | Public for documented auth steps | Public | No protected resource access | Preserve legacy flow; rate-limit login/OTP |
| `/api/auth/me`, `/api/auth/logout` | JWT | Authenticated user | Token subject must resolve to the current user | Return 401 for missing/invalid bearer; do not preserve a misleading 200 error body |
| `/api/public/**`, public appointment lookup and drug search | Public | Public | Only expose intentionally public fields | Verify response does not leak private data |
| `/api/users/**`, `/api/user/**` | JWT | Role-specific | User may read/update own account; admin/receptionist routes require explicit role | No user ID substitution without authorization |
| `/api/patient-profiles/**` | JWT | Patient/doctor/admin/receptionist/cashier by operation | Patient owns own profile; staff access requires care/reception context | Return 403 for another patient |
| `/api/appointments/**`, `/api/appointment-booking/**` | Public or JWT by route | Patient/doctor/admin/receptionist | Patient owns booking; doctor must be assigned; staff needs operational role | Check patient/doctor/work-session relation |
| `/api/counter-assignment/**`, `/api/routing/**`, `/api/take-number/**` | JWT | Receptionist/doctor/technician/admin by operation | Counter/queue must belong to active clinic context and assignment | Serialize next/skip/serve transitions |
| `/api/medical-records/**`, `/api/doctors/{doctorId}/medical-records/**` | JWT | Patient/doctor/admin/receptionist by operation | Patient own record; doctor assigned record; staff read-only where specified | Block BOLA/IDOR |
| `/api/prescriptions/**`, `/api/medication-prescriptions/**` | JWT | Doctor/patient/receptionist/technician/admin by operation | Patient owns view; doctor/technician must be assigned to service | Check prescription-service relation |
| `/api/services/**`, `/api/work-sessions/**` | JWT or route-specific public lookup | Doctor/technician/receptionist/admin | Assigned doctor/technician/work session | Reject unassigned result/status changes |
| `/api/invoice-payments/**` | JWT, webhook signature for PayOS | Cashier/patient/receptionist/doctor by operation | Patient sees own invoice; cashier operates allowed invoice | Verify signature and idempotency |
| `/api/posts/**` | Public for published content; JWT for mutation | Admin for management; authenticated user for allowed interaction | Comment/like belongs to actor; admin moderation role-wide | Preserve public/private visibility |
| `/api/file-storage/**` | JWT except explicitly public URL | Resource owner or assigned staff | File path must resolve to authorized record/service | Prevent path traversal and arbitrary deletion |
| `/api/admin/**`, `/api/statistics/**` | JWT | Admin or explicit reporting roles | Role-wide only for approved aggregate views | Never infer admin from client-supplied fields |
| `/api/doctor-ratings/**` | JWT | Patient/admin and allowed readers | Patient can rate only eligible completed appointment/doctor | Prevent duplicate or foreign rating |

## 3.1. P0 target decisions for source-public mutations

The following source routes are currently public or unguarded but mutate operational/clinical state. They are not approved as public in Spring:

| Route family | Current consumer | Spring target policy | Cutover requirement |
|---|---|---|---|
| `/api/counter-assignment/next-patient/**`, `/skip-current/**`, `/rollback/**` | Desktop counter app | RECEPTIONIST or scoped desktop credential | Desktop must send authenticated credential, or traffic remains on NestJS |
| `/api/routing/status/**` | Desktop/queue flow | Assigned operational staff or scoped desktop credential | Verify actor-to-room/counter ownership |
| `/api/prescriptions/start-services`, `/assign-next-service`, `/pending-services/**` | Desktop clinical flow | Assigned DOCTOR/TECHNICIAN; read-only pending lookup may use scoped access | Decide token propagation and patient-data exposure |
| `/api/auth/me`, `/api/auth/logout` | Web | JWT | Missing/invalid bearer must be 401, not only an error object in a 200 response |
| `/api/file-storage/**` and post like/comment routes without visible guard | Web | Resource owner or assigned staff; authenticated interaction | Complete IDOR/path traversal tests before implementation |

## 4. Current source findings requiring hardening

| Finding | Source evidence | Migration rule |
|---|---|---|
| Staff controller has no explicit guard | `revita-be/src/user-management/staff/staff.controller.ts` | Do not port as public; require explicit role policy |
| JWT has `default_secret` fallback | `revita-be/src/login/jwt.strategy.ts` and login module | Fail fast when production secret is absent |
| CORS accepts all origins | `revita-be/src/main.ts` uses `origin: true` | Use environment allowlist before production cutover |
| Some routes are `@Public` or lack visible guard | controller decorators | Classify intentionally public routes; secure the rest by matrix |

## 5. Required tests

- Missing token → 401.
- Valid token with wrong role → 403.
- Patient A requests Patient B profile/record/invoice/prescription → 403.
- Doctor/technician attempts an unassigned service update → 403.
- Receptionist/cashier attempts an operation outside their scope → 403.
- Admin-only endpoint called by every non-admin role → 403.
- Public endpoint returns no private fields.
- Alias route has the same auth and ownership rule as its canonical route.
- Source `@Public` is not sufficient approval for state mutation or personal-data response.
- `/api/v1` and `/api` return equivalent 401/403 behavior for the same actor/resource combination.

## 6. Gate

The authorization matrix is ready for implementation only when every canonical and compatibility row in the contract matrix has:

1. Explicit auth mode.
2. Allowed role set.
3. Ownership source and rule.
4. 401/403 behavior.
5. At least one positive and one negative test owner.
