import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowLeft } from 'lucide-react';

const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  systemPrompt: z.string().max(2000, 'System prompt must be less than 2000 characters').optional(),
  llmProvider: z.enum(['openai', 'openrouter']),
  llmModel: z.string().min(1, 'Model is required'),
});

type ProjectFormData = z.infer<typeof projectSchema>;

const NewProject = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      description: '',
      systemPrompt: 'You are a helpful AI assistant.',
      llmProvider: 'openai',
      llmModel: 'gpt-4',
    },
  });

  const watchProvider = form.watch('llmProvider');

  const openaiModels = [
    { value: 'gpt-4', label: 'GPT-4' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ];

  const openrouterModels = [
    { value: 'anthropic/claude-3-opus', label: 'Claude 3 Opus' },
    { value: 'anthropic/claude-3-sonnet', label: 'Claude 3 Sonnet' },
    { value: 'openai/gpt-4', label: 'GPT-4' },
    { value: 'openai/gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ];

  const availableModels = watchProvider === 'openai' ? openaiModels : openrouterModels;

  const onSubmit = async (data: ProjectFormData) => {
    if (!user) return;

    setIsLoading(true);
    
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .insert([
          {
            user_id: user.id,
            name: data.name,
            description: data.description || null,
            system_prompt: data.systemPrompt || null,
            llm_provider: data.llmProvider,
            llm_model: data.llmModel,
          }
        ])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Project created successfully!',
      });

      navigate(`/project/${project.id}`);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create project',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle>Create New Project</CardTitle>
          <CardDescription>
            Set up a new AI agent or workspace for your conversations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="Enter project name"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what this project is for..."
                rows={3}
                {...form.register('description')}
              />
              {form.formState.errors.description && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                placeholder="You are a helpful AI assistant..."
                rows={4}
                {...form.register('systemPrompt')}
              />
              <p className="text-xs text-muted-foreground">
                This defines how your AI agent should behave and respond
              </p>
              {form.formState.errors.systemPrompt && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.systemPrompt.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>LLM Provider *</Label>
                <Select
                  value={form.watch('llmProvider')}
                  onValueChange={(value) => form.setValue('llmProvider', value as 'openai' | 'openrouter')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.llmProvider && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.llmProvider.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Model *</Label>
                <Select
                  value={form.watch('llmModel')}
                  onValueChange={(value) => form.setValue('llmModel', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((model) => (
                      <SelectItem key={model.value} value={model.value}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.llmModel && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.llmModel.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/dashboard')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Project
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default NewProject;