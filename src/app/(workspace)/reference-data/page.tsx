import { Archive, Building2, FolderKanban, MapPinned } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  InventoryForm,
  ProjectForm,
  SocietyForm,
} from "@/components/reference-data/reference-forms";
import { archiveReferenceRecordAction } from "@/features/reference-data/actions";
import { getReferenceData } from "@/features/reference-data/queries";
import { canDeleteOperationalRecord } from "@/lib/auth/authorization";

export const metadata: Metadata = { title: "Reference data" };

function ArchiveButton({
  entityId,
  entityType,
}: {
  entityId: string;
  entityType: "society" | "project" | "inventory";
}) {
  const action = archiveReferenceRecordAction.bind(null, entityType, entityId);
  return (
    <form action={action}>
      <button
        type="submit"
        title={`Archive ${entityType}`}
        className="flex size-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-500"
      >
        <Archive className="size-3.5" />
        <span className="sr-only">Archive {entityType}</span>
      </button>
    </form>
  );
}

function EmptyRow({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
      {children}
    </div>
  );
}

export default async function ReferenceDataPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const data = await getReferenceData();
  if (!data) redirect("/dashboard");

  const params = await searchParams;
  const archiveError =
    params.error === "society-has-projects"
      ? "Archive the society's active projects first."
      : params.error === "project-has-inventory"
        ? "Archive the project's active inventory first."
        : null;

  const canArchive = canDeleteOperationalRecord(data.auth.membership.role);
  const summary = [
    { label: "Societies", value: data.counts.societies, icon: Building2 },
    { label: "Projects", value: data.counts.projects, icon: FolderKanban },
    { label: "Inventory", value: data.counts.inventories, icon: MapPinned },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <p className="text-xs font-medium text-gray-500 sm:text-sm">Dashboard › Inventory</p>
      <h1 className="mt-2 text-[28px] font-light tracking-tight text-[#20aee3] sm:text-[32px]">
        Reference data
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
        Manage the society, project, and property structure used by later CRM
        workflows. Every record is isolated to {data.auth.organization.name}.
      </p>

      {archiveError ? (
        <p role="alert" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {archiveError}
        </p>
      ) : null}

      <section className="mt-7 grid gap-4 sm:grid-cols-3" aria-label="Reference data totals">
        {summary.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="surface-card surface-card-interactive flex items-center gap-4 rounded-lg p-5">
              <span className="flex size-11 items-center justify-center rounded-lg bg-[#ebf2f5] text-[#20aee3]"><Icon className="size-5" /></span>
              <div><p className="text-2xl font-medium text-gray-700">{item.value}</p><p className="text-xs text-gray-500">{item.label}</p></div>
            </article>
          );
        })}
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-3">
        <article id="societies" className="surface-card scroll-mt-24 rounded-lg p-5">
          <h2 className="font-medium text-[#ff5c6c]">Add society</h2>
          <p className="mb-5 mt-1 text-xs text-slate-500">A top-level development or housing society.</p>
          <SocietyForm />
        </article>
        <article id="projects" className="surface-card scroll-mt-24 rounded-lg p-5">
          <h2 className="font-medium text-[#ff5c6c]">Add project</h2>
          <p className="mb-5 mt-1 text-xs text-slate-500">Each project belongs to one active society.</p>
          <ProjectForm societies={data.societies.map(({ id, title }) => ({ id, title }))} />
        </article>
        <article id="inventories" className="surface-card scroll-mt-24 rounded-lg p-5">
          <h2 className="font-medium text-[#ff5c6c]">Add inventory</h2>
          <p className="mb-5 mt-1 text-xs text-slate-500">Property stock can be linked to a project.</p>
          <InventoryForm projects={data.projects.map(({ id, title }) => ({ id, title }))} />
        </article>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <article className="surface-card rounded-lg p-5">
          <h2 className="mb-4 font-medium text-[#20aee3]">Societies</h2>
          <div className="space-y-2">
            {data.societies.length === 0 ? <EmptyRow>No societies created.</EmptyRow> : data.societies.map((society) => (
              <div key={society.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-[#f8fbfc] px-4 py-3 transition hover:border-sky-100 hover:bg-sky-50/50">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-gray-700">{society.title}</p><p className="text-xs text-gray-400">{society._count.projects} projects</p></div>
                {canArchive ? <ArchiveButton entityType="society" entityId={society.id} /> : null}
              </div>
            ))}
          </div>
        </article>

        <article className="surface-card rounded-lg p-5">
          <h2 className="mb-4 font-medium text-[#20aee3]">Projects</h2>
          <div className="space-y-2">
            {data.projects.length === 0 ? <EmptyRow>No projects created.</EmptyRow> : data.projects.map((project) => (
              <div key={project.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-[#f8fbfc] px-4 py-3 transition hover:border-sky-100 hover:bg-sky-50/50">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-gray-700">{project.title}</p><p className="truncate text-xs text-gray-400">{project.society.title} · {project.city} · {project._count.inventories} properties</p></div>
                {canArchive ? <ArchiveButton entityType="project" entityId={project.id} /> : null}
              </div>
            ))}
          </div>
        </article>

        <article className="surface-card rounded-lg p-5">
          <h2 className="mb-4 font-medium text-[#20aee3]">Latest inventory</h2>
          <div className="space-y-2">
            {data.inventories.length === 0 ? <EmptyRow>No inventory created.</EmptyRow> : data.inventories.map((inventory) => (
              <div key={inventory.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-[#f8fbfc] px-4 py-3 transition hover:border-sky-100 hover:bg-sky-50/50">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-gray-700">{inventory.propertyNumber ?? inventory.sellerName ?? "Property"}</p><p className="truncate text-xs text-gray-400">{inventory.project?.title ?? "Unassigned"} · {inventory.status.toLowerCase().replace("_", " ")}{inventory.price ? ` · PKR ${inventory.price.toString()}` : ""}</p></div>
                {canArchive ? <ArchiveButton entityType="inventory" entityId={inventory.id} /> : null}
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
