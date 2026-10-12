package com.tamdao.spring_revita_be.register.infrastructure;

import com.tamdao.spring_revita_be.common.error.BusinessException;
import com.tamdao.spring_revita_be.common.error.ErrorCode;
import com.tamdao.spring_revita_be.register.application.OtpSender;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("!test")
public class UnconfiguredOtpSender implements OtpSender {

    @Override
    public void send(String phone, String email, String otp) {
        throw new BusinessException(
                ErrorCode.SERVICE_UNAVAILABLE,
                "OTP delivery provider is not configured");
    }
}
