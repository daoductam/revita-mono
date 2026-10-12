package com.tamdao.spring_revita_be.auth.api.dto;

public record PatientSummaryResponse(
        String id,
        String patientCode,
        Integer loyaltyPoints) {
}
