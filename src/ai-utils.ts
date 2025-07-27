import { Context } from "hono";
import { generate } from "./fetchers";
import { generateIntentPrompt } from "./prompts/classifier";
import { generateProductsPrompt } from "./prompts/products";
import { generateOrdersPrompt } from "./prompts/orders";
import { generateBusinessPrompt } from "./prompts/business";
import { generatePaymentPrompt } from "./prompts/payment";
import { generateGeneralPrompt } from "./prompts/general";
import { UserIntent, MerchantContext, AIResponse, IntentResult } from "./types/ai-types";
import { Client } from '@neondatabase/serverless';
import { CLOUDFLARE_AI_MODELS } from "./utils/ai-utils";

// Database helper
class DatabaseManager {
  private client: Client;

  constructor(env: any) {
    this.client = new Client(env.DATABASE_URL);
  }

  async connect() {
    await this.client.connect();
  }

  async disconnect() {
    await this.client.end();
  }

  async getMerchantContext(apiToken: string): Promise<MerchantContext | null> {
    try {
      // Get merchant info
      const { rows: merchantRows } = await this.client.query(
        `SELECT m.*, u.name as user_name, u.email as user_email
         FROM "Merchant" m
         LEFT JOIN "user" u ON m."userId" = u.id
         WHERE m."apiToken" = $1`,
        [apiToken]
      );

      if (merchantRows.length === 0) {
        console.log("No merchant found for API token:", apiToken);
        return null;
      }

      const merchant = merchantRows[0];
      console.log("Found merchant:", merchant.id);

      // Get products
      const { rows: products } = await this.client.query(
        `SELECT id, name, description, price, "imageUrl" FROM "Product" WHERE "merchantId" = $1`,
        [merchant.id]
      );

      // Get orders - Fixed column name from txnid to txnId
      const { rows: orders } = await this.client.query(
        `SELECT o.id, o.amount, o.status, o."createdAt", o."txnId",
                p.name as product_name, p.price as product_price
         FROM "Order" o
         LEFT JOIN "Product" p ON o."productId" = p.id
         WHERE o."merchantId" = $1
         ORDER BY o."createdAt" DESC`,
        [merchant.id]
      );

      return { merchant, products, orders };
    } catch (error) {
      console.error('Database error:', error);
      return null;
    }
  }
}

// AI Intent Classifier
class IntentClassifier {
  static async classify(userMessage: string, env: any): Promise<IntentResult> {
    try {
      // Check for required environment variables
      if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
        console.error("Missing Cloudflare environment variables");
        throw new Error("Cloudflare API configuration is missing");
      }

      const prompt = generateIntentPrompt(userMessage);
      console.log("Intent classification prompt:", prompt.substring(0, 100) + "...");
      
      const response = await generate({
        prompt,
        model: CLOUDFLARE_AI_MODELS.LLAMA_3_1_8B,
        max_tokens: 100
      }, env);

      console.log("Intent classification response:", response);

      if (!response.success) {
        throw new Error(`Failed to classify intent: ${response.error}`);
      }

      if (!response.result) {
        throw new Error("No result returned from intent classification");
      }

      try {
        const result = JSON.parse(response.result as string);
        return {
          intent: result.intent as UserIntent,
          targetId: result.targetId
        };
      } catch (parseError) {
        console.error("Failed to parse intent classification result:", parseError);
        console.error("Raw result:", response.result);
        throw new Error("Invalid intent classification result format");
      }
    } catch (error) {
      console.error("Intent classification error:", error);
      return {
        intent: UserIntent.GENERAL_CHAT
      };
    }
  }
}

// AI Response Generator
class ResponseGenerator {
  static async generateContextResponse(
    intent: UserIntent,
    userMessage: string,
    context: MerchantContext,
    targetId: string | undefined,
    env: any
  ): Promise<string> {
    try {
      // Check for required environment variables
      if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
        console.error("Missing Cloudflare environment variables");
        throw new Error("Cloudflare API configuration is missing");
      }

      let prompt = "";

      switch (intent) {
        case UserIntent.VIEW_PRODUCTS:
        case UserIntent.PRODUCT_INFO:
        case UserIntent.ORDER_PRODUCT:
          prompt = generateProductsPrompt(intent, userMessage, context.products, targetId);
          break;

        case UserIntent.ALL_ORDERS_INFO:
        case UserIntent.SINGLE_ORDER_INFO:
        case UserIntent.CONFIRM_ORDER:
          prompt = generateOrdersPrompt(intent, userMessage, context.orders, targetId);
          break;

        case UserIntent.BUSINESS_INFO:
          prompt = generateBusinessPrompt(intent, userMessage, context.merchant);
          break;

        case UserIntent.PAYMENT_INFO:
          prompt = generatePaymentPrompt(intent, userMessage, context.merchant);
          break;

        case UserIntent.GENERAL_CHAT:
        default:
          prompt = generateGeneralPrompt(intent, userMessage);
          break;
      }

      console.log("Response generation prompt:", prompt.substring(0, 100) + "...");

      const response = await generate({
        prompt,
        model: CLOUDFLARE_AI_MODELS.LLAMA_3_1_8B,
        max_tokens: 500
      }, env);

      console.log("Response generation result:", response);

      if (!response.success) {
        throw new Error(`Failed to generate response: ${response.error}`);
      }

      if (!response.result) {
        throw new Error("No result returned from response generation");
      }

      return response.result as string;
    } catch (error) {
      console.error("Response generation error:", error);
      return "I'm sorry, I'm having trouble processing your request. How can I help you?";
    }
  }
}

// Main AI Processor
class AIProcessor {
  private db: DatabaseManager;
  private env: any;

  constructor(env: any) {
    this.db = new DatabaseManager(env);
    this.env = env;
  }

  async processMessage(message: string, apiToken: string): Promise<AIResponse> {
    try {
      console.log("Processing message:", message);
      console.log("API Token:", apiToken ? `${apiToken.substring(0, 8)}...` : "null");
      
      // Connect to database
      await this.db.connect();

      // Step 1: Classify intent
      const intentResult = await IntentClassifier.classify(message, this.env);
      console.log("Intent classified:", intentResult);

      // Step 2: Get merchant context
      const context = await this.db.getMerchantContext(apiToken);
      
      if (!context) {
        console.log("No merchant context found for API token");
        return {
          success: false,
          error: "Invalid API token - no merchant found"
        };
      }

      console.log("Found context:", {
        merchantId: context.merchant.id,
        productsCount: context.products.length,
        ordersCount: context.orders.length
      });

      // Step 3: Generate context-aware response
      const response = await ResponseGenerator.generateContextResponse(
        intentResult.intent,
        message,
        context,
        intentResult.targetId,
        this.env
      );

      return {
        success: true,
        data: {
          response,
          intent: intentResult.intent,
          targetId: intentResult.targetId,
          context: {
            productsCount: context.products.length,
            ordersCount: context.orders.length,
            businessName: context.merchant.businessInfo?.name || 'Unknown'
          }
        }
      };

    } catch (error: any) {
      console.error("AI processing error:", error);
      return {
        success: false,
        error: error.message || "Unknown error"
      };
    } finally {
      await this.db.disconnect();
    }
  }
}

// HTTP endpoint handler
export async function processIntentMessage(c: Context) {
  try {
    const body = await c.req.json();
    const { message, phoneNumber } = body;
    const apiToken = c.req.header("Authorization")?.replace("Bearer ", "");
    
    if (!apiToken) {
      return c.json({ 
        success: false, 
        error: "Authorization header with API token is required" 
      }, 401);
    }

    if (!message) {
      return c.json({ 
        success: false, 
        error: "message is required" 
      }, 400);
    }

    // Check for required environment variables
    if (!c.env.CLOUDFLARE_API_TOKEN || !c.env.CLOUDFLARE_ACCOUNT_ID) {
      console.error("Missing Cloudflare environment variables in processIntentMessage");
      return c.json({
        success: false,
        error: "Cloudflare API configuration is missing"
      }, 500);
    }

    // Process with AI
    const aiProcessor = new AIProcessor(c.env);
    const result = await aiProcessor.processMessage(message, apiToken);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 400);
    }

    return c.json({
      success: true,
      data: result.data
    });

  } catch (error: any) {
    console.error("Intent processing error:", error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}

// Internal function for webhook processing
export async function processIntentMessageInternal(request: any, env: any): Promise<AIResponse> {
  try {
    const { message, phoneNumber, apiToken } = request;
    
    if (!apiToken || !message) {
      return { success: false, error: "Missing required fields" };
    }

    // Check for required environment variables
    if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
      console.error("Missing Cloudflare environment variables in processIntentMessageInternal");
      return { success: false, error: "Cloudflare API configuration is missing" };
    }

    // Process with AI
    const aiProcessor = new AIProcessor(env);
    return await aiProcessor.processMessage(message, apiToken);

  } catch (error: any) {
    console.error("Internal intent processing error:", error);
    return { success: false, error: error.message };
  }
} 