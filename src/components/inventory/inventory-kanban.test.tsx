import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { InventoryKanban, type KanbanInventory } from "./inventory-kanban";

const { updateInventoryStatusAction, refresh } = vi.hoisted(() => ({
  updateInventoryStatusAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/features/reference-data/actions", () => ({ updateInventoryStatusAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const inventory: KanbanInventory = {
  id: "inventory-1",
  uid: "INV-001",
  property: "Plot 42",
  project: "North Tower",
  seller: "Sana Ahmed",
  sellerPhone: "0300 1234567",
  sellerCity: "Lahore",
  price: "PKR 12,000,000.00",
  status: "UNSOLD",
  created: "15/10/2026",
};

describe("inventory Kanban", () => {
  beforeEach(() => {
    cleanup();
    updateInventoryStatusAction.mockReset();
    refresh.mockReset();
  });

  it("moves inventory and refreshes after the server accepts the change", async () => {
    updateInventoryStatusAction.mockResolvedValue({ status: "success" });
    render(<InventoryKanban inventories={[inventory]} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Move Plot 42 to status" }), { target: { value: "UNDER_PROCESS" } });
    expect(updateInventoryStatusAction).toHaveBeenCalledWith("inventory-1", "UNDER_PROCESS");
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.getByRole("combobox", { name: "Move Plot 42 to status" })).toHaveValue("UNDER_PROCESS");
  });

  it("restores the previous status when the server rejects the move", async () => {
    updateInventoryStatusAction.mockResolvedValue({ status: "error", message: "Inventory changed elsewhere." });
    render(<InventoryKanban inventories={[inventory]} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Move Plot 42 to status" }), { target: { value: "SOLD" } });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Inventory changed elsewhere."));
    expect(screen.getByRole("combobox", { name: "Move Plot 42 to status" })).toHaveValue("UNSOLD");
    expect(refresh).not.toHaveBeenCalled();
  });
});
