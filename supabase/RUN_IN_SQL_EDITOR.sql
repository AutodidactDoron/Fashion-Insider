-- =============================================================================
-- COPY AND RUN THIS IN SUPABASE SQL EDITOR (Dashboard → SQL Editor → New query)
-- Fix: Users cannot see each other's posts or messages (RLS too strict)
-- =============================================================================

-- 1. MESSAGES — everyone (authenticated) can read & insert
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for participants" ON public.messages;
DROP POLICY IF EXISTS "Enable read for participants" ON public.messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.messages;
DROP POLICY IF EXISTS "Allow read messages" ON public.messages;
DROP POLICY IF EXISTS "Allow insert messages" ON public.messages;

CREATE POLICY "Enable read access for participants"
ON public.messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON public.messages FOR INSERT TO authenticated WITH CHECK (true);

-- 2. PROFILES — everyone can read (search users)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all" ON public.profiles;
DROP POLICY IF EXISTS "Public read" ON public.profiles;

CREATE POLICY "Enable read access for all"
ON public.profiles FOR SELECT TO public USING (true);

-- 3. LISTINGS (or PRODUCTS) — everyone can read; only owner can update/delete
-- If your table is named 'products', replace 'listings' with 'products' below.
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON public.listings;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.listings;
DROP POLICY IF EXISTS "Enable update for owners only" ON public.listings;
DROP POLICY IF EXISTS "Enable delete for owners only" ON public.listings;

CREATE POLICY "Enable read access for all users"
ON public.listings FOR SELECT TO public USING (true);

CREATE POLICY "Enable insert for authenticated"
ON public.listings FOR INSERT TO authenticated WITH CHECK (true);

-- Use your actual owner column: user_id or seller_id
CREATE POLICY "Enable update for owners only"
ON public.listings FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR auth.uid() = seller_id)
WITH CHECK (auth.uid() = user_id OR auth.uid() = seller_id);

CREATE POLICY "Enable delete for owners only"
ON public.listings FOR DELETE TO authenticated
USING (auth.uid() = user_id OR auth.uid() = seller_id);

-- 4. REAL-TIME — allow client to receive INSERTs on messages (public schema)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
-- If you see "already exists", that's fine — table is already in the publication.

-- -----------------------------------------------------------------------------
-- OPTIONAL: If your table is named 'products' instead of 'listings', run this:
-- -----------------------------------------------------------------------------
-- ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Enable read access for all users" ON public.products;
-- DROP POLICY IF EXISTS "Enable insert for authenticated" ON public.products;
-- DROP POLICY IF EXISTS "Enable update for owners only" ON public.products;
-- DROP POLICY IF EXISTS "Enable delete for owners only" ON public.products;
-- CREATE POLICY "Enable read access for all users" ON public.products FOR SELECT TO public USING (true);
-- CREATE POLICY "Enable insert for authenticated" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "Enable update for owners only" ON public.products FOR UPDATE TO authenticated USING (auth.uid() = user_id OR auth.uid() = seller_id) WITH CHECK (auth.uid() = user_id OR auth.uid() = seller_id);
-- CREATE POLICY "Enable delete for owners only" ON public.products FOR DELETE TO authenticated USING (auth.uid() = user_id OR auth.uid() = seller_id);
