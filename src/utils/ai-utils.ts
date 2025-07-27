import { CloudflareAIOptions, CloudflareAIResponse } from "../types/ai-types";

  export async function callCloudflareAI(options: CloudflareAIOptions): Promise<CloudflareAIResponse> {
    const {
      model,
      apiToken,
      accountId,
      systemPrompt = "",
      userPrompt,
      maxTokens = 4096,
      temperature = 0.7,
      topP = 1,
      stream = false
    } = options;
  
    try {
      // Determine if this is a direct Cloudflare AI model or a gateway model
      const isDirectModel = model.startsWith('@cf/') || model.startsWith('@hf/');
      
      let url: string;
      let requestBody: any;
      let headers: Record<string, string>;
  
      if (isDirectModel) {
        // Direct Cloudflare AI model
        url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
        requestBody = {
          prompt: systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt,
          stream,
          max_tokens: maxTokens,
          temperature,
          top_p: topP
        };
        headers = {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        };
      } else {
        // Gateway model (like Gemini, OpenAI, etc.)
        // For gateway models, we need to determine the gateway type
        // This is a simplified version - you might need to add more gateway types
        const gatewayType = determineGatewayType(model);
        url = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayType}/openai/chat/completions`;
        requestBody = {
          model,
          messages: [
            ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
            { role: "user", content: userPrompt }
          ],
          max_tokens: maxTokens,
          temperature,
          top_p: topP,
          stream
        };
        headers = {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        };
      }
  
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Cloudflare AI API error (${response.status}): ${errorText}`);
      }
  
      const data = await response.json();
  
      if (isDirectModel) {
        // Handle direct model response
        if (!data.result || !data.result.response) {
          throw new Error("No content received from Cloudflare AI API.");
        }
        
        return {
          success: true,
          result: data.result.response,
          usage: data.result.usage
        };
      } else {
        // Handle gateway model response
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error("No content received from Cloudflare AI Gateway.");
        }
        
        return {
          success: true,
          result: data.choices[0].message.content,
          usage: data.usage
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    }
  }
  
  /**
   * Simplified function for text generation with Cloudflare AI
   */
  export async function generateText(
    prompt: string,
    options: Omit<CloudflareAIOptions, 'userPrompt' | 'systemPrompt'> & {
      systemPrompt?: string;
    }
  ): Promise<CloudflareAIResponse> {
    return callCloudflareAI({
      ...options,
      userPrompt: prompt,
      systemPrompt: options.systemPrompt || ""
    });
  }
  
  /**
   * Function for chat-style conversations
   */
  export async function chatWithAI(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: Omit<CloudflareAIOptions, 'userPrompt' | 'systemPrompt'>
  ): Promise<CloudflareAIResponse> {
    const systemMessages = messages.filter(msg => msg.role === 'system');
    const userMessages = messages.filter(msg => msg.role === 'user');
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');
  
    const systemPrompt = systemMessages.map(msg => msg.content).join('\n');
    const conversation = [...userMessages, ...assistantMessages]
      .sort((a, b) => messages.indexOf(a) - messages.indexOf(b))
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
  
    return callCloudflareAI({
      ...options,
      systemPrompt,
      userPrompt: conversation
    });
  }
  
  /**
   * Helper function to determine gateway type based on model name
   */
  function determineGatewayType(model: string): string {
    if (model.includes('gpt') || model.includes('openai')) {
      return 'openai';
    }
    if (model.includes('gemini') || model.includes('google')) {
      return 'google-ai-studio';
    }
    if (model.includes('claude') || model.includes('anthropic')) {
      return 'anthropic';
    }
    if (model.includes('llama') || model.includes('meta')) {
      return 'meta';
    }
    // Default to openai gateway
    return 'openai';
  }
  
  /**
   * Predefined model configurations for common use cases
   */
  export const CLOUDFLARE_AI_MODELS = {
    // Direct Cloudflare models
    LLAMA_3_1_8B: "@cf/meta/llama-3.1-8b-instruct",
    LLAMA_3_1_70B: "@cf/meta/llama-3.1-70b-instruct",
    MISTRAL_7B: "@cf/mistral/mistral-7b-instruct-v0.2",
    GEMMA_2B: "@cf/google/gemma-2b-it",
    GEMMA_7B: "@cf/google/gemma-7b-it",
    
    // Hugging Face models
    CODELLAMA_7B: "@hf/codellama/codellama-7b-instruct",
    PHI_3_MINI: "@hf/microsoft/phi-3-mini-4k-instruct",
    
    // Gateway models (examples)
    GPT_4: "gpt-4",
    GPT_3_5_TURBO: "gpt-3.5-turbo",
    GEMINI_PRO: "gemini-1.5-pro",
    GEMINI_FLASH: "gemini-1.5-flash",
    CLAUDE_3_OPUS: "claude-3-opus-20240229",
    CLAUDE_3_SONNET: "claude-3-sonnet-20240229"
  } as const;
  