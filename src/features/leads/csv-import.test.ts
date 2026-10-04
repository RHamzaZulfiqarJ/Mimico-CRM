import { describe, expect, it } from "vitest";

import {
  parseImportPriority,
  parseImportStage,
  parseLeadCsv,
  validateLeadImportRow,
} from "@/features/leads/csv-import";

describe("lead CSV import", () => {
  it("parses quoted commas, escaped quotes, and multiline values", () => {
    const parsed = parseLeadCsv(
      'Client Name,Client Phone,Description\r\n"Ayesha, Khan",03001234567,"Asked for ""corner"" plot\nand payment plan"',
    );
    expect(parsed.headers).toEqual(["client_name", "client_phone", "description"]);
    expect(parsed.rows[0]).toMatchObject({
      rowNumber: 2,
      values: {
        client_name: "Ayesha, Khan",
        client_phone: "03001234567",
        description: 'Asked for "corner" plot\nand payment plan',
      },
    });
  });

  it("requires the client name and phone headers", () => {
    expect(() => parseLeadCsv("name,phone\nAyesha,03001234567")).toThrow(
      "Missing required CSV header: client_name.",
    );
  });

  it("rejects unclosed quoted fields", () => {
    expect(() => parseLeadCsv('client_name,client_phone\n"Ayesha,03001234567')).toThrow(
      "unclosed quoted value",
    );
  });

  it("maps readable priority and stage labels", () => {
    expect(parseImportPriority("Very Hot")).toBe("VERY_HOT");
    expect(parseImportStage("Call Not Attend")).toBe("CALL_NOT_ATTEND");
    expect(parseImportPriority("urgent")).toBeNull();
  });

  it("validates row lengths and required values", () => {
    const result = validateLeadImportRow({
      rowNumber: 2,
      values: { client_name: "A", client_phone: "12" },
    });
    expect(result.success).toBe(false);
  });
});
