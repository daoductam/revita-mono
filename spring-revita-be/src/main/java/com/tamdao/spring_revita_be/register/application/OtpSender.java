package com.tamdao.spring_revita_be.register.application;

public interface OtpSender {

    void send(String phone, String email, String otp);
}
