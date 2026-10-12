package com.tamdao.spring_revita_be.task006;

import com.tamdao.spring_revita_be.auth.domain.AuthEntity;
import com.tamdao.spring_revita_be.auth.domain.Role;
import com.tamdao.spring_revita_be.auth.infrastructure.AuthRepository;
import com.tamdao.spring_revita_be.patient.domain.PatientEntity;
import com.tamdao.spring_revita_be.patient.infrastructure.PatientRepository;
import com.tamdao.spring_revita_be.patientprofile.domain.PatientProfileEntity;
import com.tamdao.spring_revita_be.patientprofile.infrastructure.PatientProfileRepository;
import com.tamdao.spring_revita_be.register.infrastructure.TestOtpSender;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.filter.DelegatingFilterProxy;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import com.tamdao.spring_revita_be.common.web.RequestIdFilter;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

@SpringBootTest
@ActiveProfiles("test")
abstract class Task006IntegrationTestSupport {

    protected static final String PATIENT_A_AUTH_ID = "auth-patient-a";
    protected static final String PATIENT_A_ID = "patient-a";
    protected static final String PATIENT_B_AUTH_ID = "auth-patient-b";
    protected static final String PATIENT_B_ID = "patient-b";
    protected static final String STAFF_AUTH_ID = "auth-doctor";

    protected MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private RequestIdFilter requestIdFilter;

    @Autowired
    protected AuthRepository authRepository;

    @Autowired
    protected PatientRepository patientRepository;

    @Autowired
    protected PatientProfileRepository patientProfileRepository;

    @Autowired
    protected PasswordEncoder passwordEncoder;

    @Autowired
    protected TestOtpSender testOtpSender;

    @Autowired
    protected JdbcTemplate jdbcTemplate;

    @Autowired
    protected ObjectMapper objectMapper;

    @org.junit.jupiter.api.BeforeEach
    void resetTask006Database() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .addFilters(requestIdFilter, new DelegatingFilterProxy("springSecurityFilterChain", webApplicationContext))
                .build();
        jdbcTemplate.update("DELETE FROM patient_profiles");
        jdbcTemplate.update("DELETE FROM doctors");
        jdbcTemplate.update("DELETE FROM patients");
        jdbcTemplate.update("DELETE FROM auths");
        jdbcTemplate.update("DELETE FROM specialties");
        testOtpSender.send(null, null, null);
    }

    protected AuthEntity seedPatientA() {
        return seedPatient(PATIENT_A_AUTH_ID, PATIENT_A_ID, "patient-a@example.com", "0900000001", "PAT-A");
    }

    protected AuthEntity seedPatientB() {
        return seedPatient(PATIENT_B_AUTH_ID, PATIENT_B_ID, "patient-b@example.com", "0900000002", "PAT-B");
    }

    protected AuthEntity seedStaff(Role role) {
        AuthEntity auth = baseAuth(STAFF_AUTH_ID, "staff@example.com", "0900000099", "Staff User", role)
                .password(passwordEncoder.encode("password123"))
                .build();
        return authRepository.saveAndFlush(auth);
    }

    protected PatientProfileEntity seedProfile(String id, String patientId, String name) {
        Instant now = Instant.now().minus(1, ChronoUnit.DAYS);
        return patientProfileRepository.saveAndFlush(PatientProfileEntity.builder()
                .id(id)
                .profileCode("PP-" + id)
                .patientId(patientId)
                .name(name)
                .phone("0900000010")
                .dateOfBirth(Instant.parse("1990-01-01T00:00:00Z"))
                .gender("male")
                .address("Hanoi")
                .occupation("Engineer")
                .emergencyContact(Map.of("name", "Contact", "phone", "0900000011"))
                .healthInsurance("HI-001")
                .relationship("parent")
                .active(true)
                .createdAt(now)
                .updatedAt(now)
                .pregnant(false)
                .disabled(false)
                .build());
    }

    protected RequestPostProcessor jwtFor(AuthEntity auth, PatientEntity patient) {
        return jwtFor(auth.getId(), auth.getRole(), patient == null ? null : patient.getId());
    }

    protected RequestPostProcessor jwtFor(String userId, Role role, String patientId) {
        return jwt().jwt(token -> {
            token.subject(userId).claim("role", role.name());
            if (patientId != null) {
                token.claim("patient", Map.of("id", patientId, "patientCode", "PAT-" + patientId));
            }
        }).authorities(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    protected String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private AuthEntity seedPatient(
            String authId,
            String patientId,
            String email,
            String phone,
            String patientCode) {
        AuthEntity auth = baseAuth(authId, email, phone, "Patient " + patientCode, Role.PATIENT)
                .password(passwordEncoder.encode("password123"))
                .build();
        authRepository.saveAndFlush(auth);
        patientRepository.saveAndFlush(PatientEntity.builder()
                .id(patientId)
                .patientCode(patientCode)
                .authId(authId)
                .loyaltyPoints(100)
                .build());
        return auth;
    }

    private AuthEntity.AuthEntityBuilder baseAuth(
            String id,
            String email,
            String phone,
            String name,
            Role role) {
        return AuthEntity.builder()
                .id(id)
                .email(email)
                .phone(phone)
                .name(name)
                .dateOfBirth(Instant.parse("1990-01-01T00:00:00Z"))
                .gender("male")
                .address("Hanoi")
                .role(role);
    }
}
