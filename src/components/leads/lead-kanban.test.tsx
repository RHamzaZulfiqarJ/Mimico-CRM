import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LeadKanban, type KanbanLead } from "./lead-kanban";

const { moveLeadStageAction, refresh } = vi.hoisted(() => ({
  moveLeadStageAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/features/leads/actions", () => ({ moveLeadStageAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const lead: KanbanLead = {
  id: "lead-1",
  uid: "L-001",
  clientName: "Sana Ahmed",
  clientPhone: "0300 1234567",
  priority: "HOT",
  stage: "NEW_CLIENT",
  project: "North Tower",
  staff: "Aisha",
  created: "14/10/2026",
};

describe("lead Kanban", () => {
  beforeEach(() => {
    cleanup();
    moveLeadStageAction.mockReset();
    refresh.mockReset();
  });

  it("moves a lead and refreshes after the server accepts the change", async () => {
    moveLeadStageAction.mockResolvedValue({ status: "success" });
    render(<LeadKanban leads={[lead]} archived={false} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Move Sana Ahmed to stage" }), { target: { value: "FOLLOW_UP" } });

    expect(moveLeadStageAction).toHaveBeenCalledWith("lead-1", "FOLLOW_UP");
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(screen.getByRole("combobox", { name: "Move Sana Ahmed to stage" })).toHaveValue("FOLLOW_UP");
  });

  it("restores the previous stage when the server rejects the move", async () => {
    moveLeadStageAction.mockResolvedValue({ status: "error", message: "Lead changed elsewhere." });
    render(<LeadKanban leads={[lead]} archived={false} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Move Sana Ahmed to stage" }), { target: { value: "FOLLOW_UP" } });

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Lead changed elsewhere."));
    expect(screen.getByRole("combobox", { name: "Move Sana Ahmed to stage" })).toHaveValue("NEW_CLIENT");
    expect(refresh).not.toHaveBeenCalled();
  });
});
