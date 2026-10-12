package com.tamdao.spring_revita_be;

import com.tamdao.spring_revita_be.config.AppSecurityProperties;
import com.tamdao.spring_revita_be.common.web.RequestIdFilter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.filter.DelegatingFilterProxy;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
@Import(FoundationValidationTestController.class)
class SpringRevitaBeApplicationTests {

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
	void contextLoads() {
	}

	@Test
	void healthEndpointIsPublicAndCarriesRequestId() throws Exception {
		mockMvc.perform(get("/actuator/health").header("X-Request-ID", "foundation-test"))
				.andExpect(status().isOk())
				.andExpect(header().string("X-Request-ID", "foundation-test"))
				.andExpect(header().exists("X-Correlation-ID"))
				.andExpect(jsonPath("$.status").value("UP"));
	}

	@Test
	void versionedBusinessPathRequiresBearerToken() throws Exception {
		mockMvc.perform(get("/api/v1/not-implemented"))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.error.code").value("unauthorized"))
				.andExpect(jsonPath("$.success").value(false))
				.andExpect(jsonPath("$.data").doesNotExist())
				.andExpect(jsonPath("$.meta.requestId").isNotEmpty())
				.andExpect(header().exists("X-Request-ID"));
	}

	@Test
	void validationFailureUsesStableErrorContract() throws Exception {
		mockMvc.perform(post("/__foundation-test")
					.contentType(MediaType.APPLICATION_JSON)
					.content("{\"name\":\"\"}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.error.code").value("validation_error"))
				.andExpect(jsonPath("$.error.details[0].field").value("name"))
				.andExpect(header().exists("X-Request-ID"));
	}

	@Test
	void openApiIsPublicWithoutExposingSecretOrEnvironment() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.info.version").value("v1"))
				.andExpect(content().string(not(containsString("test-only-secret"))))
				.andExpect(content().string(not(containsString("JWT_SECRET"))));
	}

	@Test
	void jwtSecretMustBeExplicitAndStrongEnough() {
		AppSecurityProperties properties = new AppSecurityProperties();
		properties.setJwtSecret("short");

		assertThrows(IllegalStateException.class, properties::requireJwtSecret);
	}

}
