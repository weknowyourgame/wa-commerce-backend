export interface CloudflareAIOptions {
    model: string;
    apiToken: string;
    accountId: string;
    systemPrompt?: string;
    userPrompt: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stream?: boolean;
  }
  
  export interface CloudflareAIResponse {
    success: boolean;
    result?: string;
    error?: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  }
