# Exception Contract Specification

Date: 2026-10-13
Status: Approved for planning
Scope: `spring-revita-be` foundation before TASK-006

## Purpose

Chuẩn hóa xử lý lỗi dùng chung trước khi triển khai identity, patient và các business module. Business layer sẽ không ném message/code rời rạc; controller/API sẽ trả về cùng một response envelope để web, desktop và các consumer khác xử lý ổn định.

## Design decision

Dùng `ErrorCode` thay cho tên `EnumCode`. `ErrorCode` là enum chứa mã lỗi ổn định, HTTP status và message mặc định.

```java
throw new BusinessException(ErrorCode.NOT_FOUND);
throw new BusinessException(ErrorCode.CONFLICT, "Email already exists");
```

## Components

### `ErrorCode`

Package: `com.tamdao.spring_revita_be.common.error`

Foundation codes:

- `VALIDATION_ERROR` → 400, `validation_error`
- `BAD_REQUEST` → 400, `bad_request`
- `INVALID_REQUEST` → 400, `invalid_request`
- `UNAUTHORIZED` → 401, `unauthorized`
- `FORBIDDEN` → 403, `forbidden`
- `NOT_FOUND` → 404, `not_found`
- `CONFLICT` → 409, `conflict`
- `UNPROCESSABLE_ENTITY` → 422, `unprocessable_entity`
- `TOO_MANY_REQUESTS` → 429, `too_many_requests`
- `INTERNAL_ERROR` → 500, `internal_error`
- `SERVICE_UNAVAILABLE` → 503, `service_unavailable`

The enum owns the default safe message. Internal exception messages and stack traces must never be exposed for 500 responses.

### `BusinessException`

Runtime exception for expected business failures. It must carry an `ErrorCode`, may carry a safe message override and optional `ErrorDetail` list, and must preserve the cause for logging.

Expected constructors:

```java
BusinessException(ErrorCode errorCode)
BusinessException(ErrorCode errorCode, String message)
BusinessException(ErrorCode errorCode, List<ApiErrorResponse.ErrorDetail> details)
BusinessException(ErrorCode errorCode, String message, Throwable cause)
```

Null `ErrorCode` is invalid and must fail immediately at construction time.

### `GlobalExceptionHandler`

Handler order and mapping:

1. `BusinessException` → its `ErrorCode` status/code/message/details.
2. `MethodArgumentNotValidException` and `ConstraintViolationException` → `VALIDATION_ERROR`.
3. `HttpMessageNotReadableException` → `INVALID_REQUEST`.
4. `NoResourceFoundException` → `NOT_FOUND`.
5. `ResponseStatusException` → compatibility mapping during migration.
6. Unexpected `Exception` → `INTERNAL_ERROR`, log request ID/path/stack trace, never expose internal details.

The existing response shape remains unchanged:

```json
{
  "error": {
    "code": "not_found",
    "message": "Resource not found",
    "details": [],
    "requestId": "..."
  }
}
```

Security 401/403 responses must also use `ErrorCode` rather than duplicate string literals.

## Non-goals

- Do not migrate all existing NestJS exception messages in this task.
- Do not add domain-specific error enums before the first module demonstrates a real need.
- Do not change the public response envelope.
- Do not expose database, JWT, stack trace or provider details in API responses.

## Verification requirements

- Unit tests validate every foundation `ErrorCode` mapping.
- `BusinessException` tests cover default message, safe override, details, cause and null code.
- MockMvc tests validate business 404/409 responses, validation 400, security 401/403 and generic 500 sanitization.
- Existing foundation tests remain green.
