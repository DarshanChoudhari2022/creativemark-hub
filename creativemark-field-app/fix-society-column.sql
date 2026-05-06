-- Fix: society_data has "society_name" but app uses "name"
-- Run this in Supabase SQL Editor

-- Check current columns
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'society_data'
ORDER BY ordinal_position;

-- Rename society_name → name (if society_name exists and name doesn't)
DO $$
BEGIN
  -- If old column exists, rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='society_data' AND column_name='society_name'
  ) THEN
    -- If "name" column also exists (added by migration), copy data and drop old
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='society_data' AND column_name='name'
    ) THEN
      -- Copy any data from society_name to name where name is null
      UPDATE public.society_data SET name = society_name WHERE name IS NULL AND society_name IS NOT NULL;
      -- Drop the old column
      ALTER TABLE public.society_data DROP COLUMN society_name;
      RAISE NOTICE 'Merged society_name into name, dropped society_name';
    ELSE
      -- Simply rename
      ALTER TABLE public.society_data RENAME COLUMN society_name TO name;
      RAISE NOTICE 'Renamed society_name → name';
    END IF;
  END IF;
END $$;

-- Ensure name column has NOT NULL
ALTER TABLE public.society_data ALTER COLUMN name SET NOT NULL;
