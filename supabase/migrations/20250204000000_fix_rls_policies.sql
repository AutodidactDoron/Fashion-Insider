-- =============================================================================
-- FIX RLS: Enable users to see each other's posts and messages
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PRODUCTS / LISTINGS
-- Assume table name is 'listings' (or change to 'products' if that's your table)
-- Columns assumed: id, user_id (or seller_id), ... 
-- -----------------------------------------------------------------------------

-- Enable RLS
ALTER TABLE IF EXISTS public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;

-- LISTINGS: Drop existing policies if they exist (avoid duplicates)
DROP POLICY IF EXISTS "Enable read access for all users" ON public.listings;
DROP POLICY IF EXISTS "Enable insert update delete for owners only" ON public.listings;
DROP POLICY IF EXISTS "Allow public read" ON public.listings;
DROP POLICY IF EXISTS "Allow owner write" ON public.listings;

-- LISTINGS: Read — everyone (including anon) can see listed items
CREATE POLICY "Enable read access for all users"
ON public.listings FOR SELECT
TO public
USING (true);

-- LISTINGS: Insert — authenticated users; set owner column to auth.uid() in your app
CREATE POLICY "Enable insert for authenticated"
ON public.listings FOR INSERT
TO authenticated
WITH CHECK (true);

-- LISTINGS: Update/Delete — only owner (adjust user_id/seller_id to match your column)
CREATE POLICY "Enable update for owners only"
ON public.listings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = seller_id)
WITH CHECK (auth.uid() = user_id OR auth.uid() = seller_id);

CREATE POLICY "Enable delete for owners only"
ON public.listings FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = seller_id);

-- If your table uses 'products' instead of 'listings', uncomment and run:
/*
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.products;
DROP POLICY IF EXISTS "Enable insert update delete for owners only" ON public.products;
CREATE POLICY "Enable read access for all users" ON public.products FOR SELECT TO public USING (true);
CREATE POLICY "Enable insert for authenticated" ON public.products FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR auth.uid() = seller_id OR (user_id IS NULL AND seller_id IS NULL));
CREATE POLICY "Enable update for owners only" ON public.products FOR UPDATE TO authenticated USING (auth.uid() = user_id OR auth.uid() = seller_id) WITH CHECK (auth.uid() = user_id OR auth.uid() = seller_id);
CREATE POLICY "Enable delete for owners only" ON public.products FOR DELETE TO authenticated USING (auth.uid() = user_id OR auth.uid() = seller_id);
*/

-- -----------------------------------------------------------------------------
-- 2. MESSAGES
-- Columns: id, channel_id, sender_id, sender_name, content, created_at
-- Optional: receiver_id (for DMs). Read = participant (sent by or sent to you, or in your channel)
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for participants" ON public.messages;
DROP POLICY IF EXISTS "Enable read for participants" ON public.messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.messages;
DROP POLICY IF EXISTS "Allow read messages" ON public.messages;
DROP POLICY IF EXISTS "Allow insert messages" ON public.messages;

-- Read: All authenticated users can see all messages (channel/group chat style)
-- So User A and User B both see each other's messages without RLS blocking.
CREATE POLICY "Enable read access for participants"
ON public.messages FOR SELECT
TO authenticated
USING (true);

-- Insert: Any authenticated user can send a message
CREATE POLICY "Enable insert for authenticated users"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 3. PROFILES
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public read" ON public.profiles;

CREATE POLICY "Enable read access for all"
ON public.profiles FOR SELECT
TO public
USING (true);

-- Optional: users can update their own profile
DROP POLICY IF EXISTS "Enable update for own profile" ON public.profiles;
CREATE POLICY "Enable update for own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- 4. REAL-TIME (Publication)
-- Supabase uses a publication named 'supabase_realtime'. Tables must be in it.
-- -----------------------------------------------------------------------------

-- Add tables to the realtime publication (run if not already added)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- If you use listings/products for live updates:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.listings;

-- Replication must be enabled for the tables. If you get "relation does not exist" for the publication, 
-- in Dashboard: Database → Replication → ensure 'public.messages' (and optionally listings) are in the publication.
