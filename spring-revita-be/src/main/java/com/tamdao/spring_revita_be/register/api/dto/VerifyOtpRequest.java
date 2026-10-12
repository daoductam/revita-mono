package com.tamdao.spring_revita_be.register.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record VerifyOtpRequest(
        @NotBlank String sessionId,
        @NotBlank @Pattern(regexp = "\\d{6}") String otp) {
}
