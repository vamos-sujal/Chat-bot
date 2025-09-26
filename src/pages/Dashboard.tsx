import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, MessageSquare, FolderOpen, Upload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface RecentChat {
  id: string;
  title: string;
  project_id: string;
  created_at: string;
  projects?: {
    name: string;
  };
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    setLoading(true);
    
    // Load projects
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(6);

    if (!projectsError && projectsData) {
      setProjects(projectsData);
    }

    // Load recent conversations with project names
    const { data: chatsData, error: chatsError } = await supabase
      .from('conversations')
      .select(`
        *,
        projects (
          name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!chatsError && chatsData) {
      setRecentChats(chatsData);
    }

    setLoading(false);
  };

  const handleNewProject = () => {
    navigate('/project/new');
  };

  const handleNewChat = async () => {
    // If user has projects, create a chat in the first project
    if (projects.length > 0) {
      const { data, error } = await supabase
        .from('conversations')
        .insert([
          {
            project_id: projects[0].id,
            user_id: user?.id,
            title: 'New Chat',
          }
        ])
        .select()
        .single();

      if (!error && data) {
        navigate(`/project/${projects[0].id}/chat/${data.id}`);
      }
    } else {
      // If no projects, redirect to create one first
      navigate('/project/new');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Welcome back!</h1>
        <p className="text-muted-foreground">
          {user?.user_metadata?.full_name ? `Hi ${user.user_metadata.full_name}, ` : ''}
          What would you like to work on today?
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/20">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">AI Chat</CardTitle>
                <CardDescription className="text-sm">
                  Quick intelligent conversation
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Button 
              onClick={() => navigate('/chat')} 
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-md"
            >
              Start Chat
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/20">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">New Project Chat</CardTitle>
                <CardDescription className="text-sm">
                  Start chat in existing project
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Button 
              onClick={handleNewChat} 
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-md"
            >
              New Chat
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-primary/20">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">New Project</CardTitle>
                <CardDescription className="text-sm">
                  Create AI agent workspace
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Button 
              onClick={handleNewProject} 
              variant="outline" 
              className="w-full border-primary/20 hover:bg-primary/5 hover:border-primary/40 transition-all duration-200"
            >
              Create Project
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      {projects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Projects</h2>
            <Button variant="outline" onClick={() => navigate('/projects')}>
              View All
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/project/${project.id}`)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    {project.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="line-clamp-2">
                    {project.description || 'No description provided'}
                  </CardDescription>
                  <p className="text-xs text-muted-foreground mt-2">
                    Created {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent Chats */}
      {recentChats.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Conversations</h2>
          </div>
          <div className="space-y-2">
            {recentChats.map((chat) => (
              <Card
                key={chat.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/project/${chat.project_id}/chat/${chat.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">{chat.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {chat.projects?.name} • {new Date(chat.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {projects.length === 0 && (
        <Card className="text-center p-8">
          <CardContent>
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle className="mb-2">No projects yet</CardTitle>
            <CardDescription className="mb-4">
              Create your first AI agent or workspace to get started
            </CardDescription>
            <Button onClick={handleNewProject}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Project
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;