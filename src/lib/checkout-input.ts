import { z } from "zod";

// Buyers only choose a product; personal documents are not collected.
export const checkoutInput = z.object({ productId: z.string().uuid() });