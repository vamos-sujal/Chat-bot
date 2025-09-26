-- Create RLS policies for project-files bucket (skip if already exist)
DO $$
BEGIN
    -- Create RLS policies for project-files bucket
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can upload their own files'
    ) THEN
        CREATE POLICY "Users can upload their own files" 
        ON storage.objects 
        FOR INSERT 
        WITH CHECK (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can view their own files'
    ) THEN
        CREATE POLICY "Users can view their own files" 
        ON storage.objects 
        FOR SELECT 
        USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can update their own files'
    ) THEN
        CREATE POLICY "Users can update their own files" 
        ON storage.objects 
        FOR UPDATE 
        USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can delete their own files'
    ) THEN
        CREATE POLICY "Users can delete their own files" 
        ON storage.objects 
        FOR DELETE 
        USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;
END $$;