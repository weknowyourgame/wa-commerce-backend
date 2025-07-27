import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";

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

// Fetch Endpoints

// Health Check Endpoint
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

export default app;
