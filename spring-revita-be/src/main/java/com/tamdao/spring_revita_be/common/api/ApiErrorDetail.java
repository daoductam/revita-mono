package com.tamdao.spring_revita_be.common.api;

public record ApiErrorDetail(
        String field,
        String message,
        String code) {
}
