-- LoveBud MVP - Demo/Seed Data
-- 검증된 공개 콘텐츠 기반 샘플 데이터
-- Neon PostgreSQL에서 실행: \i netlify/sql/002_seed_demo_data.sql

-- 시스템 계정 (데모 콘텐츠용)
-- 실제 Firebase UID가 아닌 시드용 식별자 사용
INSERT INTO trees (id, owner_id, title, visibility, created_at, updated_at)
VALUES 
  ('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'seed-system-001', '[샘플] BTS 공식 MV 모음', 'public', '2024-01-15 00:00:00+00', '2024-07-20 00:00:00+00'),
  ('b1c2d3e4-f5a6-7890-bcde-f12345678901', 'seed-system-002', '[샘플] Hearts2Hearts 데뷔 콘텐츠', 'public', '2025-02-24 00:00:00+00', '2025-04-15 00:00:00+00')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  visibility = EXCLUDED.visibility,
  updated_at = NOW();

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

-- Hearts2Hearts Tree 루트 메모리
INSERT INTO memories (id, tree_id, parent_id, title, memo, artist, source, source_url, source_type, thumbnail, emotion_tags, timestamp, visibility, created_at, updated_at)
VALUES 
  ('b7c8d9e0-f1a2-3456-bcde-789012345678', 'b1c2d3e4-f5a6-7890-bcde-f12345678901', NULL, 'Hearts2Hearts 데뷔 콘텐츠', 'SM엔터테인먼트 2025년 데뷔 걸그룹 Hearts2Hearts의 공식 콘텐츠.', '', '', '', 'system', '', '["시작"]', '2025.02.24', 'private', '2025-02-24 00:00:00+00', '2025-04-15 00:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- Hearts2Hearts 공개 메모리
INSERT INTO memories (id, tree_id, parent_id, title, memo, artist, source, source_url, source_type, thumbnail, emotion_tags, timestamp, visibility, created_at, updated_at)
VALUES 
  ('c8d9e0f1-a2b3-4567-cdef-890123456789', 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b7c8d9e0-f1a2-3456-bcde-789012345678', 'Hearts2Hearts — The Chase MV', '2025년 2월 24일 공개된 Hearts2Hearts 데뷔 싱글 공식 뮤직비디오.', 'Hearts2Hearts', 'SMTOWN Official', 'https://www.youtube.com/embed/2yJ73PpitWw', 'youtube', 'https://img.youtube.com/vi/2yJ73PpitWw/mqdefault.jpg', '["데뷔", "몽환"]', '2025.02.24', 'public', '2025-02-24 00:00:00+00', '2025-04-15 00:00:00+00'),
  ('d9e0f1a2-b3c4-5678-defa-901234567890', 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b7c8d9e0-f1a2-3456-bcde-789012345678', 'Hearts2Hearts — Butterflies MV', '2025년 3월 공개된 Hearts2Hearts 싱글 앨범 수록곡 공식 뮤직비디오.', 'Hearts2Hearts', 'SMTOWN Official', 'https://www.youtube.com/embed/QpgP7CnQ61k', 'youtube', 'https://img.youtube.com/vi/QpgP7CnQ61k/mqdefault.jpg', '["수록곡", "힙합"]', '2025.03.10', 'public', '2025-03-10 00:00:00+00', '2025-04-15 00:00:00+00'),
  ('e0f1a2b3-c4d5-6789-efab-012345678901', 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b7c8d9e0-f1a2-3456-bcde-789012345678', 'Hearts2Hearts — The Chase Dance Practice', '2025년 3월 공개된 "The Chase" 안무 연습 영상.', 'Hearts2Hearts', 'SMTOWN Official', 'https://www.youtube.com/embed/dQw4w9WgXcQ', 'youtube', 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg', '["안무", "연습"]', '2025.03.05', 'public', '2025-03-05 00:00:00+00', '2025-04-15 00:00:00+00'),
  ('f1a2b3c4-d5e6-7890-fabc-123456789012', 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b7c8d9e0-f1a2-3456-bcde-789012345678', 'Hearts2Hearts SMTOWN 2025 Performance', '2025년 SMTOWN 라이브 공연에서의 Hearts2Hearts 데뷔 무대 퍼포먼스 영상.', 'Hearts2Hearts', 'SMTOWN Official', 'https://www.youtube.com/embed/XqZsoesa55w', 'youtube', 'https://img.youtube.com/vi/XqZsoesa55w/mqdefault.jpg', '["무대", "퍼포먼스"]', '2025.03.01', 'public', '2025-03-01 00:00:00+00', '2025-04-15 00:00:00+00'),
  ('a2b3c4d5-e6f7-8901-abcd-234567890123', 'b1c2d3e4-f5a6-7890-bcde-f12345678901', 'b7c8d9e0-f1a2-3456-bcde-789012345678', 'Hearts2Hearts — The Stars, The Moon, The Dreams', '2025년 발매 싱글의 수록 발라드곡 공식 오디오/클립 영상.', 'Hearts2Hearts', 'SMTOWN Official', 'https://www.youtube.com/embed/9bZkp7q19f0', 'youtube', 'https://img.youtube.com/vi/9bZkp7q19f0/mqdefault.jpg', '["발라드", "감성"]', '2025.02.28', 'public', '2025-02-28 00:00:00+00', '2025-04-15 00:00:00+00')
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
