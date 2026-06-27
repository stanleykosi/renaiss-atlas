DO $$ BEGIN
  ALTER TYPE bundle_type ADD VALUE IF NOT EXISTS 'same_wallet';
END $$;
