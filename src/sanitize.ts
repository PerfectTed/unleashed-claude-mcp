type UnknownRecord = Record<string, unknown>;

const SAFE_CUSTOMER_FIELDS = [
  "Guid",
  "CustomerCode",
  "CustomerName",
  "Name",
  "Currency",
  "SalesPerson",
  "Taxable",
  "TaxCode",
  "PaymentTerm",
  "CustomerType",
  "AccountReceivable",
  "Obsolete",
  "IsObsolete",
  "CreatedOn",
  "LastModifiedOn"
];

const CONTACT_FIELDS = new Set([
  "Email",
  "Phone",
  "Mobile",
  "Fax",
  "ContactName",
  "PostalAddress",
  "PhysicalAddress",
  "DeliveryAddress",
  "Addresses",
  "Contacts"
]);

const GENERIC_DTC_HINTS = [
  "amazon",
  "dtc",
  "direct to consumer",
  "direct-to-consumer",
  "shopify",
  "web sales",
  "website",
  "woo",
  "woocommerce"
];

export function sanitizeCustomer(value: unknown, includeContactDetails = false): unknown {
  if (!isRecord(value)) {
    return value;
  }

  const result: UnknownRecord = {};
  for (const key of SAFE_CUSTOMER_FIELDS) {
    if (key in value) {
      result[key] = value[key];
    }
  }

  if (includeContactDetails) {
    for (const [key, item] of Object.entries(value)) {
      if (CONTACT_FIELDS.has(key)) {
        result[key] = item;
      }
    }
  }

  result.AccountCategory = inferCustomerCategory(value);
  return result;
}

export function sanitizeCustomerCollection(payload: unknown, includeContactDetails = false): unknown {
  if (!isRecord(payload)) {
    return payload;
  }

  const result: UnknownRecord = { ...payload };
  for (const key of ["Items", "Customers", "customers"]) {
    if (Array.isArray(payload[key])) {
      result[key] = payload[key].map((item) => sanitizeCustomer(item, includeContactDetails));
    }
  }

  return result;
}

function inferCustomerCategory(customer: UnknownRecord): string {
  const text = [
    customer.CustomerCode,
    customer.CustomerName,
    customer.Name,
    customer.CustomerType
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();

  if (GENERIC_DTC_HINTS.some((hint) => text.includes(hint))) {
    return "generic_dtc_channel";
  }

  return "trade_or_business_account";
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
