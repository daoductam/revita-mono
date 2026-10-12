# API v1 Response Envelope Specification

Date: 2026-10-13  
Status: `Approved for planning`

## 1. Objective

Standardize the canonical `/api/v1` JSON contract without breaking existing web and desktop clients that still consume the legacy `/api` response shapes.

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
- A compatibility boundary that preserves existing raw responses under `/api`.

### Out of scope

- Reworking business services or persistence entities.
- Changing endpoint paths, authentication rules, ownership rules or status-code semantics.
- Migrating the legacy `/api` clients in this task.
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

Controllers currently combine `/api/v1` and `/api` in one mapping. The implementation must introduce a version-aware response boundary without duplicating application logic.

Recommended shape:

```text
/api/v1/**
  Controller/application service -> ApiResponse<T>
  GlobalExceptionHandler/security handlers -> ApiResponse<Void>

/api/**
  Controller/application service -> existing raw DTO/array
  GlobalExceptionHandler/security handlers -> existing ApiErrorResponse
```

The route aliases must continue using the same authentication, authorization and application services. Only the transport response mapping differs by API version.

## 6. Error handling

`GlobalExceptionHandler` must select the response format from the request path:

- `/api/v1/**`: `ResponseEntity<ApiResponse<Void>>`.
- `/api/**`: existing `ResponseEntity<ApiErrorResponse>`.

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
- The corresponding `/api` route keeps its current raw success and `ApiErrorResponse` error shape.
- Existing business, ownership and persistence behavior is unchanged.
- Tests cover success, validation, 401, 403, 404 and 409 through both prefixes.
- Auth, registration, profile, patient and doctor response payloads remain the same inside `data`.
- `.\mvnw.cmd -q test` passes after migration.

## 8. Migration risks

| Risk | Mitigation |
|---|---|
| Existing controllers share both route prefixes | Add version-aware transport mapping or separate thin version controllers; keep services shared. |
| Security filters write responses before MVC advice | Centralize version detection in the security response writer. |
| Frontend reads fields at JSON root | Update only clients using `/api/v1`; keep `/api` raw during migration. |
| OpenAPI exposes generic wrapper poorly | Add explicit schemas/examples for `ApiResponse` and endpoint payloads. |
