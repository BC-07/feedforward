-- Convert existing timestamp columns (stored as local Manila time) to UTC.
-- If your existing data is in a different timezone, replace 'Asia/Manila' below.

ALTER TABLE public.feedbacks
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'Asia/Manila',
  ALTER COLUMN updated_at TYPE timestamptz
  USING updated_at AT TIME ZONE 'Asia/Manila';

ALTER TABLE public.users
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'Asia/Manila',
  ALTER COLUMN updated_at TYPE timestamptz
  USING updated_at AT TIME ZONE 'Asia/Manila';

ALTER TABLE public.admins
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'Asia/Manila',
  ALTER COLUMN updated_at TYPE timestamptz
  USING updated_at AT TIME ZONE 'Asia/Manila';

ALTER TABLE public.categories
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'Asia/Manila',
  ALTER COLUMN updated_at TYPE timestamptz
  USING updated_at AT TIME ZONE 'Asia/Manila';
