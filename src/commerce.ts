import { Context } from "hono";
import { Client } from '@neondatabase/serverless';

// Helper function to get merchant from API token
async function getMerchantFromToken(apiToken: string, env: any) {
  const client = new Client(env.DATABASE_URL);
  await client.connect();
  
  try {
    const { rows } = await client.query(
      `SELECT m.*, u.id as user_id, u.name as user_name, u.email as user_email, u.image as user_image
       FROM "Merchant" m
       LEFT JOIN "user" u ON m."userId" = u.id
       WHERE m."apiToken" = $1`,
      [apiToken]
    );
    
    if (rows.length === 0) return null;
    
    const merchant = rows[0];
    
    // Get products for this merchant
    const { rows: products } = await client.query(
      `SELECT * FROM "Product" WHERE "merchantId" = $1`,
      [merchant.id]
    );
    
    // Get orders for this merchant
    const { rows: orders } = await client.query(
      `SELECT o.*, c.id as customer_id, c.phone as customer_phone,
              p.id as product_id, p.name as product_name, p.price as product_price
       FROM "Order" o
       LEFT JOIN "Customer" c ON o."customerId" = c.id
       LEFT JOIN "Product" p ON o."productId" = p.id
       WHERE o."merchantId" = $1`,
      [merchant.id]
    );
    
    return {
      ...merchant,
      user: {
        id: merchant.user_id,
        name: merchant.user_name,
        email: merchant.user_email,
        image: merchant.user_image
      },
      products,
      orders
    };
  } finally {
    await client.end();
  }
}

// GET /api/products - Get all products of a merchant
export async function getProducts(c: Context) {
  try {
    const apiToken = c.req.header("Authorization")?.replace("Bearer ", "");
    
    if (!apiToken) {
      return c.json({ 
        success: false, 
        error: "Authorization header with API token is required" 
      }, 401);
    }

    const merchant = await getMerchantFromToken(apiToken, c.env);
    
    if (!merchant) {
      return c.json({ 
        success: false, 
        error: "Invalid API token" 
      }, 401);
    }

    const client = new Client(c.env.DATABASE_URL);
    await client.connect();
    
    try {
      const { rows: products } = await client.query(
        `SELECT p.id, p.name, p.description, p."imageUrl", p.price, p."merchantId", p."createdAt", p."updatedAt"
         FROM "Product" p
         WHERE p."merchantId" = $1`,
        [merchant.id]
      );

      return c.json({
        success: true,
        data: products,
        count: products.length
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

// GET /api/business-info - Get merchant business information
export async function getBusinessInfo(c: Context) {
  try {
    const apiToken = c.req.header("Authorization")?.replace("Bearer ", "");
    
    if (!apiToken) {
      return c.json({ 
        success: false, 
        error: "Authorization header with API token is required" 
      }, 401);
    }

    const client = new Client(c.env.DATABASE_URL);
    await client.connect();
    
    try {
      const { rows } = await client.query(
        `SELECT m.id, m."userId", m."upiNumber", m."apiToken", m.website, m."businessInfo", m."isOnboarded", m."onboardingStep", m."createdAt", m."updatedAt",
                u.id as user_id, u.name as user_name, u.email as user_email, u.image as user_image
         FROM "Merchant" m
         LEFT JOIN "user" u ON m."userId" = u.id
         WHERE m."apiToken" = $1`,
        [apiToken]
      );

      if (rows.length === 0) {
        return c.json({ 
          success: false, 
          error: "Invalid API token" 
        }, 401);
      }

      const merchant = rows[0];

      // Get products
      const { rows: products } = await client.query(
        `SELECT id, name, price FROM "Product" WHERE "merchantId" = $1`,
        [merchant.id]
      );

      // Get orders
      const { rows: orders } = await client.query(
        `SELECT id, status, amount, "createdAt" FROM "Order" WHERE "merchantId" = $1`,
        [merchant.id]
      );

      const result = {
        id: merchant.id,
        userId: merchant.userId,
        upiNumber: merchant.upiNumber,
        apiToken: merchant.apiToken,
        website: merchant.website,
        businessInfo: merchant.businessInfo,
        isOnboarded: merchant.isOnboarded,
        onboardingStep: merchant.onboardingStep,
        createdAt: merchant.createdAt,
        updatedAt: merchant.updatedAt,
        user: {
          id: merchant.user_id,
          name: merchant.user_name,
          email: merchant.user_email,
          image: merchant.user_image
        },
        products,
        orders
      };

      return c.json({
        success: true,
        data: result
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

// GET /api/orders/:id - Get specific order by ID
export async function getOrderById(c: Context) {
  try {
    const orderId = c.req.param("id");
    const apiToken = c.req.header("Authorization")?.replace("Bearer ", "");
    
    if (!apiToken) {
      return c.json({ 
        success: false, 
        error: "Authorization header with API token is required" 
      }, 401);
    }

    const client = new Client(c.env.DATABASE_URL);
    await client.connect();
    
    try {
      // First verify the merchant
      const { rows: merchantRows } = await client.query(
        `SELECT id FROM "Merchant" WHERE "apiToken" = $1`,
        [apiToken]
      );

      if (merchantRows.length === 0) {
        return c.json({ 
          success: false, 
          error: "Invalid API token" 
        }, 401);
      }

      const merchantId = merchantRows[0].id;

      // Get the order
      const { rows } = await client.query(
        `SELECT o.id, o."customerId", o."merchantId", o."productId", o.txnId, o.amount, o.status, o."paidAt", o."createdAt", o."updatedAt",
                c.id as customer_id, c.phone as customer_phone,
                p.id as product_id, p.name as product_name, p.price as product_price,
                m.id as merchant_id, m."upiNumber", m."businessInfo"
         FROM "Order" o
         LEFT JOIN "Customer" c ON o."customerId" = c.id
         LEFT JOIN "Product" p ON o."productId" = p.id
         LEFT JOIN "Merchant" m ON o."merchantId" = m.id
         WHERE o.id = $1 AND o."merchantId" = $2`,
        [orderId, merchantId]
      );

      if (rows.length === 0) {
        return c.json({ 
          success: false, 
          error: "Order not found" 
        }, 404);
      }

      const order = rows[0];

      return c.json({
        success: true,
        data: {
          id: order.id,
          customerId: order.customerId,
          merchantId: order.merchantId,
          productId: order.productId,
          txnId: order.txnId,
          amount: order.amount,
          status: order.status,
          paidAt: order.paidAt,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          customer: {
            id: order.customer_id,
            phone: order.customer_phone
          },
          product: {
            id: order.product_id,
            name: order.product_name,
            price: order.product_price
          },
          merchant: {
            id: order.merchant_id,
            upiNumber: order.upiNumber,
            businessInfo: order.businessInfo
          }
        }
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

// POST /api/orders - Get all orders of a particular customer from his phone number
export async function getCustomerOrders(c: Context) {
  try {
    const body = await c.req.json();
    const { phoneNumber } = body;
    const apiToken = c.req.header("Authorization")?.replace("Bearer ", "");
    
    if (!apiToken) {
      return c.json({ 
        success: false, 
        error: "Authorization header with API token is required" 
      }, 401);
    }

    if (!phoneNumber) {
      return c.json({ 
        success: false, 
        error: "phoneNumber is required" 
      }, 400);
    }

    const client = new Client(c.env.DATABASE_URL);
    await client.connect();
    
    try {
      // First verify the merchant
      const { rows: merchantRows } = await client.query(
        `SELECT id FROM "Merchant" WHERE "apiToken" = $1`,
        [apiToken]
      );

      if (merchantRows.length === 0) {
        return c.json({ 
          success: false, 
          error: "Invalid API token" 
        }, 401);
      }

      const merchantId = merchantRows[0].id;

      // Get orders for the customer
      const { rows } = await client.query(
        `SELECT o.id, o."customerId", o."merchantId", o."productId", o.txnId, o.amount, o.status, o."paidAt", o."createdAt", o."updatedAt",
                c.id as customer_id, c.phone as customer_phone,
                p.id as product_id, p.name as product_name, p.price as product_price
         FROM "Order" o
         LEFT JOIN "Customer" c ON o."customerId" = c.id
         LEFT JOIN "Product" p ON o."productId" = p.id
         WHERE c.phone = $1 AND o."merchantId" = $2
         ORDER BY o."createdAt" DESC`,
        [phoneNumber, merchantId]
      );

      const orders = rows.map(row => ({
        id: row.id,
        customerId: row.customerId,
        merchantId: row.merchantId,
        productId: row.productId,
        txnId: row.txnId,
        amount: row.amount,
        status: row.status,
        paidAt: row.paidAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        customer: {
          id: row.customer_id,
          phone: row.customer_phone
        },
        product: {
          id: row.product_id,
          name: row.product_name,
          price: row.product_price
        }
      }));

      return c.json({
        success: true,
        data: orders,
        count: orders.length
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

// PUT /api/orders/:id/status - Update order status
export async function updateOrderStatus(c: Context) {
  try {
    const orderId = c.req.param("id");
    const body = await c.req.json();
    const { status } = body;
    const apiToken = c.req.header("Authorization")?.replace("Bearer ", "");
    
    if (!apiToken) {
      return c.json({ 
        success: false, 
        error: "Authorization header with API token is required" 
      }, 401);
    }

    if (!status || !['PENDING', 'CONFIRMED', 'FAILED'].includes(status)) {
      return c.json({ 
        success: false, 
        error: "Valid status is required (PENDING, CONFIRMED, FAILED)" 
      }, 400);
    }

    const client = new Client(c.env.DATABASE_URL);
    await client.connect();
    
    try {
      // First verify the merchant
      const { rows: merchantRows } = await client.query(
        `SELECT id FROM "Merchant" WHERE "apiToken" = $1`,
        [apiToken]
      );

      if (merchantRows.length === 0) {
        return c.json({ 
          success: false, 
          error: "Invalid API token" 
        }, 401);
      }

      const merchantId = merchantRows[0].id;

      // Check if order exists and belongs to this merchant
      const { rows: orderRows } = await client.query(
        `SELECT id FROM "Order" WHERE id = $1 AND "merchantId" = $2`,
        [orderId, merchantId]
      );

      if (orderRows.length === 0) {
        return c.json({ 
          success: false, 
          error: "Order not found" 
        }, 404);
      }

      // Update the order status
      const paidAt = status === 'CONFIRMED' ? new Date() : null;
      const { rows } = await client.query(
        `UPDATE "Order" SET status = $1, "paidAt" = $2 WHERE id = $3 RETURNING *`,
        [status, paidAt, orderId]
      );

      const updatedOrder = rows[0];

      // Get customer and product info for the response
      const { rows: orderDetails } = await client.query(
        `SELECT o.id, o."customerId", o."merchantId", o."productId", o.txnId, o.amount, o.status, o."paidAt", o."createdAt", o."updatedAt",
                c.id as customer_id, c.phone as customer_phone,
                p.id as product_id, p.name as product_name, p.price as product_price
         FROM "Order" o
         LEFT JOIN "Customer" c ON o."customerId" = c.id
         LEFT JOIN "Product" p ON o."productId" = p.id
         WHERE o.id = $1`,
        [orderId]
      );

      const orderWithDetails = orderDetails[0];

      return c.json({
        success: true,
        data: {
          id: updatedOrder.id,
          customerId: updatedOrder.customerId,
          merchantId: updatedOrder.merchantId,
          productId: updatedOrder.productId,
          txnId: updatedOrder.txnId,
          amount: updatedOrder.amount,
          status: updatedOrder.status,
          paidAt: updatedOrder.paidAt,
          createdAt: updatedOrder.createdAt,
          updatedAt: updatedOrder.updatedAt,
          customer: {
            id: orderWithDetails.customer_id,
            phone: orderWithDetails.customer_phone
          },
          product: {
            id: orderWithDetails.product_id,
            name: orderWithDetails.product_name,
            price: orderWithDetails.product_price
          }
        },
        message: `Order status updated to ${status}`
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

// GET /api/user-info/:phoneNumber - Get customer information from his phone number
export async function getUserInfo(c: Context) {
  try {
    const phoneNumber = c.req.param("phoneNumber");
    const apiToken = c.req.header("Authorization")?.replace("Bearer ", "");
    
    if (!apiToken) {
      return c.json({ 
        success: false, 
        error: "Authorization header with API token is required" 
      }, 401);
    }

    const client = new Client(c.env.DATABASE_URL);
    await client.connect();
    
    try {
      // First verify the merchant
      const { rows: merchantRows } = await client.query(
        `SELECT id FROM "Merchant" WHERE "apiToken" = $1`,
        [apiToken]
      );

      if (merchantRows.length === 0) {
        return c.json({ 
          success: false, 
          error: "Invalid API token" 
        }, 401);
      }

      const merchantId = merchantRows[0].id;

      // Get customer info
      const { rows: customerRows } = await client.query(
        `SELECT id, phone, "createdAt", "updatedAt" FROM "Customer" WHERE phone = $1`,
        [phoneNumber]
      );

      if (customerRows.length === 0) {
        return c.json({ 
          success: false, 
          error: "Customer not found" 
        }, 404);
      }

      const customer = customerRows[0];

      // Get orders for this customer and merchant
      const { rows: orderRows } = await client.query(
        `SELECT o.id, o."customerId", o."merchantId", o."productId", o.txnId, o.amount, o.status, o."paidAt", o."createdAt", o."updatedAt",
                p.id as product_id, p.name as product_name, p.price as product_price
         FROM "Order" o
         LEFT JOIN "Product" p ON o."productId" = p.id
         WHERE c.phone = $1 AND o."merchantId" = $2
         ORDER BY o."createdAt" DESC`,
        [phoneNumber, merchantId]
      );

      const orders = orderRows.map(row => ({
        id: row.id,
        customerId: row.customerId,
        merchantId: row.merchantId,
        productId: row.productId,
        txnId: row.txnId,
        amount: row.amount,
        status: row.status,
        paidAt: row.paidAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        product: {
          id: row.product_id,
          name: row.product_name,
          price: row.product_price
        }
      }));

      return c.json({
        success: true,
        data: {
          id: customer.id,
          phone: customer.phone,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,
          orders
        }
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