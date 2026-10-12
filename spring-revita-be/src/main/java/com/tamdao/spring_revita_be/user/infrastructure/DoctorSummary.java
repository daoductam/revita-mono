package com.tamdao.spring_revita_be.user.infrastructure;

public record DoctorSummary(
        String id,
        String name,
        String avatar,
        String doctorCode,
        Integer yearsExperience,
        Double rating,
        String workHistory,
        String description) {
}
