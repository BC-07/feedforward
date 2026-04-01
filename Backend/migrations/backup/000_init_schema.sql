-- Base schema for FeedForward (tables + default categories)

CREATE TABLE IF NOT EXISTS public.users (
  id VARCHAR(64) PRIMARY KEY,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admins (
  id VARCHAR(64) PRIMARY KEY,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  unit VARCHAR(120) NOT NULL,
  is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.feedbacks (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(60) NOT NULL,
  category VARCHAR(120) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(40) NOT NULL,
  priority VARCHAR(40) NOT NULL,
  user_id VARCHAR(64),
  user_name VARCHAR(255),
  user_email VARCHAR(255),
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  response TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id VARCHAR(64) PRIMARY KEY,
  role VARCHAR(20) NOT NULL,
  user_id VARCHAR(64),
  admin_id VARCHAR(64),
  superadmin_username VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  reauth_expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions (expires_at);

-- Default categories (schema-only defaults)
INSERT INTO public.categories (name) VALUES
  ('IT Unit'),
  ('Finance & Registrar Office'),
  ('Student Affair Office'),
  ('Guidance Office'),
  ('Faculty Office'),
  ('Disabled'),
  ('Inactive')
ON CONFLICT (name) DO NOTHING;
