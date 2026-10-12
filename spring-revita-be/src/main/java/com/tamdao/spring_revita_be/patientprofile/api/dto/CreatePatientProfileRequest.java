package com.tamdao.spring_revita_be.patientprofile.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.Map;

public record CreatePatientProfileRequest(
        String patientId,
        @NotBlank @Size(max = 255) String name,
        @Size(max = 64) String phone,
        @NotNull @Past LocalDate dateOfBirth,
        @NotBlank @Size(max = 32) String gender,
        @Size(max = 1024) String address,
        @Size(max = 255) String occupation,
        @NotEmpty Map<String, Object> emergencyContact,
        @Size(max = 255) String healthInsurance,
        @Size(max = 128) String relationship,
        Boolean isPregnant,
        Boolean isDisabled) {
}
