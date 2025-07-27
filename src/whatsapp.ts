import { Context } from "hono";
import { Client } from '@neondatabase/serverless';
import { TextMessage, InteractiveMessage } from './types/wa-types';

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
          `SELECT id FROM "Merchant" WHERE "phoneNumberId" = $1`,
          [phoneNumberId]
        );

        if (merchantRows.length === 0) {
          console.log(`No merchant found for phone number ID: ${phoneNumberId}`);
          continue;
        }

        const merchantId = merchantRows[0].id;

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
            merchantId,
            new Date()
          ]
        );

        // Process different message types
        if (messageType === 'text') {
          await processTextMessage(message, merchantId, client);
        } else if (messageType === 'interactive') {
          await processInteractiveMessage(message, merchantId, client);
        }
      }
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error('Error processing WhatsApp message:', error);
  }
}

// Process text messages
async function processTextMessage(message: any, merchantId: string, client: Client) {
  const text = message.text.body;
  const from = message.from;
  
  console.log(`Processing text message from ${from}: ${text}`);
  
  // Add your business logic here
  // For example: auto-reply, order processing, etc.
  
  // Example: Auto-reply for common queries
  if (text.toLowerCase().includes('hello') || text.toLowerCase().includes('hi')) {
    // Send auto-reply
    console.log('Sending auto-reply for greeting');
  }
}

// Process interactive messages (button clicks, list selections)
async function processInteractiveMessage(message: any, merchantId: string, client: Client) {
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