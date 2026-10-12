package com.tamdao.spring_revita_be.common.error;

import java.util.List;

public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;
    private final List<ApiErrorResponse.ErrorDetail> details;

    public BusinessException(ErrorCode errorCode) {
        this(errorCode, null, List.of(), null);
    }

    public BusinessException(ErrorCode errorCode, String message) {
        this(errorCode, message, List.of(), null);
    }

    public BusinessException(ErrorCode errorCode, List<ApiErrorResponse.ErrorDetail> details) {
        this(errorCode, null, details, null);
    }

    public BusinessException(ErrorCode errorCode, String message, Throwable cause) {
        this(errorCode, message, List.of(), cause);
    }

    private BusinessException(
            ErrorCode errorCode,
            String message,
            List<ApiErrorResponse.ErrorDetail> details,
            Throwable cause) {
        super(resolveMessage(errorCode, message), cause);
        this.errorCode = errorCode;
        this.details = details == null ? List.of() : List.copyOf(details);
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }

    public List<ApiErrorResponse.ErrorDetail> getDetails() {
        return details;
    }

    private static String resolveMessage(ErrorCode errorCode, String message) {
        if (errorCode == null) {
            throw new IllegalArgumentException("errorCode must not be null");
        }
        return message == null || message.isBlank() ? errorCode.defaultMessage() : message;
    }
}
