import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModalViewport } from "@/components/ui/modal";

afterEach(cleanup);

describe("ModalViewport", () => {
  it("portals dialogs to the document body instead of a transformed page", async () => {
    const onClose = vi.fn();
    render(
      <div style={{ transform: "translateY(0)" }} data-testid="page">
        <ModalViewport open onClose={onClose} label="Test dialog">
          <div>Dialog contents</div>
        </ModalViewport>
      </div>,
    );

    const dialog = await screen.findByRole("dialog", { name: "Test dialog" });
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.firstElementChild?.className).toContain("max-h-[calc(100dvh-1.5rem)]");
  });

  it("closes with Escape and restores document scrolling", async () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ModalViewport open onClose={onClose} label="Test dialog">
        <div>Dialog contents</div>
      </ModalViewport>,
    );

    await screen.findByRole("dialog", { name: "Test dialog" });
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();

    rerender(
      <ModalViewport open={false} onClose={onClose} label="Test dialog">
        <div>Dialog contents</div>
      </ModalViewport>,
    );
    expect(document.body.style.overflow).toBe("");
  });
});
