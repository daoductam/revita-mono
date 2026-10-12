package com.tamdao.spring_revita_be.task006;

import com.tamdao.spring_revita_be.auth.domain.AuthEntity;
import com.tamdao.spring_revita_be.patient.domain.PatientEntity;
import com.tamdao.spring_revita_be.patientprofile.domain.PatientProfileEntity;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class Task006PersistenceTests extends Task006IntegrationTestSupport {

    @Test
    void legacyAuthAndPatientTablesRoundTripWithoutLosingIdentifiers() {
        AuthEntity auth = seedPatientA();

        AuthEntity persistedAuth = authRepository.findById(PATIENT_A_AUTH_ID).orElseThrow();
        PatientEntity persistedPatient = patientRepository.findByAuthId(PATIENT_A_AUTH_ID).orElseThrow();

        assertEquals(auth.getId(), persistedAuth.getId());
        assertEquals("patient-a@example.com", persistedAuth.getEmail());
        assertEquals("0900000001", persistedAuth.getPhone());
        assertEquals("PAT-A", persistedPatient.getPatientCode());
        assertEquals(PATIENT_A_ID, persistedPatient.getId());
    }

    @Test
    void patientProfileRoundTripsJsonAndLifecycleFields() {
        seedPatientA();
        PatientProfileEntity saved = seedProfile("profile-json", PATIENT_A_ID, "JSON Profile");

        PatientProfileEntity persisted = patientProfileRepository.findById(saved.getId()).orElseThrow();

        assertEquals("Contact", persisted.getEmergencyContact().get("name"));
        assertEquals("0900000011", persisted.getEmergencyContact().get("phone"));
        assertEquals(true, persisted.getActive());
        assertEquals(false, persisted.getPregnant());
        assertEquals(false, persisted.getDisabled());
        assertNotNull(persisted.getCreatedAt());
        assertNotNull(persisted.getUpdatedAt());
    }

    @Test
    void databaseUniqueConstraintsProtectLegacyIdentityFields() {
        seedPatientA();
        AuthEntity duplicate = AuthEntity.builder()
                .id("auth-duplicate")
                .email("patient-a@example.com")
                .phone("0900000098")
                .password(passwordEncoder.encode("password123"))
                .name("Duplicate")
                .dateOfBirth(java.time.Instant.parse("1991-01-01T00:00:00Z"))
                .gender("male")
                .address("Hanoi")
                .role(com.tamdao.spring_revita_be.auth.domain.Role.PATIENT)
                .build();

        assertThrows(DataIntegrityViolationException.class, () -> authRepository.saveAndFlush(duplicate));
    }
}
