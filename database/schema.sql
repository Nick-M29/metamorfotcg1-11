-- =============================================================================
-- ESQUEMA BASE (proporcionado por el usuario)
-- =============================================================================

CREATE TYPE user_role AS ENUM ('client', 'admin');

CREATE TABLE tcgs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,

    role user_role DEFAULT 'client',
    is_buyer BOOLEAN DEFAULT FALSE,

    invitation_code VARCHAR(10) NOT NULL UNIQUE,
    referred_by INT REFERENCES users(id) ON DELETE SET NULL,
    referral_count INT DEFAULT 0 CHECK (referral_count >= 0),

    xp INT DEFAULT 0 CHECK (xp >= 0),
    xp_historical INT DEFAULT 0 CHECK (xp_historical >= 0),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    date_realization TIMESTAMP NOT NULL,

    max_players INT NOT NULL CHECK (max_players > 0),
    participation_xp INT NOT NULL DEFAULT 0 CHECK (participation_xp >= 0),
    winner_xp INT NOT NULL DEFAULT 0 CHECK (winner_xp >= 0),

    created_by INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reward_products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    tcg_id INT NOT NULL REFERENCES tcgs(id) ON DELETE RESTRICT,
    expansion_set VARCHAR(100),
    rarity VARCHAR(50),

    price_xp INT NOT NULL CHECK (price_xp > 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url VARCHAR(255),

    is_active BOOLEAN DEFAULT TRUE,
    created_by INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_tcgs (
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    tcg_id INT REFERENCES tcgs(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, tcg_id)
);

CREATE TABLE event_attendees (
    event_id INT REFERENCES events(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    is_winner BOOLEAN DEFAULT FALSE,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id, user_id)
);

CREATE TABLE reward_orders (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_xp_spent INT NOT NULL CHECK (total_xp_spent > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE reward_order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES reward_orders(id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES reward_products(id) ON DELETE RESTRICT,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    xp_at_claim INT NOT NULL
);

CREATE INDEX idx_users_invitation_code ON users(invitation_code);
CREATE INDEX idx_events_date ON events(date_realization);
CREATE INDEX idx_reward_products_name ON reward_products(name);

-- =============================================================================
-- EXTENSIONES NECESARIAS PARA LA LOGICA DE XP DE EVENTOS
-- (asunciones explicadas en el README: penalizaciones por no asistir / perder,
--  y bandera para no procesar el XP de un evento dos veces)
-- =============================================================================

ALTER TABLE events
    ADD COLUMN loser_xp INT NOT NULL DEFAULT 0 CHECK (loser_xp >= 0),      -- XP que se resta a quien asiste y no gana
    ADD COLUMN no_show_xp INT NOT NULL DEFAULT 0 CHECK (no_show_xp >= 0),  -- XP que se resta a quien se inscribe y no asiste
    ADD COLUMN finalized BOOLEAN NOT NULL DEFAULT FALSE;                  -- evita recalcular el XP dos veces

ALTER TABLE event_attendees
    ADD COLUMN attended BOOLEAN DEFAULT NULL; -- NULL = aun no resuelto, TRUE/FALSE tras finalizar el evento

-- =============================================================================
-- BONUS DE REFERIDOS
-- Si un usuario referido consigue XP dentro de su primer mes desde el registro,
-- el usuario que lo invito recibe +1 XP de forma permanente (una sola vez por referido).
-- Este flag evita pagar el bono mas de una vez y marca tambien cuando la ventana
-- de 1 mes expira sin que el referido consiguiera XP (en ese caso no se paga nunca).
-- =============================================================================
ALTER TABLE users
    ADD COLUMN referral_bonus_paid BOOLEAN NOT NULL DEFAULT FALSE;

-- =============================================================================
-- IMAGENES (TCGs, avatar de usuario) Y OTORGAMIENTO MANUAL DE XP POR COMPRA
-- =============================================================================
ALTER TABLE tcgs
    ADD COLUMN image_url VARCHAR(255); -- imagen que se muestra al elegir TCGs favoritos

ALTER TABLE users
    ADD COLUMN avatar_url VARCHAR(255); -- foto de perfil subida por el usuario
