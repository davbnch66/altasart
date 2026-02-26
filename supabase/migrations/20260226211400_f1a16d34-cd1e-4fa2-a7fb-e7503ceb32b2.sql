
-- Move pgcrypto extension from public to extensions schema
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION pgcrypto SET SCHEMA extensions;
