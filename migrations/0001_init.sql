-- =====================================================================
-- wrong-question-book 初始化 schema
-- 执行: npx wrangler d1 migrations apply wrong-question-book-db --local
-- =====================================================================

-- 0001_init.sql: 初始 schema

-- 分类表
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3b82f6',
  created_at TEXT DEFAULT (datetime('now'))
);

-- 错题表
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  answer TEXT,
  explanation TEXT,
  category_id INTEGER,
  tags TEXT,
  image_url TEXT,
  difficulty INTEGER DEFAULT 3,
  review_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  next_review_at TEXT,
  last_reviewed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category_id);
CREATE INDEX IF NOT EXISTS idx_questions_next_review ON questions(next_review_at);
CREATE INDEX IF NOT EXISTS idx_questions_tags ON questions(tags);

-- 复习记录表（用于历史追踪）
CREATE TABLE IF NOT EXISTS review_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  result TEXT NOT NULL,           -- 'correct' or 'wrong'
  reviewed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_review_logs_question ON review_logs(question_id);
CREATE INDEX IF NOT EXISTS idx_review_logs_date ON review_logs(reviewed_at);
