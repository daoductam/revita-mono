package com.tamdao.spring_revita_be.task006;

import com.tamdao.spring_revita_be.auth.domain.AuthEntity;
import com.tamdao.spring_revita_be.auth.domain.Role;
import com.tamdao.spring_revita_be.patient.domain.PatientEntity;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class Task006UserPatientContractTests extends Task006IntegrationTestSupport {

    @Test
    void doctorDirectoryIsPublicAndReturnsSafeProjectionWithSpecialtyFilter() throws Exception {
        AuthEntity doctor = seedStaff(Role.DOCTOR);
        jdbcTemplate.update("INSERT INTO specialties (id, name) VALUES (?, ?)", "specialty-1", "Dermatology");
        jdbcTemplate.update("""
                INSERT INTO doctors
                    (id, doctor_code, auth_id, years_experience, rating, work_history,
                     description, specialty_id, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, "doctor-1", "DR-001", doctor.getId(), 10, 4.8,
                "Hospital history", "Skin specialist", "specialty-1", true);

        mockMvc.perform(get("/api/v1/users/doctors").param("specialty", "dermat"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(STAFF_AUTH_ID))
                .andExpect(jsonPath("$[0].doctorCode").value("DR-001"))
                .andExpect(jsonPath("$[0].rating").value(4.8))
                .andExpect(jsonPath("$[0].password").doesNotExist())
                .andExpect(jsonPath("$.data").doesNotExist());

        mockMvc.perform(get("/api/users/doctors").param("specialty", "unknown"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void userMeUpdatesJwtSubjectOnlyAndReturnsRawUserResponse() throws Exception {
        AuthEntity patient = seedPatientA();
        PatientEntity patientEntity = patientRepository.findByAuthId(patient.getId()).orElseThrow();

        mockMvc.perform(put("/api/v1/users/me")
                        .with(jwtFor(patient, patientEntity))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of(
                                "name", "Updated Patient",
                                "address", "New Address",
                                "gender", "female"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(PATIENT_A_AUTH_ID))
                .andExpect(jsonPath("$.name").value("Updated Patient"))
                .andExpect(jsonPath("$.address").value("New Address"))
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.password").doesNotExist());

        AuthEntity persisted = authRepository.findById(PATIENT_A_AUTH_ID).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("Updated Patient", persisted.getName());
        org.junit.jupiter.api.Assertions.assertEquals("New Address", persisted.getAddress());
    }

    @Test
    void userMeRejectsDuplicateContactAndMissingBearer() throws Exception {
        AuthEntity patientA = seedPatientA();
        AuthEntity patientB = seedPatientB();
        PatientEntity patientEntityA = patientRepository.findByAuthId(patientA.getId()).orElseThrow();

        mockMvc.perform(put("/api/users/me")
                        .with(jwtFor(patientA, patientEntityA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("phone", "  " + patientB.getPhone() + "  "))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("conflict"));

        mockMvc.perform(put("/api/v1/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("unauthorized"));
    }

    @Test
    void patientMeUpdatesOwnPatientAndRejectsOtherRoles() throws Exception {
        AuthEntity patient = seedPatientA();
        AuthEntity otherPatient = seedPatientB();
        PatientEntity patientEntity = patientRepository.findByAuthId(patient.getId()).orElseThrow();

        mockMvc.perform(put("/api/patients/me")
                        .with(jwtFor(patient, patientEntity))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("name", "Patient Updated", "phone", "0900000990"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(PATIENT_A_ID))
                .andExpect(jsonPath("$.patientCode").value("PAT-A"))
                .andExpect(jsonPath("$.data").doesNotExist());

        mockMvc.perform(put("/api/v1/patients/me")
                        .with(jwtFor(patient, patientEntity))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("phone", "  " + otherPatient.getPhone() + "  "))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("conflict"));

        AuthEntity doctor = seedStaff(Role.DOCTOR);
        mockMvc.perform(put("/api/v1/patients/me")
                        .with(jwtFor(doctor, null))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("forbidden"));
    }
}
