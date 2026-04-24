-- -------------------------------------------------
-- Masa & Community – PostgreSQL schema (prices in UGX)
-- -------------------------------------------------

-- Users
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,               -- bcrypt hash in production
    role          TEXT NOT NULL CHECK (role IN ('admin','seller','buyer')),
    store_id      UUID REFERENCES stores(id)   -- nullable; only for sellers
);

-- Stores (each seller can have one store)
CREATE TABLE stores (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    image_url   TEXT                               -- Base64 data URL or external URL
);

-- Listings (product / service / rental)
CREATE TYPE listing_type AS ENUM ('product','service','rental');

CREATE TABLE listings (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    price       INTEGER NOT NULL,                 -- stored as integer UGX
    type        listing_type NOT NULL,
    image_url   TEXT,                            -- Base64 data URL or external URL
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Orders
CREATE TYPE order_status AS ENUM ('pending','completed','canceled');

CREATE TABLE orders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    notes       TEXT,
    status      order_status NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Comments / Ratings
CREATE TABLE comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id  UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text        TEXT,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (listing_id, buyer_id)    -- one rating per buyer per listing
);

-- Carts (per user)
CREATE TABLE carts (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    items   JSONB NOT NULL DEFAULT '[]'   -- [{listing_id, quantity}]
);

-- Messages (WhatsApp‑style)
CREATE TABLE messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject     TEXT,
    body        TEXT NOT NULL,
    timestamp   TIMESTAMP WITH TIME ZONE DEFAULT now(),
    read        BOOLEAN NOT NULL DEFAULT FALSE
);

-- -------------------------------------------------
-- Seed admin user (plain password for demo; replace with hash in prod)
INSERT INTO users (id, username, password_hash, role)
VALUES
    (gen_random_uuid(), 'Masanso David', '0764411.Pet?', 'admin');

-- End of schema -------------------------------------------------
