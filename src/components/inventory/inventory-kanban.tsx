"use client";

import { Building2, LoaderCircle, MapPin, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type DragEvent } from "react";

import { updateInventoryStatusAction } from "@/features/reference-data/actions";
import { inventoryStatusLabels, inventoryStatuses } from "@/features/reference-data/schemas";

type InventoryStatus = (typeof inventoryStatuses)[number];

export type KanbanInventory = {
  id: string;
  uid: string;
  property: string;
  project: string;
  seller: string;
  sellerPhone: string | null;
  sellerCity: string | null;
  price: string;
  status: InventoryStatus;
  created: string;
};

const columnColors: Record<InventoryStatus, string> = {
  UNSOLD: "border-t-sky-400",
  UNDER_PROCESS: "border-t-amber-400",
  SOLD: "border-t-emerald-500",
};

export function InventoryKanban({ inventories }: { inventories: KanbanInventory[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(inventories);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function moveInventory(inventoryId: string, destination: InventoryStatus) {
    if (pending) return;
    const current = rows.find((inventory) => inventory.id === inventoryId);
    if (!current || current.status === destination) return;

    const previousStatus = current.status;
    setMessage("");
    setRows((items) => items.map((inventory) => inventory.id === inventoryId ? { ...inventory, status: destination } : inventory));
    startTransition(async () => {
      try {
        const result = await updateInventoryStatusAction(inventoryId, destination);
        if (result.status !== "success") {
          setRows((items) => items.map((inventory) => inventory.id === inventoryId ? { ...inventory, status: previousStatus } : inventory));
          setMessage(result.message ?? "The inventory status could not be changed.");
        } else {
          router.refresh();
        }
      } catch {
        setRows((items) => items.map((inventory) => inventory.id === inventoryId ? { ...inventory, status: previousStatus } : inventory));
        setMessage("The inventory status could not be changed. Please try again.");
      }
    });
  }

  function startDrag(event: DragEvent<HTMLElement>, inventoryId: string) {
    if (pending) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", inventoryId);
  }

  function drop(event: DragEvent<HTMLElement>, status: InventoryStatus) {
    event.preventDefault();
    const inventoryId = event.dataTransfer.getData("text/plain");
    if (inventoryId) moveInventory(inventoryId, status);
  }

  return (
    <section aria-label="Inventory Kanban board" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <p>{rows.length} {rows.length === 1 ? "property" : "properties"} in this view · Drag a card to another status, or use its status selector.</p>
        {pending ? <p role="status" className="inline-flex items-center gap-1.5"><LoaderCircle className="size-3.5 animate-spin" />Saving status…</p> : null}
      </div>
      {message ? <p role="alert" className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{message}</p> : null}
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4" aria-busy={pending}>
        {inventoryStatuses.map((status) => {
          const columnInventories = rows.filter((inventory) => inventory.status === status);
          return (
            <section key={status} aria-label={`${inventoryStatusLabels[status]} inventory`} className={`min-h-[28rem] w-[min(86vw,20rem)] shrink-0 snap-start rounded-lg border border-gray-200 border-t-2 bg-[#ebf2f5] p-2.5 sm:w-[20rem] ${columnColors[status]}`} onDragOver={(event) => { if (!pending) event.preventDefault(); }} onDrop={(event) => drop(event, status)}>
              <header className="flex items-center justify-between gap-2 px-1 pb-3"><h2 className="text-sm font-medium text-gray-700">{inventoryStatusLabels[status]}</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500" aria-label={`${columnInventories.length} properties in this column`}>{columnInventories.length}</span></header>
              <div className="space-y-2">
                {columnInventories.length === 0 ? <p className="rounded-md border border-dashed border-gray-300 px-3 py-8 text-center text-xs text-gray-400">No inventory in this status</p> : null}
                {columnInventories.map((inventory) => (
                  <article key={inventory.id} draggable={!pending} onDragStart={(event) => startDrag(event, inventory.id)} className="rounded-md border border-gray-100 bg-white p-3 shadow-sm transition hover:border-sky-200 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2"><p className="min-w-0 truncate text-sm font-medium text-gray-700">{inventory.property}</p><span className="shrink-0 text-[10px] text-gray-400">{inventory.uid}</span></div>
                    <p className="mt-1 text-sm font-medium text-[#20aee3]">{inventory.price}</p>
                    <dl className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between gap-2"><dt className="inline-flex items-center gap-1 text-gray-400"><Building2 className="size-3.5" />Project</dt><dd className="truncate text-gray-700">{inventory.project}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-gray-400">Seller</dt><dd className="truncate text-gray-700">{inventory.seller}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="inline-flex items-center gap-1 text-gray-400"><Phone className="size-3.5" />Phone</dt><dd className="truncate text-gray-700">{inventory.sellerPhone ?? "—"}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="inline-flex items-center gap-1 text-gray-400"><MapPin className="size-3.5" />City</dt><dd className="truncate text-gray-700">{inventory.sellerCity ?? "—"}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-gray-400">Created</dt><dd className="text-gray-700">{inventory.created}</dd></div>
                    </dl>
                    <label className="mt-3 block border-t border-gray-100 pt-2 text-xs text-gray-500">Move to status<select aria-label={`Move ${inventory.property} to status`} value={inventory.status} disabled={pending} onChange={(event) => moveInventory(inventory.id, event.target.value as InventoryStatus)} className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700">{inventoryStatuses.map((option) => <option key={option} value={option}>{inventoryStatusLabels[option]}</option>)}</select></label>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
