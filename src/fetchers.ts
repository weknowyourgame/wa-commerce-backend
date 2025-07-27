import { Context } from "hono";
import { callCloudflareAI, CLOUDFLARE_AI_MODELS } from "./utils/ai-utils";

export async function generate(c: Context) {
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

export async function chat(c: Context) {
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