import { Context } from "hono";
import { Client } from '@neondatabase/serverless';
import { TextMessage, InteractiveMessage } from './types/wa-types';
import { processIntentMessage } from './ai-utils';

// POST /api/whatsapp/send-message - Send text message
export async function sendTextMessage(c: Context) {
  try {
    const body = await c.req.json();
    const { to, message } = body;
    const apiToken = c.req.header("Authorization")?.replace("Bearer ", "");
    
    if (!apiToken) {
      return c.json({ 
        success: false, 
        error: "Authorization header with API token is required" 
      }, 401);
    }

    if (!to || !message) {
      return c.json({ 
        success: false, 
        error: "to and message are required" 
      }, 400);
    }

    // Get merchant's WhatsApp configuration
    const client = new Client(c.env.DATABASE_URL);
    await client.connect();
    
    try {
      const { rows } = await client.query(
        `SELECT m.id, m."phoneNumberId", m."whatsappAccessToken" FROM "Merchant" m WHERE m."apiToken" = $1`,
        [apiToken]
      );

      if (rows.length === 0) {
        return c.json({ 
          success: false, 
          error: "Invalid API token" 
        }, 401);
      }

      const merchant = rows[0];
      
      if (!merchant.phoneNumberId || !merchant.whatsappAccessToken) {
        return c.json({ 
          success: false, 
          error: "WhatsApp not configured for this merchant" 
        }, 400);
      }

      // Send message via WhatsApp Business API
      const whatsappMessage: TextMessage = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: {
          preview_url: true,
          body: message
        }
      };

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${merchant.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${merchant.whatsappAccessToken}`
          },
          body: JSON.stringify(whatsappMessage)
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return c.json({
          success: false,
          error: result.error?.message || "Failed to send WhatsApp message"
        }, response.status);
      }

      // Log the message in database
      await client.query(
        `INSERT INTO "WebhookEvent" (id, payload, "merchantId", "receivedAt")
         VALUES ($1, $2, $3, $4)`,
        [
          crypto.randomUUID(),
          JSON.stringify({
            type: 'whatsapp_message_sent',
            to,
            message,
            whatsapp_response: result
          }),
          merchant.id,
          new Date()
        ]
      );

      return c.json({
        success: true,
        data: result,
        message: "Message sent successfully"
      });
    } finally {
      await client.end();
    }
  } catch (error: any) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}

// POST /api/whatsapp/send-interactive - Send interactive message (buttons/lists)
export async function sendInteractiveMessage(c: Context) {
  try {
    const body = await c.req.json();
    const { to, type, header, body: messageBody, action } = body;
    const apiToken = c.req.header("Authorization")?.replace("Bearer ", "");
    
    if (!apiToken) {
      return c.json({ 
        success: false, 
        error: "Authorization header with API token is required" 
      }, 401);
    }

    if (!to || !type || !messageBody || !action) {
      return c.json({ 
        success: false, 
        error: "to, type, body, and action are required" 
      }, 400);
    }

    if (!['button', 'list'].includes(type)) {
      return c.json({ 
        success: false, 
        error: "type must be 'button' or 'list'" 
      }, 400);
    }

    // Get merchant's WhatsApp configuration
    const client = new Client(c.env.DATABASE_URL);
    await client.connect();
    
    try {
      const { rows } = await client.query(
        `SELECT m.id, m."phoneNumberId", m."whatsappAccessToken" FROM "Merchant" m WHERE m."apiToken" = $1`,
        [apiToken]
      );

      if (rows.length === 0) {
        return c.json({ 
          success: false, 
          error: "Invalid API token" 
        }, 401);
      }

      const merchant = rows[0];
      
      if (!merchant.phoneNumberId || !merchant.whatsappAccessToken) {
        return c.json({ 
          success: false, 
          error: "WhatsApp not configured for this merchant" 
        }, 400);
      }

      // Build interactive message
      const interactiveMessage: InteractiveMessage = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: {
          type: type as "button" | "list",
          body: {
            text: messageBody
          },
          action
        }
      };

      // Add header if provided
      if (header) {
        interactiveMessage.interactive.header = header;
      }

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${merchant.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${merchant.whatsappAccessToken}`
          },
          body: JSON.stringify(interactiveMessage)
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return c.json({
          success: false,
          error: result.error?.message || "Failed to send interactive WhatsApp message"
        }, response.status);
      }

      // Log the message in database
      await client.query(
        `INSERT INTO "WebhookEvent" (id, payload, "merchantId", "receivedAt")
         VALUES ($1, $2, $3, $4)`,
        [
          crypto.randomUUID(),
          JSON.stringify({
            type: 'whatsapp_interactive_message_sent',
            to,
            interactive_type: type,
            action,
            whatsapp_response: result
          }),
          merchant.id,
          new Date()
        ]
      );

      return c.json({
        success: true,
        data: result,
        message: "Interactive message sent successfully"
      });
    } finally {
      await client.end();
    }
  } catch (error: any) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}

// GET /webhook - Webhook verification
export async function webhookVerification(c: Context) {
  try {
    const mode = c.req.query('hub.mode');
    const token = c.req.query('hub.verify_token');
    const challenge = c.req.query('hub.challenge');
    const verifyToken = c.env.VERIFY_TOKEN || 'your_verify_token';

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('WEBHOOK VERIFIED');
      return new Response(challenge, { status: 200 });
    } else {
      return new Response('Forbidden', { status: 403 });
    }
  } catch (error: any) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}

// POST /webhook - Webhook receiver (incoming messages)
export async function webhookReceiver(c: Context) {
  try {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    console.log(`\n\nWebhook received ${timestamp}\n`);
    
    const body = await c.req.json();
    console.log(JSON.stringify(body, null, 2));

    // Process the webhook
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            await processWhatsAppMessage(change.value, c.env);
          }
        }
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Helper function to process incoming WhatsApp messages
async function processWhatsAppMessage(value: any, env: any) {
  try {
    const client = new Client(env.DATABASE_URL);
    await client.connect();
    
    try {
      // Extract message details
      const metadata = value.metadata;
      const messages = value.messages || [];
      
      for (const message of messages) {
        const phoneNumberId = metadata.phone_number_id;
        const from = message.from;
        const messageType = message.type;
        const timestamp = message.timestamp;
        
        // Find merchant by phone number ID
        const { rows: merchantRows } = await client.query(
          `SELECT id, "apiToken" FROM "Merchant" WHERE "phoneNumberId" = $1`,
          [phoneNumberId]
        );

        if (merchantRows.length === 0) {
          console.log(`No merchant found for phone number ID: ${phoneNumberId}`);
          continue;
        }

        const merchant = merchantRows[0];

        // Store the webhook event
        await client.query(
          `INSERT INTO "WebhookEvent" (id, payload, "merchantId", "receivedAt")
           VALUES ($1, $2, $3, $4)`,
          [
            crypto.randomUUID(),
            JSON.stringify({
              type: 'whatsapp_message_received',
              from,
              message_type: messageType,
              timestamp,
              message_data: message
            }),
            merchant.id,
            new Date()
          ]
        );

        // Process different message types
        if (messageType === 'text') {
          await processTextMessage(message, merchant, client, env);
        } else if (messageType === 'interactive') {
          await processInteractiveMessage(message, merchant, client);
        }
      }
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('Error processing WhatsApp message:', error);
  }
}

// Process text messages with AI intent system
async function processTextMessage(message: any, merchant: any, client: Client, env: any) {
  const text = message.text.body;
  const from = message.from;
  
  console.log(`Processing text message from ${from}: ${text}`);
  
  try {
    // Use the intent-based AI system to generate response
    const intentResponse = await processIntentMessageInternal({
      message: text,
      phoneNumber: from,
      apiToken: merchant.apiToken
    }, env);

    if (intentResponse.success) {
      // Send the AI-generated response back to the user
      await sendWhatsAppResponse(from, intentResponse.data.response, merchant, client);
    } else {
      // Fallback response if AI fails
      await sendWhatsAppResponse(from, "I'm sorry, I didn't understand that. How can I help you?", merchant, client);
    }
  } catch (error) {
    console.error('Error processing intent message:', error);
    // Send fallback response
    await sendWhatsAppResponse(from, "I'm having trouble processing your request. Please try again.", merchant, client);
  }
}

// Helper function to send WhatsApp response
async function sendWhatsAppResponse(to: string, message: string, merchant: any, client: Client) {
  try {
    const whatsappMessage: TextMessage = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: true,
        body: message
      }
    };

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${merchant.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${merchant.whatsappAccessToken}`
        },
        body: JSON.stringify(whatsappMessage)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('Failed to send WhatsApp response:', result);
      return;
    }

    // Log the response
    await client.query(
      `INSERT INTO "WebhookEvent" (id, payload, "merchantId", "receivedAt")
       VALUES ($1, $2, $3, $4)`,
      [
        crypto.randomUUID(),
        JSON.stringify({
          type: 'whatsapp_ai_response_sent',
          to,
          message,
          whatsapp_response: result
        }),
        merchant.id,
        new Date()
      ]
    );

    console.log(`AI response sent to ${to}: ${message}`);
  } catch (error) {
    console.error('Error sending WhatsApp response:', error);
  }
}

// Internal function to process intent (without HTTP context)
async function processIntentMessageInternal(request: any, env: any) {
  try {
    const { message, phoneNumber, apiToken } = request;
    
    if (!apiToken || !message) {
      return { success: false, error: "Missing required fields" };
    }

    // Import the AI functions directly
    const { generate } = await import('./fetchers');
    const { generateIntentPrompt } = await import('./prompts/classifier');
    const { generateProductsPrompt } = await import('./prompts/products');
    const { generateOrdersPrompt } = await import('./prompts/orders');
    const { generateBusinessPrompt } = await import('./prompts/business');
    const { generatePaymentPrompt } = await import('./prompts/payment');
    const { generateGeneralPrompt } = await import('./prompts/general');
    const { UserIntent } = await import('./types/ai-types');

    // Step 1: Classify intent
    const intentPrompt = generateIntentPrompt(message);
    const intentResponse = await generate({
      prompt: intentPrompt,
      model: "gpt-3.5-turbo",
      max_tokens: 100
    }, env);

    if (!intentResponse.success) {
      throw new Error("Failed to classify intent");
    }

    const intentResult = JSON.parse(intentResponse.data);
    const intent = intentResult.intent as UserIntent;
    const targetId = intentResult.targetId;

    // Step 2: Get merchant context
    const client = new Client(env.DATABASE_URL);
    await client.connect();
    
    try {
      const { rows: merchantRows } = await client.query(
        `SELECT m.*, u.name as user_name, u.email as user_email
         FROM "Merchant" m
         LEFT JOIN "user" u ON m."userId" = u.id
         WHERE m."apiToken" = $1`,
        [apiToken]
      );

      if (merchantRows.length === 0) {
        return { success: false, error: "Invalid API token" };
      }

      const merchant = merchantRows[0];

      // Get products
      const { rows: products } = await client.query(
        `SELECT id, name, description, price, "imageUrl" FROM "Product" WHERE "merchantId" = $1`,
        [merchant.id]
      );

      // Get orders
      const { rows: orders } = await client.query(
        `SELECT o.id, o.amount, o.status, o."createdAt", o.txnId,
                p.name as product_name, p.price as product_price
         FROM "Order" o
         LEFT JOIN "Product" p ON o."productId" = p.id
         WHERE o."merchantId" = $1
         ORDER BY o."createdAt" DESC`,
        [merchant.id]
      );

      const context = { merchant, products, orders };

      // Step 3: Generate context-aware response
      let prompt = "";
      switch (intent) {
        case UserIntent.VIEW_PRODUCTS:
        case UserIntent.PRODUCT_INFO:
        case UserIntent.ORDER_PRODUCT:
          prompt = generateProductsPrompt(intent, message, context.products, targetId);
          break;
        case UserIntent.ALL_ORDERS_INFO:
        case UserIntent.SINGLE_ORDER_INFO:
        case UserIntent.CONFIRM_ORDER:
          prompt = generateOrdersPrompt(intent, message, context.orders, targetId);
          break;
        case UserIntent.BUSINESS_INFO:
          prompt = generateBusinessPrompt(intent, message, context.merchant);
          break;
        case UserIntent.PAYMENT_INFO:
          prompt = generatePaymentPrompt(intent, message, context.merchant);
          break;
        case UserIntent.GENERAL_CHAT:
        default:
          prompt = generateGeneralPrompt(intent, message);
          break;
      }

      const response = await generate({
        prompt,
        model: "gpt-4",
        max_tokens: 500
      }, env);

      if (!response.success) {
        return { success: false, error: "Failed to generate response" };
      }

      return {
        success: true,
        data: {
          response: response.data,
          intent,
          targetId,
          context: {
            productsCount: context.products.length,
            ordersCount: context.orders.length,
            businessName: context.merchant.businessInfo?.name || 'Unknown'
          }
        }
      };
    } finally {
      await client.end();
    }
  } catch (error: any) {
    console.error("Intent processing error:", error);
    return { success: false, error: error.message };
  }
}

// Process interactive messages (button clicks, list selections)
async function processInteractiveMessage(message: any, merchant: any, client: Client) {
  const interactive = message.interactive;
  const from = message.from;
  
  console.log(`Processing interactive message from ${from}:`, interactive);
  
  // Handle button responses
  if (interactive.type === 'button_reply') {
    const buttonId = interactive.button_reply.id;
    console.log(`Button clicked: ${buttonId}`);
    
    // Add your business logic here
    // For example: order status, product catalog, etc.
  }
  
  // Handle list responses
  if (interactive.type === 'list_reply') {
    const listId = interactive.list_reply.id;
    console.log(`List item selected: ${listId}`);
    
    // Add your business logic here
  }
} 