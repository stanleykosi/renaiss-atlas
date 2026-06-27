DO $$ BEGIN
  ALTER TYPE score_type ADD VALUE IF NOT EXISTS 'activity_velocity';
  ALTER TYPE score_type ADD VALUE IF NOT EXISTS 'offer_depth';
  ALTER TYPE score_type ADD VALUE IF NOT EXISTS 'price_consensus';
END $$;
