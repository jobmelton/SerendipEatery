-- SerendipEatery — Seed Data (development only)

INSERT INTO businesses (id, owner_clerk_id, name, slug, description, business_type, address, location, billing_plan) VALUES
  ('b1000000-0000-0000-0000-000000000001','user_seed_clerk_biz_01','Fuego Tacos','fuego-tacos','The hottest tacos in town. Flash sales every Friday.','restaurant','1234 Main St, Sacramento, CA 95814',ST_SetSRID(ST_MakePoint(-121.4944, 38.5816), 4326),'trial'),
  ('b1000000-0000-0000-0000-000000000002','user_seed_clerk_biz_02','Maya''s Rolling Kitchen','mayas-rolling-kitchen','Fusion street food. Follow the truck.','food_truck',NULL,NULL,'trial');

INSERT INTO users (id, clerk_id, email, display_name, consumer_points) VALUES
  ('u1000000-0000-0000-0000-000000000001','user_seed_clerk_consumer_01','alex@example.com','Alex Dev',0);

INSERT INTO flash_sales (id, business_id, title, description, status, starts_at, ends_at, spin_window_mins, fence_center, fence_radius_m) VALUES
  ('f1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','Friday Fuego Flash','Spin to win free tacos and drinks!','active',NOW() - INTERVAL '10 minutes',NOW() + INTERVAL '50 minutes',60,ST_SetSRID(ST_MakePoint(-121.4944, 38.5816), 4326),10);

INSERT INTO prizes (flash_sale_id, label, emoji, weight, max_spins, base_weight) VALUES
  ('f1000000-0000-0000-0000-000000000001','Free Taco','🌮',40,20,40),
  ('f1000000-0000-0000-0000-000000000001','Free Drink','🥤',30,15,30),
  ('f1000000-0000-0000-0000-000000000001','10% Off','💸',20,50,20),
  ('f1000000-0000-0000-0000-000000000001','Free Guac','🥑',8,10,8),
  ('f1000000-0000-0000-0000-000000000001','Full Meal Free','🎉',2,3,2);

INSERT INTO referrals (code, path, referrer_user_id) VALUES ('ALEX-U01','user_user','u1000000-0000-0000-0000-000000000001');
INSERT INTO referrals (code, path, referrer_biz_id) VALUES ('FUEGO-C','biz_customer','b1000000-0000-0000-0000-000000000001'),('FUEGO-B','biz_biz','b1000000-0000-0000-0000-000000000001');
