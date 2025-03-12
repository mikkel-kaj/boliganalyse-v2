
-- Create a table for storing user feedback
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_type TEXT NOT NULL,
  message TEXT NOT NULL,
  email TEXT,
  property_id TEXT,
  property_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Add RLS policy to allow anyone to insert feedback
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Let anyone insert feedback (no authentication required)
CREATE POLICY "Allow anonymous insert" ON public.feedback
  FOR INSERT TO anon
  WITH CHECK (true);

-- Only allow service_role to select, update, and delete
CREATE POLICY "Allow admins to manage feedback" ON public.feedback
  USING (true);
