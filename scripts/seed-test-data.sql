-- Seed test food items for ALL users with expiry dates in the next 1-3 days
-- Run this in Supabase SQL Editor

INSERT INTO food_items (user_id, name, quantity, category, expiry_date, status)
SELECT
  p.id,
  item.name,
  item.quantity,
  item.category,
  item.expiry_date,
  'active'
FROM profiles p
CROSS JOIN (
  VALUES
    ('Chicken Breast',  '500 g',    'Meat',       (CURRENT_DATE + INTERVAL '1 day')::date),
    ('Spinach',         '1 pack',   'Vegetables', (CURRENT_DATE + INTERVAL '1 day')::date),
    ('Greek Yogurt',    '500 ml',   'Dairy',      (CURRENT_DATE + INTERVAL '2 days')::date),
    ('Bell Peppers',    '3 piece',  'Vegetables', (CURRENT_DATE + INTERVAL '2 days')::date),
    ('Salmon Fillet',   '400 g',    'Seafood',    (CURRENT_DATE + INTERVAL '3 days')::date),
    ('Eggs',            '6 piece',  'Dairy',      (CURRENT_DATE + INTERVAL '3 days')::date),
    ('Mushrooms',       '250 g',    'Vegetables', (CURRENT_DATE + INTERVAL '1 day')::date)
) AS item(name, quantity, category, expiry_date);
