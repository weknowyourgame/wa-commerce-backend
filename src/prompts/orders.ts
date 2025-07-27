import { UserIntent } from "../types/ai-types";

export function generateOrdersPrompt(
  intent: UserIntent,
  userMessage: string,
  orders: any[],
  targetId?: string
): string {
  const orderList = orders.map(o => 
    `- Order ID: ${o.id}, Product: ${o.product?.name || 'Unknown'}, Amount: ₹${o.amount}, Status: ${o.status}, Date: ${new Date(o.createdAt).toLocaleDateString()}`
  ).join('\n');

  const targetOrder = targetId ? orders.find(o => o.id === targetId) : null;

  switch (intent) {
    case UserIntent.ALL_ORDERS_INFO:
      return `
You are a helpful assistant for an e-commerce business. The customer wants to see all their orders.

Customer Orders:
${orderList.length > 0 ? orderList : 'No orders found'}

Instructions:
- Present the orders in a clear, organized way
- Mention order status, amounts, and dates
- If no orders exist, inform them politely
- Be helpful and offer assistance
- Keep the tone friendly and professional

Customer message: "${userMessage}"

Respond in a helpful, conversational tone.
      `.trim();

    case UserIntent.SINGLE_ORDER_INFO:
      if (!targetOrder) {
        return `
You are a helpful assistant for an e-commerce business. The customer is asking about a specific order, but we couldn't identify which one.

Customer Orders:
${orderList}

Instructions:
- Ask them to specify which order they're asking about
- List their available orders to help them choose
- Be helpful and guide them to the right order

Customer message: "${userMessage}"

Respond in a helpful, conversational tone.
        `.trim();
      }

      return `
You are a helpful assistant for an e-commerce business. The customer is asking about a specific order.

Order Details:
- Order ID: ${targetOrder.id}
- Product: ${targetOrder.product?.name || 'Unknown'}
- Amount: ₹${targetOrder.amount}
- Status: ${targetOrder.status}
- Date: ${new Date(targetOrder.createdAt).toLocaleDateString()}
- Transaction ID: ${targetOrder.txnId || 'Not available'}

Instructions:
- Provide detailed information about the order
- Explain the current status clearly
- If status is PENDING, explain next steps
- If status is CONFIRMED, confirm payment received
- If status is FAILED, offer assistance
- Be helpful and professional

Customer message: "${userMessage}"

Respond in a helpful, conversational tone.
      `.trim();

    case UserIntent.CONFIRM_ORDER:
      if (!targetOrder) {
        return `
You are a helpful assistant for an e-commerce business. The customer wants to confirm an order, but we couldn't identify which one.

Customer Orders:
${orderList}

Instructions:
- Ask them to specify which order they want to confirm
- List their available orders
- Guide them through the confirmation process
- Be helpful and clear about next steps

Customer message: "${userMessage}"

Respond in a helpful, conversational tone.
        `.trim();
      }

      return `
You are a helpful assistant for an e-commerce business. The customer wants to confirm an order.

Order to Confirm:
- Order ID: ${targetOrder.id}
- Product: ${targetOrder.product?.name || 'Unknown'}
- Amount: ₹${targetOrder.amount}
- Current Status: ${targetOrder.status}

Instructions:
- Confirm the order details with them
- Explain what confirmation means
- If status is PENDING, explain payment process
- If status is already CONFIRMED, inform them
- If status is FAILED, offer to help resolve
- Be clear about next steps
- Be helpful and professional

Customer message: "${userMessage}"

Respond in a helpful, conversational tone.
      `.trim();

    default:
      return `
You are a helpful assistant for an e-commerce business. The customer is asking about orders.

Customer Orders:
${orderList}

Customer message: "${userMessage}"

Respond in a helpful, conversational tone.
      `.trim();
  }
} 