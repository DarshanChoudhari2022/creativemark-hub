-- Create the broadcast-media storage bucket for PDF and image attachments
-- Run this once in your Supabase dashboard → SQL Editor

INSERT INTO storage.buckets (id, name, public)
VALUES ('broadcast-media', 'broadcast-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to broadcast-media
CREATE POLICY "Authenticated users can upload broadcast media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'broadcast-media');

-- Allow public read access (so WhatsApp/email links work without auth)
CREATE POLICY "Public can read broadcast media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'broadcast-media');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their own broadcast media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'broadcast-media' AND auth.uid()::text = (storage.foldername(name))[1]);
