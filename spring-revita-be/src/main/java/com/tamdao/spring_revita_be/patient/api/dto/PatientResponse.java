package com.tamdao.spring_revita_be.patient.api.dto;

public record PatientResponse(
        String id,
        String patientCode,
        Integer loyaltyPoints) {
}
