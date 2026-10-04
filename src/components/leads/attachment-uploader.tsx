"use client";

import { LoaderCircle, Upload } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  completeLeadAttachmentUploadAction,
  prepareLeadAttachmentUploadAction,
} from "@/features/attachments/actions";
import {
  attachmentMaxBytes,
  attachmentMimeTypes,
} from "@/features/attachments/policy";
import { createClient } from "@/lib/supabase/client";

type Status = { tone: "success" | "error"; message: string } | null;

export function AttachmentUploader({ leadId }: { leadId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setStatus({ tone: "error", message: "Choose a file to upload." });
      return;
    }
    if (file.size > attachmentMaxBytes || !attachmentMimeTypes.includes(file.type as (typeof attachmentMimeTypes)[number])) {
      setStatus({ tone: "error", message: "Choose a supported image, PDF, Word, or Excel file up to 10 MB." });
      return;
    }

    setPending(true);
    setStatus(null);
    const metadata = { name: file.name, type: file.type, size: file.size };
    try {
      const prepared = await prepareLeadAttachmentUploadAction(leadId, metadata);
      if (prepared.status === "error") {
        setStatus({ tone: "error", message: prepared.message });
        return;
      }
      const uploaded = await createClient().storage
        .from(prepared.bucket)
        .uploadToSignedUrl(prepared.objectPath, prepared.token, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });
      if (uploaded.error) {
        setStatus({ tone: "error", message: "The file could not be uploaded to secure storage." });
        return;
      }
      const completed = await completeLeadAttachmentUploadAction(
        leadId,
        prepared.objectPath,
        metadata,
      );
      setStatus({ tone: completed.status, message: completed.message });
      if (completed.status === "success") {
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      }
    } catch {
      setStatus({ tone: "error", message: "The attachment upload did not complete." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={upload} className="space-y-3">
      {status ? <p role={status.tone === "success" ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-xs ${status.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-600"}`}>{status.message}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><input ref={inputRef} type="file" accept={attachmentMimeTypes.join(",")} disabled={pending} className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 text-xs text-gray-500 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-medium file:text-[#20aee3] file:shadow-sm" /><button disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#20aee3] px-4 text-sm font-medium text-white transition hover:-translate-y-0.5 hover:bg-sky-600 disabled:translate-y-0 disabled:opacity-60">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}{pending ? "Uploading…" : "Upload"}</button></div>
      <p className="text-[11px] text-gray-400">Private storage · Images, PDF, Word, or Excel · Maximum 10 MB</p>
    </form>
  );
}
