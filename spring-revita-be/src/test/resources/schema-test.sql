CREATE TABLE IF NOT EXISTS auths (
    id VARCHAR(64) PRIMARY KEY,
    phone VARCHAR(64),
    email VARCHAR(255),
    google_id VARCHAR(255),
    password VARCHAR(255),
    access_token VARCHAR(4096),
    refresh_token VARCHAR(4096),
    token_expiry TIMESTAMP WITH TIME ZONE,
    name VARCHAR(255) NOT NULL,
    date_of_birth TIMESTAMP WITH TIME ZONE NOT NULL,
    gender VARCHAR(32) NOT NULL,
    avatar VARCHAR(2048),
    address VARCHAR(1024) NOT NULL,
    citizen_id VARCHAR(32),
    role VARCHAR(32) NOT NULL,
    CONSTRAINT uq_auths_phone UNIQUE (phone),
    CONSTRAINT uq_auths_email UNIQUE (email),
    CONSTRAINT uq_auths_google_id UNIQUE (google_id),
    CONSTRAINT uq_auths_citizen_id UNIQUE (citizen_id)
);

CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(64) PRIMARY KEY,
    patient_code VARCHAR(64) NOT NULL,
    auth_id VARCHAR(64),
    loyalty_points INTEGER NOT NULL,
    CONSTRAINT uq_patients_auth_id UNIQUE (auth_id)
);

CREATE TABLE IF NOT EXISTS patient_profiles (
    id VARCHAR(64) PRIMARY KEY,
    profile_code VARCHAR(64) NOT NULL,
    patient_id VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(64),
    date_of_birth TIMESTAMP WITH TIME ZONE NOT NULL,
    gender VARCHAR(32) NOT NULL,
    address VARCHAR(1024),
    occupation VARCHAR(255),
    emergency_contact JSON NOT NULL,
    health_insurance VARCHAR(255),
    relationship VARCHAR(128),
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_pregnant BOOLEAN NOT NULL,
    is_disabled BOOLEAN NOT NULL
);

CREATE TABLE IF NOT EXISTS specialties (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS doctors (
    id VARCHAR(64) PRIMARY KEY,
    doctor_code VARCHAR(64) NOT NULL,
    auth_id VARCHAR(64) NOT NULL,
    years_experience INTEGER NOT NULL,
    rating DOUBLE NOT NULL,
    work_history VARCHAR(4096),
    description VARCHAR(4096),
    specialty_id VARCHAR(64),
    is_active BOOLEAN NOT NULL
);
