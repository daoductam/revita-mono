# API v1 Response Envelope Specification

Date: 2026-10-13  
Status: `Implemented`

## 1. Objective

Standardize the single canonical `/api/v1` JSON contract for the Spring backend. The backend does not expose a legacy `/api` route.

The canonical controller contract is:

```java
ResponseEntity<ApiResponse<T>>
```

`ResponseEntity` owns HTTP status and headers. `ApiResponse<T>` owns the serialized JSON body. Feature DTOs such as `AuthResponse` and `RegistrationCompleteResponse` remain the payload type `T` and are not changed to inherit from or contain `ApiResponse`.

## 2. Scope

### In scope

- All implemented TASK-006 success responses under `/api/v1`.
- All `/api/v1` business, validation, authentication and authorization errors.
- Security entry-point and access-denied responses for `/api/v1`.
- Controller tests, exception contract tests and OpenAPI-visible response types.
- A single transport boundary that returns the same envelope for every implemented `/api/v1` route.

### Out of scope

- Reworking business services or persistence entities.
- Changing endpoint paths, authentication rules, ownership rules or status-code semantics.
- Migrating web and desktop clients to the canonical `/api/v1` contract.
- Introducing a second API version or changing WebSocket contracts.

## 3. Versioned response contract

### Success

```json
{
  "success": true,
  "data": {
    "userId": "user-123",
    "message": "Registration successful"
  },
  "error": null,
  "meta": {
    "requestId": "request-123"
  }
}
```

### Error

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "conflict",
    "message": "Email is already registered",
    "details": []
  },
  "meta": {
    "requestId": "request-123"
  }
}
```

The HTTP status remains authoritative. The body `error.code` is a stable machine-readable business code and must not replace HTTP status handling.

## 4. Java contracts

```java
public record ApiResponse<T>(
        boolean success,
        T data,
        ApiError error,
        ApiMeta meta) {

    public static <T> ApiResponse<T> success(T data, ApiMeta meta);

    public static ApiResponse<Void> failure(
            ApiError error,
            ApiMeta meta);
}

public record ApiError(
        String code,
        String message,
        List<ApiErrorDetail> details) {
}

public record ApiMeta(String requestId) {
}
```

Rules:

- Success has `success=true`, non-error `data`, and `error=null`.
- Error has `success=false`, `data=null`, and a populated `error`.
- `meta.requestId` is present whenever the request ID filter has assigned one.
- `details` is always serialized as an array, including when empty.
- No password, refresh token, access token, OTP or provider secret is serialized.

## 5. Routing and compatibility

Only the canonical `/api/v1` route is exposed. Controllers use the normal feature names and delegate to the existing application services without duplicating business logic.

Recommended shape:

```text
/api/v1/**
  Controller/application service -> ApiResponse<T>
  GlobalExceptionHandler/security handlers -> ApiResponse<Void>
```

There is no supported `/api` alias. Requests from clients must use `/api/v1`.

## 6. Error handling

`GlobalExceptionHandler` must return `ResponseEntity<ApiResponse<Void>>` for `/api/v1/**` failures.

The same rule applies to:

- `BusinessException`.
- Bean validation errors.
- Malformed JSON.
- Not found resources.
- Access denied and unauthorized requests where the request reaches MVC advice.
- Security `AuthenticationEntryPoint` and `AccessDeniedHandler` responses.

No exception handler may return HTTP 200 for a failure.

## 7. Acceptance criteria

- Every TASK-006 `/api/v1` success route returns exactly one `ApiResponse` envelope.
- Every TASK-006 `/api/v1` error route returns the same envelope family with the original HTTP status and error code.
- No `/api` compatibility route is registered.
- Existing business, ownership and persistence behavior is unchanged.
- Tests cover success, validation, 401, 403, 404 and 409 through `/api/v1`.
- Auth, registration, profile, patient and doctor response payloads remain the same inside `data`.
- `.\mvnw.cmd -q test` passes after migration.

## 8. Migration risks

| Risk | Mitigation |
|---|---|
| Clients still call `/api` | Update web and desktop base URLs to `/api/v1` before rollout. |
| Security filters write responses before MVC advice | Centralize version detection in the security response writer. |
| Frontend reads fields at JSON root | Update clients to read feature payloads from `data`. |
| OpenAPI exposes generic wrapper poorly | Add explicit schemas/examples for `ApiResponse` and endpoint payloads. |
