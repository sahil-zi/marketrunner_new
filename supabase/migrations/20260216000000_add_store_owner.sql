-- Add store_id to profiles for store owner mapping (1:1)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;
