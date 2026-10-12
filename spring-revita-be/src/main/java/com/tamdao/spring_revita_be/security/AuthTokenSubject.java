package com.tamdao.spring_revita_be.security;

import com.tamdao.spring_revita_be.auth.domain.Role;

import java.util.Map;
import java.util.Objects;

public record AuthTokenSubject(
        String id,
        String phone,
        String email,
        Role role,
        Map<String, Object> roleDetails) {

    public AuthTokenSubject {
        Objects.requireNonNull(id, "id must not be null");
        Objects.requireNonNull(role, "role must not be null");
        roleDetails = roleDetails == null ? Map.of() : Map.copyOf(roleDetails);
    }
}
