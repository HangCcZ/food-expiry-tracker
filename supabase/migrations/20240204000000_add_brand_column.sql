ALTER TABLE food_items ADD COLUMN brand text;
ALTER TABLE food_items ADD CONSTRAINT chk_brand_length CHECK (length(brand) <= 100);
