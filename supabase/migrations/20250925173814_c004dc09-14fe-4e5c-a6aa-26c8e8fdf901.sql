-- Storage RLS policies for project-files bucket
-- Allow authenticated users to manage objects only within their own user folder: {user_id}/...

-- SELECT
CREATE POLICY "Users can read their own files in project-files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'project-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- INSERT
CREATE POLICY "Users can upload to their own folder in project-files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'project-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- UPDATE
CREATE POLICY "Users can update their own files in project-files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'project-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'project-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE
CREATE POLICY "Users can delete their own files in project-files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'project-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
