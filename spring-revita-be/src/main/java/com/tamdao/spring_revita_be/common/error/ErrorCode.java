package com.tamdao.spring_revita_be.common.error;

import org.springframework.http.HttpStatus;

public enum ErrorCode {

    VALIDATION_ERROR(HttpStatus.BAD_REQUEST, "validation_error", "Request validation failed"),
    BAD_REQUEST(HttpStatus.BAD_REQUEST, "bad_request", "The request is invalid"),
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "invalid_request", "Request body is invalid"),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "unauthorized", "Authentication is required"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "forbidden", "You are not allowed to access this resource"),
    NOT_FOUND(HttpStatus.NOT_FOUND, "not_found", "Resource not found"),
    CONFLICT(HttpStatus.CONFLICT, "conflict", "The request conflicts with the current state"),
    UNPROCESSABLE_ENTITY(
            HttpStatus.UNPROCESSABLE_ENTITY,
            "unprocessable_entity",
            "The request could not be processed"),
    TOO_MANY_REQUESTS(HttpStatus.TOO_MANY_REQUESTS, "too_many_requests", "Too many requests"),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "internal_error", "An unexpected error occurred"),
    SERVICE_UNAVAILABLE(
            HttpStatus.SERVICE_UNAVAILABLE,
            "service_unavailable",
            "The service is temporarily unavailable");

    private final HttpStatus httpStatus;
    private final String code;
    private final String defaultMessage;

    ErrorCode(HttpStatus httpStatus, String code, String defaultMessage) {
        this.httpStatus = httpStatus;
        this.code = code;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus httpStatus() {
        return httpStatus;
    }

    public String code() {
        return code;
    }

    public String defaultMessage() {
        return defaultMessage;
    }
}
