/*
  # Add specializations array to instructors

  ## Summary
  Adds support for multiple specializations per instructor.

  ## Changes
  - New column `specializations` (text[]) added to `instructors` table
  - Existing `specialization` values migrated into the new array column
  - Dr. Андрей Стрельцов gets a second specialization "Квантовые вычисления"
  - Old `specialization` column kept for backwards compatibility but array is now primary

  ## Notes
  - No data is lost — existing values are preserved in the new array
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'instructors' AND column_name = 'specializations'
  ) THEN
    ALTER TABLE instructors ADD COLUMN specializations text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

-- Migrate existing single specialization into array
UPDATE instructors
SET specializations = ARRAY[specialization]
WHERE specializations = '{}' AND specialization IS NOT NULL AND specialization != '';

-- Add second specialization for Dr. Андрей Стрельцов
UPDATE instructors
SET specializations = ARRAY['Нелинейная и квантовая оптика', 'Квантовые вычисления']
WHERE id = 'e8a236f5-5ad5-4040-88bd-95ac5b2efb18';

-- Also update specialization text field for consistency
UPDATE instructors
SET specialization = 'Нелинейная и квантовая оптика'
WHERE id = 'e8a236f5-5ad5-4040-88bd-95ac5b2efb18';
