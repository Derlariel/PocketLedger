import { z } from "zod";

export const transactionInput = z.object({
  accountId: z.uuid(),
  type: z.enum(["income", "expense", "refund", "adjustment"]),
  amount: z.string().min(1),
  occurredAt: z.iso.datetime({ local: true }),
  description: z.string().trim().min(1).max(160),
  note: z.string().trim().max(1000).optional(),
  categoryId: z.uuid().nullish(),
  paymentMethod: z.enum(["cash", "transfer", "ewallet", "other"]).optional(),
  status: z.enum(["draft", "posted"]),
  idempotencyKey: z.uuid(),
});
