package com.tamdao.spring_revita_be.register.infrastructure;

import com.tamdao.spring_revita_be.register.application.RegistrationSession;
import com.tamdao.spring_revita_be.register.application.RegistrationSessionStore;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Profile("test")
public class InMemoryRegistrationSessionStore implements RegistrationSessionStore {

    private final Map<String, ExpiringValue<RegistrationSession>> sessions = new ConcurrentHashMap<>();
    private final Map<String, ExpiringValue<String>> otps = new ConcurrentHashMap<>();

    @Override
    public void saveSession(RegistrationSession session, Duration ttl) {
        sessions.put(session.sessionId(), new ExpiringValue<>(session, expiresAt(ttl)));
    }

    @Override
    public Optional<RegistrationSession> findSession(String sessionId) {
        return read(sessions, sessionId);
    }

    @Override
    public void deleteSession(String sessionId) {
        sessions.remove(sessionId);
    }

    @Override
    public void saveOtp(String sessionId, String otp, Duration ttl) {
        otps.put(sessionId, new ExpiringValue<>(otp, expiresAt(ttl)));
    }

    @Override
    public Optional<String> findOtp(String sessionId) {
        return read(otps, sessionId);
    }

    @Override
    public void deleteOtp(String sessionId) {
        otps.remove(sessionId);
    }

    private <T> Optional<T> read(Map<String, ExpiringValue<T>> values, String key) {
        ExpiringValue<T> value = values.get(key);
        if (value == null) {
            return Optional.empty();
        }
        if (value.expiresAt().isBefore(Instant.now())) {
            values.remove(key, value);
            return Optional.empty();
        }
        return Optional.of(value.value());
    }

    private Instant expiresAt(Duration ttl) {
        return Instant.now().plus(ttl);
    }

    private record ExpiringValue<T>(T value, Instant expiresAt) {
    }
}
