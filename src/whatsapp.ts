import { Context } from "hono";
import { Client } from '@neondatabase/serverless';
import { TextMessage, InteractiveMessage } from './types/wa-types';
import { processIntentMessageInternal } from './ai-utils';

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
      const { rows: merchantRows } = await client.query(
        `SELECT m.*, u.name as user_name, u.email as user_email
         FROM "Merchant" m
         LEFT JOIN "user" u ON m."userId" = u.id
         WHERE m."apiToken" = $1`,
        [apiToken]
      );

      if (merchantRows.length === 0) {
        return c.json({ 
          success: false, 
          error: "Invalid API token" 
        }, 401);
      }

      const merchant = merchantRows[0];

      // Check if merchant has WhatsApp configuration
      if (!merchant.phoneNumberId || !merchant.whatsappAccessToken) {
        return c.json({ 
          success: false, 
          error: "Merchant WhatsApp configuration is missing" 
        }, 400);
      }

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
        console.error('Failed to send WhatsApp message:', result);
        return c.json({ 
          success: false, 
          error: "Failed to send WhatsApp message" 
        }, 500);
      }

      // Log the message
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
        data: {
          message_id: result.messages?.[0]?.id,
          whatsapp_response: result
        }
      });

    } finally {
      await client.end();
    }
  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}

// POST /api/whatsapp/send-interactive - Send interactive message
export async function sendInteractiveMessage(c: Context) {
  try {
    const body = await c.req.json();
    const { to, interactiveMessage } = body;
    const apiToken = c.req.header("Authorization")?.replace("Bearer ", "");
    
    if (!apiToken) {
      return c.json({ 
        success: false, 
        error: "Authorization header with API token is required" 
      }, 401);
    }

    if (!to || !interactiveMessage) {
      return c.json({ 
        success: false, 
        error: "to and interactiveMessage are required" 
      }, 400);
    }

    // Get merchant's WhatsApp configuration
    const client = new Client(c.env.DATABASE_URL);
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
        return c.json({ 
          success: false, 
          error: "Invalid API token" 
        }, 401);
      }

      const merchant = merchantRows[0];

      // Check if merchant has WhatsApp configuration
      if (!merchant.phoneNumberId || !merchant.whatsappAccessToken) {
        return c.json({ 
          success: false, 
          error: "Merchant WhatsApp configuration is missing" 
        }, 400);
      }

      const whatsappMessage: InteractiveMessage = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "interactive",
        interactive: interactiveMessage
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
        console.error('Failed to send WhatsApp interactive message:', result);
        return c.json({ 
          success: false, 
          error: "Failed to send WhatsApp interactive message" 
        }, 500);
      }

      // Log the message
      await client.query(
        `INSERT INTO "WebhookEvent" (id, payload, "merchantId", "receivedAt")
         VALUES ($1, $2, $3, $4)`,
        [
          crypto.randomUUID(),
          JSON.stringify({
            type: 'whatsapp_interactive_message_sent',
            to,
            interactiveMessage,
            whatsapp_response: result
          }),
          merchant.id,
          new Date()
        ]
      );

      return c.json({
        success: true,
        data: {
          message_id: result.messages?.[0]?.id,
          whatsapp_response: result
        }
      });

    } finally {
      await client.end();
    }
  } catch (error: any) {
    console.error('Error sending WhatsApp interactive message:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}

// GET /webhook - Webhook verification
export async function webhookVerification(c: Context) {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  console.log("Webhook verification request:", { mode, token, challenge });

  // You should verify the token against your stored verification token
  const verifyToken = c.env.VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken) {
    console.log("Webhook verified successfully");
    return c.text(challenge || "OK");
  } else {
    console.log("Webhook verification failed");
    return c.text("Forbidden", 403);
  }
}

// POST /webhook - Webhook receiver
export async function webhookReceiver(c: Context) {
  try {
    const body = await c.req.json();
    console.log("Webhook received:", JSON.stringify(body, null, 2));

    // TODO: Verify webhook signature
    // Verify webhook signature 
    // const signature = c.req.header("x-hub-signature-256");
    // Verify signature TODO

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const phoneNumberId = change?.value?.metadata?.phone_number_id;
          if (change.value && change.value.messages) {
            for (const message of change.value.messages) {
              await processWhatsAppMessage(message, phoneNumberId, c.env, c);
            }
          }
        }
      }
    }

    return c.text("OK");
  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return c.text("Error", 500);
  }
}

// Process WhatsApp messages
async function processWhatsAppMessage(message: any, phoneNumberId: string | undefined, env: any, c: Context) {
  try {
    const client = new Client(env.DATABASE_URL);
    await client.connect();
    
    try {
      // Find merchant by phone number ID
      const { rows: merchantRows } = await client.query(
        `SELECT m.*, u.name as user_name, u.email as user_email
         FROM "Merchant" m
         LEFT JOIN "user" u ON m."userId" = u.id
         WHERE m."phoneNumberId" = $1`,
        [phoneNumberId]
      );

      if (merchantRows.length === 0) {
        console.log("No merchant found for phone number ID:", phoneNumberId);
        return c.text("No merchant found", 404);
      }

      const merchant = merchantRows[0];

      // Log the incoming message
      await client.query(
        `INSERT INTO "WebhookEvent" (id, payload, "merchantId", "receivedAt")
         VALUES ($1, $2, $3, $4)`,
        [
          crypto.randomUUID(),
          JSON.stringify({
            type: 'whatsapp_message_received',
            message
          }),
          merchant.id,
          new Date()
        ]
      );

      // Process different message types
      if (message.text) {
        await processTextMessage(message, merchant, client, env);
      } else if (message.interactive) {
        await processInteractiveMessage(message, merchant, client);
      } else {
        return c.text("Unsupported message type", 400);
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

// Process interactive messages (button clicks, list selections)
async function processInteractiveMessage(message: any, merchant: any, client: Client) {
  const interactive = message.interactive;
  const from = message.from;
  
  console.log(`Processing interactive message from ${from}:`, interactive);

  let responseText = "I'm sorry, I didn't understand that interaction.";

  if (interactive.type === "button_reply") {
    const buttonText = interactive.button_reply.title;
    responseText = `You selected: ${buttonText}. How can I help you with that?`;
  } else if (interactive.type === "list_reply") {
    const listItem = interactive.list_reply.title;
    responseText = `You selected: ${listItem}. How can I help you with that?`;
  }

  await sendWhatsAppResponse(from, responseText, merchant, client);
} 