import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SaleKanban, type KanbanSale } from "./sale-kanban";

vi.mock("@/components/sales/sale-forms", () => ({
  SaleRowActions: () => <button type="button">Sale actions</button>,
}));

const sale: KanbanSale = {
  id: "sale-1",
  uid: "SAL-001",
  clientName: "Sana Ahmed",
  paymentType: "bank_transfer",
  staffName: "Aisha Khan",
  referenceNumber: "TRX-42",
  netPrice: "PKR 10,000,000.00",
  receivedAmount: "PKR 12,000,000.00",
  profit: "PKR 2,000,000.00",
  created: "16/10/2026",
  defaults: {
    id: "sale-1",
    staffProfileId: "staff-1",
    leadId: null,
    clientName: "Sana Ahmed",
    paymentType: "bank_transfer",
    referenceNumber: "TRX-42",
    netPrice: "10000000.00",
    receivedAmount: "12000000.00",
  },
  canEdit: true,
  canDelete: false,
};

describe("sales Kanban", () => {
  it("groups sales by payment method and keeps audited row actions", () => {
    render(<SaleKanban sales={[sale]} staff={[]} leads={[]} canChooseStaff={false} />);

    expect(screen.getByRole("region", { name: "Bank transfer sales" })).toHaveTextContent("Sana Ahmed");
    expect(screen.getByRole("region", { name: "Bank transfer sales" })).toHaveTextContent("TRX-42");
    expect(screen.getByRole("button", { name: "Sale actions" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Cash sales" })).toHaveTextContent("No sales with this payment method");
  });
});
