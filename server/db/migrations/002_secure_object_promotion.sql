ALTER TABLE upload_intents
  DROP CONSTRAINT upload_intents_status_check;

ALTER TABLE upload_intents
  ADD CONSTRAINT upload_intents_status_check
  CHECK (status IN ('pending', 'validating', 'completed', 'cancelled', 'expired'));

ALTER TABLE upload_intents
  ADD COLUMN validation_started_at timestamptz,
  ADD COLUMN file_id uuid REFERENCES files(id) ON UPDATE CASCADE ON DELETE SET NULL;

CREATE TABLE object_cleanup_jobs (
  storage_key text PRIMARY KEY CHECK (length(storage_key) BETWEEN 1 AND 512),
  reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 120),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX object_cleanup_jobs_due_idx
  ON object_cleanup_jobs (next_attempt_at, attempts);
