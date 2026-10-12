package com.tamdao.spring_revita_be.register.api.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

public record RegisterStep1Request(
        @Size(max = 64) String phone,
        @Email @Size(max = 255) String email) {

    @AssertTrue(message = "At least one of phone or email is required")
    public boolean hasContact() {
        return (phone != null && !phone.isBlank()) || (email != null && !email.isBlank());
    }
}
