import { z } from "zod";

export const CATEGORY_KINDS = ["income", "cogs", "expense"] as const;

export const CategoryCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  kind: z.enum(CATEGORY_KINDS),
  code: z.string().trim().max(40).optional(),
  // Optional self-parent for the chart-of-accounts hierarchy.
  parentId: z.string().uuid().nullable().optional(),
});

export const CategoryUpdateSchema = CategoryCreateSchema.extend({
  id: z.string().uuid(),
});

export type CategoryCreateInput = z.infer<typeof CategoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof CategoryUpdateSchema>;
