-- TZ 8.3.B.1B — Add MdmItemType.SERVICE (standalone enum migration)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MdmItemType') THEN
    BEGIN
      ALTER TYPE "MdmItemType" ADD VALUE IF NOT EXISTS 'SERVICE';
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
  END IF;
END $$;






