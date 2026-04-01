CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO customers (name, email, plan) VALUES
  ('Alice Chen',    'alice@acme.com',     'business'),
  ('Bob Martinez',  'bob@startup.io',     'starter'),
  ('Carol White',   'carol@bigcorp.com',  'enterprise'),
  ('Dan Kim',       'dan@devshop.dev',    'free'),
  ('Eve Davis',     'eve@agency.co',      'starter');
