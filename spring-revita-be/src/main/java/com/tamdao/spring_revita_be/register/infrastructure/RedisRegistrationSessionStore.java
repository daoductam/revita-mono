package com.tamdao.spring_revita_be.register.infrastructure;

import com.tamdao.spring_revita_be.register.application.RegistrationSession;
import com.tamdao.spring_revita_be.register.application.RegistrationSessionStore;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.Optional;

@Service
@Profile("!test")
@RequiredArgsConstructor
public class RedisRegistrationSessionStore implements RegistrationSessionStore {

    private static final String SESSION_PREFIX = "session:";
    private static final String OTP_PREFIX = "otp:";

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public void saveSession(RegistrationSession session, Duration ttl) {
        try {
            redisTemplate.opsForValue().set(
                    sessionKey(session.sessionId()),
                    objectMapper.writeValueAsString(session),
                    ttl);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to save registration session", exception);
        }
    }

    @Override
    public Optional<RegistrationSession> findSession(String sessionId) {
        String value = redisTemplate.opsForValue().get(sessionKey(sessionId));
        if (value == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(objectMapper.readValue(value, RegistrationSession.class));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to read registration session", exception);
        }
    }

    @Override
    public void deleteSession(String sessionId) {
        redisTemplate.delete(sessionKey(sessionId));
    }

    @Override
    public void saveOtp(String sessionId, String otp, Duration ttl) {
        redisTemplate.opsForValue().set(otpKey(sessionId), otp, ttl);
    }

    @Override
    public Optional<String> findOtp(String sessionId) {
        return Optional.ofNullable(redisTemplate.opsForValue().get(otpKey(sessionId)));
    }

    @Override
    public void deleteOtp(String sessionId) {
        redisTemplate.delete(otpKey(sessionId));
    }

    private String sessionKey(String sessionId) {
        return SESSION_PREFIX + sessionId;
    }

    private String otpKey(String sessionId) {
        return OTP_PREFIX + sessionId;
    }
}
