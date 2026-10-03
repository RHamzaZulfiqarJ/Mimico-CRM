import { describe, expect, it } from "vitest";

import { displayRefundUid, refundUidFromId } from "./identifiers";

describe("refund identifiers", () => {
  it("derives a stable readable identifier from the UUID", () => {
    const id = "12345678-90ab-cdef-1234-567890abcdef";
    expect(refundUidFromId(id)).toBe("REF-1234567890AB");
    expect(displayRefundUid(null, id)).toBe("REF-1234567890AB");
    expect(displayRefundUid("LEGACY-42", id)).toBe("LEGACY-42");
  });
});
