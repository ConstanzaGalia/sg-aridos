CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_id INTEGER NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'transfer',
  notes TEXT,
  paid_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_id INTEGER,
  worksite_id INTEGER,
  category TEXT NOT NULL DEFAULT 'other',
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  expense_date TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_job_id_idx ON payments (job_id);
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments (user_id);
CREATE INDEX IF NOT EXISTS expenses_user_id_idx ON expenses (user_id);
