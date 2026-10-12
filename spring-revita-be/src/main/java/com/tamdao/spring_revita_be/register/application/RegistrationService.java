package com.tamdao.spring_revita_be.register.application;

import com.tamdao.spring_revita_be.auth.domain.AuthEntity;
import com.tamdao.spring_revita_be.auth.domain.Role;
import com.tamdao.spring_revita_be.auth.infrastructure.AuthRepository;
import com.tamdao.spring_revita_be.common.error.BusinessException;
import com.tamdao.spring_revita_be.common.error.ErrorCode;
import com.tamdao.spring_revita_be.patient.domain.PatientEntity;
import com.tamdao.spring_revita_be.patient.infrastructure.PatientRepository;
import com.tamdao.spring_revita_be.register.api.dto.CompleteRegistrationRequest;
import com.tamdao.spring_revita_be.register.api.dto.MessageResponse;
import com.tamdao.spring_revita_be.register.api.dto.RegisterStep1Request;
import com.tamdao.spring_revita_be.register.api.dto.RegistrationCompleteResponse;
import com.tamdao.spring_revita_be.register.api.dto.RegistrationSessionResponse;
import com.tamdao.spring_revita_be.register.api.dto.VerifyOtpRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class RegistrationService {

    private static final Duration SESSION_TTL = Duration.ofMinutes(30);
    private static final Duration OTP_TTL = Duration.ofMinutes(5);

    private final AuthRepository authRepository;
    private final PatientRepository patientRepository;
    private final PasswordEncoder passwordEncoder;
    private final RegistrationSessionStore sessionStore;
    private final OtpSender otpSender;
    private final LegacyCodeGenerator codeGenerator;

    @Transactional(readOnly = true)
    public RegistrationSessionResponse start(RegisterStep1Request request) {
        String phone = normalize(request.phone());
        String email = normalize(request.email());
        if (phone == null && email == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "At least one of phone or email is required");
        }
        if (phone != null && authRepository.existsByPhone(phone)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Phone is already registered");
        }
        if (email != null && authRepository.existsByEmail(email)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Email is already registered");
        }

        String sessionId = UUID.randomUUID().toString();
        String otp = generateOtp();
        sessionStore.saveSession(
                new RegistrationSession(sessionId, phone, email, RegistrationState.CREATED, Instant.now()),
                SESSION_TTL);
        sessionStore.saveOtp(sessionId, otp, OTP_TTL);
        sendOtp(sessionId, phone, email, otp, true);

        String destination = phone != null ? "phone " + phone : "email " + email;
        return new RegistrationSessionResponse(sessionId, "OTP sent to " + destination);
    }

    public RegistrationSessionResponse verifyOtp(VerifyOtpRequest request) {
        RegistrationSession session = findSession(request.sessionId());
        if (session.state() == RegistrationState.VERIFIED) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Registration session is already verified");
        }
        String storedOtp = sessionStore.findOtp(request.sessionId())
                .orElseThrow(() -> new BusinessException(ErrorCode.BAD_REQUEST, "OTP has expired"));
        if (!MessageDigest.isEqual(
                storedOtp.getBytes(StandardCharsets.UTF_8),
                request.otp().getBytes(StandardCharsets.UTF_8))) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "OTP is invalid");
        }

        sessionStore.saveSession(session.verified(), SESSION_TTL);
        sessionStore.deleteOtp(request.sessionId());
        return new RegistrationSessionResponse(
                request.sessionId(), "OTP verification successful");
    }

    public MessageResponse resendOtp(String sessionId) {
        RegistrationSession session = findSession(sessionId);
        if (session.state() == RegistrationState.VERIFIED) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "Registration session is already verified");
        }
        String otp = generateOtp();
        sessionStore.saveOtp(sessionId, otp, OTP_TTL);
        sendOtp(sessionId, session.phone(), session.email(), otp, false);
        return new MessageResponse("A new OTP has been sent");
    }

    @Transactional
    public RegistrationCompleteResponse complete(CompleteRegistrationRequest request) {
        RegistrationSession session = findSession(request.sessionId());
        if (session.state() != RegistrationState.VERIFIED) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "OTP verification is required");
        }

        String citizenId = normalize(request.citizenId());
        if (citizenId != null && authRepository.existsByCitizenId(citizenId)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Citizen ID is already registered");
        }

        String userId = UUID.randomUUID().toString();
        Instant dateOfBirth = request.dateOfBirth().atStartOfDay(ZoneOffset.UTC).toInstant();
        AuthEntity auth = AuthEntity.builder()
                .id(userId)
                .phone(session.phone())
                .email(session.email())
                .password(passwordEncoder.encode(request.password()))
                .name(request.name().trim())
                .dateOfBirth(dateOfBirth)
                .gender(request.gender())
                .avatar(normalize(request.avatar()))
                .address(request.address().trim())
                .citizenId(citizenId)
                .role(Role.PATIENT)
                .build();
        PatientEntity patient = PatientEntity.builder()
                .id(userId)
                .patientCode(codeGenerator.generatePatientCode(request.name(), request.gender()))
                .authId(userId)
                .loyaltyPoints(0)
                .build();

        try {
            authRepository.save(auth);
            authRepository.flush();
            patientRepository.save(patient);
            patientRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(ErrorCode.CONFLICT, "Registration conflicts with an existing account", exception);
        }

        sessionStore.deleteSession(request.sessionId());
        return new RegistrationCompleteResponse("Registration successful", userId);
    }

    private RegistrationSession findSession(String sessionId) {
        return sessionStore.findSession(sessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Registration session not found or expired"));
    }

    private String generateOtp() {
        return Integer.toString(ThreadLocalRandom.current().nextInt(100000, 1000000));
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private void sendOtp(String sessionId, String phone, String email, String otp, boolean deleteSessionOnFailure) {
        try {
            otpSender.send(phone, email, otp);
        } catch (BusinessException exception) {
            sessionStore.deleteOtp(sessionId);
            if (deleteSessionOnFailure) {
                sessionStore.deleteSession(sessionId);
            }
            throw exception;
        } catch (RuntimeException exception) {
            sessionStore.deleteOtp(sessionId);
            if (deleteSessionOnFailure) {
                sessionStore.deleteSession(sessionId);
            }
            throw new BusinessException(ErrorCode.SERVICE_UNAVAILABLE, "OTP delivery failed", exception);
        }
    }
}
