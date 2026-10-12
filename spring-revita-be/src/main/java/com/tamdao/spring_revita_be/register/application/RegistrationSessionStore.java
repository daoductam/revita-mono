package com.tamdao.spring_revita_be.register.application;

import java.time.Duration;
import java.util.Optional;

public interface RegistrationSessionStore {

    void saveSession(RegistrationSession session, Duration ttl);

    Optional<RegistrationSession> findSession(String sessionId);

    void deleteSession(String sessionId);

    void saveOtp(String sessionId, String otp, Duration ttl);

    Optional<String> findOtp(String sessionId);

    void deleteOtp(String sessionId);
}
