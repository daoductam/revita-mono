# Implementation Plan: API v1 Response Envelope

Spec Source: `docs/plans/backend-api-migration/2026-10-13-api-v1-response-envelope-spec.md`  
Owner: `tamdao / Codex`  
Last Updated: `2026-10-13`  
Status: `Draft`

---

# 1. Context

**Problem:**

TASK-006 currently returns raw DTOs for successful responses and `ApiErrorResponse` for errors. The canonical `/api/v1` contract needs one predictable JSON envelope while the legacy `/api` contract remains unchanged during frontend and desktop migration.

**Affected Modules:**

- `spring-revita-be/common/api` — add the generic success/error envelope and response metadata.
- `spring-revita-be/common/error` — serialize version-aware error envelopes.
- `spring-revita-be/security` — serialize version-aware 401/403 responses.
- `spring-revita-be/*/api` — expose thin `/api/v1` controllers returning `ResponseEntity<ApiResponse<T>>`.
- `spring-revita-be/src/test` — assert v1 envelope and legacy raw compatibility.
- `docs/plans/backend-api-migration` — record contract and migration evidence.

**Non-Goals:**

- Do not change business services, entities, repositories, authorization policy or endpoint paths.
- Do not wrap legacy `/api` success payloads.
- Do not change HTTP status semantics or WebSocket messages.
- Do not introduce a second API version or external dependency.

---

# 2. Constraints

**Language:** `Java 21`  
**Architecture:** `Layered modular Spring Boot; thin versioned API adapters over shared application services`

**Rules:**

- `/api/v1` controllers return `ResponseEntity<ApiResponse<T>>`.
- `/api` controllers preserve their existing raw DTO/array and `ApiErrorResponse` shapes.
- Both prefixes delegate to the same application services and security policy.
- HTTP status is authoritative; body `error.code` is machine-readable business metadata only.
- No password, token, OTP or provider secret may be serialized.
- Do not modify unrelated modules or add external dependencies.

**Performance Budgets:**

- Envelope creation must be in-memory and not add database queries.
- Keep existing service/query behavior and profile-list bound unchanged.

---

# 3. Conventions

**Naming:**

- Classes: `PascalCase`; methods/variables: `camelCase`; constants: `UPPER_SNAKE_CASE`.
- Generic wrapper: `ApiResponse<T>`.
- API v1 controllers use a clear `V1` suffix or `api.v1` package and delegate; no business logic duplication.
- Use `ResponseEntity.status(...).body(...)` when status is not 200 and `ResponseEntity.ok(...)` otherwise.

**Error Handling:**

- `BusinessException`, `ErrorCode` and existing error details remain the source of error semantics.
- `/api/v1` maps errors to `ApiResponse<Void>`; `/api` maps errors to `ApiErrorResponse`.
- Security entry point and access-denied handler must apply the same path-aware rule.

**Testing:**

- JUnit 5, Spring Boot Test, MockMvc and Spring Security Test.
- Every changed endpoint is tested through both `/api/v1` and `/api`.
- v1 assertions read payloads from `$.data`; legacy assertions keep reading the root.
- Run `cd spring-revita-be; .\mvnw.cmd -q test` before handoff.

**Task Size:**

- Max 200 production LOC per task, excluding tests and documentation.

---

# 4. Contracts

## Interface: `ApiResponse<T>`

```text
success(data: T, meta: ApiMeta): ApiResponse<T>
  - pre: data may be null only for an intentionally empty successful response
  - post: success=true, error=null, original data is retained

failure(error: ApiError, meta: ApiMeta): ApiResponse<Void>
  - pre: error is non-null
  - post: success=false, data=null, error is retained
```

## Interface: `ApiResponseFactory`

```text
success(data: T, requestId: String): ApiResponse<T>
  - post: creates a success envelope with request metadata

failure(errorCode: ErrorCode, message: String?, details: List<ErrorDetail>, requestId: String): ApiResponse<Void>
  - post: creates a failure envelope without changing the supplied error semantics
```

## Interface: `ApiVersionResolver`

```text
isV1(request: HttpServletRequest): boolean
  - post: true only for the canonical /api/v1 path boundary
  - post: false for /api and unrelated paths
```

## Data Structures

```text
ApiResponse<T> {
  success: Boolean
  data: T?                  -- payload for successful responses
  error: ApiError?          -- populated only for failures
  meta: ApiMeta             -- request metadata
}

ApiError {
  code: String
  message: String
  details: List<ApiErrorDetail>
}

ApiErrorDetail {
  field: String?
  message: String
  code: String?
}

ApiMeta {
  requestId: String?
}
```

## Shared response rules

- `POST /api/v1/register/complete` returns `ResponseEntity<ApiResponse<RegistrationCompleteResponse>>` with the existing `201` status.
- List endpoints use `ApiResponse<List<T>>`, preserving raw array contents inside `data`.
- Legacy `/api` endpoints keep their current response body and status.
- Failure status comes from `ErrorCode.httpStatus()` or the existing mapped status, never from a body field.

---

# 5. Target Architecture

**Components:**

- `ApiResponse<T>` — immutable generic JSON envelope.
- `ApiError`, `ApiErrorDetail`, `ApiMeta` — v1 envelope components.
- `ApiResponseFactory` — one construction path for success/failure bodies.
- `ApiVersionResolver` — identifies `/api/v1` without changing business logic.
- `AuthV1Controller`, `RegistrationV1Controller`, `UserV1Controller`, `PatientV1Controller`, `PatientProfileV1Controller` — thin v1 adapters.
- Existing legacy controllers — retain `/api` mappings and raw response types.
- `GlobalExceptionHandler` and `SecurityConfig` — select v1 or legacy error serialization.

**Interaction Flow — v1 success:**

```text
Client
  → /api/v1/... controller
    → shared application service
    → feature DTO T
    → ApiResponseFactory.success(T, requestId)
  ← ResponseEntity<ApiResponse<T>> with existing HTTP status
```

**Interaction Flow — v1 error:**

```text
Client
  → controller/service/security failure
    → GlobalExceptionHandler or security handler
    → ApiVersionResolver.isV1(request) == true
    → ApiResponseFactory.failure(...)
  ← ResponseEntity<ApiResponse<Void>> with 4xx/5xx status
```

**Key Decisions:**

- Use thin duplicate route adapters instead of `ResponseEntity<?>` path branching inside one controller. This preserves compile-time generic types and keeps the legacy adapter stable.
- Reuse application services so business behavior cannot diverge between aliases.
- Keep `ApiErrorResponse` for `/api` until clients migrate.
- Do not use a `ResponseBodyAdvice` as the primary mechanism because it hides the v1 contract from controller signatures and OpenAPI generation.

---

# 6. Artifact Registry

| Artifact | Type | Owner Task | Implements |
|---|---|---|---|
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/common/api/ApiResponse.java` | record | ENV-001 | `ApiResponse<T>` |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/common/api/ApiError.java` | record | ENV-001 | v1 error contract |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/common/api/ApiMeta.java` | record | ENV-001 | v1 metadata contract |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/common/api/ApiResponseFactory.java` | component | ENV-001 | response construction |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/common/api/ApiVersionResolver.java` | component | ENV-001 | version detection |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/*/api/*V1Controller.java` | controllers | ENV-002/ENV-003 | v1 controller contract |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/common/error/GlobalExceptionHandler.java` | modify | ENV-004 | version-aware MVC errors |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/security/SecurityConfig.java` | modify | ENV-004 | version-aware security errors |
| `spring-revita-be/src/test/java/com/tamdao/spring_revita_be/task006/*` | tests | ENV-005 | v1 and legacy contracts |
| `docs/plans/backend-api-migration/2026-10-13-api-v1-response-envelope-spec.md` | spec | ENV-000 | approved design |
| `docs/plans/backend-api-migration/2026-10-13-api-v1-response-envelope-plan.md` | plan | ENV-000 | implementation plan |

---

# 7. Task Graph

| ID | Name | Depends On | Effort |
|---|---|---|---|
| ENV-001 | Common envelope and version resolver | — | S |
| ENV-002 | Auth, registration and user/patient v1 adapters | ENV-001 | M |
| ENV-003 | Patient-profile v1 adapter | ENV-001 | S |
| ENV-004 | Version-aware MVC and security errors | ENV-001 | M |
| ENV-005 | Contract tests, OpenAPI and evidence | ENV-002, ENV-003, ENV-004 | M |

**Dependency Graph:**

```text
ENV-001
  ├── ENV-002 ──┐
  ├── ENV-003 ──┼── ENV-005
  └── ENV-004 ──┘
```

**Execution Rules:**

- ENV-002, ENV-003 and ENV-004 may proceed in parallel after ENV-001.
- ENV-005 requires all transport and error boundaries to be complete.

---

# 8. Task Specifications

## ENV-001: Common envelope and version resolver

**Description:**

Create the immutable v1 response types and a single factory/resolver used by controllers and error handlers. This task must not change endpoint behavior yet.

**Files:**

- Create `common/api/ApiResponse.java`, `ApiError.java`, `ApiMeta.java`, `ApiResponseFactory.java`, `ApiVersionResolver.java`.
- Add focused unit tests for envelope invariants and path detection.

**Acceptance Criteria:**

- `success(payload, requestId)` → `success=true`, `data=payload`, `error=null`.
- `failure(error, requestId)` → `success=false`, `data=null`, populated error.
- `/api/v1/auth/login` → `isV1=true`.
- `/api/auth/login` → `isV1=false`.
- No factory output contains credentials or tokens unless the supplied safe DTO already contains an allowed field.

## ENV-002: Auth, registration, user and patient v1 adapters

**Description:**

Expose thin v1 controllers for auth, registration, public doctors, user self-update and patient self-update. Remove `/api/v1` from the legacy controller mappings while retaining `/api` mappings.

**Files:**

- Modify existing `AuthController`, `RegistrationController`, `UserController` and `PatientController` legacy mappings.
- Create corresponding v1 controllers or equivalent thin version adapters.

**Responsibilities:**

- Return `ResponseEntity<ApiResponse<T>>` for every v1 success route.
- Delegate to the existing application services.
- Preserve current status codes and payload DTO fields inside `data`.

**Acceptance Criteria:**

- v1 login → `200` and `$.data.accessToken`, `$.data.user`.
- v1 registration complete → `201` and `$.data.userId`.
- v1 doctor list → `200` and `$.data` is an array.
- Legacy equivalents remain raw at the JSON root.

## ENV-003: Patient-profile v1 adapter

**Description:**

Expose v1 list, by-patient, by-id, create and update routes using the existing profile service and ownership policy. Preserve the raw list contents inside `data` and the existing 1,000-record query bound.

**Files:**

- Modify `PatientProfileController` legacy mapping.
- Create the v1 patient-profile controller.

**Acceptance Criteria:**

- v1 profile list → `$.data` is an array.
- v1 create/update → payload fields are under `$.data`.
- Patient A versus Patient B still returns the same 403 behavior.
- Legacy profile responses remain unchanged.

## ENV-004: Version-aware MVC and security errors

**Description:**

Update MVC exception handling and security response writers so v1 failures use `ApiResponse<Void>` while legacy failures preserve `ApiErrorResponse`.

**Files:**

- Modify `common/error/GlobalExceptionHandler.java`.
- Modify `security/SecurityConfig.java` and any extracted security response helper.
- Add tests for MVC and filter-level failures.

**Acceptance Criteria:**

- v1 validation, conflict, not-found and unexpected errors → envelope with original status.
- v1 anonymous protected request → `401` with `success=false` and `error.code=unauthorized`.
- v1 forbidden request → `403` with `error.code=forbidden`.
- Legacy error responses remain `{ "error": ... }`.
- No failure is returned with HTTP 200.

## ENV-005: Contract tests, OpenAPI and evidence

**Description:**

Update the TASK-006 contract suite and documentation to make the versioned response decision executable and auditable.

**Files:**

- Modify all relevant `Task006*Tests` and `ExceptionContractTests` assertions.
- Add/adjust OpenAPI response schemas or configuration if needed.
- Update compatibility notes and create response-envelope test evidence.

**Acceptance Criteria:**

- Every TASK-006 endpoint is asserted through both prefixes.
- v1 success assertions use `$.data`; legacy assertions use root fields.
- Auth, registration, ownership, validation, 401, 403, 404 and 409 are covered.
- `cd spring-revita-be; .\mvnw.cmd -q test` passes.
- No sensitive values appear in either response contract.

---

# 9. Edge Cases

| # | Scenario | Expected Behavior | Handled In |
|---|---|---|---|
| 1 | `/api/v1` success DTO | Wrapped in `ApiResponse<T>` without changing payload fields | ENV-002/003 |
| 2 | `/api` success DTO | Remains raw and backward-compatible | ENV-002/003 |
| 3 | v1 validation error | HTTP 400 with `success=false` and `error.code=validation_error` | ENV-004 |
| 4 | v1 missing bearer | HTTP 401 with v1 envelope | ENV-004 |
| 5 | v1 ownership denial | HTTP 403 with v1 envelope and no protected data | ENV-004/005 |
| 6 | v1 not-found/conflict | HTTP 404/409 preserved with envelope | ENV-004 |
| 7 | Error before MVC advice | Security writer selects v1 or legacy format from request path | ENV-004 |
| 8 | Empty collection | `data=[]`, not `null`, on successful list response | ENV-001/005 |
| 9 | Create response | Existing `201` status retained and payload is under `data` | ENV-002/005 |
| 10 | Sensitive DTO fields | Password/token/OTP absent from `data` | ENV-005 |

---

# 10. Risks

| # | Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|---|
| 1 | Shared controllers cannot represent two static response types cleanly | High | High | Split into thin version adapters and keep services shared. |
| 2 | Security filters bypass MVC exception advice | High | High | Add a shared path-aware security response writer and filter-level tests. |
| 3 | Existing tests accidentally assert the wrong version shape | Medium | High | Make every alias test assert both envelope and raw root explicitly. |
| 4 | OpenAPI generic schemas are unclear to frontend generators | Medium | Medium | Add explicit examples and response schemas for representative DTOs. |
| 5 | Frontend points at `/api/v1` before it is migrated | High | Medium | Coordinate rollout; keep `/api` as rollback and compatibility path. |

---

# 11. Verification Plan

**Unit Tests:**

- `ApiResponse` factory tests — success/failure invariants and null/empty details.
- `ApiVersionResolver` tests — canonical, legacy and unrelated paths.

**Integration Tests:**

- Auth and registration v1 envelope tests.
- Patient/user/profile v1 envelope tests.
- Legacy alias raw compatibility tests.
- MVC and security error envelope tests.
- Existing persistence, ownership and exception suites.

**Manual / Smoke Tests:**

- Call v1 login, inspect `data.accessToken` and `data.user`.
- Call v1 protected profile route with missing/invalid bearer, inspect `error.code` and HTTP status.
- Call legacy `/api` equivalent and confirm root-level legacy shape.

**Success Criteria:**

- Full Maven test suite passes.
- `/api/v1` has one success/error JSON family.
- `/api` remains backward-compatible.
- No service, authorization or persistence behavior changes.

---

# 12. Rollout Plan

| Phase | Scope | Gate Criteria |
|---|---|---|
| 1 | Local tests | Envelope, alias and error tests pass. |
| 2 | Staging | Updated web/desktop clients use `/api/v1`; legacy clients remain on `/api`. |
| 3 | Controlled migration | No unexplained 4xx/5xx or JSON parsing errors. |
| 4 | Deprecate legacy | Only after all clients move to v1 and a sunset date is approved. |

**Rollback:**

- Keep clients on `/api` and disable v1 routing if envelope parsing fails.
- Do not roll back business or persistence changes; this task is transport-only.

---

# 13. Future Improvements

- Add generated TypeScript/desktop clients from OpenAPI schemas.
- Add `meta.pagination` for list endpoints when explicit pagination is introduced.
- Deprecate `/api` only after frontend and desktop migration evidence is complete.
