# TASK-006.1 — Compatibility Notes

Ngày: 2026-10-13  
Trạng thái: `Verified from source; runtime DB snapshot pending`

## PostgreSQL mapping confirmed from Prisma

| Domain | Prisma model | Physical table | Key columns |
|---|---|---|---|
| Auth | `Auth` | `auths` | `id`, `phone`, `email`, `password`, `name`, `date_of_birth`, `gender`, `avatar`, `address`, `citizen_id`, `role` |
| Patient | `Patient` | `patients` | `id`, `patient_code`, `auth_id`, `loyalty_points` |
| Patient profile | `PatientProfile` | `patient_profiles` | `id`, `profile_code`, `patient_id`, `name`, `phone`, `date_of_birth`, `gender`, `emergency_contact`, `is_active`, `created_at`, `updated_at` |
| Doctor directory | `Doctor` | `doctors` | `id`, `doctor_code`, `auth_id`, `years_experience`, `rating`, `work_history`, `description`, `specialty_id`, `is_active` |

Required relation assumptions:

- `patients.auth_id` is nullable and unique, referencing `auths.id`.
- `patient_profiles.patient_id` is nullable, referencing `patients.id`.
- `doctors.auth_id` is unique, referencing `auths.id`.
- `auths.role` preserves the legacy role values `DOCTOR`, `PATIENT`, `RECEPTIONIST`, `ADMIN`, `CASHIER`, `TECHNICIAN`.
- `patient_profiles.emergency_contact` is Prisma `Json`, so Spring must use an explicit JSON mapping/converter rather than a string column assumption.

Runtime database connection and row-level reconciliation are still pending. TASK-006 implementation must not enable destructive or auto-create DDL.

## JWT compatibility confirmed from Nest source

- Signing secret: `process.env.JWT_SECRET`, with legacy fallback `default_secret` in Nest source.
- Algorithm: default `jsonwebtoken` HMAC algorithm because no custom algorithm is configured.
- Issuer: not configured by Nest `JwtModule`; legacy tokens are not required to contain `iss`.
- Login claims: `sub`, `phone`, `email`, `role`, and a role-specific nested object such as `patient: { id, patientCode }`.
- Normal login response token TTL: access `15d`, refresh `30d`.
- Refresh endpoint verifies the submitted JWT and returns access `15m`, refresh `7d`.
- Google login uses separate access `15m`, refresh `7d` behavior and is outside TASK-006 P0.

Spring decision:

- Keep `jwt-issuer` configuration for newly issued Spring tokens when configured.
- Do not require issuer validation for legacy tokens that do not carry `iss`; signature and expiration remain mandatory.
- Use the configured `JWT_SECRET` equivalent as the only signing-key source; do not recreate the Nest `default_secret` fallback in production.
- Preserve legacy claim names and response names (`accessToken`, `refreshToken`).
- Make access/refresh TTL explicit in Spring properties so the compatibility decision is visible and testable.

## Success response envelope decision

Decision date: 2026-10-13. For TASK-006, keep the compatibility-first response strategy:

- Successful responses remain raw, feature-specific DTOs or arrays, preserving legacy field names such as `accessToken`, `refreshToken`, and `user`.
- Do not introduce a generic `ApiResponse<T>` envelope for this task. Wrapping successful payloads in `{ data, meta }` would require coordinated frontend and desktop changes.
- Do not introduce `EntityResponse`; JPA entities stay inside the persistence/domain boundary and are mapped to feature-specific API DTOs.
- Error responses continue to use the shared `ApiErrorResponse` contract through `BusinessException`, `ErrorCode`, and `GlobalExceptionHandler`.
- `/api/v1` and `/api` keep equivalent success and error semantics. URL versioning does not imply a different response envelope.

`ResponseEntity<T>` remains an HTTP transport helper for status and headers; it is separate from the JSON payload contract. If a controller needs explicit status or headers, it may use `ResponseEntity<AuthResponse>` without adding a generic JSON envelope.

## Registration compatibility confirmed

- OTP is a six-digit string with 300-second TTL.
- Registration session is stored in Redis; after OTP verification it receives a 1800-second TTL.
- Completion creates `auths` row with role `PATIENT` and `patients` row in one transaction.
- Password is BCrypt-hashed with cost 10 in the Nest implementation.
- The current production fallback does not pretend that delivery succeeded: until an email/SMS adapter is configured, registration step 1 returns the shared `503 service_unavailable` error. Tests use `TestOtpSender`.

## Bounded profile list compatibility

- Patient-profile list endpoints keep the legacy raw-array response shape and route aliases.
- The JPA query is bounded to the newest 1,000 records to avoid loading an unbounded staff result set into memory.
- A future version can add explicit page/size metadata without changing the current P0 response contract.

## Open runtime gate

Before staging cutover, run a read-only database inspection and compare:

1. Actual table/column names and PostgreSQL types.
2. Existing UUID, unique and foreign-key constraints.
3. Real `JWT_SECRET` and token samples from a non-production environment.
4. Redis connectivity and key namespace policy.

No unresolved item above blocks local entity/test implementation, but runtime deployment remains gated on this inspection.
