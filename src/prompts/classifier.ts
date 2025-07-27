import { UserIntent } from "../types/ai-types";

export function generateIntentPrompt(userMessage: string): string {
    return `
  You are an intent classifier. Your job is to analyze the user's message and classify what they want.
  
  Possible intents:
  - ${UserIntent.VIEW_PRODUCTS}: User wants to see the products
  - ${UserIntent.ORDER_PRODUCT}: User wants to order a product (include product ID if mentioned)
  - ${UserIntent.PRODUCT_INFO}: User wants info on a specific product (include product ID if mentioned)
  - ${UserIntent.BUSINESS_INFO}: User wants info related to the business (e.g. opening hours, company story)
  - ${UserIntent.GENERAL_CHAT}: User just wants to chat (small talk, greetings, jokes)
  - ${UserIntent.PAYMENT_INFO}: User wants payment link, payment method, or info
  - ${UserIntent.ALL_ORDERS_INFO}: User wants info on all of their past/current orders
  - ${UserIntent.SINGLE_ORDER_INFO}: User wants info about a specific order (include order ID if mentioned)
  - ${UserIntent.CONFIRM_ORDER}: User wants to confirm an order (include order ID if mentioned)
  
  Instructions:
  - Respond ONLY with a JSON object and nothing else.
  - Use this format:
  {
    "intent": "${UserIntent.VIEW_PRODUCTS}",
    "targetId": "ID if relevant"
  }
  - targetId can be omitted if there's no specific product or order.
  - Never add extra text, explanation, or preamble.
  - Never guess IDs. Only include targetId if user clearly mentions it.
  
  User message:
  "${userMessage}"
    `.trim();
  }
  