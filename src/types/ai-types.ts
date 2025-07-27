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

  export enum UserIntent {
    VIEW_PRODUCTS = "VIEW_PRODUCTS",
    ORDER_PRODUCT = "ORDER_PRODUCT",
    PRODUCT_INFO = "PRODUCT_INFO",
    BUSINESS_INFO = "BUSINESS_INFO",
    GENERAL_CHAT = "GENERAL_CHAT",
    PAYMENT_INFO = "PAYMENT_INFO",
    ALL_ORDERS_INFO = "ALL_ORDERS_INFO",
    SINGLE_ORDER_INFO = "SINGLE_ORDER_INFO",
    CONFIRM_ORDER = "CONFIRM_ORDER"
  }

export interface IntentResult {
  intent: UserIntent;
  targetId?: string;
}

export interface MerchantContext {
  merchant: any;
  products: any[];
  orders: any[];
}

export interface AIResponse {
  success: boolean;
  data?: {
    response: string;
    intent: UserIntent;
    targetId?: string;
    context: {
      productsCount: number;
      ordersCount: number;
      businessName: string;
    };
  };
  error?: string;
}
