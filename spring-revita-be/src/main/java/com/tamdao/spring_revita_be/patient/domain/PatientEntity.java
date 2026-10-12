package com.tamdao.spring_revita_be.patient.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "patients")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PatientEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "patient_code", nullable = false)
    private String patientCode;

    @Column(name = "auth_id", unique = true)
    private String authId;

    @Column(name = "loyalty_points", nullable = false)
    private Integer loyaltyPoints;
}
