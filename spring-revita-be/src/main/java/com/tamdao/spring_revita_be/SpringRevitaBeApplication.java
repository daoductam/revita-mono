package com.tamdao.spring_revita_be;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class SpringRevitaBeApplication {

	public static void main(String[] args) {
		SpringApplication.run(SpringRevitaBeApplication.class, args);
	}

}
