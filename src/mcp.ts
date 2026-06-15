import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sanitizeCustomer, sanitizeCustomerCollection } from "./sanitize.js";
import { UnleashedClient } from "./unleashedClient.js";

const PAGE_NUMBER = z.number().int().positive().max(10_000).default(1).describe("Page number to retrieve (1-based). Defaults to 1.");
const PAGE_SIZE = z.number().int().positive().max(200).default(50).describe("Results per page. Default 50, maximum 200. Use pageNumber to page through more.");
const GUID = z.string().trim().uuid();
const OPTIONAL_DATE = z.string().trim().nullish().transform((value) => value ?? undefined);
const REPORT_DATE = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/);
const OPTIONAL_REPORT_DATE = REPORT_DATE.nullish().transform((value) => value ?? undefined);

const SALES_ORDERS_NEEDS_FILTER = {
  status: "needs_filter",
  message:
    "No narrowing filter was provided, so this query would scan the entire sales-order history and could return thousands of rows (result ordering is not guaranteed, so paging would not give you a useful slice). Add at least one filter before retrying.",
  howToProceed: [
    "Add a date range: startDate and/or endDate in YYYY-MM-DD format (e.g. startDate: \"2026-01-01\", endDate: \"2026-01-31\"). Omit either bound to leave that side unbounded — never pass null.",
    "Or filter by a single customer: customerCode (e.g. \"TESCO\").",
    "Or filter by status: orderStatus (e.g. \"Completed\", \"Parked\", \"Placed\").",
    "Or look up one order directly: orderNumber.",
    "For aggregated revenue/margin analysis over a range, use unleashed_sales_performance_report instead of this tool."
  ],
  proceedAnyway:
    "If you genuinely intend to fetch the unfiltered result set, retry this tool with confirmUnbounded: true."
} as const;

const PURCHASE_ORDERS_NEEDS_FILTER = {
  status: "needs_filter",
  message:
    "No narrowing filter was provided, so this query would scan the entire purchase-order history and could return thousands of rows (result ordering is not guaranteed, so paging would not give you a useful slice). Add at least one filter before retrying.",
  howToProceed: [
    "Add a date range: startDate and/or endDate in YYYY-MM-DD format (e.g. startDate: \"2026-01-01\", endDate: \"2026-01-31\"). Omit either bound to leave that side unbounded — never pass null.",
    "Or filter by a single supplier: supplierCode.",
    "Or filter by status: orderStatus (e.g. \"Completed\", \"Parked\", \"Placed\").",
    "Or look up one order directly: orderNumber."
  ],
  proceedAnyway:
    "If you genuinely intend to fetch the unfiltered result set, retry this tool with confirmUnbounded: true."
} as const;

const REPORT_NEEDS_DATE_RANGE = {
  status: "needs_date_range",
  message:
    "A sales performance report requires both startDate and endDate. Provide them in YYYY-MM-DD format (e.g. startDate: \"2026-06-01\", endDate: \"2026-06-03\"). Do not pass null.",
  howToProceed: [
    "Set startDate and endDate to real dates in YYYY-MM-DD format.",
    "For a single day, set both to the same date.",
    "The range is limited to 93 days per call."
  ]
} as const;

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
};

const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true
};

const MONEY = z.number().finite().min(0);
const DISCOUNT_RATE = z.number().finite().min(0).max(1).default(0);

export type UnleashedMcpOptions = {
  writeToolsEnabled?: boolean;
};

export function createUnleashedMcpServer(
  unleashed: UnleashedClient,
  options: UnleashedMcpOptions = {}
): McpServer {
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
      annotations: READ_ONLY_ANNOTATIONS,
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
        ...pagination(pageNumber, pageSize),
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
        "Read-only lookup for one approved Unleashed customer account by customer code. Contact details are hidden unless explicitly requested.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        customerCode: z.string().trim().min(1),
        includeContactDetails: z.boolean().default(false)
      }
    },
    async ({ customerCode, includeContactDetails }) => {
      const payload = await unleashed.get<unknown>("/Customers", {
        ...pagination(1, 10),
        customerCode
      });
      return jsonResult(sanitizeCustomerCollection(payload, includeContactDetails));
    }
  );

  server.registerTool(
    "unleashed_list_products",
    {
      title: "List Unleashed products",
      description: "Read-only search for Unleashed product records.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        pageNumber: PAGE_NUMBER,
        pageSize: PAGE_SIZE,
        productCode: z.string().trim().optional(),
        productDescription: z.string().trim().optional(),
        product: z.string().trim().optional(),
        productGroup: z.string().trim().optional(),
        includeObsolete: z.boolean().optional(),
        brief: z.boolean().optional()
      }
    },
    async ({ pageNumber, pageSize, productCode, productDescription, product, productGroup, includeObsolete, brief }) => {
      const payload = await unleashed.get<unknown>("/Products", {
        ...pagination(pageNumber, pageSize),
        productCode,
        productDescription,
        product,
        productGroup,
        includeObsolete,
        brief
      });

      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_get_product",
    {
      title: "Get Unleashed product",
      description: "Read-only lookup for one Unleashed product by product code.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        productCode: z.string().trim().min(1)
      }
    },
    async ({ productCode }) => {
      const payload = await unleashed.get<unknown>("/Products", {
        ...pagination(1, 10),
        productCode
      });
      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_get_product_by_guid",
    {
      title: "Get Unleashed product by GUID",
      description: "Read-only lookup for one Unleashed product by Unleashed product GUID.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        productGuid: GUID
      }
    },
    async ({ productGuid }) => {
      const payload = await unleashed.get<unknown>(`/Products/${encodeURIComponent(productGuid)}`);
      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_list_product_prices",
    {
      title: "List Unleashed product prices",
      description: "Read-only search for Unleashed customer-specific or product-specific prices.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        pageNumber: PAGE_NUMBER,
        pageSize: PAGE_SIZE,
        customerCode: z.string().trim().optional(),
        productCode: z.string().trim().optional(),
        productGroupPrices: z.string().trim().optional(),
        asAtDate: OPTIONAL_DATE.describe("Point-in-time snapshot date, format YYYY-MM-DD (e.g. 2026-03-01). Returns values as they stood on this date. Do NOT pass null — omit the field to use the current state."),
        modifiedSince: OPTIONAL_DATE.describe("Return only records created or edited on/after this date, format YYYY-MM-DD (e.g. 2026-03-01). Do NOT pass null — omit the field to disable this filter.")
      }
    },
    async ({ pageNumber, pageSize, customerCode, productCode, productGroupPrices, asAtDate, modifiedSince }) => {
      const payload = await unleashed.get<unknown>("/ProductPrices", {
        ...pagination(pageNumber, pageSize),
        customerCode,
        productCode,
        productGroupPrices,
        asAtDate,
        modifiedSince
      });

      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_get_product_price",
    {
      title: "Get Unleashed product price",
      description: "Read-only lookup for one Unleashed product price by GUID.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        productPriceGuid: GUID
      }
    },
    async ({ productPriceGuid }) => {
      const payload = await unleashed.get<unknown>(`/ProductPrices/${encodeURIComponent(productPriceGuid)}`);
      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_list_stock_on_hand",
    {
      title: "List Unleashed stock on hand",
      description: "Read-only search for Unleashed stock-on-hand records.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        pageNumber: PAGE_NUMBER,
        pageSize: PAGE_SIZE,
        productId: z.string().trim().optional(),
        warehouseCode: z.string().trim().optional(),
        warehouseName: z.string().trim().optional(),
        asAtDate: OPTIONAL_DATE.describe("Point-in-time snapshot date, format YYYY-MM-DD (e.g. 2026-03-01). Returns values as they stood on this date. Do NOT pass null — omit the field to use the current state."),
        modifiedSince: OPTIONAL_DATE.describe("Return only records created or edited on/after this date, format YYYY-MM-DD (e.g. 2026-03-01). Do NOT pass null — omit the field to disable this filter."),
        isAssembled: z.boolean().optional(),
        orderBy: z.string().trim().optional()
      }
    },
    async ({ pageNumber, pageSize, productId, warehouseCode, warehouseName, asAtDate, modifiedSince, isAssembled, orderBy }) => {
      const payload = await unleashed.get<unknown>("/StockOnHand", {
        ...pagination(pageNumber, pageSize),
        productId,
        warehouseCode,
        warehouseName,
        asAtDate,
        modifiedSince,
        isAssembled,
        orderBy
      });

      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_get_stock_on_hand",
    {
      title: "Get Unleashed stock on hand",
      description: "Read-only lookup for stock on hand for one product by product GUID.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        productGuid: GUID,
        allWarehouses: z.boolean().default(false)
      }
    },
    async ({ productGuid, allWarehouses }) => {
      const suffix = allWarehouses ? "/AllWarehouses" : "";
      const payload = await unleashed.get<unknown>(`/StockOnHand/${encodeURIComponent(productGuid)}${suffix}`);
      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_list_sales_orders",
    {
      title: "List Unleashed sales orders",
      description: "Read-only search for Unleashed sales orders. WARNING: the full sales-order history is large and result ordering is not guaranteed — without filters this can return thousands of unhelpful rows. Prefer to narrow by a date range (startDate and/or endDate in YYYY-MM-DD), a customerCode, an orderStatus, or an orderNumber. If you call this with no narrowing filter at all, the tool will ask you to add one (or set confirmUnbounded: true) instead of dumping everything. For aggregated revenue/margin analysis over a date range, use unleashed_sales_performance_report instead.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        pageNumber: PAGE_NUMBER,
        pageSize: PAGE_SIZE,
        orderNumber: z.string().trim().optional(),
        customerCode: z.string().trim().optional(),
        warehouseCode: z.string().trim().optional(),
        orderStatus: z.string().trim().optional(),
        startDate: OPTIONAL_DATE.describe("Lower bound on ORDER DATE, format YYYY-MM-DD (e.g. 2026-01-31). Returns orders dated on/after this date. Do NOT pass null — omit the field entirely to leave the start unbounded (no lower bound)."),
        endDate: OPTIONAL_DATE.describe("Upper bound on ORDER DATE, format YYYY-MM-DD (e.g. 2026-02-28). Returns orders dated up to this date. Do NOT pass null — omit the field entirely to leave the end unbounded (up to today)."),
        modifiedSince: OPTIONAL_DATE.describe("Return only records created or edited on/after this date, format YYYY-MM-DD (e.g. 2026-03-01). Filters on last-modified time, not order date — use it for incremental/delta syncs. Do NOT pass null — omit the field to disable this filter."),
        confirmUnbounded: z.boolean().default(false).describe("Set true ONLY to bypass the no-filter safety check and intentionally fetch an unfiltered, potentially very large result set. Defaults to false, which makes the tool ask for a narrowing filter when none is provided.")
      }
    },
    async ({ pageNumber, pageSize, orderNumber, customerCode, warehouseCode, orderStatus, startDate, endDate, modifiedSince, confirmUnbounded }) => {
      const hasNarrowingFilter =
        Boolean(startDate) || Boolean(endDate) || Boolean(modifiedSince) ||
        Boolean(customerCode) || Boolean(orderNumber) || Boolean(orderStatus);
      if (!confirmUnbounded && !hasNarrowingFilter) {
        return jsonResult(SALES_ORDERS_NEEDS_FILTER);
      }

      const payload = await unleashed.get<unknown>("/SalesOrders", {
        ...pagination(pageNumber, pageSize),
        orderNumber,
        customerCode,
        warehouseCode,
        orderStatus,
        startDate,
        endDate,
        modifiedSince
      });

      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_sales_performance_report",
    {
      title: "Create Unleashed sales performance report data",
      description:
        "Read-only aggregated sales performance report for a date range. Uses daily date-filtered Unleashed sales-order reads instead of fragile bulk pagination.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        startDate: OPTIONAL_REPORT_DATE.describe("Start of the report date range, format YYYY-MM-DD (e.g. 2026-06-01). Required. Do NOT pass null."),
        endDate: OPTIONAL_REPORT_DATE.describe("End of the report date range, format YYYY-MM-DD (e.g. 2026-06-03). Required. Do NOT pass null."),
        comparisonStartDate: OPTIONAL_REPORT_DATE,
        comparisonEndDate: OPTIONAL_REPORT_DATE,
        orderStatus: z.string().trim().default("Completed"),
        topLimit: z.number().int().positive().max(10).default(5)
      }
    },
    async ({ startDate, endDate, comparisonStartDate, comparisonEndDate, orderStatus, topLimit }) => {
      if (!startDate || !endDate) {
        return jsonResult(REPORT_NEEDS_DATE_RANGE);
      }

      const primaryOrders = await fetchSalesOrdersByDay(unleashed, startDate, endDate, orderStatus);
      const primary = summarizeSalesOrders(primaryOrders.orders, startDate, endDate, topLimit);

      let comparison: SalesSummary | undefined;
      let comparisonWarnings: string[] = [];

      if (comparisonStartDate && comparisonEndDate) {
        const comparisonOrders = await fetchSalesOrdersByDay(
          unleashed,
          comparisonStartDate,
          comparisonEndDate,
          orderStatus
        );
        comparison = summarizeSalesOrders(
          comparisonOrders.orders,
          comparisonStartDate,
          comparisonEndDate,
          topLimit
        );
        comparisonWarnings = comparisonOrders.warnings;
      }

      return jsonResult({
        reportType: "sales_performance",
        generatedAt: new Date().toISOString(),
        assumptions: [
          "Sales value is calculated from sales-order line totals where lines are available, otherwise order subtotal/total is used.",
          "Gross profit is estimated only for lines with AverageLandedPriceAtTimeOfSale; margin fields are flagged when incomplete.",
          "Data is fetched as one API request per date because broad SalesOrders pagination is unreliable for this endpoint."
        ],
        primary: publicSalesSummary(primary),
        comparison: comparison ? publicSalesSummary(comparison) : undefined,
        changes: comparison ? buildChanges(primary, comparison) : undefined,
        productDemandChanges: comparison
          ? compareRankedEntities(primary.products.all, comparison.products.all, Math.min(topLimit, 5))
          : [],
        customerChanges: comparison
          ? compareRankedEntities(primary.customers.all, comparison.customers.all, Math.min(topLimit, 5))
          : [],
        dataCompleteness: {
          primaryWarnings: primaryOrders.warnings,
          comparisonWarnings,
          note:
            "If any date reports more items than returned, export that date from Unleashed or narrow the range further."
        }
      });
    }
  );

  server.registerTool(
    "unleashed_get_sales_order",
    {
      title: "Get Unleashed sales order",
      description: "Read-only lookup for one Unleashed sales order by order number.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        orderNumber: z.string().trim().min(1)
      }
    },
    async ({ orderNumber }) => {
      const payload = await unleashed.get<unknown>("/SalesOrders", {
        ...pagination(1, 10),
        orderNumber
      });
      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_get_sales_order_by_guid",
    {
      title: "Get Unleashed sales order by GUID",
      description: "Read-only lookup for one Unleashed sales order by Unleashed sales order GUID.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        orderGuid: GUID
      }
    },
    async ({ orderGuid }) => {
      const payload = await unleashed.get<unknown>(`/SalesOrders/${encodeURIComponent(orderGuid)}`);
      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_list_customer_delivery_addresses",
    {
      title: "List Unleashed customer delivery addresses",
      description: "Read-only list of Unleashed customer delivery addresses for approved B2B/generic channel accounts.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        pageNumber: PAGE_NUMBER,
        pageSize: PAGE_SIZE,
        customerCode: z.string().trim().optional(),
        modifiedSince: OPTIONAL_DATE.describe("Return only records created or edited on/after this date, format YYYY-MM-DD (e.g. 2026-03-01). Do NOT pass null — omit the field to disable this filter.")
      }
    },
    async ({ pageNumber, pageSize, customerCode, modifiedSince }) => {
      const payload = await unleashed.get<unknown>("/CustomerDeliveryAddresses", {
        ...pagination(pageNumber, pageSize),
        customerCode,
        modifiedSince
      });

      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_list_warehouses",
    {
      title: "List Unleashed warehouses",
      description: "Read-only search for Unleashed warehouses.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        pageNumber: PAGE_NUMBER,
        pageSize: PAGE_SIZE,
        warehouseCode: z.string().trim().optional(),
        warehouseName: z.string().trim().optional(),
        includeObsolete: z.boolean().optional(),
        modifiedSince: OPTIONAL_DATE.describe("Return only records created or edited on/after this date, format YYYY-MM-DD (e.g. 2026-03-01). Do NOT pass null — omit the field to disable this filter.")
      }
    },
    async ({ pageNumber, pageSize, warehouseCode, warehouseName, includeObsolete, modifiedSince }) => {
      const payload = await unleashed.get<unknown>("/Warehouses", {
        ...pagination(pageNumber, pageSize),
        warehouseCode,
        warehouseName,
        includeObsolete,
        modifiedSince
      });

      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_list_suppliers",
    {
      title: "List Unleashed suppliers",
      description: "Read-only search for Unleashed suppliers.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        pageNumber: PAGE_NUMBER,
        pageSize: PAGE_SIZE,
        contactEmail: z.string().trim().optional(),
        modifiedSince: OPTIONAL_DATE.describe("Return only records created or edited on/after this date, format YYYY-MM-DD (e.g. 2026-03-01). Do NOT pass null — omit the field to disable this filter.")
      }
    },
    async ({ pageNumber, pageSize, contactEmail, modifiedSince }) => {
      const payload = await unleashed.get<unknown>("/Suppliers", {
        ...pagination(pageNumber, pageSize),
        contactEmail,
        modifiedSince
      });

      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_get_supplier",
    {
      title: "Get Unleashed supplier",
      description: "Read-only lookup for one Unleashed supplier by GUID.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        supplierGuid: GUID
      }
    },
    async ({ supplierGuid }) => {
      const payload = await unleashed.get<unknown>(`/Suppliers/${encodeURIComponent(supplierGuid)}`);
      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_list_purchase_orders",
    {
      title: "List Unleashed purchase orders",
      description: "Read-only search for Unleashed purchase orders. WARNING: the full purchase-order history is large and result ordering is not guaranteed — without filters this can return thousands of unhelpful rows. Prefer to narrow by a date range (startDate and/or endDate in YYYY-MM-DD), a supplierCode, an orderStatus, or an orderNumber. If you call this with no narrowing filter at all, the tool will ask you to add one (or set confirmUnbounded: true) instead of dumping everything.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        pageNumber: PAGE_NUMBER,
        pageSize: PAGE_SIZE,
        orderNumber: z.string().trim().optional(),
        supplierCode: z.string().trim().optional(),
        warehouseCode: z.string().trim().optional(),
        orderStatus: z.string().trim().optional(),
        startDate: OPTIONAL_DATE.describe("Lower bound on ORDER DATE, format YYYY-MM-DD (e.g. 2026-01-31). Returns orders dated on/after this date. Do NOT pass null — omit the field entirely to leave the start unbounded (no lower bound)."),
        endDate: OPTIONAL_DATE.describe("Upper bound on ORDER DATE, format YYYY-MM-DD (e.g. 2026-02-28). Returns orders dated up to this date. Do NOT pass null — omit the field entirely to leave the end unbounded (up to today)."),
        modifiedSince: OPTIONAL_DATE.describe("Return only records created or edited on/after this date, format YYYY-MM-DD (e.g. 2026-03-01). Filters on last-modified time, not order date — use it for incremental/delta syncs. Do NOT pass null — omit the field to disable this filter."),
        confirmUnbounded: z.boolean().default(false).describe("Set true ONLY to bypass the no-filter safety check and intentionally fetch an unfiltered, potentially very large result set. Defaults to false, which makes the tool ask for a narrowing filter when none is provided.")
      }
    },
    async ({ pageNumber, pageSize, orderNumber, supplierCode, warehouseCode, orderStatus, startDate, endDate, modifiedSince, confirmUnbounded }) => {
      const hasNarrowingFilter =
        Boolean(startDate) || Boolean(endDate) || Boolean(modifiedSince) ||
        Boolean(supplierCode) || Boolean(orderNumber) || Boolean(orderStatus);
      if (!confirmUnbounded && !hasNarrowingFilter) {
        return jsonResult(PURCHASE_ORDERS_NEEDS_FILTER);
      }

      const payload = await unleashed.get<unknown>("/PurchaseOrders", {
        ...pagination(pageNumber, pageSize),
        orderNumber,
        supplierCode,
        warehouseCode,
        orderStatus,
        startDate,
        endDate,
        modifiedSince
      });

      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_get_purchase_order",
    {
      title: "Get Unleashed purchase order",
      description: "Read-only lookup for one Unleashed purchase order by order number.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        orderNumber: z.string().trim().min(1)
      }
    },
    async ({ orderNumber }) => {
      const payload = await unleashed.get<unknown>("/PurchaseOrders", {
        ...pagination(1, 10),
        orderNumber
      });
      return jsonResult(payload);
    }
  );

  server.registerTool(
    "unleashed_get_purchase_order_by_guid",
    {
      title: "Get Unleashed purchase order by GUID",
      description: "Read-only lookup for one Unleashed purchase order by Unleashed purchase order GUID.",
      annotations: READ_ONLY_ANNOTATIONS,
      inputSchema: {
        orderGuid: GUID
      }
    },
    async ({ orderGuid }) => {
      const payload = await unleashed.get<unknown>(`/PurchaseOrders/${encodeURIComponent(orderGuid)}`);
      return jsonResult(payload);
    }
  );

  registerPurchaseOrderWriteTool(server, unleashed, options);

  return server;
}

const CREATE_PURCHASE_ORDER_INPUT_SCHEMA = {
  dryRun: z.boolean().default(true),
  confirmUpload: z.boolean().default(false),
  purchaseOrderGuid: GUID.optional(),
  supplierCode: z.string().trim().min(1).max(500).optional().describe("Exact Unleashed supplier code. If the user only gave a supplier name or vague hint, leave this blank and set supplierName so the tool can return candidates."),
  supplierName: z.string().trim().min(1).max(500).optional().describe("Supplier name or hint used only to find candidates when supplierCode is not known."),
  warehouseCode: z.string().trim().min(1).max(15).optional(),
  warehouseName: z.string().trim().min(1).max(200).optional().describe("Warehouse name or hint used only to find candidate warehouse codes when warehouseCode is not known."),
  orderStatus: z.enum(["Parked", "Placed"]).default("Parked"),
  orderDate: REPORT_DATE.optional(),
  deliveryDate: REPORT_DATE.optional(),
  supplierRef: z.string().trim().max(500).optional(),
  comments: z.string().trim().max(1024).optional(),
  currencyCode: z.string().trim().length(3).optional(),
  taxCode: z.string().trim().max(25).optional(),
  taxRate: z.number().finite().min(0).optional(),
  discountRate: DISCOUNT_RATE,
  lines: z.array(
    z.object({
      productCode: z.string().trim().min(1).max(100).optional().describe("Exact Unleashed product code. Do not guess this from vague text; use productName or productHint instead."),
      productName: z.string().trim().min(1).max(200).optional().describe("Product name from the user, used only to find candidate product codes."),
      productHint: z.string().trim().min(1).max(200).optional().describe("Any vague product text from the user, such as 'match 021' or 'raspberry', used to find candidate product codes."),
      orderQuantity: z.number().finite().positive().optional(),
      unitPrice: MONEY.optional(),
      lineTax: MONEY.default(0),
      lineTotal: MONEY.optional(),
      deliveryDate: REPORT_DATE.optional(),
      comments: z.string().trim().max(1024).optional(),
      discountRate: DISCOUNT_RATE,
      unitOfMeasureName: z.string().trim().max(20).optional()
    })
  ).default([])
};

type CreatePurchaseOrderInput = z.output<z.ZodObject<typeof CREATE_PURCHASE_ORDER_INPUT_SCHEMA>>;

type ReadyPurchaseOrderInput = Omit<CreatePurchaseOrderInput, "supplierCode" | "warehouseCode" | "lines"> & {
  supplierCode: string;
  warehouseCode: string;
  lines: Array<CreatePurchaseOrderInput["lines"][number] & {
    productCode: string;
    orderQuantity: number;
    unitPrice: number;
  }>;
};

type PurchaseOrderPayload = {
  Guid?: string;
  Supplier: { SupplierCode: string };
  Warehouse: { WarehouseCode: string };
  OrderStatus: "Parked" | "Placed";
  SubTotal: number;
  TaxTotal: number;
  Total: number;
  DiscountRate: number;
  PurchaseOrderLines: PurchaseOrderPayloadLine[];
  OrderDate?: string;
  DeliveryDate?: string;
  SupplierRef?: string;
  Comments?: string;
  Currency?: { CurrencyCode: string };
  TaxCode?: string;
  TaxRate?: number;
};

type PurchaseOrderPayloadLine = {
  LineNumber: number;
  Product: { ProductCode: string };
  OrderQuantity: number;
  UnitPrice: number;
  LineTotal: number;
  LineTax: number;
  DiscountRate: number;
  DeliveryDate?: string;
  Comments?: string;
  UnitOfMeasure?: { Name: string };
};

function registerPurchaseOrderWriteTool(
  server: McpServer,
  unleashed: UnleashedClient,
  options: UnleashedMcpOptions
) {
  server.registerTool(
    "unleashed_create_purchase_order",
    {
      title: "Upload Unleashed purchase order",
      description:
        "Write-scoped creation of one Unleashed purchase order. Defaults to dry-run and Parked status for safe review before upload.",
      annotations: WRITE_ANNOTATIONS,
      inputSchema: CREATE_PURCHASE_ORDER_INPUT_SCHEMA
    },
    async (input) => {
      const needsInput = await inspectPurchaseOrderInput(unleashed, input);
      if (needsInput) {
        return jsonResult(needsInput);
      }

      const readyInput = input as ReadyPurchaseOrderInput;
      const payload = buildPurchaseOrderPayload(readyInput);

      if (input.dryRun) {
        return jsonResult({
          dryRun: true,
          uploadReady: true,
          writeToolsEnabled: Boolean(options.writeToolsEnabled),
          endpoint: purchaseOrderCreatePath(input.purchaseOrderGuid),
          payload
        });
      }

      if (!options.writeToolsEnabled) {
        throw new Error("Purchase order uploads are disabled. Set UNLEASHED_ENABLE_WRITE_TOOLS=true to enable.");
      }

      if (!input.confirmUpload) {
        throw new Error("Set confirmUpload=true after reviewing a dry-run payload before uploading.");
      }

      const result = await unleashed.post<unknown>(purchaseOrderCreatePath(input.purchaseOrderGuid), payload);
      return jsonResult({
        uploaded: true,
        endpoint: purchaseOrderCreatePath(input.purchaseOrderGuid),
        purchaseOrder: result
      });
    }
  );
}

async function inspectPurchaseOrderInput(
  unleashed: UnleashedClient,
  input: CreatePurchaseOrderInput
): Promise<Record<string, unknown> | undefined> {
  const missing: string[] = [];
  const confirmations: Array<Record<string, unknown>> = [];
  const candidateLookups: Record<string, unknown> = {};
  const lookupErrors: Record<string, string> = {};
  const questions: string[] = [];

  if (!input.supplierCode) {
    if (input.supplierName) {
      const suppliers = await findSupplierCandidates(unleashed, input.supplierName);
      candidateLookups.supplierCandidates = suppliers.candidates;
      if (suppliers.error) {
        lookupErrors.supplier = suppliers.error;
        missing.push("supplierCode");
        questions.push(`I could not search suppliers for "${input.supplierName}" because Unleashed returned an error. Ask for the exact supplier code or retry the lookup.`);
      } else if (suppliers.candidates.length > 0) {
        confirmations.push({
          field: "supplierCode",
          question: `I found possible suppliers for "${input.supplierName}". Which one is the right supplier?`,
          candidates: suppliers.candidates
        });
      } else {
        missing.push("supplierName");
        questions.push(`I could not find a supplier match for "${input.supplierName}". What supplier name should I search for?`);
      }
    } else {
      missing.push("supplierName");
      questions.push("What supplier name should I search for in Unleashed?");
    }
  }

  if (!input.warehouseCode) {
    if (input.warehouseName) {
      const warehouses = await findWarehouseCandidates(unleashed, input.warehouseName);
      candidateLookups.warehouseCandidates = warehouses.candidates;
      if (warehouses.error) {
        lookupErrors.warehouse = warehouses.error;
        missing.push("warehouseCode");
        questions.push(`I could not search warehouses for "${input.warehouseName}" because Unleashed returned an error. Ask for the exact warehouse code or retry the lookup.`);
      } else if (warehouses.candidates.length > 0) {
        confirmations.push({
          field: "warehouseCode",
          question: `I found possible warehouses for "${input.warehouseName}". Which one should this purchase order go to?`,
          candidates: warehouses.candidates
        });
      } else {
        missing.push("warehouseName");
        questions.push(`I could not find a warehouse match for "${input.warehouseName}". What warehouse name should I search for?`);
      }
    } else {
      missing.push("warehouseName");
      questions.push("Which warehouse should this purchase order go to?");
    }
  }

  if (!input.deliveryDate) {
    missing.push("deliveryDate");
    questions.push("What delivery date should be used for this purchase order? Use YYYY-MM-DD format.");
  }

  if (input.lines.length === 0) {
    missing.push("lines");
    questions.push("What products should be added to this purchase order?");
  }

  for (const [index, line] of input.lines.entries()) {
    const lineLabel = `lines[${index}]`;
    if (!line.productCode) {
      const productSearch = line.productName ?? line.productHint;
      if (productSearch) {
        const products = await findProductCandidates(unleashed, productSearch);
        candidateLookups[`${lineLabel}.productCandidates`] = products.candidates;
        if (products.error) {
          lookupErrors[`${lineLabel}.product`] = products.error;
          missing.push(`${lineLabel}.productCode`);
          questions.push(`I could not search products for "${productSearch}" because Unleashed returned an error. Ask for the exact product code or retry the lookup.`);
        } else if (products.candidates.length > 0) {
          confirmations.push({
            field: `${lineLabel}.productCode`,
            question: `For "${productSearch}", which product do you mean?`,
            candidates: products.candidates
          });
        } else {
          missing.push(`${lineLabel}.productName`);
          questions.push(`I could not find a product match for "${productSearch}". What product name should I search for?`);
        }
      } else {
        missing.push(`${lineLabel}.productName`);
        questions.push(`What product name should I search for on line ${index + 1}?`);
      }
    }

    if (line.orderQuantity === undefined) {
      missing.push(`${lineLabel}.orderQuantity`);
      questions.push(`What quantity is needed for line ${index + 1}?`);
    }
    if (line.unitPrice === undefined) {
      missing.push(`${lineLabel}.unitPrice`);
      questions.push(`What unit price should be used for line ${index + 1}?`);
    }
  }

  if (missing.length === 0 && confirmations.length === 0) {
    return undefined;
  }

  return {
    status: confirmations.length > 0 ? "needs_confirmation" : "needs_input",
    message:
      "The purchase order is not upload-ready yet. Ask for names first, search Unleashed for matches, then ask the user to confirm the exact match. Do not ask employees to memorize codes and do not guess missing supplier, warehouse, product, quantity, or price fields.",
    missing,
    questions,
    confirmations,
    form: {
      supplierCode: input.supplierCode ?? "",
      supplierName: input.supplierName ?? "",
      warehouseCode: input.warehouseCode ?? "",
      warehouseName: input.warehouseName ?? "",
      orderStatus: input.orderStatus,
      deliveryDate: input.deliveryDate ?? "",
      supplierRef: input.supplierRef ?? "",
      lines: input.lines.map((line) => ({
        productCode: line.productCode ?? "",
        productName: line.productName ?? "",
        productHint: line.productHint ?? "",
        orderQuantity: line.orderQuantity ?? "",
        unitPrice: line.unitPrice ?? "",
        lineTax: line.lineTax ?? 0
      }))
    },
    candidateLookups,
    lookupErrors,
    howToProceed: [
      "If supplierCode is missing, ask for a supplier name and search Unleashed before asking for a code.",
      "If warehouseCode is missing, ask for a warehouse name and search Unleashed before asking for a code.",
      "If productCode is missing, ask for the product name or product description and search Unleashed before asking for a code.",
      "Confirm the purchase order deliveryDate is present in YYYY-MM-DD format before upload.",
      "When candidates are returned, ask in plain English which one the user means.",
      "Confirm each line has a selected product, orderQuantity, and unitPrice.",
      "Run this tool again with dryRun=true after the missing fields are filled.",
      "Only use dryRun=false and confirmUpload=true after the dry-run payload has been reviewed."
    ]
  };
}

type LookupResult = {
  candidates: Array<Record<string, unknown>>;
  error?: string;
};

async function findProductCandidates(
  unleashed: UnleashedClient,
  search: string
): Promise<LookupResult> {
  const errors: string[] = [];

  try {
    const payload = await getWithLookupRetry<UnleashedListResponse<{
      Guid?: string;
      ProductCode?: string;
      ProductDescription?: string;
    }>>(unleashed, "/Products", {
      ...pagination(1, 10),
      product: search,
      brief: true
    });

    return { candidates: mapProductCandidates(payload.Items ?? []) };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Product lookup failed.");
  }

  try {
    const payload = await getWithLookupRetry<UnleashedListResponse<{
      Guid?: string;
      ProductCode?: string;
      ProductDescription?: string;
    }>>(unleashed, "/Products", {
      ...pagination(1, 10),
      productDescription: search
    });

    return { candidates: mapProductCandidates(payload.Items ?? []) };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Product description lookup failed.");
  }

  try {
    const products = await fetchLookupPages<{
      Guid?: string;
      ProductCode?: string;
      ProductDescription?: string;
    }>(unleashed, "/Products", { brief: true });

    const candidates = products.filter((product) =>
      matchesLookup(search, product.ProductDescription, product.ProductCode)
    );

    return { candidates: mapProductCandidates(candidates) };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Product fallback lookup failed.");
  }

  return {
    candidates: [],
    error: errors.join(" | ")
  };
}

async function findSupplierCandidates(
  unleashed: UnleashedClient,
  search: string
): Promise<LookupResult> {
  try {
    const suppliers = await fetchLookupPages<{
      Guid?: string;
      SupplierCode?: string;
      SupplierName?: string;
    }>(unleashed, "/Suppliers");

    const candidates = suppliers.filter((supplier) =>
      matchesLookup(search, supplier.SupplierName, supplier.SupplierCode)
    );

    return { candidates: candidates.slice(0, 10).map((supplier) => ({
      supplierCode: supplier.SupplierCode,
      supplierName: supplier.SupplierName,
      guid: supplier.Guid
    })) };
  } catch (error) {
    return {
      candidates: [],
      error: error instanceof Error ? error.message : "Supplier lookup failed."
    };
  }
}

async function findWarehouseCandidates(
  unleashed: UnleashedClient,
  search: string
): Promise<LookupResult> {
  try {
    const warehouses = await fetchLookupPages<{
      Guid?: string;
      WarehouseCode?: string;
      WarehouseName?: string;
    }>(unleashed, "/Warehouses");

    const candidates = warehouses.filter((warehouse) =>
      matchesLookup(search, warehouse.WarehouseName, warehouse.WarehouseCode)
    );

    return { candidates: candidates.slice(0, 10).map((warehouse) => ({
      warehouseCode: warehouse.WarehouseCode,
      warehouseName: warehouse.WarehouseName,
      guid: warehouse.Guid
    })) };
  } catch (error) {
    return {
      candidates: [],
      error: error instanceof Error ? error.message : "Warehouse lookup failed."
    };
  }
}

async function fetchLookupPages<T>(
  unleashed: UnleashedClient,
  path: string,
  query: Record<string, string | number | boolean | undefined> = {}
): Promise<T[]> {
  const items: T[] = [];
  const pageSize = 200;
  const maxPages = 10;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    const payload = await getWithLookupRetry<UnleashedListResponse<T>>(unleashed, path, {
      ...pagination(pageNumber, pageSize),
      ...query
    });
    items.push(...(payload.Items ?? []));

    const numberOfPages = payload.Pagination?.NumberOfPages;
    if (!numberOfPages || pageNumber >= numberOfPages) {
      break;
    }
  }

  return items;
}

async function getWithLookupRetry<T>(
  unleashed: UnleashedClient,
  path: string,
  query: Record<string, string | number | boolean | undefined>
): Promise<T> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await unleashed.get<T>(path, query);
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts || !isTransientLookupError(error)) {
        throw error;
      }

      await sleep(250 * attempt);
    }
  }

  throw lastError;
}

function isTransientLookupError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /\b(403|408|409|425|429|500|502|503|504)\b/.test(error.message);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function mapProductCandidates(products: Array<{
  Guid?: string;
  ProductCode?: string;
  ProductDescription?: string;
}>): Array<Record<string, unknown>> {
  return products.slice(0, 10).map((product) => ({
    productCode: product.ProductCode,
    productDescription: product.ProductDescription,
    guid: product.Guid
  }));
}

function matchesLookup(search: string, name?: string, code?: string): boolean {
  const terms = normalizeLookup(search).split(" ").filter(Boolean);
  const haystack = normalizeLookup(`${name ?? ""} ${code ?? ""}`);

  return terms.length > 0 && terms.every((term) => haystack.includes(term));
}

function normalizeLookup(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildPurchaseOrderPayload(input: ReadyPurchaseOrderInput): PurchaseOrderPayload {
  const lines = input.lines.map((line, index) => buildPurchaseOrderLine(line, index + 1));
  const subTotal = round2(lines.reduce((sum, line) => sum + line.LineTotal, 0));
  const taxTotal = round2(lines.reduce((sum, line) => sum + line.LineTax, 0));

  return omitUndefined({
    Guid: input.purchaseOrderGuid,
    Supplier: { SupplierCode: input.supplierCode },
    Warehouse: { WarehouseCode: input.warehouseCode },
    OrderStatus: input.orderStatus,
    OrderDate: input.orderDate,
    DeliveryDate: input.deliveryDate,
    SupplierRef: input.supplierRef,
    Comments: input.comments,
    Currency: input.currencyCode ? { CurrencyCode: input.currencyCode } : undefined,
    TaxCode: input.taxCode,
    TaxRate: input.taxRate,
    DiscountRate: input.discountRate,
    SubTotal: subTotal,
    TaxTotal: taxTotal,
    Total: round2(subTotal + taxTotal),
    PurchaseOrderLines: lines
  });
}

function buildPurchaseOrderLine(
  line: ReadyPurchaseOrderInput["lines"][number],
  lineNumber: number
): PurchaseOrderPayloadLine {
  const lineTotal = line.lineTotal ?? line.orderQuantity * line.unitPrice * (1 - line.discountRate);

  return omitUndefined({
    LineNumber: lineNumber,
    Product: { ProductCode: line.productCode },
    OrderQuantity: line.orderQuantity,
    UnitPrice: line.unitPrice,
    LineTotal: round2(lineTotal),
    LineTax: round2(line.lineTax),
    DiscountRate: line.discountRate,
    DeliveryDate: line.deliveryDate,
    Comments: line.comments,
    UnitOfMeasure: line.unitOfMeasureName ? { Name: line.unitOfMeasureName } : undefined
  });
}

function purchaseOrderCreatePath(purchaseOrderGuid: string | undefined): string {
  return purchaseOrderGuid ? `/PurchaseOrders/${encodeURIComponent(purchaseOrderGuid)}` : "/PurchaseOrders";
}

type UnleashedListResponse<T> = {
  Pagination?: {
    NumberOfItems?: number;
    PageSize?: number;
    PageNumber?: number;
    NumberOfPages?: number;
  };
  Items?: T[];
};

type SalesOrder = {
  Guid?: string;
  OrderNumber?: string;
  OrderDate?: string;
  Customer?: {
    CustomerCode?: string;
    CustomerName?: string;
  };
  Warehouse?: {
    WarehouseCode?: string;
    WarehouseName?: string;
  };
  SubTotal?: number;
  Total?: number;
  SalesOrderLines?: SalesOrderLine[];
};

type SalesOrderLine = {
  Product?: {
    ProductCode?: string;
    ProductDescription?: string;
  };
  OrderQuantity?: number;
  UnitPrice?: number;
  LineTotal?: number;
  AverageLandedPriceAtTimeOfSale?: number;
};

type RankedEntity = {
  key: string;
  name: string;
  revenue: number;
  units: number;
  orders: number;
  averageSellingPrice: number;
  grossProfitEstimate?: number;
  grossMarginPercent?: number;
};

type SalesSummary = {
  startDate: string;
  endDate: string;
  days: number;
  totals: {
    revenue: number;
    orders: number;
    units: number;
    averageOrderValue: number;
    averageSellingPrice: number;
    grossProfitEstimate?: number;
    grossMarginPercent?: number;
    grossProfitVelocityPerDay?: number;
    revenueVelocityPerDay: number;
  };
  concentrationRisk: {
    top5ProductRevenuePercent: number;
    top5CustomerRevenuePercent: number;
  };
  daily: Array<{
    date: string;
    revenue: number;
    orders: number;
    units: number;
    grossProfitEstimate?: number;
  }>;
  products: {
    topByRevenue: RankedEntity[];
    topByUnits: RankedEntity[];
    topByGrossProfit: RankedEntity[];
    all: RankedEntity[];
  };
  customers: {
    topByRevenue: RankedEntity[];
    topByOrders: RankedEntity[];
    topByGrossProfit: RankedEntity[];
    all: RankedEntity[];
  };
  dataQuality: {
    ordersWithoutLines: number;
    linesWithCost: number;
    linesWithoutCost: number;
    grossProfitCoveragePercent: number;
  };
};

type MutableEntity = {
  key: string;
  name: string;
  revenue: number;
  units: number;
  orderNumbers: Set<string>;
  cost: number;
  revenueWithCost: number;
  linesWithCost: number;
};

async function fetchSalesOrdersByDay(
  unleashed: UnleashedClient,
  startDate: string,
  endDate: string,
  orderStatus: string
): Promise<{ orders: SalesOrder[]; warnings: string[] }> {
  const dates = inclusiveDates(startDate, endDate);
  if (dates.length > 93) {
    throw new Error("Report date range is limited to 93 days per call.");
  }

  const orders: SalesOrder[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const date of dates) {
    const payload = await unleashed.get<UnleashedListResponse<SalesOrder>>("/SalesOrders", {
      startDate: date,
      endDate: date,
      orderStatus,
      pageSize: 1000,
      page: 1
    });

    const items = payload.Items ?? [];
    const total = payload.Pagination?.NumberOfItems ?? items.length;
    if (total > items.length) {
      warnings.push(
        `${date}: returned ${items.length} of ${total} orders; this date may need a native Unleashed export.`
      );
    }

    for (const order of items) {
      const key = order.Guid ?? order.OrderNumber;
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      orders.push(order);
    }
  }

  return { orders, warnings };
}

function summarizeSalesOrders(
  orders: SalesOrder[],
  startDate: string,
  endDate: string,
  topLimit: number
): SalesSummary {
  const products = new Map<string, MutableEntity>();
  const customers = new Map<string, MutableEntity>();
  const daily = new Map<string, MutableEntity>();
  let revenue = 0;
  let units = 0;
  let cost = 0;
  let revenueWithCost = 0;
  let linesWithCost = 0;
  let linesWithoutCost = 0;
  let ordersWithoutLines = 0;

  for (const order of orders) {
    const orderNumber = order.OrderNumber ?? order.Guid ?? "unknown-order";
    const orderDate = formatUnleashedDate(order.OrderDate) ?? "unknown-date";
    const customerCode = order.Customer?.CustomerCode ?? "UNKNOWN";
    const customerName = order.Customer?.CustomerName ?? customerCode;
    const customer = getEntity(customers, customerCode, customerName);
    const day = getEntity(daily, orderDate, orderDate);
    const lines = order.SalesOrderLines ?? [];

    customer.orderNumbers.add(orderNumber);
    day.orderNumbers.add(orderNumber);

    if (lines.length === 0) {
      ordersWithoutLines += 1;
      const orderRevenue = numeric(order.SubTotal) || numeric(order.Total);
      revenue += orderRevenue;
      customer.revenue += orderRevenue;
      day.revenue += orderRevenue;
      continue;
    }

    for (const line of lines) {
      const quantity = numeric(line.OrderQuantity);
      const lineRevenue = numeric(line.LineTotal);
      const productCode = line.Product?.ProductCode ?? "UNKNOWN";
      const productName = line.Product?.ProductDescription ?? productCode;
      const product = getEntity(products, productCode, productName);

      revenue += lineRevenue;
      units += quantity;
      product.revenue += lineRevenue;
      product.units += quantity;
      product.orderNumbers.add(orderNumber);
      customer.revenue += lineRevenue;
      customer.units += quantity;
      day.revenue += lineRevenue;
      day.units += quantity;

      const unitCost = numeric(line.AverageLandedPriceAtTimeOfSale);
      if (unitCost > 0 && quantity !== 0) {
        const lineCost = unitCost * quantity;
        cost += lineCost;
        revenueWithCost += lineRevenue;
        linesWithCost += 1;
        product.cost += lineCost;
        product.revenueWithCost += lineRevenue;
        product.linesWithCost += 1;
        customer.cost += lineCost;
        customer.revenueWithCost += lineRevenue;
        customer.linesWithCost += 1;
        day.cost += lineCost;
        day.revenueWithCost += lineRevenue;
        day.linesWithCost += 1;
      } else {
        linesWithoutCost += 1;
      }
    }
  }

  const days = inclusiveDates(startDate, endDate).length;
  const grossProfit = revenueWithCost > 0 ? revenueWithCost - cost : undefined;
  const allProducts = [...products.values()].map(toRankedEntity);
  const allCustomers = [...customers.values()].map(toRankedEntity);
  const sortedProductsByRevenue = sortBy(allProducts, "revenue");
  const sortedCustomersByRevenue = sortBy(allCustomers, "revenue");

  return {
    startDate,
    endDate,
    days,
    totals: {
      revenue: round2(revenue),
      orders: orders.length,
      units: round2(units),
      averageOrderValue: round2(orders.length ? revenue / orders.length : 0),
      averageSellingPrice: round2(units ? revenue / units : 0),
      grossProfitEstimate: grossProfit === undefined ? undefined : round2(grossProfit),
      grossMarginPercent: grossProfit === undefined ? undefined : percent(grossProfit, revenueWithCost),
      grossProfitVelocityPerDay: grossProfit === undefined ? undefined : round2(grossProfit / days),
      revenueVelocityPerDay: round2(revenue / days)
    },
    concentrationRisk: {
      top5ProductRevenuePercent: percent(sumTop(sortedProductsByRevenue, 5, "revenue"), revenue),
      top5CustomerRevenuePercent: percent(sumTop(sortedCustomersByRevenue, 5, "revenue"), revenue)
    },
    daily: [...daily.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((entry) => ({
        date: entry.key,
        revenue: round2(entry.revenue),
        orders: entry.orderNumbers.size,
        units: round2(entry.units),
        grossProfitEstimate: entry.revenueWithCost > 0 ? round2(entry.revenueWithCost - entry.cost) : undefined
      })),
    products: {
      topByRevenue: sortedProductsByRevenue.slice(0, topLimit),
      topByUnits: sortBy(allProducts, "units").slice(0, topLimit),
      topByGrossProfit: sortByGrossProfit(allProducts).slice(0, topLimit),
      all: sortedProductsByRevenue
    },
    customers: {
      topByRevenue: sortedCustomersByRevenue.slice(0, topLimit),
      topByOrders: sortBy(allCustomers, "orders").slice(0, topLimit),
      topByGrossProfit: sortByGrossProfit(allCustomers).slice(0, topLimit),
      all: sortedCustomersByRevenue
    },
    dataQuality: {
      ordersWithoutLines,
      linesWithCost,
      linesWithoutCost,
      grossProfitCoveragePercent: percent(revenueWithCost, revenue)
    }
  };
}

function getEntity(map: Map<string, MutableEntity>, key: string, name: string): MutableEntity {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }

  const entity: MutableEntity = {
    key,
    name,
    revenue: 0,
    units: 0,
    orderNumbers: new Set<string>(),
    cost: 0,
    revenueWithCost: 0,
    linesWithCost: 0
  };
  map.set(key, entity);
  return entity;
}

function toRankedEntity(entity: MutableEntity): RankedEntity {
  const grossProfit = entity.revenueWithCost > 0 ? entity.revenueWithCost - entity.cost : undefined;
  return {
    key: entity.key,
    name: entity.name,
    revenue: round2(entity.revenue),
    units: round2(entity.units),
    orders: entity.orderNumbers.size,
    averageSellingPrice: round2(entity.units ? entity.revenue / entity.units : 0),
    grossProfitEstimate: grossProfit === undefined ? undefined : round2(grossProfit),
    grossMarginPercent: grossProfit === undefined ? undefined : percent(grossProfit, entity.revenueWithCost)
  };
}

function buildChanges(primary: SalesSummary, comparison: SalesSummary) {
  return {
    revenue: delta(primary.totals.revenue, comparison.totals.revenue),
    orders: delta(primary.totals.orders, comparison.totals.orders),
    units: delta(primary.totals.units, comparison.totals.units),
    averageOrderValue: delta(primary.totals.averageOrderValue, comparison.totals.averageOrderValue),
    grossProfitEstimate:
      primary.totals.grossProfitEstimate === undefined || comparison.totals.grossProfitEstimate === undefined
        ? undefined
        : delta(primary.totals.grossProfitEstimate, comparison.totals.grossProfitEstimate)
  };
}

function publicSalesSummary(summary: SalesSummary) {
  return {
    startDate: summary.startDate,
    endDate: summary.endDate,
    days: summary.days,
    totals: summary.totals,
    concentrationRisk: summary.concentrationRisk,
    daily: summary.daily,
    products: {
      topByRevenue: summary.products.topByRevenue,
      topByUnits: summary.products.topByUnits,
      topByGrossProfit: summary.products.topByGrossProfit
    },
    customers: {
      topByRevenue: summary.customers.topByRevenue,
      topByOrders: summary.customers.topByOrders,
      topByGrossProfit: summary.customers.topByGrossProfit
    },
    dataQuality: summary.dataQuality
  };
}

function compareRankedEntities(primary: RankedEntity[], comparison: RankedEntity[], limit: number) {
  const previousByKey = new Map(comparison.map((entity) => [entity.key, entity]));
  return primary
    .map((entity) => {
      const previous = previousByKey.get(entity.key);
      return {
        key: entity.key,
        name: entity.name,
        revenueChange: delta(entity.revenue, previous?.revenue ?? 0),
        unitsChange: delta(entity.units, previous?.units ?? 0),
        orderChange: delta(entity.orders, previous?.orders ?? 0)
      };
    })
    .sort((a, b) => Math.abs(b.revenueChange.absolute) - Math.abs(a.revenueChange.absolute))
    .slice(0, limit);
}

function inclusiveDates(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    throw new Error("Invalid report date range.");
  }

  const dates: string[] = [];
  for (const current = new Date(start); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    dates.push(current.toISOString().slice(0, 10));
  }
  return dates;
}

function formatUnleashedDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/\/Date\((\d+)\)\//);
  const date = match ? new Date(Number(match[1])) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString().slice(0, 10);
}

function numeric(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function omitUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function percent(part: number, whole: number): number {
  return whole ? round2((part / whole) * 100) : 0;
}

function delta(current: number, previous: number) {
  const absolute = round2(current - previous);
  return {
    current,
    previous,
    absolute,
    percent: previous ? percent(absolute, previous) : undefined
  };
}

function sortBy(items: RankedEntity[], field: "revenue" | "units" | "orders"): RankedEntity[] {
  return [...items].sort((a, b) => b[field] - a[field]);
}

function sortByGrossProfit(items: RankedEntity[]): RankedEntity[] {
  return [...items].sort((a, b) => (b.grossProfitEstimate ?? -Infinity) - (a.grossProfitEstimate ?? -Infinity));
}

function sumTop(items: RankedEntity[], count: number, field: "revenue" | "units" | "orders"): number {
  return items.slice(0, count).reduce((sum, item) => sum + item[field], 0);
}

function pagination(pageNumber: number, pageSize: number) {
  return {
    page: pageNumber,
    pageSize
  };
}

const MAX_RESULT_CHARS = 250_000;

function jsonResult(payload: unknown) {
  const text = JSON.stringify(payload, null, 2);

  if (text.length <= MAX_RESULT_CHARS) {
    return {
      content: [{ type: "text" as const, text }]
    };
  }

  // Overflow: never emit a mid-structure slice (that produced unparseable JSON and
  // silently dropped orders). Return a valid, self-describing note so the client can narrow.
  const itemCount =
    payload && typeof payload === "object" && Array.isArray((payload as { Items?: unknown[] }).Items)
      ? (payload as { Items: unknown[] }).Items.length
      : undefined;

  const note = {
    status: "response_too_large",
    message:
      `The result is ${text.length} characters, exceeding the ${MAX_RESULT_CHARS}-character response limit. ` +
      "Nothing was returned rather than send a truncated, unparseable payload. Narrow the query and retry.",
    ...(itemCount !== undefined ? { itemCount } : {}),
    howToProceed: [
      "Narrow the date range to a smaller startDate/endDate window.",
      "Reduce pageSize and page through the results, or add a customerCode / orderStatus filter.",
      "For totals or aggregates over a range, use unleashed_sales_performance_report instead of listing raw orders."
    ]
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(note, null, 2) }]
  };
}
