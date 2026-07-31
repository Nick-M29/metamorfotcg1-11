-- =============================================================================
-- MIGRACION INCREMENTAL: imagenes de TCGs, avatar de usuario
-- Ejecuta SOLO este archivo si tu base de datos ya existia antes de esta
-- funcionalidad (evita re-ejecutar schema.sql completo, que fallaria porque
-- las tablas ya existen). Es seguro ejecutarlo una sola vez.
-- =============================================================================

ALTER TABLE tcgs
    ADD COLUMN IF NOT EXISTS image_url VARCHAR(255);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);
