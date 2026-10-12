# Implementation Plan: Shared Exception Contract

Spec Source: `docs/plans/backend-api-migration/2026-10-13-exception-contract-spec.md`
Owner: `Codex`
Last Updated: `2026-10-13`
Status: `Complete — EH-001–EH-005 implemented and verified`

---

# 1. Context

**Problem:**

The current Spring foundation has a stable response envelope but still uses string literals for error codes and has no standard business exception. TASK-006 would otherwise introduce inconsistent exception types, status mapping and messages across identity/patient modules.

**Affected Modules:**

- `spring-revita-be/src/main/java/.../common/error` — shared error code, exception, response and controller advice.
- `spring-revita-be/src/main/java/.../security` — 401/403 responses must use the shared error codes.
- `spring-revita-be/src/test/java/...` — unit and MockMvc contract coverage.
- `docs/plans/backend-api-migration` — approved exception contract and implementation plan.

**Non-Goals:**

- Do not port TASK-006 business endpoints.
- Do not migrate every existing NestJS message in this task.
- Do not change the existing `{ error: { code, message, details, requestId } }` envelope.
- Do not expose internal stack traces, provider errors, database errors or secrets.

---

# 2. Constraints

**Language:** `Java 21`
**Architecture:** `Spring Boot 4.1.1`, layered REST API

**Rules:**

- Keep all shared error types in `common.error`.
- Use `ErrorCode` rather than a generic `EnumCode` name.
- Business code throws `BusinessException`; controllers do not construct ad-hoc error JSON.
- Preserve request ID in every handled API error.
- Do not introduce a new dependency; Lombok is already present but is not required for this change.
- `ResponseStatusException` remains only as a migration compatibility path.

**Performance Budgets:**

- Error mapping must be in-process and add no external I/O.
- Logging must not serialize request bodies, tokens or exception secrets.

---

# 3. Conventions

**Naming:**

- Classes: `PascalCase`; methods and fields: `camelCase`.
- Error enum: `ErrorCode`.
- Business exception: `BusinessException`.
- API error code values: lowercase `snake_case`.
- Packages: `com.tamdao.spring_revita_be.common.error`.

**Error Handling:**

- Expected domain failure → `throw new BusinessException(ErrorCode.X)`.
- Validation failures → `ErrorCode.VALIDATION_ERROR` with field details.
- Unexpected failure → `ErrorCode.INTERNAL_ERROR` with a generic message.
- Never return null error details; use an empty list.

**Logging:**

- Library: SLF4J.
- Unexpected exceptions log `requestId`, URI and stack trace.
- Business exceptions are expected failures and do not require error-level stack traces.

**Testing:**

- Framework: JUnit 5 and Spring MockMvc.
- Tests assert HTTP status, error code, message safety, details and request ID.
- Existing foundation tests must remain green.

**Task Size:**

- Each implementation task stays below 200 production LOC, excluding tests.

---

# 4. Contracts

## Interface: `ErrorCode`

```text
ErrorCode.code(): String
  - post: returns a stable lowercase snake_case API code

ErrorCode.httpStatus(): HttpStatus
  - post: returns the HTTP status associated with the error

ErrorCode.defaultMessage(): String
  - post: returns a safe client-facing default message
```

Foundation values:

```text
VALIDATION_ERROR(400, validation_error)
BAD_REQUEST(400, bad_request)
INVALID_REQUEST(400, invalid_request)
UNAUTHORIZED(401, unauthorized)
FORBIDDEN(403, forbidden)
NOT_FOUND(404, not_found)
CONFLICT(409, conflict)
UNPROCESSABLE_ENTITY(422, unprocessable_entity)
TOO_MANY_REQUESTS(429, too_many_requests)
INTERNAL_ERROR(500, internal_error)
SERVICE_UNAVAILABLE(503, service_unavailable)
```

## Interface: `BusinessException`

```text
new BusinessException(errorCode: ErrorCode)
  - pre: errorCode is not null
  - post: exception uses errorCode.defaultMessage()
  - throws: IllegalArgumentException when errorCode is null

new BusinessException(errorCode: ErrorCode, message: String)
  - pre: errorCode is not null; message is safe for clients
  - post: handler uses the supplied message

new BusinessException(errorCode: ErrorCode, details: List<ErrorDetail>)
  - pre: errorCode is not null; details is null or contains safe details
  - post: handler returns a non-null immutable details list
```

## Interface: `GlobalExceptionHandler`

```text
handle(BusinessException, request) -> ApiErrorResponse
  - post: status/code/message/details are derived from BusinessException.errorCode

handle(unexpected Exception, request) -> ApiErrorResponse
  - post: returns 500/internal_error with generic message and requestId
  - side effect: logs requestId, path and stack trace
```

## Shared DTO

```text
ApiErrorResponse {
  error: {
    code: String
    message: String
    details: List<ErrorDetail>
    requestId: String
  }
}
```

---

# 5. Target Architecture

**Components:**

- `ErrorCode` — single source of truth for code, status and safe default message.
- `BusinessException` — expected business failure carrying `ErrorCode`.
- `ApiErrorResponse` — stable serialized error envelope.
- `GlobalExceptionHandler` — maps framework/business/unexpected exceptions.
- `SecurityConfig` — emits the same envelope using `UNAUTHORIZED`/`FORBIDDEN`.

**Interaction Flow:**

```text
Controller/Service
  → throw BusinessException(ErrorCode.CONFLICT)
    → GlobalExceptionHandler
      → ApiErrorResponse.of(ErrorCode.CONFLICT, ...)
  ← HTTP 409 { error: { code, message, details, requestId } }

Security filter
  → ErrorCode.UNAUTHORIZED / FORBIDDEN
    → ApiErrorResponse
  ← HTTP 401/403 with the same envelope
```

**Key Decisions:**

- `ErrorCode` owns default status/message so callers cannot accidentally diverge from the contract.
- A safe message override is allowed for useful domain context, but unexpected exception messages are never returned.
- The response envelope is preserved to avoid breaking web/desktop clients.
- `ResponseStatusException` remains supported temporarily so migration can proceed incrementally.

---

# 6. Artifact Registry

| Artifact | Type | Owner Task | Implements |
|----------|------|------------|------------|
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/common/error/ErrorCode.java` | enum | EH-001 | `ErrorCode` |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/common/error/BusinessException.java` | exception | EH-002 | `BusinessException` |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/common/error/ApiErrorResponse.java` | DTO | EH-002 | shared DTO |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/common/error/GlobalExceptionHandler.java` | advice | EH-003 | handler contract |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/security/SecurityConfig.java` | config | EH-004 | security error mapping |
| `spring-revita-be/src/test/java/com/tamdao/spring_revita_be/ExceptionContractTests.java` | test | EH-005 | all contracts |
| `docs/plans/backend-api-migration/2026-10-13-exception-contract-spec.md` | spec | EH-000 | approved design |

---

# 7. Task Graph

| ID | Name | Depends On | Effort |
|----|------|------------|--------|
| EH-001 | Define `ErrorCode` contract | — | S |
| EH-002 | Implement `BusinessException` and DTO helpers | EH-001 | S |
| EH-003 | Migrate `GlobalExceptionHandler` | EH-001, EH-002 | M |
| EH-004 | Reuse error codes in security responses | EH-002 | S |
| EH-005 | Add exception contract tests and review | EH-003, EH-004 | M |

**Dependency Graph:**

```text
EH-001 ──┬── EH-002 ──┬── EH-003 ──┐
         │            └── EH-004 ──┼── EH-005
         └─────────────────────────┘
```

**Execution Rules:**

- EH-001 is the contract root.
- EH-003 and EH-004 can proceed in parallel after EH-002.
- TASK-006 depends on EH-005 passing.

---

# 8. Task Specifications

## EH-001: Define `ErrorCode`

**Description:**

Create the shared enum containing stable API code, HTTP status and safe default message.

**Input:**

- Approved exception spec.

**Output:**

- `ErrorCode` consumed by `BusinessException`, handler and security config.

**Files:**

- `common/error/ErrorCode.java` — **create**.

**Responsibilities:**

- Define all foundation codes from Section 4.
- Expose immutable accessors.

**Acceptance Criteria:**

- [x] Every foundation value returns the expected code/status/message.
- [x] All codes are lowercase `snake_case`.
- [x] No enum value exposes secrets or internal exception text.

## EH-002: Implement `BusinessException` and response helpers

**Description:**

Add the expected business exception and extend `ApiErrorResponse` with ErrorCode-based creation while preserving the JSON envelope.

**Input:**

- EH-001 `ErrorCode`.

**Output:**

- `BusinessException` and safe response factory consumed by EH-003/EH-004.

**Files:**

- `common/error/BusinessException.java` — **create**.
- `common/error/ApiErrorResponse.java` — **modify**.

**Acceptance Criteria:**

- [x] `new BusinessException(ErrorCode.NOT_FOUND)` uses the enum default message.
- [x] Null `ErrorCode` fails immediately.
- [x] Details are immutable and never null in the response.
- [x] Existing `ApiErrorResponse.of(String, ...)` callers remain compatible until migration is complete.

## EH-003: Migrate `GlobalExceptionHandler`

**Description:**

Replace string literals for standard errors with `ErrorCode` and add `BusinessException` handling before framework fallback handling.

**Input:**

- EH-001 and EH-002 contracts.

**Output:**

- One handler mapping business, validation, framework and unexpected errors.

**Files:**

- `common/error/GlobalExceptionHandler.java` — **modify**.

**Acceptance Criteria:**

- [x] `BusinessException(CONFLICT)` → HTTP 409/code `conflict`.
- [x] Validation exception → HTTP 400/code `validation_error` with field details.
- [x] Unknown exception → HTTP 500/code `internal_error` with generic message.
- [x] `NoResourceFoundException` → HTTP 404/code `not_found`.
- [x] Every response preserves request ID.

## EH-004: Reuse codes in security responses

**Description:**

Make the JWT authentication entry point and access-denied handler use shared `ErrorCode` values rather than duplicate code/message literals.

**Input:**

- EH-002 response factory.

**Output:**

- Security responses consistent with controller advice.

**Files:**

- `security/SecurityConfig.java` — **modify**.

**Acceptance Criteria:**

- [x] Missing token → HTTP 401/code `unauthorized`.
- [x] Denied authority → HTTP 403/code `forbidden`.
- [x] Response shape matches `ApiErrorResponse` exactly.

## EH-005: Verify and review

**Description:**

Add focused tests for the new contract and run the existing foundation suite.

**Input:**

- EH-003 and EH-004 implementations.

**Output:**

- Green test suite and review-ready exception foundation.

**Files:**

- `src/test/java/.../ExceptionContractTests.java` — **create** or extend foundation test class.

**Acceptance Criteria:**

- [x] Default, override, details, cause and null-code business exception cases pass.
- [x] 400/401/403/404/409/500 mappings pass.
- [x] Internal exception message and stack trace are absent from HTTP response.
- [x] `mvn test` passes with zero failures and errors.

---

# 9. Edge Cases

| # | Scenario | Expected Behavior | Handled In |
|---|----------|-------------------|------------|
| 1 | `BusinessException` has null `ErrorCode` | Fail immediately with `IllegalArgumentException` | EH-002 |
| 2 | Business exception has no message override | Use `ErrorCode.defaultMessage()` | EH-002 |
| 3 | Business exception has empty/null details | Serialize `details: []` | EH-002 |
| 4 | Unexpected exception contains secrets | Return generic 500; log only server-side | EH-003 |
| 5 | Request ID is absent | Filter-generated request ID remains in response | EH-003 |
| 6 | Unknown route | Return 404/not_found, not 500 | EH-003 |
| 7 | No bearer token | Return 401/unauthorized envelope | EH-004 |
| 8 | Authenticated user lacks authority | Return 403/forbidden envelope | EH-004 |
| 9 | Legacy `ResponseStatusException` is thrown | Preserve compatible status mapping during migration | EH-003 |

---

# 10. Risks

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | Existing modules expect raw Spring exception messages | Medium | High | Keep `ResponseStatusException` compatibility and migrate module-by-module. |
| 2 | Error code changes break desktop/web branching | High | Medium | Freeze lowercase code values and add contract tests before TASK-006. |
| 3 | Security filter and controller advice serialize differently | High | Medium | Route both through `ApiErrorResponse` and assert identical JSON shape. |

---

# 11. Verification Plan

**Unit Tests:**

- `ErrorCode` — validates code/status/default message mapping.
- `BusinessException` — validates constructors, cause, details and null guard.

**Integration Tests:**

- MockMvc business error endpoint — validates 409/404 response contract.
- MockMvc validation and security flows — validates 400/401/403 consistency.

**Manual / Smoke Tests:**

- Call an authenticated protected route without a token → verify `unauthorized` envelope.
- Trigger a business conflict from TASK-006 → verify `conflict` envelope and request ID.

**Success Criteria:**

- All automated tests pass.
- No internal exception details are returned.
- TASK-006 can throw `BusinessException(ErrorCode.X)` without defining ad-hoc response mapping.

---

# 12. Rollout Plan

| Phase | Scope | Gate Criteria |
|-------|-------|---------------|
| 1 | Shared error foundation | EH-001–EH-005 complete and tests green |
| 2 | TASK-006 adoption | New identity/patient services use `BusinessException` |
| 3 | Legacy cleanup | Raw exception/string mappings removed incrementally |

**Rollback:**

- Revert only the shared error implementation if tests show an existing contract regression.
- Keep the existing `ApiErrorResponse.of(String, ...)` overload during migration.

---

# 13. Future Improvements

- Add module-specific error code namespaces after identity/patient contracts stabilize.
- Generate an error-code catalog into OpenAPI documentation.
- Add static analysis rule preventing new raw error-code literals in business modules.
