package com.tamdao.spring_revita_be.user.api.dto;

public record DoctorSummaryResponse(
        String id,
        String name,
        String avatar,
        String doctorCode,
        Integer yearsExperience,
        Double rating,
        String workHistory,
        String description) {
}
