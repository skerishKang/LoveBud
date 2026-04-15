-- LoveBud MVP - Verified Demo/Seed Data
-- 실제 공식 YouTube 채널에서 확인 가능한 공개 콘텐츠만 포함
-- Neon PostgreSQL에서 실행: \i netlify/sql/002_seed_demo_data.sql

-- 시스템 계정 (데모 콘텐츠용)
-- 실제 Firebase UID가 아닌 시드용 식별자 사용
INSERT INTO trees (id, owner_id, title, visibility, created_at, updated_at)
VALUES 
  ('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'seed-system-001', '[샘플] BTS 공식 MV 모음', 'public', '2024-01-15 00:00:00+00', '2024-07-20 00:00:00+00'),
  ('b1c2d3e4-f5a6-7890-bcde-f12345678901', 'seed-system-002', '[샘플] Hearts2Hearts 공식 MV', 'public', '2025-02-24 00:00:00+00', '2025-04-15 00:00:00+00')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  visibility = EXCLUDED.visibility,
  updated_at = NOW();
-- 참고: owner_id는 DO UPDATE에서 제외 (시드 소유권 유지)

-- BTS Tree 루트 메모리 (내부용, community API 미노출)
INSERT INTO memories (id, tree_id, parent_id, title, memo, artist, source, source_url, source_type, thumbnail, emotion_tags, timestamp, visibility, created_at, updated_at)
VALUES 
  ('c2d3e4f5-a6b7-8901-cdef-234567890123', 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', NULL, 'BTS 공식 MV 모음', 'BTS 공식 유튜브 채널의 대표 뮤직비디오 클립 모음. 2017-2021년 발표된 공식 콘텐츠입니다.', '', '', '', 'system', '', '["시작"]', '2017.02.13', 'private', '2017-02-13 00:00:00+00', '2024-01-15 00:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- BTS 공개 메모리 (community API 노출)
INSERT INTO memories (id, tree_id, parent_id, title, memo, artist, source, source_url, source_type, thumbnail, emotion_tags, timestamp, visibility, created_at, updated_at)
VALUES 
  ('d3e4f5a6-b7c8-9012-defa-345678901234', 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'c2d3e4f5-a6b7-8901-cdef-234567890123', 'BTS — 봄날 (Spring Day) Official MV', '2017년 2월 13일 공개된 BTS의 정규 2집 리패키지 타이틀곡 뮤직비디오.', 'BTS', 'BTS Official YouTube', 'https://www.youtube.com/embed/xEeFrLSkMm8', 'youtube', 'https://img.youtube.com/vi/xEeFrLSkMm8/mqdefault.jpg', '["봄", "그리움", "희망"]', '2017.02.13', 'public', '2017-02-13 00:00:00+00', '2024-01-15 00:00:00+00'),
  ('e4f5a6b7-c8d9-0123-efab-456789012345', 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'c2d3e4f5-a6b7-8901-cdef-234567890123', 'BTS — Dynamite Official MV', '2020년 8월 21일 공개된 BTS의 첫 영어 싱글 뮤직비디오.', 'BTS', 'BTS Official YouTube', 'https://www.youtube.com/embed/gdZLi9oWNZg', 'youtube', 'https://img.youtube.com/vi/gdZLi9oWNZg/mqdefault.jpg', '["에너지", "여름"]', '2020.08.21', 'public', '2020-08-21 00:00:00+00', '2024-01-15 00:00:00+00'),
  ('f5a6b7c8-d9e0-1234-fabc-567890123456', 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'c2d3e4f5-a6b7-8901-cdef-234567890123', 'BTS — Butter Official MV', '2021년 5월 21일 공개된 BTS의 두 번째 영어 싱글 공식 뮤직비디오.', 'BTS', 'BTS Official YouTube', 'https://www.youtube.com/embed/UMHX0l11nlY', 'youtube', 'https://img.youtube.com/vi/UMHX0l11nlY/mqdefault.jpg', '["경쾌", "댄스"]', '2021.05.21', 'public', '2021-05-21 00:00:00+00', '2024-01-15 00:00:00+00'),
  ('a6b7c8d9-e0f1-2345-abcd-678901234567', 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'c2d3e4f5-a6b7-8901-cdef-234567890123', 'BTS — Permission to Dance Official MV', '2021년 7월 9일 공개된 BTS의 영어 싱글 공식 뮤직비디오.', 'BTS', 'BTS Official YouTube', 'https://www.youtube.com/embed/CuklIb9dEfA', 'youtube', 'https://img.youtube.com/vi/CuklIb9dEfA/mqdefault.jpg', '["자유", "희망"]', '2021.07.09', 'public', '2021-07-09 00:00:00+00', '2024-01-15 00:00:00+00')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  source_url = EXCLUDED.source_url,
  thumbnail = EXCLUDED.thumbnail,
  updated_at = NOW();

-- Hearts2Hearts Tree 루트 메모리 (내부용, community API 미노출)
INSERT INTO memories (id, tree_id, parent_id, title, memo, artist, source, source_url, source_type, thumbnail, emotion_tags, timestamp, visibility, created_at, updated_at)
VALUES 
  ('b7c8d9e0-f1a2-3456-bcde-789012345678', 'b1c2d3e4-f5a6-7890-bcde-f12345678901', NULL, 'Hearts2Hearts 공식 MV', 'SM엔터테인먼트 2025년 데뷔 걸그룹 Hearts2Hearts 공식 유튜브 채널 콘텐츠.', '', '', '', 'system', '', '["시작"]', '2025.02.24', 'private', '2025-02-24 00:00:00+00', '2025-04-15 00:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- Hearts2Hearts 공개 메모리 (community API 노출)
-- 출처: @hearts2hearts.official 공식 채널
INSERT INTO memories (id, tree_id, parent_id, title, memo, artist, source, source_url, source_type, thumbnail, emotion_tags, timestamp, visibility, created_at, updated_at)
VALUES 
  ('c8d9e0f1-a2b3-4567-cdef-890123456789', 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b7c8d9e0-f1a2-3456-bcde-789012345678', 'Hearts2Hearts — The Chase MV', '2025년 2월 24일 공개된 Hearts2Hearts 데뷔 싱글 공식 뮤직비디오.', 'Hearts2Hearts', 'Hearts2Hearts Official', 'https://www.youtube.com/embed/kxUA2wwYiME', 'youtube', 'https://img.youtube.com/vi/kxUA2wwYiME/mqdefault.jpg', '["데뷔", "몽환"]', '2025.02.24', 'public', '2025-02-24 00:00:00+00', '2025-04-15 00:00:00+00')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  source_url = EXCLUDED.source_url,
  thumbnail = EXCLUDED.thumbnail,
  updated_at = NOW();

-- 인덱스 재생성 (성능 최적화)
ANALYZE memories;
ANALYZE trees;

-- 확인 쿼리 (선택사항)
-- SELECT t.title as tree_title, m.title as memory_title, m.visibility 
-- FROM memories m 
-- JOIN trees t ON m.tree_id = t.id 
-- WHERE m.visibility = 'public';
