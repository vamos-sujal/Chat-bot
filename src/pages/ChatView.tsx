import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, MessageCircle, Upload, Loader2 } from 'lucide-react';
import ChatInterface from '@/components/ChatInterface';
import FileUpload from '@/components/FileUpload';

interface Project {
  id: string;
  name: string;
  description: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

const ChatView = () => {
  const { projectId, conversationId } = useParams<{ 
    projectId: string; 
    conversationId: string; 
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [project, setProject] = useState<Project | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!projectId || !conversationId || !user) return;

      try {
        // Load project data
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('id, name, description')
          .eq('id', projectId)
          .eq('user_id', user.id)
          .single();

        if (projectError) {
          console.error('Error loading project:', projectError);
          toast({
            title: "Error",
            description: "Project not found",
            variant: "destructive",
          });
          navigate('/dashboard');
          return;
        }

        // Load conversation data
        const { data: conversationData, error: conversationError } = await supabase
          .from('conversations')
          .select('id, title, created_at')
          .eq('id', conversationId)
          .eq('user_id', user.id)
          .eq('project_id', projectId)
          .single();

        if (conversationError) {
          console.error('Error loading conversation:', conversationError);
          toast({
            title: "Error",
            description: "Conversation not found",
            variant: "destructive",
          });
          navigate(`/project/${projectId}`);
          return;
        }

        setProject(projectData);
        setConversation(conversationData);
      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: "Error",
          description: "Failed to load chat data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId, conversationId, user, navigate, toast]);

  const handleFileUploaded = () => {
    toast({
      title: "File uploaded",
      description: "File uploaded successfully to project",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading chat...</span>
      </div>
    );
  }

  if (!project || !conversation) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Chat not found</p>
        <Button 
          onClick={() => navigate('/dashboard')} 
          variant="outline" 
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate(`/project/${projectId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Project
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{conversation.title}</h1>
          <p className="text-muted-foreground">
            {project.name} • Created {new Date(conversation.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Content */}
      <Tabs defaultValue="chat" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="files" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Files
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <ChatInterface 
            conversationId={conversationId!} 
            projectId={projectId!} 
          />
        </TabsContent>

        <TabsContent value="files">
          <FileUpload 
            projectId={projectId!} 
            onFileUploaded={handleFileUploaded} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChatView;