CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  source_folder TEXT,
  filename TEXT NOT NULL,
  content_type TEXT,
  bytes INTEGER,
  uploaded_at TEXT NOT NULL,
  exif_date TEXT,
  category TEXT,
  caption TEXT,
  alt_text TEXT,
  gallery TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  validation_code TEXT,
  validation_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','review','approved','processing','published','archived','rejected')),
  approved_at TEXT,
  processed_at TEXT,
  published_at TEXT,
  archived_at TEXT,
  rejected_at TEXT,
  trash_delete_after TEXT,
  reviewer TEXT,
  thumb_key TEXT,
  web_key TEXT,
  large_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_status ON media(status);
CREATE INDEX IF NOT EXISTS idx_media_category ON media(category);
CREATE INDEX IF NOT EXISTS idx_media_gallery ON media(gallery);
CREATE INDEX IF NOT EXISTS idx_media_uploaded ON media(uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_validation ON media(validation_code);

CREATE TABLE IF NOT EXISTS galleries (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  cover_media_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_galleries_active_sort ON galleries(active, sort_order, title);

CREATE TABLE IF NOT EXISTS media_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  actor TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_history_media ON media_history(media_id, created_at DESC);
