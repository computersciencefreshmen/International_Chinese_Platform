CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email citext NOT NULL UNIQUE CHECK (length(email::text) BETWEEN 3 AND 254 AND position('@' IN email::text) > 1),
  password_hash text NOT NULL CHECK (length(password_hash) >= 32),
  role text NOT NULL CHECK (role IN ('student', 'teacher', 'administrator')),
  display_name text NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 100),
  avatar_url text,
  country text,
  region text,
  age integer CHECK (age IS NULL OR age BETWEEN 6 AND 120),
  chinese_level text,
  bio text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  must_reset_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE teacher_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  school text NOT NULL DEFAULT '' CHECK (length(school) <= 160),
  title text NOT NULL DEFAULT '' CHECK (length(title) <= 120),
  experience_years integer NOT NULL DEFAULT 0 CHECK (experience_years BETWEEN 0 AND 80),
  rating double precision NOT NULL DEFAULT 5 CHECK (rating BETWEEN 0 AND 5),
  hourly_rate_cents integer NOT NULL DEFAULT 0 CHECK (hourly_rate_cents >= 0),
  specialties_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  certificates_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  teaching_style_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  languages_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE CHECK (length(token_hash) BETWEEN 43 AND 64),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  user_agent text,
  ip_address text,
  CHECK (expires_at > created_at),
  CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE TABLE verification_codes (
  id uuid PRIMARY KEY,
  email citext NOT NULL CHECK (length(email::text) BETWEEN 3 AND 254 AND position('@' IN email::text) > 1),
  purpose text NOT NULL CHECK (purpose IN ('register', 'reset_password', 'change_email')),
  code_hash text NOT NULL CHECK (length(code_hash) = 64),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE TABLE courses (
  id uuid PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  summary text NOT NULL DEFAULT '' CHECK (length(summary) <= 500),
  description text NOT NULL DEFAULT '',
  level text NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner', 'elementary', 'intermediate', 'advanced', 'all')),
  category text NOT NULL DEFAULT 'general' CHECK (length(category) BETWEEN 1 AND 80),
  cover_url text,
  duration_minutes integer NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 1 AND 1440),
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  capacity integer NOT NULL DEFAULT 30 CHECK (capacity BETWEEN 1 AND 10000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'rejected', 'archived')),
  rejection_reason text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status = 'rejected' OR rejection_reason IS NULL),
  CHECK (status = 'published' OR published_at IS NULL)
);

CREATE TABLE course_reviews (
  id uuid PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES courses(id) ON UPDATE CASCADE ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  review_note text NOT NULL DEFAULT '' CHECK (length(review_note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE appointments (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  teacher_id uuid NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  course_id uuid REFERENCES courses(id) ON UPDATE CASCADE ON DELETE SET NULL,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  topic text NOT NULL CHECK (length(trim(topic)) BETWEEN 1 AND 160),
  message text NOT NULL DEFAULT '' CHECK (length(message) <= 2000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'completed')),
  response_note text NOT NULL DEFAULT '' CHECK (length(response_note) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (student_id <> teacher_id),
  CHECK (scheduled_end > scheduled_start)
);

CREATE TABLE classrooms (
  id uuid PRIMARY KEY,
  appointment_id uuid NOT NULL UNIQUE REFERENCES appointments(id) ON UPDATE CASCADE ON DELETE CASCADE,
  room_code text NOT NULL UNIQUE CHECK (length(room_code) BETWEEN 6 AND 64),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'open', 'closed')),
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (closed_at IS NULL OR opened_at IS NOT NULL),
  CHECK (closed_at IS NULL OR closed_at >= opened_at)
);

CREATE TABLE assignments (
  id uuid PRIMARY KEY,
  course_id uuid NOT NULL REFERENCES courses(id) ON UPDATE CASCADE ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  instructions text NOT NULL DEFAULT '',
  due_at timestamptz,
  max_score double precision NOT NULL DEFAULT 100 CHECK (max_score > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, title)
);

CREATE TABLE assignment_questions (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON UPDATE CASCADE ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  question_type text NOT NULL CHECK (question_type IN ('single_choice', 'multiple_choice', 'text')),
  prompt text NOT NULL CHECK (length(trim(prompt)) > 0),
  options_json jsonb,
  correct_answer_json jsonb,
  points double precision NOT NULL CHECK (points > 0),
  explanation text NOT NULL DEFAULT '',
  UNIQUE (assignment_id, position),
  CHECK (question_type = 'text' OR options_json IS NOT NULL)
);

CREATE TABLE submissions (
  id uuid PRIMARY KEY,
  assignment_id uuid NOT NULL REFERENCES assignments(id) ON UPDATE CASCADE ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  answers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'graded')),
  submitted_at timestamptz,
  score double precision CHECK (score IS NULL OR score >= 0),
  feedback text NOT NULL DEFAULT '' CHECK (length(feedback) <= 5000),
  graded_by uuid REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  graded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id),
  CHECK (status = 'draft' OR submitted_at IS NOT NULL),
  CHECK (status <> 'graded' OR (score IS NOT NULL AND graded_by IS NOT NULL AND graded_at IS NOT NULL))
);

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY,
  classroom_id uuid NOT NULL REFERENCES classrooms(id) ON UPDATE CASCADE ON DELETE CASCADE,
  sender_id uuid REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'hand_raise')),
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 4000),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  CHECK (edited_at IS NULL OR edited_at >= created_at),
  CHECK (deleted_at IS NULL OR deleted_at >= created_at)
);

CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  type text NOT NULL CHECK (length(type) BETWEEN 1 AND 80),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  body text NOT NULL DEFAULT '' CHECK (length(body) <= 4000),
  resource_type text,
  resource_id uuid,
  link text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (read_at IS NULL OR read_at >= created_at)
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY,
  actor_id uuid REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  action text NOT NULL CHECK (length(action) BETWEEN 1 AND 120),
  entity_type text NOT NULL CHECK (length(entity_type) BETWEEN 1 AND 80),
  entity_id uuid,
  details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE files (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE CHECK (length(storage_key) BETWEEN 1 AND 512),
  original_name text NOT NULL CHECK (length(original_name) BETWEEN 1 AND 255),
  mime_type text NOT NULL CHECK (length(mime_type) BETWEEN 1 AND 120),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 52428800),
  sha256 text NOT NULL CHECK (length(sha256) = 64),
  category text NOT NULL CHECK (category IN ('avatar', 'course_cover', 'course_video', 'course_material')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE upload_intents (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  storage_key text NOT NULL UNIQUE CHECK (length(storage_key) BETWEEN 1 AND 512),
  original_name text NOT NULL CHECK (length(original_name) BETWEEN 1 AND 255),
  declared_mime_type text NOT NULL,
  declared_size_bytes bigint NOT NULL CHECK (declared_size_bytes BETWEEN 1 AND 52428800),
  category text NOT NULL CHECK (category IN ('avatar', 'course_cover', 'course_video', 'course_material')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE TABLE dialogue_sessions (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  keywords_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider text NOT NULL DEFAULT 'local',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dialogue_turns (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES dialogue_sessions(id) ON UPDATE CASCADE ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  speaker text NOT NULL CHECK (speaker IN ('student', 'tutor', 'system')),
  content text NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, position)
);

CREATE INDEX users_role_status_idx ON users (role, status);
CREATE INDEX teacher_profiles_discovery_idx ON teacher_profiles (rating DESC, experience_years DESC);
CREATE INDEX sessions_user_active_idx ON sessions (user_id, expires_at) WHERE revoked_at IS NULL;
CREATE INDEX sessions_expiry_idx ON sessions (expires_at);
CREATE INDEX verification_codes_lookup_idx ON verification_codes (email, purpose, created_at DESC) WHERE consumed_at IS NULL;
CREATE INDEX courses_teacher_status_idx ON courses (teacher_id, status, updated_at DESC);
CREATE INDEX courses_catalog_idx ON courses (status, level, category, published_at DESC);
CREATE INDEX course_reviews_course_idx ON course_reviews (course_id, created_at DESC);
CREATE INDEX appointments_student_idx ON appointments (student_id, status, scheduled_start);
CREATE INDEX appointments_teacher_idx ON appointments (teacher_id, status, scheduled_start);
CREATE UNIQUE INDEX appointments_active_request_uq ON appointments (student_id, teacher_id, scheduled_start) WHERE status IN ('pending', 'accepted');
CREATE INDEX classrooms_status_idx ON classrooms (status, created_at DESC);
CREATE INDEX assignments_course_status_idx ON assignments (course_id, status, due_at);
CREATE INDEX assignments_teacher_status_idx ON assignments (teacher_id, status, updated_at DESC);
CREATE INDEX submissions_assignment_status_idx ON submissions (assignment_id, status, submitted_at DESC);
CREATE INDEX submissions_student_status_idx ON submissions (student_id, status, updated_at DESC);
CREATE INDEX chat_messages_history_idx ON chat_messages (classroom_id, created_at, id);
CREATE UNIQUE INDEX chat_messages_client_dedupe_uq ON chat_messages (sender_id, client_message_id) WHERE sender_id IS NOT NULL AND client_message_id IS NOT NULL;
CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;
CREATE UNIQUE INDEX notifications_dedupe_uq ON notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX audit_logs_actor_created_idx ON audit_logs (actor_id, created_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX files_owner_created_idx ON files (owner_id, created_at DESC);
CREATE INDEX upload_intents_owner_status_idx ON upload_intents (owner_id, status, expires_at);
CREATE INDEX dialogue_sessions_student_updated_idx ON dialogue_sessions (student_id, updated_at DESC);
CREATE INDEX dialogue_turns_session_position_idx ON dialogue_turns (session_id, position);
