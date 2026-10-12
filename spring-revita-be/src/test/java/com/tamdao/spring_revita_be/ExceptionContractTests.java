package com.tamdao.spring_revita_be;

import com.tamdao.spring_revita_be.common.error.ApiErrorResponse;
import com.tamdao.spring_revita_be.common.error.BusinessException;
import com.tamdao.spring_revita_be.common.error.ErrorCode;
import com.tamdao.spring_revita_be.common.web.RequestIdFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.filter.DelegatingFilterProxy;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
@Import(FoundationValidationTestController.class)
class ExceptionContractTests {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private RequestIdFilter requestIdFilter;

    private MockMvc mockMvc;

    @BeforeEach
    void setUpMockMvc() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .addFilters(requestIdFilter, new DelegatingFilterProxy("springSecurityFilterChain", webApplicationContext))
                .build();
    }

    @Test
    void everyFoundationErrorCodeHasStableContract() {
        assertErrorCode(ErrorCode.VALIDATION_ERROR, 400, "validation_error");
        assertErrorCode(ErrorCode.BAD_REQUEST, 400, "bad_request");
        assertErrorCode(ErrorCode.INVALID_REQUEST, 400, "invalid_request");
        assertErrorCode(ErrorCode.UNAUTHORIZED, 401, "unauthorized");
        assertErrorCode(ErrorCode.FORBIDDEN, 403, "forbidden");
        assertErrorCode(ErrorCode.NOT_FOUND, 404, "not_found");
        assertErrorCode(ErrorCode.CONFLICT, 409, "conflict");
        assertErrorCode(ErrorCode.UNPROCESSABLE_ENTITY, 422, "unprocessable_entity");
        assertErrorCode(ErrorCode.TOO_MANY_REQUESTS, 429, "too_many_requests");
        assertErrorCode(ErrorCode.INTERNAL_ERROR, 500, "internal_error");
        assertErrorCode(ErrorCode.SERVICE_UNAVAILABLE, 503, "service_unavailable");
    }

    @Test
    void businessExceptionUsesDefaultMessageAndImmutableDetails() {
        ApiErrorResponse.ErrorDetail detail = new ApiErrorResponse.ErrorDetail(
                "email", "Email is already used", "already_exists");
        BusinessException exception = new BusinessException(ErrorCode.CONFLICT, List.of(detail));

        assertEquals(ErrorCode.CONFLICT, exception.getErrorCode());
        assertEquals(ErrorCode.CONFLICT.defaultMessage(), exception.getMessage());
        assertIterableEquals(List.of(detail), exception.getDetails());
        assertThrows(UnsupportedOperationException.class, () -> exception.getDetails().add(detail));
    }

    @Test
    void businessExceptionPreservesSafeMessageAndCause() {
        Throwable cause = new IllegalStateException("internal cause");
        BusinessException exception = new BusinessException(ErrorCode.CONFLICT, "Email already exists", cause);

        assertEquals("Email already exists", exception.getMessage());
        assertEquals(cause, exception.getCause());
    }

    @Test
    void businessExceptionRejectsNullCodeImmediately() {
        assertThrows(IllegalArgumentException.class, () -> new BusinessException(null));
    }

    @Test
    void businessConflictUsesStableEnvelopeAndGeneratedRequestId() throws Exception {
        mockMvc.perform(get("/__foundation-test/business-conflict"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("conflict"))
                .andExpect(jsonPath("$.error.message").value("A test conflict"))
                .andExpect(jsonPath("$.error.details").isArray())
                .andExpect(jsonPath("$.error.requestId").isNotEmpty())
                .andExpect(header().exists(RequestIdFilter.REQUEST_ID_HEADER));
    }

    @Test
    void businessExceptionUsesDefaultMessageWhenNoOverrideExists() throws Exception {
        mockMvc.perform(get("/__foundation-test/business-default"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("not_found"))
                .andExpect(jsonPath("$.error.message").value("Resource not found"));
    }

    @Test
    void unexpectedExceptionIsSanitized() throws Exception {
        mockMvc.perform(get("/__foundation-test/unexpected"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error.code").value("internal_error"))
                .andExpect(jsonPath("$.error.message").value("An unexpected error occurred"))
                .andExpect(content().string(not(containsString("database password"))))
                .andExpect(jsonPath("$.error.requestId").isNotEmpty());
    }

    @Test
    void legacyResponseStatusExceptionRemainsCompatible() throws Exception {
        mockMvc.perform(get("/__foundation-test/legacy-not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("not_found"))
                .andExpect(jsonPath("$.error.message").value("Legacy resource not found"));
    }

    @Test
    void unknownRouteUsesNotFoundContract() throws Exception {
        mockMvc.perform(get("/__foundation-test/missing-route"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("not_found"));
    }

    @Test
    void forbiddenResponseUsesSharedErrorCode() throws Exception {
        mockMvc.perform(get("/__foundation-test/admin-only").with(user("staff").roles("STAFF")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("forbidden"))
                .andExpect(jsonPath("$.error.message").value("You are not allowed to access this resource"))
                .andExpect(jsonPath("$.error.requestId").isNotEmpty());
    }

    @Test
    void invalidJsonUsesInvalidRequestCode() throws Exception {
        mockMvc.perform(post("/__foundation-test")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_request"));
    }

    private void assertErrorCode(ErrorCode errorCode, int status, String code) {
        assertEquals(status, errorCode.httpStatus().value());
        assertEquals(code, errorCode.code());
        assertTrue(errorCode.defaultMessage() != null && !errorCode.defaultMessage().isBlank());
    }
}
