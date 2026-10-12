# Implementation Plan: TASK-006 — Identity và Patient P0

Spec Source: `docs/plans/backend-api-migration/2026-10-13-task-006-identity-patient-spec.md`  
Owner: `tamdao / Codex`  
Last Updated: `2026-10-13`  
Status: `Draft`

---

# 1. Context

**Problem:**

`spring-revita-be` đã có security/error foundation nhưng chưa có vertical slice nghiệp vụ. TASK-006 cần đưa các flow identity và patient P0 từ NestJS sang Spring Boot mà không làm vỡ frontend hiện tại, đồng thời chuẩn hóa canonical `/api/v1` và giữ alias `/api`.

**Affected Modules:**

- `spring-revita-be/common` — giữ error envelope, request ID và API path conventions.
- `spring-revita-be/security` — JWT decoder, role mapping, authentication entry point và public route allow-list.
- `spring-revita-be/auth` — login, refresh, me, logout và token claims.
- `spring-revita-be/register` — registration session, OTP và transaction tạo patient.
- `spring-revita-be/user` — user self-update và public doctor directory.
- `spring-revita-be/patient` — patient self-update.
- `spring-revita-be/patientprofile` — CRUD P0 và ownership/role policy.
- `spring-revita-be/src/test` — unit, MockMvc và persistence contract tests.

**Non-Goals:**

- Google OAuth redirect/callback và `POST /auth/google/token`.
- Upload avatar/file storage.
- Staff doctor directory, search/advanced-search/independent profile/link/unlink.
- Admin, receptionist, doctor, cashier và các module clinic/appointment/clinical khác.
- DELETE patient profile vì legacy route matrix không có contract tương ứng.
- Hibernate auto-create/update hoặc migration thay thế schema hiện hữu.

---

# 2. Constraints

**Language:** `Java 21`  
**Architecture:** `Layered modular Spring Boot; application/service boundary with JPA and Redis adapters`

**Rules:**

- Không sửa module ngoài phạm vi identity/patient và foundation cần thiết cho route/security.
- Không thêm dependency ngoài các dependency đã có trong `pom.xml` nếu không có quyết định riêng.
- PostgreSQL schema hiện hữu là source of truth; giữ UUID, tên bảng, tên column và enum values.
- Production JPA giữ `ddl-auto=validate`; không dùng Hibernate để tạo hoặc sửa schema.
- Canonical và legacy alias phải gọi cùng application service, cùng authz và cùng response mapping.
- Mọi lỗi nghiệp vụ dùng `BusinessException` + `ErrorCode` + `GlobalExceptionHandler`.
- Không đưa password hash, provider token, OTP hoặc secret vào response/log production.
- Controller không tự quyết định ownership; policy phải được enforce ở service/application layer.

**Performance Budgets:**

- Không đặt latency benchmark mới khi chưa có runtime snapshot; không thêm query N+1 trong `me` và patient-profile list.
- Registration/login phải thực hiện lookup cần thiết trong một request và không tải toàn bộ quan hệ clinic.
- Redis OTP/session phải dùng TTL server-side, không dựa vào client timestamp.

---

# 3. Conventions

> Shared rules ALL tasks must follow.

**Naming:**

- Package: `com.tamdao.spring_revita_be.<module>.<layer>`.
- Classes: `PascalCase`; methods/variables: `camelCase`; constants: `UPPER_SNAKE_CASE`.
- Persistence classes dùng hậu tố `Entity`, repository dùng `Repository`, application services dùng `Service`.
- API DTO không expose JPA entity trực tiếp; response mapping tập trung trong mapper hoặc application service.
- `ApiPaths.V1` và `ApiPaths.LEGACY` là nguồn duy nhất cho prefix route.

**Error Handling:**

- Validation lỗi dùng `ErrorCode.VALIDATION_ERROR`.
- Credential lỗi dùng `ErrorCode.UNAUTHORIZED`.
- Role/ownership lỗi dùng `ErrorCode.FORBIDDEN`.
- Không tìm thấy resource dùng `ErrorCode.NOT_FOUND`.
- Duplicate/conflict dùng `ErrorCode.CONFLICT`.
- Error response luôn đi qua `ApiErrorResponse` và giữ `requestId`.
- Không để `ResponseStatusException` hoặc generic exception lọt ra từ business service.

**Logging:**

- Dùng SLF4J qua Lombok `@Slf4j`.
- Log structured metadata: `action`, `resource`, `requestId`, `userId` nếu có.
- Không log raw password, raw OTP, access token, refresh token hoặc provider token.
- Log failed ownership access ở mức warn với resource ID đã được mask/giới hạn theo policy.

**Testing:**

- Framework: JUnit 5, Spring Boot Test, MockMvc, Spring Security Test.
- Test method naming: `should_<expected>_when_<condition>`.
- Controller tests kiểm tra cả `/api/v1` và `/api` alias.
- Service tests kiểm tra business error code, không chỉ HTTP status.
- Repository/integration tests dùng H2 test schema hoặc test fixture tương thích PostgreSQL; không phụ thuộc database production.
- Mọi task phải chạy `.mvnw.cmd -q test` trước khi handoff.

**Task Size:**

- Max 200 LOC production code cho mỗi task, không tính tests/fixtures.
- Task có nhiều hơn một boundary độc lập phải được tách như trong Section 7.

---

# 4. Contracts

## Interface: `TokenService`

```
issueAccessToken(AuthSnapshot user): String
  - pre: user.id and user.role are present; password/provider secrets are excluded
  - post: returns signed JWT with sub, phone, email, role and role-specific claim
  - throws: BusinessException(UNAUTHORIZED) when token configuration is invalid

issueRefreshToken(AuthSnapshot user): String
  - pre: user.id and user.role are present
  - post: returns signed refresh JWT accepted by refresh endpoint
  - throws: BusinessException(UNAUTHORIZED) when token configuration is invalid

refresh(String rawRefreshToken): TokenResponse
  - pre: raw token is non-blank
  - post: verifies signature/expiry, resolves current auth record, returns new token pair
  - throws: BusinessException(UNAUTHORIZED) for malformed, expired, unknown or revoked token

parseSubject(String rawAccessToken): String
  - pre: raw token is non-blank
  - post: returns UUID subject for current user
  - throws: BusinessException(UNAUTHORIZED) for invalid token or missing sub claim
```

## Interface: `AuthService`

```
login(LoginRequest request): AuthResponse
  - pre: identifier and password are non-blank
  - post: BCrypt password match returns accessToken, refreshToken and safe user DTO
  - throws: BusinessException(UNAUTHORIZED) for invalid credentials or inactive/missing user

getCurrentUser(CurrentUser currentUser): UserResponse
  - pre: authenticated JWT resolves to a user ID
  - post: returns current user and role-specific safe projection
  - throws: BusinessException(UNAUTHORIZED) when subject no longer exists

logout(CurrentUser currentUser): LogoutResponse
  - pre: authenticated JWT is present
  - post: clears server-side session/provider token state where applicable and returns success response
  - throws: BusinessException(UNAUTHORIZED) when authentication cannot resolve a user
```

## Interface: `RegistrationService`

```
start(RegisterStep1Request request): RegistrationSessionResponse
  - pre: at least one of phone/email is present and valid
  - post: creates CREATED session, stores OTP for 300 seconds, returns sessionId/message
  - throws: BusinessException(CONFLICT) for duplicate phone/email

verifyOtp(VerifyOtpRequest request): RegistrationSessionResponse
  - pre: sessionId and six-digit OTP are non-blank
  - post: valid OTP changes session to VERIFIED for 1800 seconds and removes used OTP
  - throws: BusinessException(NOT_FOUND) for missing session; BAD_REQUEST for invalid/expired OTP

resendOtp(String sessionId): MessageResponse
  - pre: sessionId is non-blank and session is not verified
  - post: replaces OTP with 300-second TTL and sends/logs only through configured safe adapter
  - throws: BusinessException(NOT_FOUND) for missing session; BAD_REQUEST for verified session

complete(CompleteRegistrationRequest request): RegistrationCompleteResponse
  - pre: session exists in VERIFIED state and required profile/password fields are valid
  - post: transaction creates Auth(PATIENT) + Patient, then removes session
  - throws: NOT_FOUND for missing session; BAD_REQUEST for wrong state; CONFLICT for duplicate identity/citizenId
```

## Interface: `PatientProfileAccessPolicy`

```
requireCanRead(CurrentUser user, PatientProfileSnapshot profile): void
  - pre: user and profile are non-null
  - post: returns only when role and ownership policy allow read
  - throws: BusinessException(FORBIDDEN) for patient-to-patient access violation

requireCanUpdate(CurrentUser user, PatientProfileSnapshot profile): void
  - pre: user and profile are non-null
  - post: returns only when role and ownership policy allow update
  - throws: BusinessException(FORBIDDEN) for unauthorized mutation

resolveCreatePatientId(CurrentUser user, String requestedPatientId): String
  - pre: user is authenticated; requested ID may be null for staff-compatible input
  - post: returns subject patient ID for PATIENT or validated requested ID for allowed staff
  - throws: BusinessException(FORBIDDEN/NOT_FOUND) when patient ID is not allowed
```

## Data Structures

```
AuthEntity {
  id: String UUID — immutable legacy primary key
  phone: String? — unique
  email: String? — unique
  password: String? — BCrypt hash, never serialized
  name: String
  dateOfBirth: LocalDate/Instant — map legacy date_of_birth
  gender: String
  avatar: String?
  address: String
  citizenId: String? — unique
  role: Role
  accessToken/refreshToken/tokenExpiry: provider/session compatibility fields, never serialized
}

PatientEntity {
  id: String UUID — legacy primary key
  patientCode: String
  authId: String? — unique foreign key to auths.id
  loyaltyPoints: Integer
}

PatientProfileEntity {
  id: String UUID
  profileCode: String
  patientId: String? — nullable for future independent profile flow
  name: String
  phone: String?
  dateOfBirth: LocalDate/Instant
  gender: String
  address/occupation/healthInsurance/relationship: String?
  emergencyContact: JSON object
  isActive/isPregnant/isDisabled: Boolean
  createdAt/updatedAt: Instant
}

CurrentUser {
  userId: String UUID
  role: Role
  patientId/patientCode: String?
  doctorId/receptionistId/adminId/cashierId/technicianId: String?
}
```

## Shared DTOs

```
LoginRequest { identifier: String required; password: String required }
RefreshTokenRequest { refreshToken: String required }
AuthResponse { accessToken: String; refreshToken: String; user: UserResponse }
TokenResponse { accessToken: String; refreshToken: String }
LogoutResponse { success: Boolean; message: String }

RegisterStep1Request { phone: String?; email: String?; at least one required }
VerifyOtpRequest { sessionId: String required; otp: String exactly 6 digits }
RegistrationSessionResponse { sessionId: String; message: String }
CompleteRegistrationRequest {
  sessionId, name, dateOfBirth, gender, address, password: required
  citizenId, avatar: optional
}
RegistrationCompleteResponse { message: String; userId: String }

UserResponse {
  id, name, dateOfBirth, gender, address, role: required
  email, phone, avatar, citizenId: optional
  patient/doctor/technician/receptionist/admin/cashier: optional safe projection
}

PatientProfileCreateRequest {
  patientId: String?
  name, dateOfBirth, gender, emergencyContact: required
  phone, address, occupation, healthInsurance, relationship: optional
  isPregnant, isDisabled: optional
}
PatientProfileUpdateRequest { all create fields except immutable patientId/profileCode: optional }
```

---

# 5. Target Architecture

**Components:**

- `AuthController` — maps both route prefixes and validates auth DTOs.
- `AuthService` — credential validation, safe user projection and logout.
- `JwtTokenService` — signs/validates legacy-compatible claims and refresh tokens.
- `AuthRepository`, `PatientRepository`, `PatientProfileRepository` — JPA data access.
- `RegistrationController`/`RegistrationService` — OTP workflow and transaction boundary.
- `RegistrationSessionStore` — Redis production adapter and in-memory test adapter.
- `UserController`/`PatientController` — self-service profile mutations and public doctor projection.
- `PatientProfileController`/`PatientProfileService` — profile CRUD and access policy.
- `CurrentUserResolver` — converts Spring `Jwt`/authentication into `CurrentUser`.
- `GlobalExceptionHandler`/`SecurityConfig` — shared error envelope and 401/403 behavior.

**Interaction Flow — login:**

```
Client
  → POST /api/v1/auth/login or /api/auth/login
    → AuthController.login(LoginRequest)
      → AuthService.login(request)
        → AuthRepository.findByPhoneOrEmail(identifier)
        → PasswordEncoder.matches(password, hash)
        → PatientRepository/role projection lookup
        → JwtTokenService.issueAccessToken/issueRefreshToken
      ← AuthResponse(accessToken, refreshToken, safe user)
  ← 200 response
```

**Interaction Flow — protected profile:**

```
Client + Bearer JWT
  → PatientProfileController.get/update
    → CurrentUserResolver.resolve(authentication)
    → PatientProfileService.load(id)
    → PatientProfileAccessPolicy.requireCanRead/Update(user, profile)
    → repository read/update
  ← DTO or ApiErrorResponse(401/403/404)
```

**Interaction Flow — registration:**

```
Client
  → register/step1
    → duplicate lookup → RegistrationSessionStore.create(CREATED) → OTP store TTL 300s
  → register/verify-otp
    → session + OTP check → session VERIFIED TTL 1800s → delete OTP
  → register/complete
    → verified session check → transaction(Auth PATIENT + Patient) → delete session
```

**Key Decisions:**

- Controllers expose aliases but never duplicate business logic.
- Existing PostgreSQL is mapped read/write; no new identity schema is invented.
- `CurrentUser` is derived from JWT subject and current database state, not trusted entirely from client-supplied IDs.
- Patient ownership is enforced after loading the target resource, preventing IDOR through path/body substitution.
- Registration session/OTP is behind an interface so tests do not require an external Redis process.
- Doctor public list uses a projection to avoid exposing full `Auth` or clinic relations.

---

# 6. Artifact Registry

| Artifact | Type | Owner Task | Implements |
|----------|------|------------|------------|
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/auth/domain/AuthEntity.java` | entity | TASK-006.2 | `AuthEntity` |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/patient/domain/PatientEntity.java` | entity | TASK-006.2 | `PatientEntity` |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/patientprofile/domain/PatientProfileEntity.java` | entity | TASK-006.2 | `PatientProfileEntity` |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/auth/infrastructure/AuthRepository.java` | repository | TASK-006.2 | auth lookup contract |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/patient/infrastructure/PatientRepository.java` | repository | TASK-006.2 | patient lookup contract |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/patientprofile/infrastructure/PatientProfileRepository.java` | repository | TASK-006.2 | profile lookup contract |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/common/security/CurrentUser.java` | value object | TASK-006.3 | `CurrentUser` |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/security/CurrentUserResolver.java` | component | TASK-006.3 | JWT subject/role resolution |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/security/JwtTokenService.java` | service | TASK-006.3 | `TokenService` |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/auth/api/dto/*.java` | DTOs | TASK-006.3 | auth DTO contracts |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/auth/application/AuthService.java` | service | TASK-006.4 | `AuthService` |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/auth/api/AuthController.java` | controller | TASK-006.4 | auth routes |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/register/application/RegistrationSessionStore.java` | interface | TASK-006.5 | registration store |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/register/infrastructure/RedisRegistrationSessionStore.java` | adapter | TASK-006.5 | Redis OTP/session |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/register/application/RegistrationService.java` | service | TASK-006.5 | `RegistrationService` |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/register/api/RegistrationController.java` | controller | TASK-006.5 | registration routes |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/user/api/UserController.java` | controller | TASK-006.6 | `/users/me`, doctors |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/patient/api/PatientController.java` | controller | TASK-006.6 | `/patients/me` |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/patientprofile/application/PatientProfileAccessPolicy.java` | service | TASK-006.7 | ownership contract |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/patientprofile/application/PatientProfileService.java` | service | TASK-006.7 | profile CRUD |
| `spring-revita-be/src/main/java/com/tamdao/spring_revita_be/patientprofile/api/PatientProfileController.java` | controller | TASK-006.7 | profile routes |
| `spring-revita-be/src/main/resources/application.yaml` | config | TASK-006.3 | production route/security settings |
| `spring-revita-be/src/main/resources/application-test.yaml` | config | TASK-006.8 | test route/security settings |
| `spring-revita-be/src/test/resources/sql/task006-schema.sql` | fixture | TASK-006.2 | H2 identity schema |
| `spring-revita-be/src/test/java/com/tamdao/spring_revita_be/task006/*` | tests | TASK-006.8 | contract/flow verification |
| `docs/plans/backend-api-migration/2026-10-13-task-006-identity-patient-spec.md` | spec | complete | TASK-006 scope |

Existing foundation files to modify only when needed: `SecurityConfig.java`, `ApiPaths.java`, `GlobalExceptionHandler.java`, `pom.xml` and shared config properties. Do not rewrite exception behavior while implementing feature services.

---

# 7. Task Graph

| ID | Name | Depends On | Effort |
|----|------|------------|--------|
| TASK-006.1 | Compatibility spike: schema, JWT and runtime settings | — | M |
| TASK-006.2 | Legacy identity/patient persistence mapping | TASK-006.1 | L |
| TASK-006.3 | JWT/current-user/security route wiring | TASK-006.1, TASK-006.2 | M |
| TASK-006.4 | Auth login/refresh/me/logout | TASK-006.3 | L |
| TASK-006.5 | Registration session/OTP/complete transaction | TASK-006.2, TASK-006.3 | L |
| TASK-006.6 | User self-update, patient self-update and doctor directory | TASK-006.2, TASK-006.3 | M |
| TASK-006.7 | Patient profile CRUD and ownership policy | TASK-006.2, TASK-006.3 | L |
| TASK-006.8 | Contract, security, persistence and client-flow tests | TASK-006.4, TASK-006.5, TASK-006.6, TASK-006.7 | L |

**Dependency Graph:**

```
TASK-006.1
     │
     └── TASK-006.2
           │
           └── TASK-006.3
                 ├── TASK-006.4 ──┐
                 ├── TASK-006.5 ──┤
                 ├── TASK-006.6 ──┼── TASK-006.8
                 └── TASK-006.7 ──┘
```

**Execution Rules:**

- TASK-006.1 is a gate; do not implement entities before confirming actual table/column names and Nest JWT configuration.
- TASK-006.4, TASK-006.5, TASK-006.6 and TASK-006.7 can run in parallel after security/current-user contracts are stable.
- TASK-006.8 is last because it exercises the complete vertical slice, but each prior task must include focused tests.
- If TASK-006.1 finds an incompatible JWT secret/issuer or schema mismatch, stop dependent implementation and record the decision before proceeding.

---

# 8. Task Specifications

## TASK-006.1: Compatibility spike — schema, JWT and runtime settings

**Description:**

Verify the exact PostgreSQL mappings and NestJS JWT configuration needed for compatibility. Resolve whether legacy JWTs contain `iss`, their algorithm/secret source, and the observed token expiry before implementing token issuance or decoder validation.

**Input:**

- `revita-be/prisma/schema.prisma`.
- `revita-be/src/login/login.module.ts`, JWT strategy/config and environment references.
- Current `application.yaml`, security foundation and migration plan.

**Output:**

- Confirmed table/column mapping for `auths`, `patients`, `patient_profiles`, doctor projection tables.
- Confirmed JWT algorithm, secret source, issuer behavior and access/refresh expiry policy.
- Documented unresolved mismatch, if any, for user approval before dependent code.

**Files:**

- `docs/plans/backend-api-migration/2026-10-13-task-006-compatibility-notes.md` — **create**: evidence and decisions.
- `revita-be/src/login/login.module.ts` and related config — **read only** unless a source correction is required.

**Responsibilities:**

- Validate `AuthEntity`, `PatientEntity`, `PatientProfileEntity` mappings from Section 4.
- Confirm no implementation assumes a table name different from Prisma `@@map`.

**Acceptance Criteria:**

- [ ] `auths`, `patients`, `patient_profiles` and required columns are listed with exact names.
- [ ] Nest access/refresh token signing settings are recorded.
- [ ] `JwtDecoder` acceptance/rejection behavior for legacy token shape is decided.
- [ ] No dependent code starts while a high-impact schema/JWT mismatch remains unresolved.

## TASK-006.2: Legacy identity/patient persistence mapping

**Description:**

Create the minimal JPA model and repositories for identity, patient, patient profile and read-only doctor projection. Preserve existing UUIDs and relations without introducing production DDL.

**Input:**

- TASK-006.1 compatibility notes.
- `AuthEntity`, `PatientEntity`, `PatientProfileEntity` contracts.

**Output:**

- JPA entities/repositories usable by auth, registration and profile services.
- Test-only H2 schema and fixtures for patient A, patient B, staff and doctor.

**Files:**

- `auth/domain/AuthEntity.java` — **create**.
- `patient/domain/PatientEntity.java` — **create**.
- `patientprofile/domain/PatientProfileEntity.java` — **create**.
- `auth/infrastructure/AuthRepository.java` — **create**.
- `patient/infrastructure/PatientRepository.java` — **create**.
- `patientprofile/infrastructure/PatientProfileRepository.java` — **create**.
- `user/infrastructure/DoctorDirectoryRepository.java` — **create**.
- `src/test/resources/sql/task006-schema.sql` — **create**.
- `application-test.yaml` — **modify** only for test schema setup if required.

**Responsibilities:**

- Map `auths`, `patients`, `patient_profiles` exactly as confirmed.
- Map JSON emergency contact in a testable PostgreSQL-compatible way.
- Keep entity serialization out of controllers.
- Add repository methods for identifier lookup, subject lookup, patient ownership and profile lookup/list.

**Acceptance Criteria:**

- [ ] Repository lookup by email or phone returns the correct Auth record.
- [ ] `Patient.authId` and `PatientProfile.patientId` preserve nullable/unique semantics.
- [ ] Profile list for patient A cannot accidentally include patient B.
- [ ] H2 persistence fixture starts without production `ddl-auto=create/update`.
- [ ] Entity tests pass with legacy UUID strings and role values.

## TASK-006.3: JWT/current-user/security route wiring

**Description:**

Complete the security adapter required by all feature controllers: password encoder, token signing/refresh parsing, current-user resolver, role authorities and public-route configuration for both aliases.

**Input:**

- TASK-006.1 JWT decisions.
- TASK-006.2 repositories.
- Existing `SecurityConfig`, `ApiPaths`, `ErrorCode` and request ID filter.

**Output:**

- `TokenService` implementation and `CurrentUser` resolution.
- Stable 401/403 behavior for protected and method-secured routes.

**Files:**

- `security/JwtTokenService.java` — **create**.
- `security/CurrentUserResolver.java` — **create**.
- `common/security/CurrentUser.java` — **create**.
- `security/PasswordConfig.java` or equivalent — **create**.
- `SecurityConfig.java` — **modify**: route allow-list/authority integration only.
- `application.yaml` — **modify**: P0 public paths and token settings.
- `application-test.yaml` — **modify**: test-safe public paths/settings.
- `security/JwtTokenServiceTest.java`, `security/CurrentUserResolverTest.java` — **create**.

**Responsibilities:**

- Preserve claims `sub`, `phone`, `email`, `role`, and nested patient claim.
- Normalize role authority to `ROLE_<ROLE>` consistently.
- Make missing/invalid bearer return shared 401 response.
- Make authenticated but unauthorized method calls return shared 403 response.
- Permit only auth login/refresh, register routes and public doctors; do not accidentally expose `/auth/me` or `/api/v1/auth/register` as a broad wildcard.

**Acceptance Criteria:**

- [ ] `issueAccessToken(patient)` → token contains `sub`, `role=PATIENT`, `patient.id`, `patient.patientCode`.
- [ ] `parseSubject(malformed)` → `BusinessException(UNAUTHORIZED)`.
- [ ] Anonymous protected request → HTTP 401 with `error.code=unauthorized`.
- [ ] Authenticated wrong role → HTTP 403 with `error.code=forbidden`.
- [ ] Both `/api/v1` and `/api` public/protected patterns behave identically.

## TASK-006.4: Auth login/refresh/me/logout

**Description:**

Implement the authentication vertical slice using the persistence and token contracts. Keep legacy response names and current-user projections while ensuring credentials and provider secrets never leave the service boundary.

**Input:**

- TASK-006.2 repositories/entities.
- TASK-006.3 `TokenService`, `CurrentUser`, security config.
- Legacy login DTO/response behavior.

**Output:**

- `POST login`, `POST refresh`, `GET me`, `POST logout` under both route prefixes.

**Files:**

- `auth/api/dto/LoginRequest.java`, `RefreshTokenRequest.java`, `AuthResponse.java`, `TokenResponse.java`, `UserResponse.java`, `LogoutResponse.java` — **create**.
- `auth/application/AuthService.java` — **create**.
- `auth/api/AuthController.java` — **create**.
- `auth/application/UserMapper.java` — **create** if mapping is non-trivial.
- `AuthServiceTest.java`, `AuthControllerTest.java` — **create**.

**Responsibilities:**

- Validate identifier/password using BCrypt.
- Resolve role-specific patient data for login/me.
- Refresh only valid, non-expired tokens and current users.
- Logout must be authenticated and return `{success,message}`.
- Map all business failures to error codes from Section 3.

**Acceptance Criteria:**

- [ ] Valid email login → 200 with `accessToken`, `refreshToken`, safe `user`.
- [ ] Valid phone login → same response contract.
- [ ] Wrong password → 401 and no password/hash detail.
- [ ] Valid refresh token → new access/refresh pair.
- [ ] Invalid/expired refresh token → 401.
- [ ] `/auth/me` → current DB-backed user with patient projection.
- [ ] Logout without bearer → 401; logout with bearer → `{success:true,...}`.
- [ ] Canonical and legacy aliases call the same service and produce equivalent JSON fields.

## TASK-006.5: Registration session/OTP/complete transaction

**Description:**

Port the three-step patient registration flow with Redis-compatible TTL behavior and a test adapter. Ensure duplicate checks happen before OTP/session creation and final Auth + Patient creation is atomic.

**Input:**

- TASK-006.2 Auth/Patient repositories.
- TASK-006.3 password encoder and public route configuration.
- Legacy register DTOs and OTP timings.

**Output:**

- Four registration endpoints under both route prefixes.
- Redis store abstraction and safe test implementation.

**Files:**

- `register/api/dto/RegisterStep1Request.java`, `VerifyOtpRequest.java`, `CompleteRegistrationRequest.java`, `RegistrationSessionResponse.java`, `RegistrationCompleteResponse.java` — **create**.
- `register/application/RegistrationSessionStore.java` — **create**.
- `register/infrastructure/RedisRegistrationSessionStore.java` — **create**.
- `register/infrastructure/InMemoryRegistrationSessionStore.java` — **test support/create only if needed**.
- `register/application/RegistrationService.java` — **create**.
- `register/api/RegistrationController.java` — **create**.
- `register/*Test.java` — **create**.

**Responsibilities:**

- Enforce at-least-one phone/email and duplicate conflict checks.
- Store OTP 300 seconds and verified session 1800 seconds.
- Consume OTP exactly once and reject wrong state transitions.
- Hash password with BCrypt and create Auth/PATIENT + Patient in one transaction.
- Do not send raw OTP/password to application logs.

**Acceptance Criteria:**

- [ ] `step1({phone})` → session + OTP with 300-second TTL.
- [ ] `step1({})` → validation error.
- [ ] Duplicate phone/email → 409 conflict.
- [ ] Correct six-digit OTP → session becomes VERIFIED and OTP is removed.
- [ ] Wrong/expired OTP → 400; missing session → 404.
- [ ] Resend on verified/missing session → 400/404 respectively.
- [ ] Complete unverified session → 400.
- [ ] Complete verified session → one Auth(PATIENT) + Patient transaction and 201 response.
- [ ] Duplicate citizen ID/identity race → 409 and no partial patient row.

## TASK-006.6: User self-update, patient self-update and doctor directory

**Description:**

Implement user and patient self-service routes plus the public doctor list required by current frontend flows. All updates derive the target user/patient from the JWT subject.

**Input:**

- TASK-006.2 repositories/entities.
- TASK-006.3 `CurrentUser` and method security.
- Legacy `UpdateUserDto`, `UpdatePatientDto` and doctor public projection.

**Output:**

- `PUT /users/me`, `PUT /patients/me`, `GET /users/doctors` with aliases.

**Files:**

- `user/api/dto/UpdateUserRequest.java`, `DoctorSummaryResponse.java` — **create**.
- `user/application/UserService.java` — **create**.
- `user/api/UserController.java` — **create**.
- `patient/api/dto/UpdatePatientRequest.java` — **create**.
- `patient/application/PatientService.java` — **create**.
- `patient/api/PatientController.java` — **create**.
- `user/*Test.java`, `patient/*Test.java` — **create**.

**Responsibilities:**

- Update only the authenticated subject.
- Apply BCrypt when password update is in the supported user DTO; never return hash.
- Enforce `PATIENT` on `/patients/me`.
- Return minimal public doctor data and optional specialty filtering only if mapping is confirmed.

**Acceptance Criteria:**

- [ ] Authenticated user update changes only JWT subject row.
- [ ] Body/path cannot substitute another user ID.
- [ ] Patient role can update `/patients/me`; non-patient receives 403.
- [ ] Public doctor list returns no password, token or private identity fields.
- [ ] Duplicate email/phone/citizen ID returns 409.
- [ ] Canonical and legacy aliases have equivalent behavior.

## TASK-006.7: Patient profile CRUD and ownership policy

**Description:**

Implement the P0 profile endpoints and enforce patient ownership independently of controller role annotations. Patient users are limited to their own linked profiles; allowed staff roles use the policy defined in the route matrix.

**Input:**

- TASK-006.2 profile repository/entity.
- TASK-006.3 `CurrentUser` and method security.
- Legacy profile DTOs and service ownership rules.

**Output:**

- List, by-patient, by-id, create and update routes with both aliases.
- Reusable `PatientProfileAccessPolicy`.

**Files:**

- `patientprofile/api/dto/CreatePatientProfileRequest.java`, `UpdatePatientProfileRequest.java`, `PatientProfileResponse.java` — **create**.
- `patientprofile/application/PatientProfileAccessPolicy.java` — **create**.
- `patientprofile/application/PatientProfileService.java` — **create**.
- `patientprofile/api/PatientProfileController.java` — **create**.
- `patientprofile/*Test.java` — **create**.

**Responsibilities:**

- Validate patient existence when `patientId` is supplied.
- Resolve patient ID from JWT for PATIENT creation/update/read.
- Prevent patient A from reading/updating patient B by profile ID or patient ID.
- Preserve profile fields and JSON emergency contact.
- Restrict priority flags (`isPregnant`, `isDisabled`) according to legacy staff/patient policy.
- Return 404 for missing resource and 403 for existing but unauthorized resource.

**Acceptance Criteria:**

- [ ] Patient A `GET /patient-profiles/patient/A` → only A profiles.
- [ ] Patient A `GET /patient-profiles/patient/B` → 403.
- [ ] Patient A `GET/PATCH /patient-profiles/profileOfB` → 403.
- [ ] Patient A create with `patientId=B` → 403.
- [ ] Patient create with own ID → 201/200 profile response.
- [ ] Allowed staff role can use contract-authorized profile operation.
- [ ] Missing profile/patient → 404 with stable error code.
- [ ] Both route prefixes use identical policy and response mapping.

## TASK-006.8: Contract, security, persistence and client-flow tests

**Description:**

Add the final cross-module verification suite covering endpoint aliases, response/error envelopes, persistence transactions, ownership isolation and representative web/desktop flows.

**Input:**

- Completed TASK-006.4–TASK-006.7 artifacts.
- Section 6 test fixtures and Section 9 edge cases.

**Output:**

- Repeatable Spring test suite and documented manual smoke evidence.

**Files:**

- `src/test/java/com/tamdao/spring_revita_be/task006/Task006AuthContractTests.java` — **create**.
- `src/test/java/com/tamdao/spring_revita_be/task006/Task006RegistrationContractTests.java` — **create**.
- `src/test/java/com/tamdao/spring_revita_be/task006/Task006OwnershipTests.java` — **create**.
- `src/test/java/com/tamdao/spring_revita_be/task006/Task006AliasTests.java` — **create**.
- `src/test/java/com/tamdao/spring_revita_be/task006/Task006PersistenceTests.java` — **create**.
- `docs/plans/backend-api-migration/2026-10-13-task-006-test-evidence.md` — **create**.

**Responsibilities:**

- Exercise every P0 route in both prefixes.
- Verify 401/403/404/409 envelope code, requestId and no sensitive data.
- Verify Auth + Patient rollback on registration failure.
- Verify Patient A/B isolation.
- Run existing foundation tests to catch regressions.

**Acceptance Criteria:**

- [ ] `.mvnw.cmd -q test` passes.
- [ ] Every endpoint in spec Section 3 has at least one success and one failure test.
- [ ] Alias tests confirm same status/field semantics.
- [ ] Ownership tests demonstrate no IDOR path/body substitution.
- [ ] Test evidence records any environment-dependent smoke test limitation.

---

# 9. Edge Cases

| # | Scenario | Expected Behavior | Handled In |
|---|----------|-------------------|------------|
| 1 | Missing/invalid bearer on protected route | HTTP 401, `unauthorized`, requestId present | TASK-006.3, TASK-006.8 |
| 2 | Authenticated user has wrong role | HTTP 403, `forbidden` | TASK-006.3, TASK-006.6, TASK-006.7 |
| 3 | JWT subject user was deleted/deactivated | HTTP 401, no user data returned | TASK-006.3, TASK-006.4 |
| 4 | JWT missing `sub` or incompatible issuer/algorithm | HTTP 401; decision is recorded before implementation | TASK-006.1, TASK-006.3 |
| 5 | Login with unknown identifier or wrong password | HTTP 401 without account enumeration detail | TASK-006.4 |
| 6 | Refresh token malformed/expired/current user missing | HTTP 401 | TASK-006.3, TASK-006.4 |
| 7 | Step 1 has neither phone nor email | Validation error, no Redis session | TASK-006.5 |
| 8 | Duplicate phone/email/citizen ID | HTTP 409, no partial registration | TASK-006.2, TASK-006.5 |
| 9 | OTP wrong, expired, reused or wrong length | 400; used OTP cannot be replayed | TASK-006.5 |
| 10 | Registration session missing/expired/wrong state | 404 or 400 according to contract | TASK-006.5 |
| 11 | Concurrent complete requests for same session | At most one Auth + Patient pair; loser gets conflict/bad request | TASK-006.5, TASK-006.8 |
| 12 | Patient A requests patient B by ID/profile ID | HTTP 403, no B data in body | TASK-006.7, TASK-006.8 |
| 13 | Patient create/update sends another `patientId` | Server derives/rejects ID; never trusts body | TASK-006.7 |
| 14 | Profile/patient does not exist | HTTP 404 stable error | TASK-006.7 |
| 15 | JSON emergency contact malformed | Validation error, no partial update | TASK-006.2, TASK-006.7 |
| 16 | Canonical and legacy alias called with same input | Same service, authz, status and response field semantics | TASK-006.3–TASK-006.8 |
| 17 | Refresh/logout token accidentally logged or serialized | Sensitive values absent from logs/responses | TASK-006.4, TASK-006.8 |
| 18 | H2 test schema differs from legacy PostgreSQL mapping | Test fixture fails before feature tests; mapping corrected, not hidden by auto-DDL | TASK-006.1, TASK-006.2 |

---

# 10. Risks

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| 1 | Runtime database schema/check constraints differ from Prisma schema | High | Medium | TASK-006.1 evidence gate and test-schema review before entities |
| 2 | Nest JWT secret/issuer/expiry differs from Spring configuration | High | Medium | Inspect Nest module/config, add compatibility decision before TASK-006.3 |
| 3 | Redis is unavailable in local/test environment | Medium | High | Store interface plus in-memory test adapter; production remains Redis |
| 4 | Legacy profile service exposes more staff access than reviewed policy | High | Medium | Keep explicit role matrix and ownership tests; defer unreviewed search flows |
| 5 | JPA JSON/array mapping is not H2-compatible | Medium | Medium | Use explicit converter/fixture and test against PostgreSQL-compatible schema when available |
| 6 | Frontend expects `token` while backend returns `accessToken` | Medium | High | Preserve legacy `accessToken`; verify existing frontend normalization in smoke test |
| 7 | Login/me queries introduce N+1 role projections | Medium | Medium | Use explicit projections and repository query tests; inspect SQL during integration verification |
| 8 | Security public-path wildcard accidentally exposes protected routes | High | Low | Enumerate exact P0 public patterns and test anonymous access for every protected route |

---

# 11. Verification Plan

**Unit Tests:**

- `JwtTokenServiceTest` — claim names, expiry, malformed token and subject extraction.
- `CurrentUserResolverTest` — role and role-specific claim conversion.
- `AuthServiceTest` — password match, user projection, refresh/logout errors.
- `RegistrationServiceTest` — OTP TTL/state transitions, duplicate checks, transaction behavior.
- `PatientProfileAccessPolicyTest` — patient A/B ownership and staff role policy.
- DTO validation tests — required fields, date/gender/OTP constraints.

**Integration Tests:**

- MockMvc auth contract — login/refresh/me/logout through both aliases.
- MockMvc registration contract — full OTP flow and error envelope.
- MockMvc ownership contract — patient A cannot access patient B.
- JPA fixture contract — legacy table names, UUIDs and relation mapping.
- Full Spring test suite — existing foundation tests plus TASK-006 tests.

**Manual / Smoke Tests:**

- Web: login with email/phone → store tokens → call `/me` → refresh → logout.
- Web: registration step1 → OTP verify → complete → login.
- Web: patient profile list/create/update as patient A; attempt profile B and expect 403.
- Desktop: login/refresh/me/logout with `/api/v1` and legacy alias as configured client base.

**Success Criteria:**

- All automated tests pass with `.mvnw.cmd -q test`.
- P0 endpoint contracts match Section 3 of the spec.
- No sensitive token/password/OTP leakage in responses or logs.
- Ownership and role tests pass for both route prefixes.
- No production DDL mutation is introduced.

---

# 12. Rollout Plan

| Phase | Scope | Gate Criteria |
|-------|-------|---------------|
| 1 | Local/test profile | TASK-006.1 mapping decision, unit tests and MockMvc tests pass |
| 2 | Staging against restored PostgreSQL/Redis | schema reconciliation, web/desktop smoke pass, no unexplained auth/profile mismatch |
| 3 | Controlled route migration | frontend base URL can use `/api/v1`; legacy `/api` remains rollback alias |
| 4 | Production cutover for P0 | error rate and auth/profile contract stable; NestJS remains rollback target for out-of-scope routes |

**Rollback:**

- Route traffic back to NestJS for P0 if contract or data reconciliation fails.
- Do not roll back by dropping or changing identity tables.
- Disable Spring P0 routing only after confirming existing NestJS routes remain healthy.

---

# 13. Future Improvements

- Add Google OAuth token exchange after provider/config contract is captured.
- Add secure refresh-token rotation/revocation strategy beyond legacy JWT behavior.
- Add avatar/file storage adapter with ownership checks.
- Add staff search, independent profiles and link/unlink workflows.
- Add Testcontainers PostgreSQL/Redis for closer runtime parity.
- Add OpenAPI generated client contract snapshots for web and desktop.
