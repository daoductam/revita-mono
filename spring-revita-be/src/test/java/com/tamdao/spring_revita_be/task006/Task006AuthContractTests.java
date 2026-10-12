package com.tamdao.spring_revita_be.task006;

import com.tamdao.spring_revita_be.auth.domain.AuthEntity;
import com.tamdao.spring_revita_be.auth.domain.Role;
import com.tamdao.spring_revita_be.patient.domain.PatientEntity;
import com.tamdao.spring_revita_be.security.AuthTokenSubject;
import com.tamdao.spring_revita_be.security.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;

import java.time.Instant;
import java.util.Map;

import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class Task006AuthContractTests extends Task006IntegrationTestSupport {

    @Autowired
    private JwtTokenService jwtTokenService;

    @Test
    void loginByEmailReturnsRawLegacyResponseWithoutSensitiveFields() throws Exception {
        seedPatientA();

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("identifier", "patient-a@example.com", "password", "password123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.user.id").value(PATIENT_A_AUTH_ID))
                .andExpect(jsonPath("$.user.patient.id").value(PATIENT_A_ID))
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.user.password").doesNotExist())
                .andExpect(jsonPath("$.user.accessToken").doesNotExist())
                .andExpect(jsonPath("$.user.refreshToken").doesNotExist())
                .andExpect(header().exists("X-Request-ID"));
    }

    @Test
    void loginByPhoneAndLegacyAliasPreservesContract() throws Exception {
        seedPatientA();

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("identifier", "0900000001", "password", "password123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.user.role").value("PATIENT"))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    @Test
    void invalidCredentialsUseUnauthorizedErrorEnvelope() throws Exception {
        seedPatientA();

        mockMvc.perform(post("/api/v1/auth/login")
                        .header("X-Request-ID", "auth-invalid")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("identifier", "patient-a@example.com", "password", "wrong"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("unauthorized"))
                .andExpect(jsonPath("$.error.requestId").value("auth-invalid"));
    }

    @Test
    void refreshReturnsRawTokenResponseAndRejectsAccessToken() throws Exception {
        AuthEntity patient = seedPatientA();
        PatientEntity patientEntity = patientRepository.findByAuthId(patient.getId()).orElseThrow();
        String accessToken = jwtTokenService.issueAccessToken(new AuthTokenSubject(
                patient.getId(), patient.getPhone(), patient.getEmail(), Role.PATIENT,
                Map.of("id", patientEntity.getId(), "patientCode", patientEntity.getPatientCode())));
        String refreshToken = jwtTokenService.issueRefreshToken(new AuthTokenSubject(
                patient.getId(), patient.getPhone(), patient.getEmail(), Role.PATIENT,
                Map.of("id", patientEntity.getId(), "patientCode", patientEntity.getPatientCode())));

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("refreshToken", refreshToken))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.data").doesNotExist());

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("refreshToken", accessToken))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("unauthorized"));
    }

    @Test
    void meUsesJwtSubjectAndLogoutClearsStoredTokenState() throws Exception {
        AuthEntity patient = seedPatientA();
        patient.setAccessToken("stored-access");
        patient.setRefreshToken("stored-refresh");
        patient.setTokenExpiry(Instant.now().plusSeconds(3600));
        authRepository.saveAndFlush(patient);
        PatientEntity patientEntity = patientRepository.findByAuthId(patient.getId()).orElseThrow();

        mockMvc.perform(get("/api/v1/auth/me").with(jwtFor(patient, patientEntity)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(PATIENT_A_AUTH_ID))
                .andExpect(jsonPath("$.patient.id").value(PATIENT_A_ID))
                .andExpect(jsonPath("$.data").doesNotExist());

        mockMvc.perform(post("/api/auth/logout").with(jwtFor(patient, patientEntity)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.data").doesNotExist());

        AuthEntity persisted = authRepository.findById(PATIENT_A_AUTH_ID).orElseThrow();
        org.junit.jupiter.api.Assertions.assertNull(persisted.getAccessToken());
        org.junit.jupiter.api.Assertions.assertNull(persisted.getRefreshToken());
        org.junit.jupiter.api.Assertions.assertNull(persisted.getTokenExpiry());
    }

    @Test
    void protectedAuthRouteWithoutBearerReturnsSharedUnauthorizedContract() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("unauthorized"))
                .andExpect(jsonPath("$.error.requestId").isNotEmpty())
                .andExpect(jsonPath("$.accessToken").doesNotExist());

        mockMvc.perform(post("/api/v1/auth/logout"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("unauthorized"));
    }

    @Test
    void issuedJwtPreservesLegacyClaimsAndExpiry() {
        AuthTokenSubject subject = new AuthTokenSubject(
                "auth-1", "0900000000", "user@example.com", Role.PATIENT,
                Map.of("id", "patient-1", "patientCode", "PAT-1"));

        String rawToken = jwtTokenService.issueAccessToken(subject);
        var jwt = jwtTokenService.decode(rawToken);

        org.junit.jupiter.api.Assertions.assertEquals("auth-1", jwt.getSubject());
        org.junit.jupiter.api.Assertions.assertEquals("0900000000", jwt.getClaimAsString("phone"));
        org.junit.jupiter.api.Assertions.assertEquals("user@example.com", jwt.getClaimAsString("email"));
        org.junit.jupiter.api.Assertions.assertEquals("PATIENT", jwt.getClaimAsString("role"));
        org.junit.jupiter.api.Assertions.assertEquals("access", jwt.getClaimAsString("token_type"));
        org.junit.jupiter.api.Assertions.assertTrue(jwt.getExpiresAt().isAfter(Instant.now()));
        org.junit.jupiter.api.Assertions.assertEquals("patient-1", ((Map<?, ?>) jwt.getClaims().get("patient")).get("id"));
    }
}
