-- UUID extension'ını aktif edelim (benzersiz ID'ler için)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users tablosu
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'USER')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    phone VARCHAR(20)
);

-- Investors tablosu
CREATE TABLE investors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Fields tablosu
CREATE TABLE fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Plants tablosu
CREATE TABLE plants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('GES', 'ÇGES', 'RES', 'HES', 'TES', 'BES', 'DGES')),
    investor_id UUID REFERENCES investors(id),
    field_id UUID REFERENCES fields(id),
    coordinates VARCHAR(100),
    status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE')),
    power VARCHAR(50),
    pv_module VARCHAR(100),
    inverter VARCHAR(100),
    installation_date DATE,
    depreciation_rate DECIMAL(5,2),
    iec104_asdu_address VARCHAR(100),
    wan_ip_address VARCHAR(50),
    local_ip_address VARCHAR(50),
    osos_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Gerçekleşen üretim verileri (günlük)
CREATE TABLE daily_productions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    type INTEGER NOT NULL DEFAULT 2 CHECK (type IN (1, 2)), -- 1: PVSyst beklenen, 2: Gerçekleşen
    production DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Aynı santral için aynı tarihte ve tipte tek bir veri olabilir
    UNIQUE(plant_id, date, type)
);

-- PVSyst rapor verileri (aylık)
CREATE TABLE pvsyst_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plant_id UUID REFERENCES plants(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    expected_production DECIMAL(12,2) NOT NULL,
    is_calculated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Aynı santral için aynı ay ve yıla ait tek bir PVSyst verisi olabilir
    UNIQUE(plant_id, year, month)
);

-- Work Orders tablosu
CREATE TABLE work_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    plant_id UUID REFERENCES plants(id),
    type VARCHAR(20) NOT NULL CHECK (type IN ('MAINTENANCE', 'FAULT', 'INSPECTION', 'OTHER')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Work Order Assignees (İş Emri - Kullanıcı ilişki tablosu)
CREATE TABLE work_order_assignees (
    work_order_id UUID REFERENCES work_orders(id),
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (work_order_id, user_id)
);

-- Activities tablosu
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    work_order_id UUID REFERENCES work_orders(id),
    description TEXT NOT NULL,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Activity Attachments tablosu
CREATE TABLE activity_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID REFERENCES activities(id),
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size BIGINT
);

-- Cascade silme işlemleri için foreign key güncellemeleri
ALTER TABLE work_order_assignees 
    ADD CONSTRAINT fk_work_order 
    FOREIGN KEY (work_order_id) 
    REFERENCES work_orders(id) 
    ON DELETE CASCADE;

ALTER TABLE activities 
    ADD CONSTRAINT fk_work_order 
    FOREIGN KEY (work_order_id) 
    REFERENCES work_orders(id) 
    ON DELETE CASCADE;

ALTER TABLE activity_attachments 
    ADD CONSTRAINT fk_activity 
    FOREIGN KEY (activity_id) 
    REFERENCES activities(id) 
    ON DELETE CASCADE;

-- Index'ler
CREATE INDEX idx_daily_productions_plant_date ON daily_productions(plant_id, date);
CREATE INDEX idx_daily_productions_plant_date_type ON daily_productions(plant_id, date, type);
CREATE INDEX idx_pvsyst_reports_plant_year_month ON pvsyst_reports(plant_id, year, month);
CREATE INDEX idx_pvsyst_reports_calculated ON pvsyst_reports(is_calculated);