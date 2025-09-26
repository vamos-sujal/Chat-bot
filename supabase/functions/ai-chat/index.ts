import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get environment variables
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('Environment check:', {
      hasOpenAIKey: !!OPENAI_API_KEY,
      keyPrefix: OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 7) + '...' : 'none',
      hasSupabaseUrl: !!SUPABASE_URL,
      hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY
    });

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body
    const { message, conversationId, projectId, userId } = await req.json();

    if (!message || !conversationId || !projectId || !userId) {
      throw new Error('Missing required parameters');
    }

    console.log('Processing chat request:', { conversationId, projectId, userId });

    // Get project details for system prompt
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('system_prompt, llm_model, llm_provider')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError) {
      console.error('Error fetching project:', projectError);
      throw new Error('Project not found');
    }

    // Get conversation history
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw new Error('Failed to fetch conversation history');
    }

    // Fetch uploaded files for context
    const { data: projectFiles, error: filesError } = await supabase
      .from('file_uploads')
      .select('filename, openai_file_id, file_type, file_path')
      .eq('project_id', projectId)
      .eq('user_id', userId);

    if (filesError) {
      console.error('Error fetching files:', filesError);
      // Don't throw - files are optional
    }

    let fileContext = '';
    let pdfIssues = false;
    if (projectFiles && projectFiles.length > 0) {
      fileContext = '\n\n=== Available Files Context ===\n';
      for (const file of projectFiles) {
        try {
          let content = file.openai_file_id as string | null;

          if (!content && file.file_path) {
            // Download file from storage
            const { data: fileBlob, error: dlErr } = await supabase.storage
              .from('project-files')
              .download(file.file_path);

            if (!dlErr && fileBlob) {
              if (
                file.file_type?.startsWith('text/') ||
                file.file_type === 'application/json' ||
                file.file_type === 'application/xml' ||
                file.filename?.endsWith('.md') ||
                file.filename?.endsWith('.txt') ||
                file.filename?.endsWith('.csv') ||
                file.filename?.endsWith('.log')
              ) {
                content = await fileBlob.text();
              } else if (file.file_type === 'application/pdf') {
                try {
                  const { pdfText } = await import('jsr:@pdf/pdftext@1.3.2');
                  const buf = await fileBlob.arrayBuffer();
                  const pages = await pdfText(new Uint8Array(buf));
                  content = Object.keys(pages)
                    .sort((a, b) => Number(a) - Number(b))
                    .map((k) => (pages as any)[k] ?? (pages as any)[Number(k)])
                    .join('\n\n');
                } catch (e) {
                  console.warn('PDF extraction failed in ai-chat:', e);
                  pdfIssues = true;
                }
              }

              // Cache extracted content for future requests
              if (content) {
                const preview = content.substring(0, 8000);
                await supabase
                  .from('file_uploads')
                  .update({ openai_file_id: preview })
                  .eq('project_id', projectId)
                  .eq('user_id', userId)
                  .eq('filename', file.filename);
              }
            }
          }

          if (content) {
            fileContext += `\n--- File: ${file.filename} (${file.file_type}) ---\n`;
            fileContext += content;
            fileContext += '\n';
          }
        } catch (e) {
          console.warn('Skipping file due to processing error:', file.filename, e);
          if (file.file_type === 'application/pdf') pdfIssues = true;
        }
      }
      if (pdfIssues) {
        fileContext += '\nNote: Some PDFs could not be fully processed. If I cannot reference content from them, it is likely due to OpenAI file/token limits for large documents.';
      }
      fileContext += "=== End Files Context ===\n\nYou can reference these files in your responses when relevant to the user's questions.\n";
    }

    // Store user message
    const { error: userMsgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'user',
        content: message
      });

    if (userMsgError) {
      console.error('Error storing user message:', userMsgError);
      throw new Error('Failed to store user message');
    }

    // Prepare messages for OpenAI
    const policyNote = '\n\nPolicy: If any file (especially PDFs) cannot be processed or content is missing, do NOT say you cannot read the PDF. Instead say: "OpenAI file upload limit was hit" (or "OpenAI file/token limits were hit for large documents") and ask the user for specific sections or smaller excerpts.';
    const systemPrompt = (project.system_prompt || 'You are a helpful AI assistant.') + policyNote + fileContext;
    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message }
    ];

    console.log('Sending request to OpenAI with model:', project.llm_model);

    // Call OpenAI API
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: project.llm_model === 'gpt-4' ? 'gpt-4o-mini' : project.llm_model || 'gpt-4o-mini',
        messages: conversationMessages,
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);

      let fallbackContent = 'The AI is temporarily unavailable. Please try again later.';
      try {
        const parsed = JSON.parse(errorText);
        const code = parsed?.error?.code || parsed?.error?.type;
        if (openAIResponse.status === 429 || code === 'insufficient_quota') {
          fallbackContent = 'OpenAI quota has been exceeded. Please update the OPENAI_API_KEY secret in Supabase and try again.';
        }
      } catch (_) { /* ignore parse errors */ }

      // Store a helpful assistant message so the UI continues to work
      const { error: assistantMsgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: fallbackContent
        });

      if (assistantMsgError) {
        console.error('Error storing fallback assistant message:', assistantMsgError);
      }

      return new Response(JSON.stringify({ 
        message: fallbackContent,
        success: true,
        fallback: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const data = await openAIResponse.json();
    const assistantMessage = data.choices[0].message.content;

    console.log('Received response from OpenAI');

    // Store assistant message
    const { error: assistantMsgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'assistant',
        content: assistantMessage
      });

    if (assistantMsgError) {
      console.error('Error storing assistant message:', assistantMsgError);
      throw new Error('Failed to store assistant message');
    }

    return new Response(JSON.stringify({ 
      message: assistantMessage,
      success: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-chat function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});