package com.tamdao.spring_revita_be.auth.api.dto;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        UserResponse user) {
}
