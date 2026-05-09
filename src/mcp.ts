import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sanitizeCustomer, sanitizeCustomerCollection } from "./sanitize.js";
import { UnleashedClient } from "./unleashedClient.js";

const PAGE_NUMBER = z.number().int().positive().max(10_000).default(1);
const PAGE_SIZE = z.number().int().positive().max(200).default(50);

export function createUnleashedMcpServer(unleashed: UnleashedClient): McpServer {
  const server = new McpServer({
    name: "unleashed-claude-mcp",
    version: "0.1.0"
  });

  server.registerTool(
    "unleashed_list_customers",
    {
      title: "List Unleashed customers",
      description:
        "Read-only search for approved Unleashed customer accounts. Returns business-safe fields by default.",
      inputSchema: {
        pageNumber: PAGE_NUMBER,
        pageSize: PAGE_SIZE,
        customerCode: z.string().trim().optional(),
        customerName: z.string().trim().optional(),
        includeContactDetails: z.boolean().default(false)
      }
    },
    async ({ pageNumber, pageSize, customerCode, customerName, includeContactDetails }) => {
      const payload = await unleashed.get<unknown>("/Customers", {
        pageNumber,
        pageSize,
        customerCode,
        customerName
      });

      return jsonResult(sanitizeCustomerCollection(payload, includeContactDetails));
    }
  );

  server.registerTool(
    "unleashed_get_customer",
    {
      title: "Get Unleashed customer",
      description:
        "Read-only lookup for one approved Unleashed customer account. Contact details are hidden unless explicitly requested.",
      inputSchema: {
        customerCode: z.string().trim().min(1),
        includeContactDetails: z.boolean().default(false)
      }
    },
    async ({ customerCode, includeContactDetails }) => {
      const payload = await unleashed.get<unknown>(`/Customers/${encodeURIComponent(customerCode)}`);
      return jsonResult(sanitizeCustomer(payload, includeContactDetails));
    }
  );

  server.registerTool(
    "unleashed_list_products",
    {
      title: "List Unleashed products",
      description: "Read-only search for Unleashed product records.",
      inputSchema: {
        pageNumber: PAGE_NUMBER,
        pageSize: PAGE_SIZE,
        productCode: z.string().trim().optional(),
        productDescription: z.string().trim().optional()
      }
    },
    async ({ pageNumber, pageSize, productCode, productDescription }) => {
      const payload = await unleashed.get<unknown>("/Products", {
        pageNumber,
        pageSize,
        productCode,
        productDescription
      });

      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_get_product",
    {
      title: "Get Unleashed product",
      description: "Read-only lookup for one Unleashed product by product code.",
      inputSchema: {
        productCode: z.string().trim().min(1)
      }
    },
    async ({ productCode }) => {
      const payload = await unleashed.get<unknown>(`/Products/${encodeURIComponent(productCode)}`);
      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_list_sales_orders",
    {
      title: "List Unleashed sales orders",
      description: "Read-only search for Unleashed sales orders.",
      inputSchema: {
        pageNumber: PAGE_NUMBER,
        pageSize: PAGE_SIZE,
        orderNumber: z.string().trim().optional(),
        customerCode: z.string().trim().optional(),
        modifiedSince: z.string().trim().optional()
      }
    },
    async ({ pageNumber, pageSize, orderNumber, customerCode, modifiedSince }) => {
      const payload = await unleashed.get<unknown>("/SalesOrders", {
        pageNumber,
        pageSize,
        orderNumber,
        customerCode,
        modifiedSince
      });

      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_get_sales_order",
    {
      title: "Get Unleashed sales order",
      description: "Read-only lookup for one Unleashed sales order by order number.",
      inputSchema: {
        orderNumber: z.string().trim().min(1)
      }
    },
    async ({ orderNumber }) => {
      const payload = await unleashed.get<unknown>(`/SalesOrders/${encodeURIComponent(orderNumber)}`);
      return jsonResult(payload);
    }
  );

  return server;
}

function jsonResult(payload: unknown) {
  const text = JSON.stringify(payload, null, 2);

  return {
    content: [
      {
        type: "text" as const,
        text: text.length > 50_000 ? `${text.slice(0, 50_000)}\n\n[truncated]` : text
      }
    ]
  };
}
