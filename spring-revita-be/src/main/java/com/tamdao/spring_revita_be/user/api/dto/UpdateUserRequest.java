package com.tamdao.spring_revita_be.user.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record UpdateUserRequest(
        @Size(max = 255) String name,
        @Past LocalDate dateOfBirth,
        @Size(max = 32) String gender,
        @Size(max = 1024) String address,
        @Size(max = 32) String citizenId,
        @Size(max = 2048) String avatar,
        @Email @Size(max = 255) String email,
        @Size(max = 64) String phone,
        @Size(min = 6, max = 128) String password) {
}
