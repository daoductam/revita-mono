package com.tamdao.spring_revita_be.common.api;

import com.tamdao.spring_revita_be.common.error.ApiErrorResponse;
import com.tamdao.spring_revita_be.common.error.ErrorCode;
import com.tamdao.spring_revita_be.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ApiResponseFactory {

    public <T> ApiResponse<T> success(T data, HttpServletRequest request) {
        return success(data, RequestIdFilter.requestId(request));
    }

    public <T> ApiResponse<T> success(T data, String requestId) {
        return ApiResponse.success(data, new ApiMeta(requestId));
    }

    public ApiResponse<Void> failure(
            ErrorCode errorCode,
            String message,
            List<ApiErrorResponse.ErrorDetail> details,
            HttpServletRequest request) {
        return failure(errorCode, message, details, RequestIdFilter.requestId(request));
    }

    public ApiResponse<Void> failure(
            ErrorCode errorCode,
            String message,
            List<ApiErrorResponse.ErrorDetail> details,
            String requestId) {
        String resolvedMessage = message == null || message.isBlank()
                ? errorCode.defaultMessage()
                : message;
        List<ApiErrorDetail> resolvedDetails = details == null
                ? List.of()
                : details.stream()
                        .map(detail -> new ApiErrorDetail(detail.field(), detail.message(), detail.code()))
                        .toList();
        return ApiResponse.failure(
                new ApiError(errorCode.code(), resolvedMessage, resolvedDetails),
                new ApiMeta(requestId));
    }
}
