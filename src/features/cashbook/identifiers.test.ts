import { describe, expect, it } from "vitest";

import {
  cashbookUidFromId,
  displayCashbookUid,
} from "@/features/cashbook/identifiers";

describe("cashbook identifiers", () => {
  it("creates stable readable IDs from database UUIDs", () => {
    const id = "4e3ee49d-a2fd-47f5-9ac5-cc876c9f981d";
    expect(cashbookUidFromId(id)).toBe("CASH-4E3EE49DA2FD");
    expect(displayCashbookUid(null, id)).toBe("CASH-4E3EE49DA2FD");
    expect(displayCashbookUid("LEGACY-1", id)).toBe("LEGACY-1");
  });
});
