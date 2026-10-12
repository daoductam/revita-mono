package com.tamdao.spring_revita_be.patientprofile.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "patient_profiles")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PatientProfileEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "profile_code", nullable = false)
    private String profileCode;

    @Column(name = "patient_id")
    private String patientId;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "phone")
    private String phone;

    @Column(name = "date_of_birth", nullable = false)
    private Instant dateOfBirth;

    @Column(name = "gender", nullable = false)
    private String gender;

    @Column(name = "address")
    private String address;

    @Column(name = "occupation")
    private String occupation;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "emergency_contact", nullable = false)
    private Map<String, Object> emergencyContact;

    @Column(name = "health_insurance")
    private String healthInsurance;

    @Column(name = "relationship")
    private String relationship;

    @Column(name = "is_active", nullable = false)
    private Boolean active;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "is_pregnant", nullable = false)
    private Boolean pregnant;

    @Column(name = "is_disabled", nullable = false)
    private Boolean disabled;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (active == null) {
            active = true;
        }
        if (pregnant == null) {
            pregnant = false;
        }
        if (disabled == null) {
            disabled = false;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
