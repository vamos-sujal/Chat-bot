import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, File, X, Check } from 'lucide-react';

interface FileUploadProps {
  projectId: string;
  onFileUploaded?: () => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ projectId, onFileUploaded }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const uploadFile = async (file: File) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Create file path with user ID and timestamp
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${timestamp}-${file.name}`;
    const filePath = `${user.id}/${projectId}/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('project-files')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('project-files')
      .getPublicUrl(filePath);

    // Save file metadata to database
    const { data: fileData, error: dbError } = await supabase
      .from('file_uploads')
      .insert({
        user_id: user.id,
        project_id: projectId,
        filename: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
      })
      .select()
      .single();

    if (dbError) {
      // Clean up uploaded file if database insert fails
      await supabase.storage
        .from('project-files')
        .remove([filePath]);
      throw dbError;
    }

    // Process file content in background
    try {
      const { error: processError } = await supabase.functions.invoke('process-file', {
        body: {
          fileId: fileData.id,
          filePath: filePath,
          fileType: file.type,
          fileName: file.name
        }
      });

      if (processError) {
        console.warn('File content processing failed:', processError);
        // Don't throw error - file upload was successful, content processing is optional
      }
    } catch (processError) {
      console.warn('File content processing error:', processError);
      // Don't throw error - file upload was successful
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Add files to uploading state
    const newUploadingFiles = files.map(file => ({
      file,
      progress: 0,
      status: 'uploading' as const,
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Upload each file
    files.forEach(async (file, index) => {
      try {
        // Simulate progress for better UX
        const progressInterval = setInterval(() => {
          setUploadingFiles(prev => 
            prev.map((item, i) => 
              item.file === file 
                ? { ...item, progress: Math.min(item.progress + 10, 90) }
                : item
            )
          );
        }, 100);

        await uploadFile(file);

        clearInterval(progressInterval);

        // Mark as completed
        setUploadingFiles(prev => 
          prev.map(item => 
            item.file === file 
              ? { ...item, progress: 100, status: 'completed' }
              : item
          )
        );

        toast({
          title: "File uploaded",
          description: `${file.name} uploaded successfully`,
        });

        onFileUploaded?.();

      } catch (error) {
        console.error('Error uploading file:', error);
        
        setUploadingFiles(prev => 
          prev.map(item => 
            item.file === file 
              ? { 
                  ...item, 
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Upload failed'
                }
              : item
          )
        );

        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    });

    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeUploadingFile = (fileToRemove: File) => {
    setUploadingFiles(prev => prev.filter(item => item.file !== fileToRemove));
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    
    if (files.length === 0) return;

    // Add files to uploading state
    const newUploadingFiles = files.map(file => ({
      file,
      progress: 0,
      status: 'uploading' as const,
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Upload each file
    files.forEach(async (file) => {
      try {
        // Simulate progress for better UX
        const progressInterval = setInterval(() => {
          setUploadingFiles(prev => 
            prev.map((item) => 
              item.file === file 
                ? { ...item, progress: Math.min(item.progress + 10, 90) }
                : item
            )
          );
        }, 100);

        await uploadFile(file);

        clearInterval(progressInterval);

        // Mark as completed
        setUploadingFiles(prev => 
          prev.map(item => 
            item.file === file 
              ? { ...item, progress: 100, status: 'completed' }
              : item
          )
        );

        toast({
          title: "File uploaded",
          description: `${file.name} uploaded successfully`,
        });

        onFileUploaded?.();

      } catch (error) {
        console.error('Error uploading file:', error);
        
        setUploadingFiles(prev => 
          prev.map(item => 
            item.file === file 
              ? { 
                  ...item, 
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Upload failed'
                }
              : item
          )
        );

        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    });
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Upload Files
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">Drop files here or click to browse</p>
          <p className="text-sm text-muted-foreground">
            Support for all file types. Maximum file size: 20MB
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept="*/*"
        />

        <Button onClick={() => fileInputRef.current?.click()} className="w-full">
          <Upload className="h-4 w-4 mr-2" />
          Select Files
        </Button>

        {/* Uploading files */}
        {uploadingFiles.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Uploading Files</h4>
            {uploadingFiles.map((item, index) => (
              <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(item.file.size)}
                  </p>
                  {item.status === 'uploading' && (
                    <Progress value={item.progress} className="mt-1" />
                  )}
                  {item.status === 'error' && (
                    <p className="text-xs text-destructive mt-1">{item.error}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {item.status === 'completed' && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                  {item.status === 'error' && (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeUploadingFile(item.file)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FileUpload;