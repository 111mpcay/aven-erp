/** Client-safe shapes for the Orders UI (no server imports). */

export type SalesChannel =
  | "shopee"
  | "lazada"
  | "tiktok"
  | "facebook"
  | "website"
  | "walk_in"
  | "other";

export const CHANNEL_LABELS: Record<SalesChannel, string> = {
  shopee: "Shopee",
  lazada: "Lazada",
  tiktok: "TikTok Shop",
  facebook: "Facebook",
  website: "Website",
  walk_in: "Walk-in",
  other: "Other",
};

export type OrderStatus = "draft" | "confirmed" | "cancelled";
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
};

export type PaymentStatus = "unpaid" | "partial" | "paid";

export type AccountOption = { id: string; name: string };

/** Row shape rendered in the orders table (mirrors lib/orders OrderRow). */
export type OrderRowView = {
  id: string;
  orderNo: string;
  customerName: string | null;
  channel: string;
  orderDate: string;
  status: string;
  paymentStatus: PaymentStatus;
  total: string;
  amountPaid: string;
  cogs: string;
  currency: string;
  cashAccountId: string | null;
  cashAccountName: string | null;
};

export type EditableItem = {
  productName: string;
  sku: string;
  qty: string;
  unitPrice: string;
  unitCost: string;
};

/** Order + items used to prefill the edit form (fetched on demand). */
export type EditableOrder = {
  id: string;
  orderNo: string;
  customerName: string | null;
  channel: SalesChannel;
  orderDate: string;
  status: OrderStatus;
  cashAccountId: string | null;
  shippingFee: string;
  discount: string;
  amountPaid: string;
  currency: string;
  fxToPhp: string;
  notes: string | null;
  items: EditableItem[];
};
