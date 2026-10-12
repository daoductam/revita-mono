package com.tamdao.spring_revita_be.auth.api.dto;

public record TokenResponse(
        String accessToken,
        String refreshToken) {
}
