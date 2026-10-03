"use client";

import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

const subscribeToClient = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ModalViewport({
  open,
  onClose,
  children,
  labelledBy,
  label,
  panelClassName = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  label?: string;
  panelClassName?: string;
}) {
  const mounted = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    window.requestAnimationFrame(() => panelRef.current?.focus());

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      previouslyFocused?.focus();
    };
  }, [onClose, open]);

  if (!mounted || !open) return null;

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div
      className="overlay-enter fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-900/35 px-2 py-3 backdrop-blur-[1px] sm:px-4 sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-label={label}
      onMouseDown={closeFromBackdrop}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`dialog-enter flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-lg bg-white shadow-2xl outline-none sm:max-h-[calc(100dvh-4rem)] ${panelClassName}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
