package com.tamdao.spring_revita_be.patient.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record UpdatePatientRequest(
        @Size(max = 255) String name,
        @Past LocalDate dateOfBirth,
        @Size(max = 32) String gender,
        @Size(max = 1024) String address,
        @Size(max = 32) String citizenId,
        @Size(max = 2048) String avatar,
        @Size(max = 64) String phone,
        @Email @Size(max = 255) String email) {
}
