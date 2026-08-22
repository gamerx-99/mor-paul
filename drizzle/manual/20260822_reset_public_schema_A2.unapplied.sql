-- DESTRUCTIVE — NOT EXECUTED
-- Target: Supabase project mor-paul (xjwzbwqtdlufflturird), schema public only.
-- Preconditions: owner has reviewed docs/supabase-reset-manifest-2026-08-22.md
-- and issued an explicit final confirmation immediately before execution.

BEGIN;

DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Restore the standard Supabase schema grants. Do not grant the anonymous or
-- authenticated API roles table privileges: the application uses its backend
-- database connection and server-enforced RBAC instead.
GRANT USAGE ON SCHEMA public TO postgres, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, service_role;

COMMIT;
