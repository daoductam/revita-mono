package com.tamdao.spring_revita_be.task006;

import com.tamdao.spring_revita_be.auth.domain.AuthEntity;
import com.tamdao.spring_revita_be.patient.domain.PatientEntity;
import com.tamdao.spring_revita_be.patientprofile.domain.PatientProfileEntity;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class Task006AliasTests extends Task006IntegrationTestSupport {

    @Test
    void canonicalApiV1AuthenticationReturnsEnvelope() throws Exception {
        AuthEntity patient = seedPatientA();
        PatientEntity patientEntity = patientRepository.findByAuthId(patient.getId()).orElseThrow();

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("identifier", patient.getEmail(), "password", "password123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.data.user.id").value(PATIENT_A_AUTH_ID));

        mockMvc.perform(get("/api/v1/auth/me").with(jwtFor(patient, patientEntity)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(PATIENT_A_AUTH_ID));
    }

    @Test
    void canonicalApiV1PublicRoutesReturnEnvelope() throws Exception {
        mockMvc.perform(post("/api/v1/register/step1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("email", "canonical@example.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.sessionId").isNotEmpty())
                .andExpect(jsonPath("$.data.message").isNotEmpty());

        mockMvc.perform(get("/api/v1/users/doctors"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    void canonicalApiV1ProtectedRoutesReturnEnvelope() throws Exception {
        AuthEntity patient = seedPatientA();
        PatientEntity patientEntity = patientRepository.findByAuthId(patient.getId()).orElseThrow();
        PatientProfileEntity profile = seedProfile("profile-a", PATIENT_A_ID, "Profile A");

        mockMvc.perform(get("/api/v1/patient-profiles").with(jwtFor(patient, patientEntity)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].id").value(profile.getId()));

        mockMvc.perform(get("/api/v1/patient-profiles/" + profile.getId())
                        .with(jwtFor(patient, patientEntity)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.id").value(profile.getId()));
    }
}
