package com.tamdao.spring_revita_be.register.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CompleteRegistrationRequest(
        @NotBlank String sessionId,
        @NotBlank String name,
        @NotNull @Past LocalDate dateOfBirth,
        @NotBlank @Pattern(regexp = "male|female|other") String gender,
        @NotBlank String address,
        @NotBlank @Size(min = 6, max = 128) String password,
        @Size(max = 32) String citizenId,
        @Size(max = 2048) String avatar) {
}
