-- Rename legacy table name to neutral portfolio naming (no-op if already renamed)
DO $$
BEGIN
  IF to_regclass('public.cprime_opportunity_mappings') IS NOT NULL
     AND to_regclass('public.integrator_opportunity_mappings') IS NULL THEN
    ALTER TABLE "cprime_opportunity_mappings" RENAME TO "integrator_opportunity_mappings";
  END IF;
END $$;
