"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { InventoryForm } from "@/components/reference-data/reference-forms";
import { ModalViewport } from "@/components/ui/modal";

export function InventoryCreateDialog({ projects }: { projects: Array<{ id: string; title: string }> }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="group inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#ff5c6c] px-4 text-sm font-medium text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-red-500 hover:shadow-lg">
        <Plus className="size-4 transition-transform group-hover:rotate-90" />New inventory
      </button>
      <ModalViewport open={open} onClose={() => setOpen(false)} labelledBy="create-inventory-title" panelClassName="max-w-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
          <div><h2 id="create-inventory-title" className="text-xl font-normal text-[#20aee3]">Create Inventory</h2><p className="mt-0.5 text-xs text-gray-400">Add a property record and its current availability.</p></div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-gray-500 transition hover:bg-gray-100" aria-label="Close create inventory dialog"><X className="size-5" /></button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6"><InventoryForm projects={projects} /></div>
        <div className="flex shrink-0 justify-end border-t border-gray-200 bg-slate-50/70 px-4 py-3 sm:px-6"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 transition hover:bg-gray-50">Close</button></div>
      </ModalViewport>
    </>
  );
}
