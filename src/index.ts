import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { generateEndpoint, chatEndpoint } from "./fetchers";
import { 
  getProducts, 
  getBusinessInfo, 
  getOrderById, 
  getCustomerOrders, 
  updateOrderStatus, 
  getUserInfo 
} from "./commerce";
import {
  sendTextMessage,
  sendInteractiveMessage,
  webhookVerification,
  webhookReceiver
} from "./whatsapp";
import { processIntentMessage } from "./ai-utils";
import { CLOUDFLARE_AI_MODELS } from "./utils/ai-utils";

// Hono app
const app = new Hono();

// Middleware
app.use("*", honoLogger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["POST", "OPTIONS", "GET", "PUT"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

app.get("/", (c) => {
  return c.json({
    name: "Whatsapp Worker",
    version: "1.0.0",
    endpoints: {
      ai: [
        "POST /ai/generate - Generate AI text (LLAMA_3_1_8B)",
        "POST /ai/chat - Chat with AI (LLAMA_3_1_8B)",
        "POST /ai/intent - Intent-based AI responses with context (LLAMA_3_1_8B)"
      ],
      commerce: [
        "GET /api/products - Get merchant products",
        "GET /api/business-info - Get merchant business info",
        "GET /api/orders/:id - Get specific order",
        "POST /api/orders - Get customer orders",
        "PUT /api/orders/:id/status - Update order status",
        "GET /api/user-info/:userId - Get customer info"
      ],
      whatsapp: [
        "POST /api/whatsapp/send-message - Send text message",
        "POST /api/whatsapp/send-interactive - Send interactive message",
        "GET /webhook - Webhook verification",
        "POST /webhook - Webhook receiver"
      ]
    },
    authentication: "Bearer token required for commerce and WhatsApp endpoints",
      ai_model: CLOUDFLARE_AI_MODELS.LLAMA_3_1_8B,
  });
});

// AI Endpoints
app.post("/ai/generate", generateEndpoint);
app.post("/ai/chat", chatEndpoint);
app.post("/ai/intent", processIntentMessage);

// Commerce Endpoints
app.get("/api/products", getProducts);
app.get("/api/business-info", getBusinessInfo);
app.get("/api/orders/:id", getOrderById);
app.post("/api/orders", getCustomerOrders);
app.put("/api/orders/:id/status", updateOrderStatus);
app.get("/api/user-info/:userId", getUserInfo);

// WhatsApp Endpoints
app.post("/api/whatsapp/send-message", sendTextMessage);
app.post("/api/whatsapp/send-interactive", sendInteractiveMessage);
app.get("/webhook", webhookVerification);
app.post("/webhook", webhookReceiver);

// Health Check
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    ai_model: "LLAMA_3_1_8B",
  });
});

export default app;
