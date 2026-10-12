package com.tamdao.spring_revita_be.patientprofile.api.dto;

import java.time.Instant;
import java.util.Map;

public record PatientProfileResponse(
        String id,
        String profileCode,
        String patientId,
        String name,
        String phone,
        Instant dateOfBirth,
        String gender,
        String address,
        String occupation,
        Map<String, Object> emergencyContact,
        String healthInsurance,
        String relationship,
        Boolean isActive,
        Boolean isPregnant,
        Boolean isDisabled,
        Instant createdAt,
        Instant updatedAt) {
}
