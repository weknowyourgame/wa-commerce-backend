import { Context } from "hono";
import { callCloudflareAI, CLOUDFLARE_AI_MODELS } from "./utils/ai-utils";

// Updated generate function for better AI integration
export async function generate(request: any, env: any) {
  try {
    const { 
      prompt, 
      model = CLOUDFLARE_AI_MODELS.LLAMA_3_1_8B,
      max_tokens = 500,
      temperature = 0.7,
      top_p = 0.9
    } = request;

    if (!prompt) {
      return { 
        success: false, 
        error: "Prompt is required" 
      };
    }

    // Check for required environment variables
    if (!env.CLOUDFLARE_API_TOKEN) {
      console.error("Missing CLOUDFLARE_API_TOKEN environment variable");
      return {
        success: false,
        error: "Missing Cloudflare API configuration"
      };
    }

    if (!env.CLOUDFLARE_ACCOUNT_ID) {
      console.error("Missing CLOUDFLARE_ACCOUNT_ID environment variable");
      return {
        success: false,
        error: "Missing Cloudflare account configuration"
      };
    }

    const result = await callCloudflareAI({
      model,
      apiToken: env.CLOUDFLARE_API_TOKEN,
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      systemPrompt: "You are a helpful AI assistant.",
      userPrompt: prompt,
      maxTokens: max_tokens,
      temperature,
      topP: top_p,
      stream: false
    });

    return result;
  } catch (error: any) {
    console.error("Generate function error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// HTTP endpoint for generate
export async function generateEndpoint(c: Context) {
  try {
    const body = await c.req.json();
    const { 
      prompt, 
      model = CLOUDFLARE_AI_MODELS.LLAMA_3_1_8B,
      apiToken, 
      accountId,
      systemPrompt,
      maxTokens,
      temperature,
      topP,
      stream = false
    } = body;

    if (!prompt || !apiToken || !accountId) {
      return c.json({ 
        success: false, 
        error: "Missing required fields: prompt, apiToken, accountId are required" 
      }, 400);
    }

    const result = await callCloudflareAI({
      model,
      apiToken,
      accountId,
      systemPrompt,
      userPrompt: prompt,
      maxTokens,
      temperature,
      topP,
      stream
    });

    return c.json(result);
  } catch (error: any) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}

// Updated chat function for better AI integration
export async function chat(request: any, env: any) {
  try {
    const { 
      messages, 
      model = CLOUDFLARE_AI_MODELS.LLAMA_3_1_8B,
      max_tokens = 500,
      temperature = 0.7,
      top_p = 0.9
    } = request;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return { 
        success: false, 
        error: "Messages must be a non-empty array" 
      };
    }

    // Check for required environment variables
    if (!env.CLOUDFLARE_API_TOKEN) {
      console.error("Missing CLOUDFLARE_API_TOKEN environment variable");
      return {
        success: false,
        error: "Missing Cloudflare API configuration"
      };
    }

    if (!env.CLOUDFLARE_ACCOUNT_ID) {
      console.error("Missing CLOUDFLARE_ACCOUNT_ID environment variable");
      return {
        success: false,
        error: "Missing Cloudflare account configuration"
      };
    }

    const systemMessages = messages.filter(msg => msg.role === 'system');
    const userMessages = messages.filter(msg => msg.role === 'user');
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');

    const systemPrompt = systemMessages.map(msg => msg.content).join('\n');
    const conversation = [...userMessages, ...assistantMessages]
      .sort((a, b) => messages.indexOf(a) - messages.indexOf(b))
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const result = await callCloudflareAI({
      model,
      apiToken: env.CLOUDFLARE_API_TOKEN,
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      systemPrompt,
      userPrompt: conversation,
      maxTokens: max_tokens,
      temperature,
      topP: top_p,
      stream: false
    });

    return result;
  } catch (error: any) {
    console.error("Chat function error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

// HTTP endpoint for chat
export async function chatEndpoint(c: Context) {
  try {
    const body = await c.req.json();
    const { 
      messages, 
      model = CLOUDFLARE_AI_MODELS.LLAMA_3_1_8B,
      apiToken, 
      accountId,
      maxTokens,
      temperature,
      topP,
      stream = false
    } = body;

    if (!messages || !apiToken || !accountId) {
      return c.json({ 
        success: false, 
        error: "Missing required fields: messages, apiToken, accountId are required" 
      }, 400);
    }

    // Validate messages format
    if (!Array.isArray(messages) || messages.length === 0) {
      return c.json({ 
        success: false, 
        error: "Messages must be a non-empty array" 
      }, 400);
    }

    const systemMessages = messages.filter(msg => msg.role === 'system');
    const userMessages = messages.filter(msg => msg.role === 'user');
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');

    const systemPrompt = systemMessages.map(msg => msg.content).join('\n');
    const conversation = [...userMessages, ...assistantMessages]
      .sort((a, b) => messages.indexOf(a) - messages.indexOf(b))
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const result = await callCloudflareAI({
      model,
      apiToken,
      accountId,
      systemPrompt,
      userPrompt: conversation,
      maxTokens,
      temperature,
      topP,
      stream
    });

    return c.json(result);
  } catch (error: any) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}