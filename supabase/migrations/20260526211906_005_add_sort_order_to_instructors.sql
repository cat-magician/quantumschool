/*
  # Add sort_order to instructors

  1. Changes
    - Add `sort_order` integer column to `instructors` table with default 0
    - Set sort order: Дарья Сокол = 1, Dr. Дмитрий = 2, Dr. Елена = 3 (last)
*/

ALTER TABLE instructors ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

UPDATE instructors SET sort_order = 1 WHERE id = '4d6f4b0b-9b26-48f7-9a09-376466467bca';
UPDATE instructors SET sort_order = 2 WHERE id = 'e8a236f5-5ad5-4040-88bd-95ac5b2efb18';
UPDATE instructors SET sort_order = 3 WHERE id = 'e0608e84-bea0-4a18-b2e9-9f5e122ee242';
