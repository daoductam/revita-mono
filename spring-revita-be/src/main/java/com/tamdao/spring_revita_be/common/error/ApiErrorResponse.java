package com.tamdao.spring_revita_be.common.error;

import java.util.List;

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
}
