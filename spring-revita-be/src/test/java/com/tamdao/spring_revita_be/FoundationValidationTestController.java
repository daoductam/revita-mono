package com.tamdao.spring_revita_be;

import com.tamdao.spring_revita_be.common.error.BusinessException;
import com.tamdao.spring_revita_be.common.error.ErrorCode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/__foundation-test")
class FoundationValidationTestController {

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    ValidationPayload validate(@Valid @RequestBody ValidationPayload payload) {
        return payload;
    }

    @GetMapping("/business-conflict")
    void businessConflict() {
        throw new BusinessException(ErrorCode.CONFLICT, "A test conflict");
    }

    @GetMapping("/business-default")
    void businessDefault() {
        throw new BusinessException(ErrorCode.NOT_FOUND);
    }

    @GetMapping("/unexpected")
    void unexpected() {
        throw new IllegalStateException("database password must not be exposed");
    }

    @GetMapping("/legacy-not-found")
    void legacyNotFound() {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Legacy resource not found");
    }

    @GetMapping("/admin-only")
    @PreAuthorize("hasRole('ADMIN')")
    String adminOnly() {
        return "admin";
    }

    record ValidationPayload(@NotBlank String name) {
    }
}
