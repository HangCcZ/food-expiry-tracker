-- Add CHECK constraints for input validation on food_items table
ALTER TABLE food_items ADD CONSTRAINT chk_name_length CHECK (length(name) <= 100);
ALTER TABLE food_items ADD CONSTRAINT chk_name_not_empty CHECK (length(trim(name)) > 0);
ALTER TABLE food_items ADD CONSTRAINT chk_notes_length CHECK (length(notes) <= 500);
