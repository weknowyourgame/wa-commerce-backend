import { UserIntent } from "../types/ai-types";

export function generateProductsPrompt(
  intent: UserIntent,
  userMessage: string,
  products: any[],
  targetId?: string
): string {
  const productList = products.map(p => 
    `- ID: ${p.id}, Name: ${p.name}, Price: ₹${p.price}, Description: ${p.description || 'No description'}`
  ).join('\n');

  const targetProduct = targetId ? products.find(p => p.id === targetId) : null;

  switch (intent) {
    case UserIntent.VIEW_PRODUCTS:
      return `
You are a helpful assistant for an e-commerce business. The customer wants to see all available products.

Available Products:
${productList}

Instructions:
- Present the products in a friendly, engaging way
- Mention prices clearly
- Highlight key features if available
- Keep the response conversational and helpful
- If no products are available, politely inform the customer

Customer message: "${userMessage}"

Respond in a helpful, conversational tone.
      `.trim();

    case UserIntent.PRODUCT_INFO:
      if (!targetProduct) {
        return `
You are a helpful assistant for an e-commerce business. The customer is asking about a specific product, but we couldn't identify which one.

Available Products:
${productList}

Instructions:
- Ask them to specify which product they're interested in
- List the available products to help them choose
- Be helpful and guide them to the right product

Customer message: "${userMessage}"

Respond in a helpful, conversational tone.
        `.trim();
      }

      return `
You are a helpful assistant for an e-commerce business. The customer is asking about a specific product.

Product Details:
- ID: ${targetProduct.id}
- Name: ${targetProduct.name}
- Price: ₹${targetProduct.price}
- Description: ${targetProduct.description || 'No description available'}

Instructions:
- Provide detailed information about the product
- Highlight its features and benefits
- Mention the price clearly
- Offer to help with ordering if they're interested
- Be enthusiastic and helpful

Customer message: "${userMessage}"

Respond in a helpful, conversational tone.
      `.trim();

    case UserIntent.ORDER_PRODUCT:
      if (!targetProduct) {
        return `
You are a helpful assistant for an e-commerce business. The customer wants to order a product, but we couldn't identify which one.

Available Products:
${productList}

Instructions:
- Ask them to specify which product they want to order
- List the available products with prices
- Guide them through the ordering process
- Be helpful and clear about next steps

Customer message: "${userMessage}"

Respond in a helpful, conversational tone.
        `.trim();
      }

      return `
You are a helpful assistant for an e-commerce business. The customer wants to order a product.

Product to Order:
- Name: ${targetProduct.name}
- Price: ₹${targetProduct.price}
- Description: ${targetProduct.description || 'No description available'}

Instructions:
- Confirm the product they want to order
- Explain the ordering process
- Mention payment options (UPI, etc.)
- Ask for their phone number to create the order
- Be clear about next steps
- Be enthusiastic and helpful

Customer message: "${userMessage}"

Respond in a helpful, conversational tone.
      `.trim();

    default:
      return `
You are a helpful assistant for an e-commerce business. The customer is asking about products.

Available Products:
${productList}

Customer message: "${userMessage}"

Respond in a helpful, conversational tone.
      `.trim();
  }
}
