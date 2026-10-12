package com.tamdao.spring_revita_be.register.api.dto;

import jakarta.validation.constraints.NotBlank;

public record ResendOtpRequest(@NotBlank String sessionId) {
}
