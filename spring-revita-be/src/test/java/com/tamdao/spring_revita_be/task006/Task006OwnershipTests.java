package com.tamdao.spring_revita_be.task006;

import com.tamdao.spring_revita_be.auth.domain.AuthEntity;
import com.tamdao.spring_revita_be.auth.domain.Role;
import com.tamdao.spring_revita_be.patient.domain.PatientEntity;
import com.tamdao.spring_revita_be.patientprofile.domain.PatientProfileEntity;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class Task006OwnershipTests extends Task006IntegrationTestSupport {

    @Test
    void patientCanReadOnlyOwnProfilesAcrossBothRoutePrefixes() throws Exception {
        AuthEntity patientA = seedPatientA();
        PatientEntity patientEntityA = patientRepository.findByAuthId(patientA.getId()).orElseThrow();
        seedPatientB();
        PatientProfileEntity profileA = seedProfile("profile-a", PATIENT_A_ID, "Profile A");
        PatientProfileEntity profileB = seedProfile("profile-b", PATIENT_B_ID, "Profile B");

        mockMvc.perform(get("/api/v1/patient-profiles").with(jwtFor(patientA, patientEntityA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(profileA.getId()))
                .andExpect(jsonPath("$.data").doesNotExist());

        mockMvc.perform(get("/api/patient-profiles/patient/" + PATIENT_A_ID)
                        .with(jwtFor(patientA, patientEntityA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].patientId").value(PATIENT_A_ID));

        mockMvc.perform(get("/api/v1/patient-profiles/" + profileB.getId())
                        .with(jwtFor(patientA, patientEntityA)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("forbidden"));

        mockMvc.perform(get("/api/patient-profiles/patient/" + PATIENT_B_ID)
                        .with(jwtFor(patientA, patientEntityA)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("forbidden"));
    }

    @Test
    void patientCanCreateAndUpdateOwnProfileButCannotSubstitutePatientId() throws Exception {
        AuthEntity patientA = seedPatientA();
        PatientEntity patientEntityA = patientRepository.findByAuthId(patientA.getId()).orElseThrow();
        seedPatientB();

        var created = mockMvc.perform(post("/api/v1/patient-profiles")
                        .with(jwtFor(patientA, patientEntityA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(profileRequest(PATIENT_A_ID, "Created Profile")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.patientId").value(PATIENT_A_ID))
                .andExpect(jsonPath("$.isPregnant").value(false))
                .andExpect(jsonPath("$.isDisabled").value(false))
                .andExpect(jsonPath("$.data").doesNotExist())
                .andReturn();
        String profileId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/patient-profiles")
                        .with(jwtFor(patientA, patientEntityA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(profileRequest(PATIENT_B_ID, "Wrong Owner")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("forbidden"));

        mockMvc.perform(patch("/api/patient-profiles/" + profileId)
                        .with(jwtFor(patientA, patientEntityA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "name", "Updated Profile",
                                "isPregnant", true,
                                "emergencyContact", Map.of("name", "Updated Contact", "phone", "0900000022")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Profile"))
                .andExpect(jsonPath("$.isPregnant").value(false))
                .andExpect(jsonPath("$.emergencyContact.name").value("Updated Contact"));

        PatientProfileEntity otherProfile = seedProfile("profile-b", PATIENT_B_ID, "Other Profile");
        mockMvc.perform(patch("/api/v1/patient-profiles/" + otherProfile.getId())
                        .with(jwtFor(patientA, patientEntityA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", "IDOR Attempt"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("forbidden"));
    }

    @Test
    void staffCanReadAndUpdateProfilesButUnsupportedRoleCannot() throws Exception {
        seedPatientA();
        PatientProfileEntity profileA = seedProfile("profile-a", PATIENT_A_ID, "Profile A");
        AuthEntity doctor = seedStaff(Role.DOCTOR);

        mockMvc.perform(get("/api/v1/patient-profiles").with(jwtFor(doctor, null)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(profileA.getId()));

        mockMvc.perform(patch("/api/patient-profiles/" + profileA.getId())
                        .with(jwtFor(doctor, null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("isPregnant", true, "isDisabled", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isPregnant").value(true))
                .andExpect(jsonPath("$.isDisabled").value(true));

        AuthEntity cashier = seedStaff(Role.CASHIER);
        mockMvc.perform(get("/api/patient-profiles/" + profileA.getId()).with(jwtFor(cashier, null)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("forbidden"));
    }

    @Test
    void missingProfileAndMissingBearerUseSharedErrorContract() throws Exception {
        AuthEntity patientA = seedPatientA();
        PatientEntity patientEntityA = patientRepository.findByAuthId(patientA.getId()).orElseThrow();

        mockMvc.perform(get("/api/v1/patient-profiles/missing")
                        .with(jwtFor(patientA, patientEntityA)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("not_found"));

        mockMvc.perform(get("/api/patient-profiles"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("unauthorized"));
    }

    private String profileRequest(String patientId, String name) throws Exception {
        return json(Map.of(
                "patientId", patientId,
                "name", name,
                "phone", "0900000020",
                "dateOfBirth", "1990-01-01",
                "gender", "female",
                "address", "Hanoi",
                "occupation", "Engineer",
                "emergencyContact", Map.of("name", "Contact", "phone", "0900000021"),
                "healthInsurance", "HI-002",
                "relationship", "parent"));
    }
}
