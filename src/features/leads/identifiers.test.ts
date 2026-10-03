import { describe, expect, it } from "vitest";

import { displayLeadUid, leadUidFromId } from "@/features/leads/identifiers";

describe("lead identifiers", () => {
  const id = "a3bb189e-8bf9-4c60-9f46-18f5880f1b13";

  it("creates a stable readable ID from the database UUID", () => {
    expect(leadUidFromId(id)).toBe("LEAD-A3BB189E8BF9");
  });

  it("keeps an existing imported ID and fills missing IDs", () => {
    expect(displayLeadUid("LEGACY-42", id)).toBe("LEGACY-42");
    expect(displayLeadUid(null, id)).toBe("LEAD-A3BB189E8BF9");
    expect(displayLeadUid("  ", id)).toBe("LEAD-A3BB189E8BF9");
  });
});
