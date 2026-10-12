package com.tamdao.spring_revita_be.register.application;

import org.springframework.stereotype.Component;

import java.time.ZonedDateTime;
import java.util.Locale;

@Component
public class LegacyCodeGenerator {

    public String generatePatientCode(String name, String gender) {
        ZonedDateTime now = ZonedDateTime.now();
        String timestamp = String.format(
                Locale.ROOT,
                "%02d%02d%02d%02d%02d%02d",
                now.getYear() % 100,
                now.getMonthValue(),
                now.getDayOfMonth(),
                now.getHour(),
                now.getMinute(),
                now.getSecond());
        return "PAT" + timestamp + genderCode(gender) + nameInitial(name);
    }

    public String generateProfileCode(String name, String gender) {
        ZonedDateTime now = ZonedDateTime.now();
        String timestamp = String.format(
                Locale.ROOT,
                "%02d%02d%02d%02d%02d%02d",
                now.getYear() % 100,
                now.getMonthValue(),
                now.getDayOfMonth(),
                now.getHour(),
                now.getMinute(),
                now.getSecond());
        return "PP" + timestamp + genderCode(gender) + nameInitial(name);
    }

    private String genderCode(String gender) {
        String value = gender == null ? "" : gender.toLowerCase(Locale.ROOT);
        if (value.contains("female") || value.contains("nữ") || value.equals("f")) {
            return "F";
        }
        if (value.contains("male") || value.contains("nam") || value.equals("m")) {
            return "M";
        }
        return "O";
    }

    private String nameInitial(String name) {
        if (name == null || name.isBlank()) {
            return "X";
        }
        char initial = Character.toUpperCase(name.trim().charAt(0));
        return initial >= 'A' && initial <= 'Z'
                ? Integer.toString(initial - 'A' + 1)
                : "X";
    }
}
