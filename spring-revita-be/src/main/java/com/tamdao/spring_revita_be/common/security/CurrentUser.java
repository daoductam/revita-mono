package com.tamdao.spring_revita_be.common.security;

import com.tamdao.spring_revita_be.auth.domain.Role;

import java.util.Map;

public record CurrentUser(
        String userId,
        Role role,
        String patientId,
        String patientCode,
        Map<String, Object> claims) {

    public boolean isPatient() {
        return role == Role.PATIENT;
    }
}
