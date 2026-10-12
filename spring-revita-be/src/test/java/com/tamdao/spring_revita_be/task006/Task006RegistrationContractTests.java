package com.tamdao.spring_revita_be.task006;

import com.tamdao.spring_revita_be.auth.domain.AuthEntity;
import com.tamdao.spring_revita_be.auth.domain.Role;
import com.tamdao.spring_revita_be.common.error.BusinessException;
import com.tamdao.spring_revita_be.common.error.ErrorCode;
import com.tamdao.spring_revita_be.register.infrastructure.UnconfiguredOtpSender;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.time.LocalDate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class Task006RegistrationContractTests extends Task006IntegrationTestSupport {

    @Test
    void unconfiguredProductionOtpSenderFailsInsteadOfSilentlyAcceptingDelivery() {
        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> new UnconfiguredOtpSender().send("0900000000", null, "123456"));

        assertEquals(ErrorCode.SERVICE_UNAVAILABLE, exception.getErrorCode());
    }

    @Test
    void registrationCompletesCreatedVerifiedCompletedFlowAndCreatesPatientAtomically() throws Exception {
        String sessionId = startRegistration("/api/v1/register/step1", "new@example.com", "0900000100");
        String otp = testOtpSender.getLastOtp();

        mockMvc.perform(post("/api/v1/register/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("sessionId", sessionId, "otp", otp))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.sessionId").value(sessionId))
                .andExpect(jsonPath("$.data.message").isNotEmpty());

        mockMvc.perform(post("/api/v1/register/complete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "sessionId", sessionId,
                                "name", "New Patient",
                                "dateOfBirth", "1992-05-10",
                                "gender", "female",
                                "address", "Hanoi",
                                "password", "password123",
                                "citizenId", "CITIZEN-100"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.message").isNotEmpty())
                .andExpect(jsonPath("$.data.userId").isNotEmpty());

        AuthEntity auth = authRepository.findFirstByPhoneOrEmail("0900000100", "new@example.com").orElseThrow();
        assertEquals(Role.PATIENT, auth.getRole());
        assertTrue(passwordEncoder.matches("password123", auth.getPassword()));
        assertTrue(patientRepository.findByAuthId(auth.getId()).isPresent());
        assertEquals(1, authRepository.count());
        assertEquals(1, patientRepository.count());
    }

    @Test
    void registrationRejectsMissingContactAndDuplicateContact() throws Exception {
        mockMvc.perform(post("/api/v1/register/step1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("validation_error"));

        seedPatientA();
        mockMvc.perform(post("/api/v1/register/step1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "patient-a@example.com"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("conflict"));
    }

    @Test
    void registrationRejectsInvalidOtpAndDoesNotAdvanceSession() throws Exception {
        String sessionId = startRegistration("/api/v1/register/step1", "otp@example.com", "0900000101");

        mockMvc.perform(post("/api/v1/register/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("sessionId", sessionId, "otp", "000000"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("bad_request"));

        mockMvc.perform(post("/api/v1/register/complete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(completeRequest(sessionId))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("bad_request"));

        assertEquals(0, authRepository.count());
        assertEquals(0, patientRepository.count());
    }

    @Test
    void registrationRejectsResendAfterVerificationAndSecondVerification() throws Exception {
        String sessionId = startRegistration("/api/v1/register/step1", "verified@example.com", "0900000102");
        String otp = testOtpSender.getLastOtp();

        mockMvc.perform(post("/api/v1/register/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("sessionId", sessionId, "otp", otp))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/register/resend-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("sessionId", sessionId))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("bad_request"));

        mockMvc.perform(post("/api/v1/register/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("sessionId", sessionId, "otp", otp))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("bad_request"));
    }

    @Test
    void registrationCanResendOtpBeforeVerification() throws Exception {
        String sessionId = startRegistration("/api/v1/register/step1", "resend@example.com", "0900000104");
        String firstOtp = testOtpSender.getLastOtp();

        mockMvc.perform(post("/api/v1/register/resend-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("sessionId", sessionId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.message").isNotEmpty());

        String resentOtp = testOtpSender.getLastOtp();
        org.junit.jupiter.api.Assertions.assertNotNull(resentOtp);
        org.junit.jupiter.api.Assertions.assertTrue(resentOtp.matches("\\d{6}"));
    }

    @Test
    void registrationRejectsDuplicateCitizenIdBeforeCreatingAccount() throws Exception {
        AuthEntity existing = seedPatientA();
        existing.setCitizenId("CITIZEN-200");
        authRepository.saveAndFlush(existing);

        String sessionId = startRegistration("/api/v1/register/step1", "citizen@example.com", "0900000103");
        String otp = testOtpSender.getLastOtp();
        mockMvc.perform(post("/api/v1/register/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("sessionId", sessionId, "otp", otp))))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/register/complete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "sessionId", sessionId,
                                "name", "Duplicate Citizen",
                                "dateOfBirth", "1992-05-10",
                                "gender", "male",
                                "address", "Hanoi",
                                "password", "password123",
                                "citizenId", "CITIZEN-200"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("conflict"));

        assertEquals(1, authRepository.count());
        assertEquals(1, patientRepository.count());
    }

    private String startRegistration(String route, String email, String phone) throws Exception {
        var result = mockMvc.perform(post(route)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", email, "phone", phone))))
                .andExpect(status().isOk());
        result.andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.sessionId").isNotEmpty())
                .andExpect(jsonPath("$.data.message").isNotEmpty());
        var response = objectMapper.readTree(result.andReturn().getResponse().getContentAsString());
        return response.get("data").get("sessionId").asText();
    }

    private Map<String, Object> completeRequest(String sessionId) {
        return Map.of(
                "sessionId", sessionId,
                "name", "New Patient",
                "dateOfBirth", LocalDate.of(1992, 5, 10).toString(),
                "gender", "female",
                "address", "Hanoi",
                "password", "password123");
    }
}
