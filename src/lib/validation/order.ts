import { z } from "zod";

import { currencyCode, fxRate, isoDate, nonNegativeMoney } from "./money";

export const SALES_CHANNELS = [
  "shopee",
  "lazada",
  "tiktok",
  "facebook",
  "website",
  "walk_in",
  "other",
] as const;

export const ORDER_STATUSES = ["draft", "confirmed", "cancelled"] as const;

/** Quantity: positive, up to 2 decimals (supports fractional units). */
const quantity = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid quantity")
  .refine((v) => Number(v) > 0, "Quantity must be greater than 0");

export const OrderItemSchema = z.object({
  productName: z.string().trim().min(1, "Product is required").max(200),
  sku: z.string().trim().max(80).optional(),
  qty: quantity,
  unitPrice: nonNegativeMoney,
  unitCost: nonNegativeMoney.default("0"),
});

export const OrderCreateSchema = z
  .object({
    orderNo: z.string().trim().max(40).optional(), // blank ⇒ auto-generated
    customerName: z.string().trim().max(200).optional(),
    channel: z.enum(SALES_CHANNELS),
    orderDate: isoDate,
    status: z.enum(ORDER_STATUSES).default("confirmed"),
    cashAccountId: z.string().uuid().optional(),
    shippingFee: nonNegativeMoney.default("0"),
    discount: nonNegativeMoney.default("0"),
    amountPaid: nonNegativeMoney.default("0"),
    currency: currencyCode,
    fxToPhp: fxRate,
    notes: z.string().trim().max(1000).optional(),
    items: z.array(OrderItemSchema).min(1, "Add at least one item"),
  })
  // If money was received, it must be attributed to a cash account.
  .refine((d) => Number(d.amountPaid) === 0 || !!d.cashAccountId, {
    message: "Select the cash account that received the payment",
    path: ["cashAccountId"],
  });

export const OrderUpdateSchema = z
  .object({
    id: z.string().uuid(),
    orderNo: z.string().trim().max(40).optional(),
    customerName: z.string().trim().max(200).optional(),
    channel: z.enum(SALES_CHANNELS),
    orderDate: isoDate,
    status: z.enum(ORDER_STATUSES).default("confirmed"),
    cashAccountId: z.string().uuid().optional(),
    shippingFee: nonNegativeMoney.default("0"),
    discount: nonNegativeMoney.default("0"),
    amountPaid: nonNegativeMoney.default("0"),
    currency: currencyCode,
    fxToPhp: fxRate,
    notes: z.string().trim().max(1000).optional(),
    items: z.array(OrderItemSchema).min(1, "Add at least one item"),
  })
  .refine((d) => Number(d.amountPaid) === 0 || !!d.cashAccountId, {
    message: "Select the cash account that received the payment",
    path: ["cashAccountId"],
  });

export type OrderItemInput = z.infer<typeof OrderItemSchema>;
export type OrderCreateInput = z.infer<typeof OrderCreateSchema>;
export type OrderUpdateInput = z.infer<typeof OrderUpdateSchema>;
