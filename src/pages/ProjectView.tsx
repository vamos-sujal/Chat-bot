import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, 
  MessageSquare, 
  Settings, 
  Upload, 
  Plus,
  Calendar,
  Brain
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  llm_provider: string;
  llm_model: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

interface FileUpload {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

const ProjectView = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<Project | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId && user) {
      loadProjectData();
    }
  }, [projectId, user]);

  const loadProjectData = async () => {
    setLoading(true);

    try {
      // Load project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Load conversations
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('conversations')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (!conversationsError && conversationsData) {
        setConversations(conversationsData);
      }

      // Load files
      const { data: filesData, error: filesError } = await supabase
        .from('file_uploads')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (!filesError && filesData) {
        setFiles(filesData);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load project',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          project_id: projectId!,
          title: 'New Chat'
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating conversation:', error);
        toast({
          title: "Error",
          description: "Failed to create new chat",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Chat created",
        description: "New chat started successfully",
      });

      // Navigate to chat view
      navigate(`/project/${projectId}/chat/${data.id}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Failed to create new chat",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold">Project not found</h2>
        <Button onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        <Button onClick={handleNewChat}>
          <MessageSquare className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground mt-2">{project.description}</p>
          )}
        </div>

        <div className="flex items-center gap-4">
          <Badge variant="secondary">
            <Brain className="h-3 w-3 mr-1" />
            {project.llm_provider} / {project.llm_model}
          </Badge>
          <div className="flex items-center text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 mr-1" />
            Created {new Date(project.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Conversations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{conversations.length}</div>
                <p className="text-xs text-muted-foreground">Total chats</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Files</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{files.length}</div>
                <p className="text-xs text-muted-foreground">Uploaded files</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Model</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-semibold">{project.llm_model}</div>
                <p className="text-xs text-muted-foreground">{project.llm_provider}</p>
              </CardContent>
            </Card>
          </div>

          {project.system_prompt && (
            <Card>
              <CardHeader>
                <CardTitle>System Prompt</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm bg-muted p-3 rounded">{project.system_prompt}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="conversations" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Recent Conversations</h3>
            <Button onClick={handleNewChat} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>

          {conversations.length === 0 ? (
            <Card className="text-center p-8">
              <CardContent>
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <CardTitle className="mb-2">No conversations yet</CardTitle>
                <CardDescription className="mb-4">
                  Start your first conversation with this AI agent
                </CardDescription>
                <Button onClick={handleNewChat}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Start Chatting
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <Card
                  key={conversation.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/project/${projectId}/chat/${conversation.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{conversation.title}</h4>
                      <span className="text-sm text-muted-foreground">
                        {new Date(conversation.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Uploaded Files</h3>
            <Button onClick={() => navigate('/uploads')} size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </Button>
          </div>

          {files.length === 0 ? (
            <Card className="text-center p-8">
              <CardContent>
                <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <CardTitle className="mb-2">No files uploaded</CardTitle>
                <CardDescription className="mb-4">
                  Upload documents and images to enhance your AI conversations
                </CardDescription>
                <Button onClick={() => navigate('/uploads')}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Files
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <Card key={file.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{file.filename}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{file.file_type}</span>
                          <span>•</span>
                          <span>{formatFileSize(file.file_size)}</span>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {new Date(file.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Project Settings</CardTitle>
              <CardDescription>
                Manage your project configuration and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Settings panel coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectView;