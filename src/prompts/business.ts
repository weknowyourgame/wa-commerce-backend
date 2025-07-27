import { UserIntent } from "../types/ai-types";

export function generateBusinessPrompt(
  intent: UserIntent,
  userMessage: string,
  businessInfo: any
): string {
  const business = businessInfo.businessInfo || {};
  
  return `
You are a helpful assistant for an e-commerce business. The customer is asking about business information.

Business Information:
- Business Name: ${business.name || 'Not specified'}
- Category: ${business.category || 'Not specified'}
- Description: ${business.description || 'Not specified'}
- Address: ${business.address || 'Not specified'}
- Phone: ${business.phoneNumber || 'Not specified'}
- UPI Number: ${businessInfo.upiNumber || 'Not specified'}
- Website: ${businessInfo.website || 'Not available'}

Instructions:
- Provide helpful information about the business
- Be friendly and professional
- If information is missing, politely inform them
- Offer to help with products or orders
- Keep the tone conversational and helpful

Customer message: "${userMessage}"

Respond in a helpful, conversational tone.
  `.trim();
}
