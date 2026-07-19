CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE
    CHECK (length(email) BETWEEN 3 AND 254 AND instr(email, '@') > 1),
  password_hash TEXT NOT NULL CHECK (length(password_hash) >= 32),
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'administrator')),
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 100),
  avatar_url TEXT,
  country TEXT,
  region TEXT,
  age INTEGER CHECK (age IS NULL OR age BETWEEN 6 AND 120),
  chinese_level TEXT,
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (length(token_hash) BETWEEN 43 AND 64),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at TEXT,
  user_agent TEXT,
  ip_address TEXT,
  CHECK (expires_at > created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE TABLE IF NOT EXISTS verification_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE
    CHECK (length(email) BETWEEN 3 AND 254 AND instr(email, '@') > 1),
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'reset_password', 'change_email')),
  code_hash TEXT NOT NULL CHECK (length(code_hash) = 64),
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (expires_at > created_at),
  CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  summary TEXT NOT NULL DEFAULT '' CHECK (length(summary) <= 500),
  description TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'beginner'
    CHECK (level IN ('beginner', 'elementary', 'intermediate', 'advanced', 'all')),
  category TEXT NOT NULL DEFAULT 'general' CHECK (length(category) BETWEEN 1 AND 80),
  cover_url TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 1 AND 1440),
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  capacity INTEGER NOT NULL DEFAULT 30 CHECK (capacity BETWEEN 1 AND 10000),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'published', 'rejected', 'archived')),
  rejection_reason TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (status = 'rejected' OR rejection_reason IS NULL),
  CHECK (status = 'published' OR published_at IS NULL)
);

CREATE TABLE IF NOT EXISTS course_reviews (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON UPDATE CASCADE ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  review_note TEXT NOT NULL DEFAULT '' CHECK (length(review_note) <= 2000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  teacher_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  course_id TEXT REFERENCES courses(id) ON UPDATE CASCADE ON DELETE SET NULL,
  scheduled_start TEXT NOT NULL,
  scheduled_end TEXT NOT NULL,
  topic TEXT NOT NULL CHECK (length(trim(topic)) BETWEEN 1 AND 160),
  message TEXT NOT NULL DEFAULT '' CHECK (length(message) <= 2000),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'completed')),
  response_note TEXT NOT NULL DEFAULT '' CHECK (length(response_note) <= 2000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (student_id <> teacher_id),
  CHECK (scheduled_end > scheduled_start)
);

CREATE TABLE IF NOT EXISTS classrooms (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL UNIQUE
    REFERENCES appointments(id) ON UPDATE CASCADE ON DELETE CASCADE,
  room_code TEXT NOT NULL UNIQUE CHECK (length(room_code) BETWEEN 6 AND 64),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'open', 'closed')),
  opened_at TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (closed_at IS NULL OR opened_at IS NOT NULL),
  CHECK (closed_at IS NULL OR closed_at >= opened_at)
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON UPDATE CASCADE ON DELETE CASCADE,
  teacher_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  instructions TEXT NOT NULL DEFAULT '',
  due_at TEXT,
  max_score REAL NOT NULL DEFAULT 100 CHECK (max_score > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (course_id, title)
);

CREATE TABLE IF NOT EXISTS assignment_questions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON UPDATE CASCADE ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  question_type TEXT NOT NULL CHECK (question_type IN ('single_choice', 'multiple_choice', 'text')),
  prompt TEXT NOT NULL CHECK (length(trim(prompt)) > 0),
  options_json TEXT,
  correct_answer_json TEXT,
  points REAL NOT NULL CHECK (points > 0),
  explanation TEXT NOT NULL DEFAULT '',
  UNIQUE (assignment_id, position),
  CHECK (question_type = 'text' OR options_json IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON UPDATE CASCADE ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  answers_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'graded')),
  submitted_at TEXT,
  score REAL CHECK (score IS NULL OR score >= 0),
  feedback TEXT NOT NULL DEFAULT '' CHECK (length(feedback) <= 5000),
  graded_by TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  graded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (assignment_id, student_id),
  CHECK (status = 'draft' OR submitted_at IS NOT NULL),
  CHECK (
    status <> 'graded'
    OR (score IS NOT NULL AND graded_by IS NOT NULL AND graded_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON UPDATE CASCADE ON DELETE CASCADE,
  sender_id TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'system', 'hand_raise')),
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  client_message_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  edited_at TEXT,
  deleted_at TEXT,
  CHECK (edited_at IS NULL OR edited_at >= created_at),
  CHECK (deleted_at IS NULL OR deleted_at >= created_at)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (length(type) BETWEEN 1 AND 80),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  body TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 4000),
  resource_type TEXT,
  resource_id TEXT,
  link TEXT,
  dedupe_key TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (read_at IS NULL OR read_at >= created_at)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (length(action) BETWEEN 1 AND 120),
  entity_type TEXT NOT NULL CHECK (length(entity_type) BETWEEN 1 AND 80),
  entity_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  request_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS users_role_status_idx
  ON users (role, status);

CREATE INDEX IF NOT EXISTS sessions_user_active_idx
  ON sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS sessions_expiry_idx
  ON sessions (expires_at);

CREATE INDEX IF NOT EXISTS verification_codes_lookup_idx
  ON verification_codes (email, purpose, created_at DESC)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS courses_teacher_status_idx
  ON courses (teacher_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS courses_catalog_idx
  ON courses (status, level, category, published_at DESC);

CREATE INDEX IF NOT EXISTS course_reviews_course_idx
  ON course_reviews (course_id, created_at DESC);

CREATE INDEX IF NOT EXISTS appointments_student_idx
  ON appointments (student_id, status, scheduled_start);

CREATE INDEX IF NOT EXISTS appointments_teacher_idx
  ON appointments (teacher_id, status, scheduled_start);

CREATE UNIQUE INDEX IF NOT EXISTS appointments_active_request_uq
  ON appointments (student_id, teacher_id, scheduled_start)
  WHERE status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS classrooms_status_idx
  ON classrooms (status, created_at DESC);

CREATE INDEX IF NOT EXISTS assignments_course_status_idx
  ON assignments (course_id, status, due_at);

CREATE INDEX IF NOT EXISTS assignments_teacher_status_idx
  ON assignments (teacher_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS submissions_assignment_status_idx
  ON submissions (assignment_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS submissions_student_status_idx
  ON submissions (student_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS chat_messages_history_idx
  ON chat_messages (classroom_id, created_at, id);

CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_client_dedupe_uq
  ON chat_messages (sender_id, client_message_id)
  WHERE sender_id IS NOT NULL AND client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_uq
  ON notifications (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx
  ON audit_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_entity_idx
  ON audit_logs (entity_type, entity_id, created_at DESC);
