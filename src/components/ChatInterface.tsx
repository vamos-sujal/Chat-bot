import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Send, Bot, User, Loader2, Paperclip, X, FileText } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Message {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  url?: string;
}

interface ChatInterfaceProps {
  conversationId: string;
  projectId: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ conversationId, projectId }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversation history
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Error loading messages:', error);
          toast({
            title: "Error",
            description: "Failed to load conversation history",
            variant: "destructive",
          });
          return;
        }

        setMessages(data || []);
      } catch (error) {
        console.error('Error loading messages:', error);
        toast({
          title: "Error", 
          description: "Failed to load conversation history",
          variant: "destructive",
        });
      } finally {
        setIsLoadingHistory(false);
      }
    };

    if (conversationId && user) {
      loadMessages();
    }
  }, [conversationId, user, toast]);

  // Set up real-time subscription for new messages
  useEffect(() => {
    if (!conversationId || !user) return;

    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          // Only add the message if it's not from this client
          setMessages(prev => {
            if (prev.some(msg => msg.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, user]);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !projectId) return;

    for (const file of Array.from(files)) {
      try {
        // Upload to Supabase Storage
        const fileName = `${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('project-files')
          .upload(`${user?.id}/${projectId}/${fileName}`, file);

        if (uploadError) {
          throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('project-files')
          .getPublicUrl(`${user?.id}/${projectId}/${fileName}`);

        // Save file metadata to database
        const { data: fileRecord, error: dbError } = await supabase
          .from('file_uploads')
          .insert({
            project_id: projectId,
            user_id: user?.id,
            filename: file.name,
            file_path: `${user?.id}/${projectId}/${fileName}`,
            file_size: file.size,
            file_type: file.type
          })
          .select()
          .single();

        if (dbError) {
          throw dbError;
        }

        // Process file content in background
        try {
          const { error: processError } = await supabase.functions.invoke('process-file', {
            body: {
              fileId: fileRecord?.id,
              filePath: `${user?.id}/${projectId}/${fileName}`,
              fileType: file.type,
              fileName: file.name
            }
          });

          if (processError) {
            console.warn('File content processing failed:', processError);
          }
        } catch (processError) {
          console.warn('File content processing error:', processError);
        }

        setAttachedFiles(prev => [...prev, {
          name: file.name,
          size: file.size,
          type: file.type,
          url: publicUrl
        }]);

        toast({
          title: "File uploaded",
          description: `${file.name} uploaded successfully`,
        });

      } catch (error) {
        console.error('Error uploading file:', error);
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || !user || isLoading) return;

    let messageContent = input.trim();
    
    // Add file references to message if any
    if (attachedFiles.length > 0) {
      const fileList = attachedFiles.map(file => `📎 ${file.name}`).join('\n');
      messageContent = `${messageContent}\n\nAttached files:\n${fileList}`;
    }

    setInput('');
    setAttachedFiles([]);
    setIsLoading(true);

    try {
      // Call the AI chat edge function
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: messageContent,
          conversationId,
          projectId,
          userId: user.id,
        },
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to get AI response');
      }

      // Messages will be added via real-time subscription
      toast({
        title: "Message sent",
        description: "AI response generated successfully",
      });

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoadingHistory) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading conversation...</span>
      </div>
    );
  }

  return (
    <Card className="flex flex-col h-[600px]">
      {/* Messages area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Start a conversation with your AI assistant</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {message.role === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground ml-auto'
                      : 'bg-muted'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <span className="text-xs opacity-70 mt-1 block">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted p-3 rounded-lg">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* File attachments area */}
      {attachedFiles.length > 0 && (
        <div className="p-3 border-t bg-muted/30">
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-background rounded-lg p-2 border"
              >
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleFileSelect}
            disabled={isLoading}
            className="shrink-0"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message... (Shift+Enter for new line)"
            className="resize-none"
            rows={2}
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
            size="icon"
            className="shrink-0 self-end"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
        accept="*/*"
      />
    </Card>
  );
};

export default ChatInterface;