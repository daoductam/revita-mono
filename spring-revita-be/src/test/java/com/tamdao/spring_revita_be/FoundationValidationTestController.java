package com.tamdao.spring_revita_be;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/__foundation-test")
class FoundationValidationTestController {

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    ValidationPayload validate(@Valid @RequestBody ValidationPayload payload) {
        return payload;
    }

    record ValidationPayload(@NotBlank String name) {
    }
}
