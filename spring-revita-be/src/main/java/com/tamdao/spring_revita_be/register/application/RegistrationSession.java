package com.tamdao.spring_revita_be.register.application;

import java.time.Instant;

public record RegistrationSession(
        String sessionId,
        String phone,
        String email,
        RegistrationState state,
        Instant createdAt) {

    public RegistrationSession verified() {
        return new RegistrationSession(sessionId, phone, email, RegistrationState.VERIFIED, createdAt);
    }
}
