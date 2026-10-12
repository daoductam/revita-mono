package com.tamdao.spring_revita_be.auth.api.dto;

import com.tamdao.spring_revita_be.auth.domain.Role;

import java.time.Instant;

public record UserResponse(
        String id,
        String name,
        Instant dateOfBirth,
        String email,
        String phone,
        String gender,
        String avatar,
        String address,
        String citizenId,
        Role role,
        PatientSummaryResponse patient) {
}
