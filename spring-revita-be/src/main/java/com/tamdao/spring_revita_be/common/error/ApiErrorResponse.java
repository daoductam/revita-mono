package com.tamdao.spring_revita_be.common.error;

import java.util.List;
import java.util.Objects;

public record ApiErrorResponse(ErrorBody error) {

    public record ErrorBody(
            String code,
            String message,
            List<ErrorDetail> details,
            String requestId) {
    }

    public record ErrorDetail(String field, String message, String code) {
    }

    public static ApiErrorResponse of(
            String code,
            String message,
            List<ErrorDetail> details,
            String requestId) {
        return new ApiErrorResponse(new ErrorBody(
                code,
                message,
                details == null ? List.of() : List.copyOf(details),
                requestId));
    }

    public static ApiErrorResponse of(
            ErrorCode errorCode,
            List<ErrorDetail> details,
            String requestId) {
        return of(errorCode, null, details, requestId);
    }

    public static ApiErrorResponse of(
            ErrorCode errorCode,
            String message,
            List<ErrorDetail> details,
            String requestId) {
        Objects.requireNonNull(errorCode, "errorCode must not be null");
        String resolvedMessage = message == null || message.isBlank()
                ? errorCode.defaultMessage()
                : message;
        return of(errorCode.code(), resolvedMessage, details, requestId);
    }
}
