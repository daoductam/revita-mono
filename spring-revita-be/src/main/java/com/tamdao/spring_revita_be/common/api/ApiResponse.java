package com.tamdao.spring_revita_be.common.api;

public record ApiResponse<T>(
        boolean success,
        T data,
        ApiError error,
        ApiMeta meta) {

    public static <T> ApiResponse<T> success(T data, ApiMeta meta) {
        return new ApiResponse<>(true, data, null, meta);
    }

    public static ApiResponse<Void> failure(ApiError error, ApiMeta meta) {
        return new ApiResponse<>(false, null, error, meta);
    }
}
