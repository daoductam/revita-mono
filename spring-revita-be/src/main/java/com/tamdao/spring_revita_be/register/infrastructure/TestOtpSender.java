package com.tamdao.spring_revita_be.register.infrastructure;

import com.tamdao.spring_revita_be.register.application.OtpSender;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile("test")
public class TestOtpSender implements OtpSender {

    private volatile String lastOtp;

    @Override
    public void send(String phone, String email, String otp) {
        lastOtp = otp;
    }

    public String getLastOtp() {
        return lastOtp;
    }
}
