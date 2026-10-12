package com.tamdao.spring_revita_be.common.error;

import com.tamdao.spring_revita_be.common.web.RequestIdFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiErrorResponse> handleBusinessException(
            BusinessException exception,
            HttpServletRequest request) {
        return response(
                exception.getErrorCode(),
                exception.getMessage(),
                exception.getDetails(),
                request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleMethodArgumentNotValid(
            MethodArgumentNotValidException exception,
            HttpServletRequest request) {
        List<ApiErrorResponse.ErrorDetail> details = exception.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(error -> new ApiErrorResponse.ErrorDetail(
                        error.getField(),
                        error.getDefaultMessage(),
                        error.getCode()))
                .toList();
        return response(ErrorCode.VALIDATION_ERROR, null, details, request);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleConstraintViolation(
            ConstraintViolationException exception,
            HttpServletRequest request) {
        List<ApiErrorResponse.ErrorDetail> details = exception.getConstraintViolations()
                .stream()
                .map(violation -> new ApiErrorResponse.ErrorDetail(
                        violation.getPropertyPath().toString(),
                        violation.getMessage(),
                        "constraint_violation"))
                .toList();
        return response(ErrorCode.VALIDATION_ERROR, null, details, request);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleUnreadableMessage(
            HttpMessageNotReadableException exception,
            HttpServletRequest request) {
        return response(ErrorCode.INVALID_REQUEST, null, List.of(), request);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNotFound(
            NoResourceFoundException exception,
            HttpServletRequest request) {
        return response(ErrorCode.NOT_FOUND, null, List.of(), request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(
            AccessDeniedException exception,
            HttpServletRequest request) {
        return response(ErrorCode.FORBIDDEN, null, List.of(), request);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiErrorResponse> handleResponseStatus(
            ResponseStatusException exception,
            HttpServletRequest request) {
        HttpStatus status = HttpStatus.resolve(exception.getStatusCode().value());
        HttpStatus resolvedStatus = status == null ? HttpStatus.INTERNAL_SERVER_ERROR : status;
        ErrorCode errorCode = compatibilityCode(resolvedStatus);
        String message = resolvedStatus.is5xxServerError()
                ? null
                : exception.getReason();
        return response(resolvedStatus, errorCode, message, List.of(), request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(
            Exception exception,
            HttpServletRequest request) {
        String requestId = requestId(request);
        log.error("Unhandled API exception requestId={} path={}", requestId, request.getRequestURI(), exception);
        return response(ErrorCode.INTERNAL_ERROR, null, List.of(), request);
    }

    private ResponseEntity<ApiErrorResponse> response(
            ErrorCode errorCode,
            String message,
            List<ApiErrorResponse.ErrorDetail> details,
            HttpServletRequest request) {
        return response(errorCode.httpStatus(), errorCode, message, details, request);
    }

    private ResponseEntity<ApiErrorResponse> response(
            HttpStatus status,
            ErrorCode errorCode,
            String message,
            List<ApiErrorResponse.ErrorDetail> details,
            HttpServletRequest request) {
        return ResponseEntity.status(status)
                .body(ApiErrorResponse.of(errorCode, message, details, requestId(request)));
    }

    private String requestId(HttpServletRequest request) {
        return RequestIdFilter.requestId(request);
    }

    private ErrorCode compatibilityCode(HttpStatus status) {
        return switch (status) {
            case BAD_REQUEST -> ErrorCode.BAD_REQUEST;
            case UNAUTHORIZED -> ErrorCode.UNAUTHORIZED;
            case FORBIDDEN -> ErrorCode.FORBIDDEN;
            case NOT_FOUND -> ErrorCode.NOT_FOUND;
            case CONFLICT -> ErrorCode.CONFLICT;
            case UNPROCESSABLE_ENTITY -> ErrorCode.UNPROCESSABLE_ENTITY;
            case TOO_MANY_REQUESTS -> ErrorCode.TOO_MANY_REQUESTS;
            case SERVICE_UNAVAILABLE -> ErrorCode.SERVICE_UNAVAILABLE;
            default -> status.is4xxClientError() ? ErrorCode.BAD_REQUEST : ErrorCode.INTERNAL_ERROR;
        };
    }
}
