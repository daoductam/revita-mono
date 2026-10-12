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
    void authenticationAliasesHaveEquivalentRawSuccessSemantics() throws Exception {
        AuthEntity patient = seedPatientA();
        PatientEntity patientEntity = patientRepository.findByAuthId(patient.getId()).orElseThrow();

        for (String prefix : new String[]{"/api/v1", "/api"}) {
            mockMvc.perform(post(prefix + "/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json(Map.of("identifier", patient.getEmail(), "password", "password123"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.accessToken").isNotEmpty())
                    .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                    .andExpect(jsonPath("$.data").doesNotExist());

            mockMvc.perform(get(prefix + "/auth/me").with(jwtFor(patient, patientEntity)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(PATIENT_A_AUTH_ID))
                    .andExpect(jsonPath("$.data").doesNotExist());
        }
    }

    @Test
    void publicRegistrationAndDoctorAliasesAreBothReachable() throws Exception {
        for (String prefix : new String[]{"/api/v1", "/api"}) {
            mockMvc.perform(post(prefix + "/register/step1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json(Map.of("email", prefix.substring(1).replace('/', '-') + "@example.com"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.sessionId").isNotEmpty())
                    .andExpect(jsonPath("$.message").isNotEmpty())
                    .andExpect(jsonPath("$.data").doesNotExist());

            mockMvc.perform(get(prefix + "/users/doctors"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$").isArray())
                    .andExpect(jsonPath("$.data").doesNotExist());
        }
    }

    @Test
    void protectedUserPatientAndProfileAliasesUseSameAuthorizationAndFields() throws Exception {
        AuthEntity patient = seedPatientA();
        PatientEntity patientEntity = patientRepository.findByAuthId(patient.getId()).orElseThrow();
        PatientProfileEntity profile = seedProfile("profile-a", PATIENT_A_ID, "Profile A");

        for (String prefix : new String[]{"/api/v1", "/api"}) {
            mockMvc.perform(get(prefix + "/patient-profiles").with(jwtFor(patient, patientEntity)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].id").value(profile.getId()))
                    .andExpect(jsonPath("$.data").doesNotExist());

            mockMvc.perform(get(prefix + "/patient-profiles/" + profile.getId())
                            .with(jwtFor(patient, patientEntity)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(profile.getId()))
                    .andExpect(jsonPath("$.data").doesNotExist());
        }
    }
}
