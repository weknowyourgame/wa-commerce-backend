import { Context } from "hono";
import { PrismaClient } from "@prisma/client/edge";

// Initialize Prisma client
const prisma = new PrismaClient();

// Helper function to get merchant from API token
async function getMerchantFromToken(apiToken: string) {
  return await prisma.merchant.findUnique({
    where: { apiToken },
    include: {
      user: true,
      products: true,
      orders: {
        include: {
          customer: true,
          product: true
        }
      }
    }
  });
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

    const merchant = await getMerchantFromToken(apiToken);
    
    if (!merchant) {
      return c.json({ 
        success: false, 
        error: "Invalid API token" 
      }, 401);
    }

    const products = await prisma.product.findMany({
      where: { merchantId: merchant.id },
      include: {
        merchant: {
          select: {
            id: true,
            userId: true,
            upiNumber: true,
            website: true,
            businessInfo: true,
            isOnboarded: true
          }
        }
      }
    });

    return c.json({
      success: true,
      data: products,
      count: products.length
    });
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

    const merchant = await prisma.merchant.findUnique({
      where: { apiToken },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        },
        products: {
          select: {
            id: true,
            name: true,
            price: true
          }
        },
        orders: {
          select: {
            id: true,
            status: true,
            amount: true,
            createdAt: true
          }
        }
      }
    });

    if (!merchant) {
      return c.json({ 
        success: false, 
        error: "Invalid API token" 
      }, 401);
    }

    return c.json({
      success: true,
      data: merchant
    });
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

    const merchant = await prisma.merchant.findUnique({
      where: { apiToken }
    });

    if (!merchant) {
      return c.json({ 
        success: false, 
        error: "Invalid API token" 
      }, 401);
    }

    const order = await prisma.order.findFirst({
      where: { 
        id: orderId,
        merchantId: merchant.id 
      },
      include: {
        customer: true,
        product: true,
        merchant: {
          select: {
            id: true,
            upiNumber: true,
            businessInfo: true
          }
        }
      }
    });

    if (!order) {
      return c.json({ 
        success: false, 
        error: "Order not found" 
      }, 404);
    }

    return c.json({
      success: true,
      data: order
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}

// POST /api/orders - Get all orders of a particular customer
export async function getCustomerOrders(c: Context) {
  try {
    const body = await c.req.json();
    const { customerId } = body;
    const apiToken = c.req.header("Authorization")?.replace("Bearer ", "");
    
    if (!apiToken) {
      return c.json({ 
        success: false, 
        error: "Authorization header with API token is required" 
      }, 401);
    }

    if (!customerId) {
      return c.json({ 
        success: false, 
        error: "customerId is required" 
      }, 400);
    }

    const merchant = await prisma.merchant.findUnique({
      where: { apiToken }
    });

    if (!merchant) {
      return c.json({ 
        success: false, 
        error: "Invalid API token" 
      }, 401);
    }

    const orders = await prisma.order.findMany({
      where: { 
        customerId,
        merchantId: merchant.id 
      },
      include: {
        customer: true,
        product: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return c.json({
      success: true,
      data: orders,
      count: orders.length
    });
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

    const merchant = await prisma.merchant.findUnique({
      where: { apiToken }
    });

    if (!merchant) {
      return c.json({ 
        success: false, 
        error: "Invalid API token" 
      }, 401);
    }

    const order = await prisma.order.findFirst({
      where: { 
        id: orderId,
        merchantId: merchant.id 
      }
    });

    if (!order) {
      return c.json({ 
        success: false, 
        error: "Order not found" 
      }, 404);
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { 
        status,
        paidAt: status === 'CONFIRMED' ? new Date() : null
      },
      include: {
        customer: true,
        product: true
      }
    });

    return c.json({
      success: true,
      data: updatedOrder,
      message: `Order status updated to ${status}`
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
}

// GET /api/user-info/:userId - Get customer information
export async function getUserInfo(c: Context) {
  try {
    const userId = c.req.param("userId");
    const apiToken = c.req.header("Authorization")?.replace("Bearer ", "");
    
    if (!apiToken) {
      return c.json({ 
        success: false, 
        error: "Authorization header with API token is required" 
      }, 401);
    }

    const merchant = await prisma.merchant.findUnique({
      where: { apiToken }
    });

    if (!merchant) {
      return c.json({ 
        success: false, 
        error: "Invalid API token" 
      }, 401);
    }

    const customer = await prisma.customer.findUnique({
      where: { id: userId },
      include: {
        orders: {
          where: { merchantId: merchant.id },
          include: {
            product: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!customer) {
      return c.json({ 
        success: false, 
        error: "Customer not found" 
      }, 404);
    }

    return c.json({
      success: true,
      data: customer
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, 500);
  }
} 