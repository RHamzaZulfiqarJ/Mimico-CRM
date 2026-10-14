"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition, type DragEvent } from "react";

import { moveLeadStageAction } from "@/features/leads/actions";
import { leadStages, priorityLabels, stageLabels } from "@/features/leads/schemas";

type LeadStage = (typeof leadStages)[number];
type LeadPriority = keyof typeof priorityLabels;

export type KanbanLead = {
  id: string;
  uid: string;
  clientName: string;
  clientPhone: string | null;
  priority: LeadPriority;
  stage: LeadStage;
  project: string | null;
  staff: string;
  created: string;
};

const columnColors: Record<LeadStage, string> = {
  NEW_CLIENT: "border-t-rose-700",
  FOLLOW_UP: "border-t-sky-400",
  CONTACTED_CLIENT: "border-t-orange-400",
  CALL_NOT_ATTEND: "border-t-lime-400",
  VISIT_SCHEDULED: "border-t-teal-400",
  VISIT_DONE: "border-t-indigo-400",
  CLOSED_WON: "border-t-green-500",
  CLOSED_LOST: "border-t-red-400",
};

export function LeadKanban({ leads, archived }: { leads: KanbanLead[]; archived: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(leads);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function moveLead(leadId: string, destination: LeadStage) {
    if (archived || pending) return;
    const current = rows.find((lead) => lead.id === leadId);
    if (!current || current.stage === destination) return;

    const previousStage = current.stage;
    setMessage("");
    setRows((items) => items.map((lead) => lead.id === leadId ? { ...lead, stage: destination } : lead));
    startTransition(async () => {
      try {
        const result = await moveLeadStageAction(leadId, destination);
        if (result.status !== "success") {
          setRows((items) => items.map((lead) => lead.id === leadId ? { ...lead, stage: previousStage } : lead));
          setMessage(result.message ?? "The stage could not be changed.");
        } else {
          router.refresh();
        }
      } catch {
        setRows((items) => items.map((lead) => lead.id === leadId ? { ...lead, stage: previousStage } : lead));
        setMessage("The stage could not be changed. Please try again.");
      }
    });
  }

  function startDrag(event: DragEvent<HTMLElement>, leadId: string) {
    if (archived || pending) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", leadId);
  }

  function drop(event: DragEvent<HTMLElement>, stage: LeadStage) {
    event.preventDefault();
    const leadId = event.dataTransfer.getData("text/plain");
    if (leadId) moveLead(leadId, stage);
  }

  return (
    <section aria-label="Lead Kanban board" className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <p>{rows.length} {rows.length === 1 ? "lead" : "leads"} on this page · Drag a card to another stage, or use its stage selector.</p>
        {pending ? <p role="status">Saving stage…</p> : null}
      </div>
      {message ? <p role="alert" className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{message}</p> : null}
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4" aria-busy={pending}>
        {leadStages.map((stage) => {
          const columnLeads = rows.filter((lead) => lead.stage === stage);
          return (
            <section
              key={stage}
              aria-label={`${stageLabels[stage]} leads`}
              className={`min-h-[26rem] w-[min(82vw,17rem)] shrink-0 snap-start rounded-lg border border-gray-200 border-t-2 bg-[#ebf2f5] p-2.5 sm:w-[17rem] ${columnColors[stage]}`}
              onDragOver={(event) => { if (!archived && !pending) event.preventDefault(); }}
              onDrop={(event) => drop(event, stage)}
            >
              <header className="flex items-center justify-between gap-2 px-1 pb-3">
                <h2 className="text-sm font-medium text-gray-700">{stageLabels[stage]}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500" aria-label={`${columnLeads.length} leads on this page`}>{columnLeads.length}</span>
              </header>
              <div className="space-y-2">
                {columnLeads.length === 0 ? <p className="rounded-md border border-dashed border-gray-300 px-3 py-8 text-center text-xs text-gray-400">No leads on this page</p> : null}
                {columnLeads.map((lead) => (
                  <article key={lead.id} draggable={!archived && !pending} onDragStart={(event) => startDrag(event, lead.id)} className="rounded-md border border-gray-100 bg-white p-3 shadow-sm transition hover:border-sky-200 hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      {archived ? <span className="min-w-0 truncate text-sm font-medium capitalize text-gray-700">{lead.clientName}</span> : <Link href={`/leads/${lead.id}`} className="min-w-0 truncate text-sm font-medium capitalize text-[#20aee3] hover:underline">{lead.clientName}</Link>}
                      <span className="shrink-0 text-[10px] text-gray-400">{lead.uid}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{lead.clientPhone ?? "No phone"}</p>
                    <dl className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between gap-2"><dt className="text-gray-400">Priority</dt><dd className="text-gray-700">{priorityLabels[lead.priority]}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-gray-400">Project</dt><dd className="truncate text-gray-700">{lead.project ?? "—"}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-gray-400">Staff</dt><dd className="truncate text-gray-700">{lead.staff}</dd></div>
                      <div className="flex justify-between gap-2"><dt className="text-gray-400">Created</dt><dd className="text-gray-700">{lead.created}</dd></div>
                    </dl>
                    {!archived ? (
                      <label className="mt-3 block border-t border-gray-100 pt-2 text-xs text-gray-500">
                        Move to stage
                        <select aria-label={`Move ${lead.clientName} to stage`} value={lead.stage} disabled={pending} onChange={(event) => moveLead(lead.id, event.target.value as LeadStage)} className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700">
                          {leadStages.map((option) => <option key={option} value={option}>{stageLabels[option]}</option>)}
                        </select>
                      </label>
                    ) : null}
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
