import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";
import { callCloudflareAI } from "./utils/ai-utils";
import { CLOUDFLARE_AI_MODELS } from "./utils/ai-utils";
import { generate, chat } from "./fetchers";

// Hono app
const app = new Hono();

// Middleware
app.use("*", honoLogger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["POST", "OPTIONS", "GET"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  })
);

app.get("/", (c) => {
  return c.json({
    name: "Whatsapp Worker",
    version: "1.0.0",
    endpoints: [""],
    authentication: "No authentication required (for now)",
  });
});

// AI Endpoints
app.post("/ai/generate", generate);
app.post("/ai/chat", chat);

// Health Check
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

export default app;
