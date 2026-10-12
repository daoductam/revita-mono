package com.tamdao.spring_revita_be.common.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String REQUEST_ID_HEADER = "X-Request-ID";
    public static final String CORRELATION_ID_HEADER = "X-Correlation-ID";
    public static final String REQUEST_ID_ATTRIBUTE = RequestIdFilter.class.getName() + ".requestId";
    public static final String CORRELATION_ID_ATTRIBUTE = RequestIdFilter.class.getName() + ".correlationId";
    private static final int MAX_ID_LENGTH = 128;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String requestId = safeId(request.getHeader(REQUEST_ID_HEADER));
        String correlationId = safeId(request.getHeader(CORRELATION_ID_HEADER));

        request.setAttribute(REQUEST_ID_ATTRIBUTE, requestId);
        request.setAttribute(CORRELATION_ID_ATTRIBUTE, correlationId);
        response.setHeader(REQUEST_ID_HEADER, requestId);
        response.setHeader(CORRELATION_ID_HEADER, correlationId);
        MDC.put("requestId", requestId);
        MDC.put("correlationId", correlationId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove("requestId");
            MDC.remove("correlationId");
        }
    }

    private String safeId(String candidate) {
        if (candidate != null
                && candidate.length() <= MAX_ID_LENGTH
                && candidate.matches("[A-Za-z0-9._:-]+")) {
            return candidate;
        }
        return UUID.randomUUID().toString();
    }

    public static String requestId(HttpServletRequest request) {
        Object requestAttribute = request.getAttribute(REQUEST_ID_ATTRIBUTE);
        return requestAttribute instanceof String value ? value : request.getHeader(REQUEST_ID_HEADER);
    }
}
