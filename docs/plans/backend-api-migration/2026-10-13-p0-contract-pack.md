# Revita P0 Contract Pack — Static Completion

Spec Source: `docs/plans/backend-api-migration/2026-10-12-spec.md`
Route Matrix: `docs/plans/backend-api-migration/2026-10-12-contract-matrix.md`
Source Baseline: `revita-be/src/**`, `revita-fe/src/**`, `revita-desktop/src/**`
Generated: `2026-10-13`
Status: `Static contract completed; runtime snapshots and consumer approval still required`

## 1. Purpose and evidence boundary

This pack completes the P0 contract at the level that can be verified from source code, DTOs, Swagger decorators, frontend types/services and existing sequence documents.

The following items are intentionally not invented:

- Actual response JSON for methods returning `any`, Prisma objects or service-specific projections.
- Runtime status codes where the Nest controller relies on framework defaults or thrown exceptions.
- Database row examples, JWT claim values and external-provider payloads.

Those items require a running NestJS environment with representative data. They are a cutover gate, not a reason to create a speculative Spring response.

## 2. Version and compatibility rule

For every business route in this document:

- Canonical Spring route: `/api/v1/...`.
- Legacy route: `/api/...`.
- Both routes use the same application service, authorization rule and state transition.
- A legacy alias may transform only the external request/response shape explicitly recorded in the matrix.
- `GET /`, `/docs`, OpenAPI and Actuator remain outside the business API version.

## 3. P0 identity and registration

| ID | Canonical Spring route | Legacy route | Request contract | Success contract | Error contract | Auth target | Evidence |
|---|---|---|---|---|---|---|---|
| ID-01 | `POST /api/v1/auth/login` | `POST /api/auth/login` | JSON `{ identifier, password }`; both required strings | `200 { accessToken, refreshToken, user }` | `401` invalid credentials | Public + rate limit | `login.dto.ts`, `login.controller.ts`, `login-sequence.puml` |
| ID-02 | `POST /api/v1/auth/refresh` | `POST /api/auth/refresh` | JSON `{ refreshToken }`; required string | `200 { accessToken, refreshToken }` | `401` invalid/expired refresh token | Public + refresh-token validation | `login.dto.ts`, `login.controller.ts` |
| ID-03 | `GET /api/v1/auth/me` | `GET /api/auth/me` | `Authorization: Bearer <accessToken>` | `200 UserDto` | `401` missing/invalid bearer; legacy source currently also returns an error body | JWT | `login.controller.ts`, `user.service.ts` |
| ID-04 | `POST /api/v1/auth/logout` | `POST /api/auth/logout` | Bearer access token | `200 { success, message }` | `401` missing/invalid bearer | JWT | `login.controller.ts` |
| ID-05 | `POST /api/v1/auth/google/token` | `POST /api/auth/google/token` | JSON `{ code }`; required string | `200 AuthResponseDto` | `400` provider/code failure | Public + provider timeout/rate limit | `login.dto.ts`, `login.controller.ts` |
| ID-06 | `POST /api/v1/register/step1` | `POST /api/register/step1` | JSON with at least one of `phone` or `email` | `200 { sessionId, message }` | `400` validation; `409` duplicate account | Public + OTP rate limit | `register-step1.dto.ts`, `register.controller.ts`, `register-sequence.puml` |
| ID-07 | `POST /api/v1/register/verify-otp` | `POST /api/register/verify-otp` | JSON `{ sessionId, otp }`; OTP exactly 6 characters | `200 { sessionId, message }` | `400` invalid OTP; `404` missing/expired session | Public + OTP attempt limit | `verify-otp.dto.ts`, `register.controller.ts` |
| ID-08 | `POST /api/v1/register/complete` | `POST /api/register/complete` | `name`, `dateOfBirth`, `gender`, `address`, `password`, `sessionId`; optional `citizenId`, `avatar`; gender `male|female|other` | `201 { message, userId }` | `400` invalid/unverified session; `409` duplicate citizen ID | Public + session validation | `complete-registration.dto.ts`, `register.controller.ts` |
| ID-09 | `POST /api/v1/register/resend-otp` | `POST /api/register/resend-otp` | JSON `{ sessionId }` | `200 { message }` | `400` already verified; `404` missing/expired session | Public + OTP rate limit | `register.controller.ts` |

## 4. P0 patient, appointment and queue

| ID | Canonical Spring route | Legacy/consumer route | Request/query contract | Success contract | Authorization decision | Evidence |
|---|---|---|---|---|---|
| OPS-01 | `GET /api/v1/appointment-booking/specialties` | `/api/appointment-booking/specialties` | none | specialty collection | Public read-only | appointment controller |
| OPS-02 | `GET /api/v1/appointment-booking/specialties/{specialtyId}/doctors` | same legacy suffix | path `specialtyId` | doctor collection | Public read-only | appointment controller |
| OPS-03 | `GET /api/v1/appointment-booking/doctors/{doctorId}/available-slots` | same legacy suffix | query `serviceId`, `date=YYYY-MM-DD` | available-slot collection | Public read-only | appointment controller |
| OPS-04 | `POST /api/v1/appointment-booking/appointments` | `/api/appointment-booking/appointments` | `{ patientProfileId, doctorId, serviceId, date, startTime, endTime }` | appointment booking result; status must be runtime-snapshotted | JWT; patient ownership and slot conflict check | `book-appointment.dto.ts`, appointment controller |
| OPS-05 | `GET /api/v1/appointment-booking/patient/appointments` | same legacy suffix | bearer token | patient appointment collection | JWT; own patient only | appointment controller |
| OPS-06 | `PATCH /api/v1/appointment-booking/appointments/{id}/cancel` | same legacy suffix | path `id`; empty JSON body accepted by current client | `{ appointmentId, appointmentCode?, status, message }` | ADMIN/DOCTOR/RECEPTIONIST + assignment/operational ownership | appointment controller |
| OPS-07 | `POST /api/v1/take-number/take` | `/api/take-number/take` | optional identity fields; at least one valid patient/appointment/manual identity path; priority flags | ticket/queue number result | Kiosk public compatibility only; rate limit, validation and audit required | `take-number.dto.ts`, desktop `api.ts`, take-number docs |
| OPS-08 | `GET /api/v1/counter-assignment/counters` | `/api/counter-assignment/counters` | none | counter array or `{ counters }` accepted by desktop | Read-only; public only if no private fields are returned | counter controller, desktop `api.ts` |
| OPS-09 | `GET /api/v1/counter-assignment/queue/{counterId}` | `/api/counter-assignment/queue/{counterId}` | path `counterId` | queue snapshot | Requires queue-scope authorization before production; current source is `@Public` | counter controller, desktop `api.ts` |
| OPS-10 | `POST /api/v1/counter-assignment/next-patient/{counterId}` | same legacy suffix | path `counterId`; empty JSON body | promoted patient/ticket result | RECEPTIONIST or scoped desktop credential; never remain unauthenticated mutation | counter controller, desktop `api.ts` |
| OPS-11 | `POST /api/v1/counter-assignment/skip-current/{counterId}` | same legacy suffix | path `counterId`; empty JSON body | skipped ticket result | RECEPTIONIST or scoped desktop credential | counter controller, desktop `api.ts` |
| OPS-12 | `POST /api/v1/routing/status/completed` | same legacy suffix | `{ patientProfileId, roomId }` | `{ message }` | Assigned DOCTOR/TECHNICIAN/RECEPTIONIST or scoped desktop credential | routing controller, desktop `api.ts` |

### Queue security blocker

The current desktop client calls queue mutation routes without an `Authorization` header while the Nest controllers mark several of them `@Public`. Spring must not copy that public mutation behavior. Before cutover, choose one of:

1. Add JWT acquisition and bearer propagation to desktop.
2. Use a narrowly scoped internal credential/mTLS path for trusted kiosk/desktop clients.
3. Keep queue mutations on NestJS until authenticated desktop compatibility is verified.

## 5. P0 clinical workflow

| ID | Canonical Spring route | Request contract | Success contract | Authorization and state rule | Evidence |
|---|---|---|---|---|---|
| CLN-01 | `POST /api/v1/prescriptions` | `patientProfileId`, non-empty `services[]`; optional doctor/record/note | created prescription with prescription services | DOCTOR/RECEPTIONIST; actor and patient context required | `create-prescription.dto.ts`, prescription controller |
| CLN-02 | `POST /api/v1/prescriptions/start-services` | `{ services: [...] }` from desktop | service-start result | Must be authenticated service actor; current source is public and requires hardening | prescription controller, desktop `api.ts` |
| CLN-03 | `GET /api/v1/prescriptions/pending-services/{prescriptionCode}` | path code | pending service collection | Read-only scoped by prescription; current source is public | prescription controller, desktop `api.ts` |
| CLN-04 | `PUT /api/v1/prescriptions/prescription-service/status` | `{ prescriptionServiceId, status, note? }`; status must be `PrescriptionStatus` | `{ service, message }` | DOCTOR/TECHNICIAN/RECEPTIONIST + assigned service; valid state transition only | `prescription-service.dto.ts` |
| CLN-05 | `PUT /api/v1/prescriptions/prescription-service/results` | `{ prescriptionServiceId, results[], note?, shouldReschedule? }` | `{ service, message }` | Assigned DOCTOR/TECHNICIAN/RECEPTIONIST; result update is idempotent per request key | `prescription-service.dto.ts` |
| CLN-06 | `POST /api/v1/medical-records` | multipart: `patientProfileId`, `templateId?`, `doctorId?`, `appointmentCode?`, `status?`, JSON-string `content`, optional `files[]` | medical record + optional `uploadedFiles` + message | DOCTOR/ADMIN create; patient/resource ownership enforced | medical-record controller, medical-record sequence |
| CLN-07 | `PATCH /api/v1/medical-records/{id}` | multipart `content`, `status`, `appendFiles?`, optional `files[]` | updated record + optional uploaded files + message | DOCTOR/ADMIN/RECEPTIONIST; valid medical-record transition | medical-record controller |
| CLN-08 | `GET /api/v1/medical-records/patient-profile/{patientProfileId}` | query `page`, `limit` | paginated record collection | patient own profile or assigned/approved staff | medical-record controller, frontend `api.ts` |
| CLN-09 | `POST /api/v1/file-storage/upload` | multipart `file`, `bucket`, optional `folder` | `{ url, originalName, fileName, size, mimeType, uploadedAt }` | owner/assigned staff; MIME, size and path checks | file-storage service |

## 6. P0 payment

| ID | Canonical Spring route | Request contract | Success/error contract | Authorization/state rule | Evidence |
|---|---|---|---|---|---|
| PAY-01 | `POST /api/v1/invoice-payments/preview` | `prescriptionCode`, `paymentMethod`, selected service IDs/codes, optional URLs | invoice preview | CASHIER/RECEPTIONIST; do not mutate paid state | `create-payment.dto.ts`, frontend `api.ts` |
| PAY-02 | `POST /api/v1/invoice-payments/create` | same payment DTO; cashier resolved from JWT where possible | invoice/payment draft | CASHIER; idempotency key required for retried create | invoice controller, cash-payment docs |
| PAY-03 | `POST /api/v1/invoice-payments/confirm` | `invoiceCode`, `cashierId`, optional `transactionId` | confirmed invoice/payment result | CASHIER; invoice must be payable and not cancelled | `confirm-payment.dto.ts`, cash-payment docs |
| PAY-04 | `POST /api/v1/invoice-payments/invoice/{invoiceCode}/refresh` | optional `returnUrl`, `cancelUrl` | refreshed provider link | CASHIER/PATIENT/RECEPTIONIST; invoice ownership check | `refresh-payment.dto.ts`, frontend `api.ts` |
| PAY-05 | `POST /api/v1/invoice-payments/payos/webhook` | raw provider JSON + `x-payos-signature` or `x-signature` | acknowledge provider contract; internal processing must be idempotent | Public transport, mandatory signature verification; duplicate event is no-op | invoice controller, PayOS sequence/activity |
| PAY-06 | `GET /api/v1/invoice-payments/invoice-by-id/{invoiceId}` | path `invoiceId` | invoice detail | CASHIER/PATIENT/RECEPTIONIST with patient/invoice ownership | invoice controller, frontend `api.ts` |

## 7. Realtime P0 contract

Socket.IO is not moved under `/api/v1` in phase 1. Preserve namespaces, event names, rooms, acknowledgement shape and reconnect behavior:

| Namespace | Client evidence | Required events/operations | Gate |
|---|---|---|---|
| `/counters` | desktop `websocket.ts` | `join_counter`, `leave_counter`, `new_ticket`, `patient_called`, `next_patient_called`, `patient_skipped`, `patient_preparing`, `patient_served`, queue/ticket events | capture payloads and auth/room ownership |
| `/clinic-rooms` | desktop `clinic-room-websocket.ts` | `join_clinic_room`, `leave_clinic_room`, `prescription_service_serving`, `prescription_service_removed`, `patient_status_changed`, `new_prescription_patient` | capture payloads and room ownership |
| Remaining three namespaces | Nest websocket module + frontend hooks | preserve source namespaces/events | explicit source-to-client inventory before TASK-011 |

## 8. P0 contract tests

| Test ID | Contract | Expected result |
|---|---|---|
| CT-01 | `/api/v1/auth/login` and `/api/auth/login` with same valid request | Equivalent observable payload and status |
| CT-02 | Invalid login, expired refresh, missing bearer | 401 contract; no sensitive detail |
| CT-03 | Register step 1 → verify OTP → complete | Session can advance once; duplicate/expired session is rejected |
| CT-04 | Patient A reads/updates Patient B profile/record/invoice | 403 and audit event |
| CT-05 | Duplicate appointment booking for same slot | One booking only; second request gets documented 409/idempotent result |
| CT-06 | Concurrent next-patient requests | At most one ticket is promoted |
| CT-07 | Service status invalid transition | 409 with stable error code |
| CT-08 | Multipart medical record with malformed JSON/path traversal | 400; no file escape; no partial record mutation |
| CT-09 | PayOS invalid signature and duplicate valid webhook | Reject invalid signature; duplicate valid event is idempotent |
| CT-10 | Every `/api/v1` P0 route through `/api` alias | Same authorization and service behavior; documented transform only |
| CT-11 | Desktop connects/reconnects to `/counters` and `/clinic-rooms` | Room membership and event delivery are not duplicated |
| CT-12 | Null/empty inputs | Missing login fields, empty OTP/session, empty service list and empty upload list return the documented validation error without a partial write |
| CT-13 | Boundary values | OTP length 5/6/7, queue age 0/150/151, pagination limit 0/1/max/max+1, and date at the month boundary are handled deterministically |
| CT-14 | Format outliers | Unicode names, surrounding whitespace, HTML/SQL-like strings, leap-day dates, timezone offsets and unsafe file names are validated/escaped safely |

## 9. Readiness decision

Static completion is sufficient to begin Spring foundation design, but not sufficient for production cutover. Before `TASK-006` implementation:

1. Capture runtime success/error snapshots from NestJS for every P0 row.
2. Resolve the desktop queue-auth blocker.
3. Approve all `UNGUARDED/REVIEW` P0 routes in the authorization matrix.
4. Run the contract tests against both legacy NestJS and Spring `/api/v1` plus `/api` aliases.
