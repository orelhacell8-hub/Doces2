import { describe, expect, it } from "vitest";
import { checkoutInput } from "@/lib/checkout-input";

describe("document-free checkout", () => {
  it("accepts a purchase without CPF or CNPJ", () => {
    const productId = "12345678-1234-4234-8234-123456789abc";
    expect(checkoutInput.parse({ productId })).toEqual({ productId });
  });
  it("does not retain a supplied personal document", () => {
    const productId = "12345678-1234-4234-8234-123456789abc";
    expect(checkoutInput.parse({ productId, document: "12345678901" })).toEqual({ productId });
  });
});