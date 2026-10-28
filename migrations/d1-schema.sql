-- Cloudflare D1 schema migration for nn-telegram-bot
-- Apply with: npx wrangler d1 execute nn-bot-db --remote --file=migrations/d1-schema.sql

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Viewer',
  totp_secret TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  csrf_token TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bots (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL,
  username TEXT NOT NULL,
  first_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  can_join_groups INTEGER NOT NULL DEFAULT 1,
  can_read_all_group_messages INTEGER NOT NULL DEFAULT 1,
  supports_inline_queries INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'OFFLINE',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'group',
  active INTEGER NOT NULL DEFAULT 1,
  is_admin INTEGER DEFAULT 0,
  permissions_verified INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  message_id INTEGER,
  from_id INTEGER,
  from_name TEXT NOT NULL,
  from_username TEXT,
  is_bot INTEGER NOT NULL DEFAULT 0,
  direction TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  reply_to_message_id INTEGER,
  reply_to_name TEXT,
  reply_to_text TEXT,
  media_type TEXT,
  media_file_id TEXT,
  media_mime TEXT,
  media_emoji TEXT,
  media_file_name TEXT,
  sticker_format TEXT,
  buttons_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_date ON chat_messages(chat_id, date);
CREATE INDEX IF NOT EXISTS idx_messages_message_id ON chat_messages(chat_id, message_id);

CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  media_url TEXT,
  parse_mode TEXT NOT NULL DEFAULT 'HTML',
  type TEXT NOT NULL DEFAULT 'daily',
  time TEXT NOT NULL,
  day_of_week INTEGER,
  day_of_month INTEGER,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  target_group_ids_json TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  last_executed_at TEXT,
  last_delivery_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_runs (
  id TEXT PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  scheduled_for TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  error TEXT
);

CREATE TABLE IF NOT EXISTS moderation_settings (
  chat_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  delete_links INTEGER NOT NULL DEFAULT 0,
  delete_stickers INTEGER NOT NULL DEFAULT 0,
  delete_files INTEGER NOT NULL DEFAULT 0,
  blocked_extensions_json TEXT DEFAULT '[]',
  blocked_keywords_json TEXT NOT NULL DEFAULT '[]',
  exempt_admins INTEGER NOT NULL DEFAULT 1,
  warn_limit INTEGER NOT NULL DEFAULT 3,
  mute_minutes INTEGER NOT NULL DEFAULT 60,
  rules_text TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS moderation_warnings (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  last_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_warnings_chat_user ON moderation_warnings(chat_id, user_id);

CREATE TABLE IF NOT EXISTS chat_members (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  first_name TEXT,
  last_name TEXT,
  username TEXT,
  is_bot INTEGER NOT NULL DEFAULT 0,
  status TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_chat_user ON chat_members(chat_id, user_id);

CREATE TABLE IF NOT EXISTS ai_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 0,
  reply_on_mention INTEGER NOT NULL DEFAULT 1,
  model TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
  system_prompt TEXT NOT NULL DEFAULT '',
  max_tokens INTEGER NOT NULL DEFAULT 800,
  api_key TEXT
);

CREATE TABLE IF NOT EXISTS menu_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  persistent_keyboard INTEGER NOT NULL DEFAULT 0,
  inline_menu_on_start INTEGER NOT NULL DEFAULT 1,
  chat_menu_button TEXT NOT NULL DEFAULT 'default',
  web_app_url TEXT,
  buttons_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_logs (
  id TEXT PRIMARY KEY,
  group_id INTEGER,
  chat_title TEXT NOT NULL,
  schedule_id INTEGER,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  sent_at TEXT NOT NULL,
  telegram_response_json TEXT
);

CREATE TABLE IF NOT EXISTS processed_updates (
  update_id INTEGER PRIMARY KEY,
  processed_at TEXT NOT NULL
);
