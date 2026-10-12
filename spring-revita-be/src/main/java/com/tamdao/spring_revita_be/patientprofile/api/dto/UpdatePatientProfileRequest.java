package com.tamdao.spring_revita_be.patientprofile.api.dto;

import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.Map;

public record UpdatePatientProfileRequest(
        @Size(max = 255) String name,
        @Size(max = 64) String phone,
        @Past LocalDate dateOfBirth,
        @Size(max = 32) String gender,
        @Size(max = 1024) String address,
        @Size(max = 255) String occupation,
        Map<String, Object> emergencyContact,
        @Size(max = 255) String healthInsurance,
        @Size(max = 128) String relationship,
        Boolean isPregnant,
        Boolean isDisabled) {
}
