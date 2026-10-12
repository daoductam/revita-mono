package com.tamdao.spring_revita_be.common.api;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

@Component
public class ApiVersionResolver {

    public boolean isV1(HttpServletRequest request) {
        String contextPath = request.getContextPath();
        String requestUri = request.getRequestURI();
        String v1Path = contextPath + ApiPaths.V1;
        return requestUri.equals(v1Path) || requestUri.startsWith(v1Path + "/");
    }
}
