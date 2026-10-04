import { describe, expect, it } from "vitest";

import {
  attachmentMetadataSchema,
  attachmentObjectPath,
  formatAttachmentSize,
  isLeadAttachmentPath,
} from "@/features/attachments/policy";

describe("attachment policy", () => {
  it("accepts supported files within the size limit", () => {
    expect(
      attachmentMetadataSchema.safeParse({
        name: "booking-form.pdf",
        type: "application/pdf",
        size: 500_000,
      }).success,
    ).toBe(true);
  });

  it("rejects executable and oversized files", () => {
    expect(
      attachmentMetadataSchema.safeParse({ name: "payload.exe", type: "application/x-msdownload", size: 1_000 }).success,
    ).toBe(false);
    expect(
      attachmentMetadataSchema.safeParse({ name: "large.pdf", type: "application/pdf", size: 11 * 1024 * 1024 }).success,
    ).toBe(false);
    expect(
      attachmentMetadataSchema.safeParse({ name: "disguised.exe", type: "application/pdf", size: 1_000 }).success,
    ).toBe(false);
  });

  it("builds and scopes opaque object paths", () => {
    const path = attachmentObjectPath("org-1", "lead-1", "Client Form.PDF", "object-1");
    expect(path).toBe("org-1/leads/lead-1/object-1.pdf");
    expect(isLeadAttachmentPath(path, "org-1", "lead-1")).toBe(true);
    expect(isLeadAttachmentPath(path, "org-2", "lead-1")).toBe(false);
    expect(isLeadAttachmentPath("org-1/leads/lead-1/../secret.pdf", "org-1", "lead-1")).toBe(false);
  });

  it("formats file sizes", () => {
    expect(formatAttachmentSize(1024)).toBe("1.0 KB");
    expect(formatAttachmentSize(BigInt(2 * 1024 * 1024))).toBe("2.0 MB");
  });
});
