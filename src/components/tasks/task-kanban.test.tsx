import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskKanban, type KanbanTask } from "./task-kanban";

const { updateTaskStatusAction, refresh } = vi.hoisted(() => ({
  updateTaskStatusAction: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/features/tasks/actions", () => ({ updateTaskStatusAction }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const task: KanbanTask = {
  id: "task-1",
  uid: "TSK-001",
  title: "Call the client",
  description: "Confirm the site visit.",
  due: "15/10/2026, 10:30",
  overdue: false,
  status: "TODO",
  outcome: null,
  assignee: "Aisha Khan",
  creator: "Admin User",
  canUpdate: true,
};

describe("task Kanban", () => {
  beforeEach(() => {
    cleanup();
    updateTaskStatusAction.mockReset();
    refresh.mockReset();
  });

  it("moves a task to a non-completed status immediately", async () => {
    updateTaskStatusAction.mockResolvedValue({ status: "success" });
    render(<TaskKanban tasks={[task]} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Move Call the client to status" }), { target: { value: "IN_PROGRESS" } });

    await waitFor(() => expect(updateTaskStatusAction).toHaveBeenCalledOnce());
    const formData = updateTaskStatusAction.mock.calls[0][2] as FormData;
    expect(formData.get("status")).toBe("IN_PROGRESS");
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it("asks for an outcome before completing a task", async () => {
    updateTaskStatusAction.mockResolvedValue({ status: "success" });
    render(<TaskKanban tasks={[task]} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Move Call the client to status" }), { target: { value: "COMPLETED" } });
    expect(screen.getByRole("dialog", { name: "Complete task" })).toBeInTheDocument();
    expect(updateTaskStatusAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("radio", { name: "Successful" }));
    fireEvent.click(screen.getByRole("button", { name: "Complete task" }));

    await waitFor(() => expect(updateTaskStatusAction).toHaveBeenCalledOnce());
    const formData = updateTaskStatusAction.mock.calls[0][2] as FormData;
    expect(formData.get("status")).toBe("COMPLETED");
    expect(formData.get("outcome")).toBe("SUCCESSFUL");
  });

  it("restores the prior status when the server rejects a move", async () => {
    updateTaskStatusAction.mockResolvedValue({ status: "error", message: "Task changed elsewhere." });
    render(<TaskKanban tasks={[task]} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Move Call the client to status" }), { target: { value: "IN_PROGRESS" } });

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Task changed elsewhere."));
    expect(screen.getByRole("combobox", { name: "Move Call the client to status" })).toHaveValue("TODO");
    expect(refresh).not.toHaveBeenCalled();
  });
});
