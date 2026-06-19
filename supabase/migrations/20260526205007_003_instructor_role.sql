/*
  # Add role field to instructors table

  1. Changes
    - `instructors` table: add `role` column with values 'lecturer' | 'seminar'
    - Default existing instructors to 'lecturer'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'instructors' AND column_name = 'role'
  ) THEN
    ALTER TABLE instructors ADD COLUMN role text NOT NULL DEFAULT 'lecturer'
      CHECK (role IN ('lecturer', 'seminar'));
  END IF;
END $$;
