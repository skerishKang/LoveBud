-- LoveBud MVP - Verified Demo/Seed Data
-- Hearts2Hearts 6개 MV 확정 + BTS 4개 MV (총 10개)
-- Neon PostgreSQL에서 실행: \i netlify/sql/002_seed_demo_data.sql

-- ========== Trees ==========
INSERT INTO trees (id, owner_id, title, visibility, created_at, updated_at)
VALUES 
  ('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'seed-system-001', '[샘플] BTS 공식 MV 모음', 'public', '2024-01-15 00:00:00+00', '2024-07-20 00:00:00+00'),
  ('b1c2d3e4-f5a6-7890-bcde-f12345678901', 'seed-system-002', '[샘플] Hearts2Hearts 공식 MV', 'public', '2025-02-24 00:00:00+00', '2026-04-15 00:00:00+00')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  visibility = EXCLUDED.visibility,
  updated_at = NOW();

-- ========== BTS Memories ==========
-- BTS Tree 루트 (내부용)
INSERT INTO memories (id, tree_id, parent_id, title, memo, artist, source, source_url, source_type, thumbnail, emotion_tags, timestamp, visibility, created_at, updated_at)
VALUES 
  ('bts-root-001', 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', NULL, 'BTS 공식 MV 모음', 'BTS 공식 유튜브 채널의 대표 뮤직비디오 클립 모음.', '', '', '', 'system', '', '["시작"]', '2017.02.13', 'private', '2017-02-13 00:00:00+00', '2024-01-15 00:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- BTS 공개 MV
INSERT INTO memories (id, tree_id, parent_id, title, memo, artist, source, source_url, source_type, thumbnail, emotion_tags, timestamp, visibility, created_at, updated_at)
VALUES 
  ('bts-001', 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'bts-root-001', 'BTS — 봄날 (Spring Day) Official MV', '2017년 2월 13일 공개된 BTS의 정규 2집 리패키지 타이틀곡.', 'BTS', 'BTS Official YouTube', 'https://www.youtube.com/embed/xEeFrLSkMm8', 'youtube', 'https://img.youtube.com/vi/xEeFrLSkMm8/mqdefault.jpg', '["봄", "그리움", "희망"]', '2017.02.13', 'public', '2017-02-13 00:00:00+00', '2024-01-15 00:00:00+00'),
  ('bts-002', 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'bts-root-001', 'BTS — Dynamite Official MV', '2020년 8월 21일 공개된 BTS의 첫 영어 싱글.', 'BTS', 'BTS Official YouTube', 'https://www.youtube.com/embed/gdZLi9oWNZg', 'youtube', 'https://img.youtube.com/vi/gdZLi9oWNZg/mqdefault.jpg', '["에너지", "여름"]', '2020.08.21', 'public', '2020-08-21 00:00:00+00', '2024-01-15 00:00:00+00'),
  ('bts-003', 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'bts-root-001', 'BTS — Butter Official MV', '2021년 5월 21일 공개된 BTS의 두 번째 영어 싱글.', 'BTS', 'BTS Official YouTube', 'https://www.youtube.com/embed/UMHX0l11nlY', 'youtube', 'https://img.youtube.com/vi/UMHX0l11nlY/mqdefault.jpg', '["경쾌", "댄스"]', '2021.05.21', 'public', '2021-05-21 00:00:00+00', '2024-01-15 00:00:00+00'),
  ('bts-004', 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'bts-root-001', 'BTS — Permission to Dance Official MV', '2021년 7월 9일 공개된 BTS의 영어 싱글.', 'BTS', 'BTS Official YouTube', 'https://www.youtube.com/embed/CuklIb9dEfA', 'youtube', 'https://img.youtube.com/vi/CuklIb9dEfA/mqdefault.jpg', '["자유", "희망"]', '2021.07.09', 'public', '2021-07-09 00:00:00+00', '2024-01-15 00:00:00+00')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  source_url = EXCLUDED.source_url,
  thumbnail = EXCLUDED.thumbnail,
  updated_at = NOW();

-- ========== Hearts2Hearts Memories ==========
-- Hearts2Hearts 루트 (내부용)
INSERT INTO memories (id, tree_id, parent_id, title, memo, artist, source, source_url, source_type, thumbnail, emotion_tags, timestamp, visibility, created_at, updated_at)
VALUES 
  ('h2h-root-001', 'b1c2d3e4-f5a6-7890-bcde-f12345678901', NULL, 'Hearts2Hearts 공식 MV', 'SMTOWN 공식 채널 기준 Hearts2Hearts 공식 뮤직비디오 모음.', '', '', '', 'system', '', '["시작"]', '2025.02.24', 'private', '2025-02-24 00:00:00+00', NOW())
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  memo = EXCLUDED.memo,
  updated_at = NOW();

-- Hearts2Hearts 공개 MV (6개 확정)
INSERT INTO memories (id, tree_id, parent_id, title, memo, artist, source, source_url, source_type, thumbnail, emotion_tags, timestamp, visibility, created_at, updated_at)
VALUES 
  ('h2h-001', 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'h2h-root-001', 'Hearts2Hearts — The Chase MV', '2025년 2월 24일 공개된 Hearts2Hearts 데뷔 싱글 공식 MV.', 'Hearts2Hearts', 'SMTOWN', 'https://www.youtube.com/embed/kxUA2wwYiME', 'youtube', 'https://img.youtube.com/vi/kxUA2wwYiME/mqdefault.jpg', '["데뷔", "몽환"]', '2025.02.24', 'public', '2025-02-24 00:00:00+00', NOW()),
  ('h2h-002', 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'h2h-root-001', 'Hearts2Hearts — Butterflies MV', '2025년 3월 7일 공개된 Hearts2Hearts 공식 MV.', 'Hearts2Hearts', 'SMTOWN', 'https://www.youtube.com/embed/hJ9Wp3PO3c8', 'youtube', 'https://img.youtube.com/vi/hJ9Wp3PO3c8/mqdefault.jpg', '["설렘", "청량"]', '2025.03.07', 'public', '2025-03-07 00:00:00+00', NOW()),
  ('h2h-003', 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'h2h-root-001', 'Hearts2Hearts — STYLE MV', '2025년 6월 18일 공개된 Hearts2Hearts 공식 MV.', 'Hearts2Hearts', 'SMTOWN', 'https://www.youtube.com/embed/n7kFRxFIPrI', 'youtube', 'https://img.youtube.com/vi/n7kFRxFIPrI/mqdefault.jpg', '["당당", "세련"]', '2025.06.18', 'public', '2025-06-18 00:00:00+00', NOW()),
  ('h2h-004', 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'h2h-root-001', 'Hearts2Hearts — Pretty Please MV', '2025년 9월 24일 공개된 Hearts2Hearts 1st EP 수록곡 MV.', 'Hearts2Hearts', 'SMTOWN', 'https://www.youtube.com/embed/ufwB9Uja_wM', 'youtube', 'https://img.youtube.com/vi/ufwB9Uja_wM/mqdefault.jpg', '["달콤", "플레이풀"]', '2025.09.24', 'public', '2025-09-24 00:00:00+00', NOW()),
  ('h2h-005', 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'h2h-root-001', 'Hearts2Hearts — FOCUS MV', '2025년 10월 20일 공개된 Hearts2Hearts 1st EP 타이틀곡 MV.', 'Hearts2Hearts', 'SMTOWN', 'https://www.youtube.com/embed/Ur7aK4FvK-U', 'youtube', 'https://img.youtube.com/vi/Ur7aK4FvK-U/mqdefault.jpg', '["집중", "성숙"]', '2025.10.20', 'public', '2025-10-20 00:00:00+00', NOW()),
  ('h2h-006', 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'h2h-root-001', 'Hearts2Hearts — RUDE! MV', '2026년 2월 20일 공개된 Hearts2Hearts 공식 MV.', 'Hearts2Hearts', 'SMTOWN', 'https://www.youtube.com/embed/F7sGJVUrkjQ', 'youtube', 'https://img.youtube.com/vi/F7sGJVUrkjQ/mqdefault.jpg', '["자유", "에너지"]', '2026.02.20', 'public', '2026-02-20 00:00:00+00', NOW())
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  memo = EXCLUDED.memo,
  artist = EXCLUDED.artist,
  source = EXCLUDED.source,
  source_url = EXCLUDED.source_url,
  source_type = EXCLUDED.source_type,
  thumbnail = EXCLUDED.thumbnail,
  emotion_tags = EXCLUDED.emotion_tags,
  timestamp = EXCLUDED.timestamp,
  visibility = EXCLUDED.visibility,
  updated_at = NOW();

-- ========== Analyze ==========
ANALYZE memories;
ANALYZE trees;

-- 확인 쿼리 (선택사항)
-- SELECT t.title as tree_title, m.title as memory_title, m.timestamp, m.visibility 
-- FROM memories m 
-- JOIN trees t ON m.tree_id = t.id 
-- WHERE m.visibility = 'public'
-- ORDER BY t.title, m.timestamp;