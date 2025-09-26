import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6 max-w-2xl mx-auto px-4">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            ChatBot Platform
          </h1>
          <p className="text-xl text-muted-foreground">
            Create powerful AI agents, manage conversations, and build intelligent chatbots with ease.
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">🤖 AI Agents</h3>
              <p className="text-sm text-muted-foreground">
                Create custom AI agents with unique personalities and capabilities
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">💬 Smart Conversations</h3>
              <p className="text-sm text-muted-foreground">
                Engage in intelligent conversations with context-aware responses
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">📁 File Integration</h3>
              <p className="text-sm text-muted-foreground">
                Upload documents and images for enhanced AI interactions
              </p>
            </div>
          </div>
          
          <Button 
            size="lg" 
            onClick={() => navigate('/auth')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3"
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
