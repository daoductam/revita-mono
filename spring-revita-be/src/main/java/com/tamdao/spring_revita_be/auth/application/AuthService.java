package com.tamdao.spring_revita_be.auth.application;

import com.tamdao.spring_revita_be.auth.api.dto.AuthResponse;
import com.tamdao.spring_revita_be.auth.api.dto.LoginRequest;
import com.tamdao.spring_revita_be.auth.api.dto.LogoutResponse;
import com.tamdao.spring_revita_be.auth.api.dto.PatientSummaryResponse;
import com.tamdao.spring_revita_be.auth.api.dto.TokenResponse;
import com.tamdao.spring_revita_be.auth.api.dto.UserResponse;
import com.tamdao.spring_revita_be.auth.domain.AuthEntity;
import com.tamdao.spring_revita_be.auth.domain.Role;
import com.tamdao.spring_revita_be.auth.infrastructure.AuthRepository;
import com.tamdao.spring_revita_be.common.error.BusinessException;
import com.tamdao.spring_revita_be.common.error.ErrorCode;
import com.tamdao.spring_revita_be.common.security.CurrentUser;
import com.tamdao.spring_revita_be.patient.domain.PatientEntity;
import com.tamdao.spring_revita_be.patient.infrastructure.PatientRepository;
import com.tamdao.spring_revita_be.security.AuthTokenSubject;
import com.tamdao.spring_revita_be.security.JwtTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String INVALID_CREDENTIALS = "Invalid credentials";

    private final AuthRepository authRepository;
    private final PatientRepository patientRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        AuthEntity auth = authRepository.findFirstByPhoneOrEmail(request.identifier(), request.identifier())
                .orElseThrow(() -> unauthorized(INVALID_CREDENTIALS));

        if (auth.getPassword() == null || !passwordEncoder.matches(request.password(), auth.getPassword())) {
            throw unauthorized(INVALID_CREDENTIALS);
        }

        AuthTokenSubject subject = toTokenSubject(auth);
        return new AuthResponse(
                jwtTokenService.issueAccessToken(subject),
                jwtTokenService.issueRefreshToken(subject),
                toUserResponse(auth));
    }

    @Transactional(readOnly = true)
    public TokenResponse refresh(String rawRefreshToken) {
        var jwt = jwtTokenService.decode(rawRefreshToken);
        Object tokenType = jwt.getClaims().get("token_type");
        if (tokenType != null && !"refresh".equals(tokenType.toString())) {
            throw unauthorized("Invalid refresh token");
        }

        String userId = jwt.getSubject();
        if (userId == null || userId.isBlank()) {
            throw unauthorized("Invalid refresh token");
        }

        AuthEntity auth = authRepository.findById(userId)
                .orElseThrow(() -> unauthorized("Invalid refresh token"));
        AuthTokenSubject subject = toTokenSubject(auth);
        return new TokenResponse(
                jwtTokenService.issueRefreshedAccessToken(subject),
                jwtTokenService.issueRefreshedRefreshToken(subject));
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser(CurrentUser currentUser) {
        AuthEntity auth = authRepository.findById(currentUser.userId())
                .orElseThrow(() -> unauthorized("User not found"));
        return toUserResponse(auth);
    }

    @Transactional
    public LogoutResponse logout(CurrentUser currentUser) {
        AuthEntity auth = authRepository.findById(currentUser.userId())
                .orElseThrow(() -> unauthorized("User not found"));
        auth.setAccessToken(null);
        auth.setRefreshToken(null);
        auth.setTokenExpiry(null);
        authRepository.save(auth);
        return new LogoutResponse(true, "Logged out successfully");
    }

    private AuthTokenSubject toTokenSubject(AuthEntity auth) {
        Map<String, Object> roleDetails = Map.of();
        if (auth.getRole() == Role.PATIENT) {
            PatientEntity patient = patientRepository.findByAuthId(auth.getId()).orElse(null);
            if (patient != null) {
                roleDetails = Map.of("id", patient.getId(), "patientCode", patient.getPatientCode());
            }
        }
        return new AuthTokenSubject(auth.getId(), auth.getPhone(), auth.getEmail(), auth.getRole(), roleDetails);
    }

    private UserResponse toUserResponse(AuthEntity auth) {
        PatientSummaryResponse patient = null;
        if (auth.getRole() == Role.PATIENT) {
            patient = patientRepository.findByAuthId(auth.getId())
                    .map(value -> new PatientSummaryResponse(
                            value.getId(), value.getPatientCode(), value.getLoyaltyPoints()))
                    .orElse(null);
        }
        return new UserResponse(
                auth.getId(),
                auth.getName(),
                auth.getDateOfBirth(),
                auth.getEmail(),
                auth.getPhone(),
                auth.getGender(),
                auth.getAvatar(),
                auth.getAddress(),
                auth.getCitizenId(),
                auth.getRole(),
                patient);
    }

    private BusinessException unauthorized(String message) {
        return new BusinessException(ErrorCode.UNAUTHORIZED, message);
    }
}
