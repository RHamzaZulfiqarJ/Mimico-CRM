import { NextResponse } from "next/server";

import { runTaskReminderJob } from "@/features/reminders/job";
import { isTaskReminderRequestAuthorized } from "@/features/reminders/policy";
import { getTaskReminderEnvironment } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const responseHeaders = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let secret: string;
  try {
    secret = getTaskReminderEnvironment().TASK_REMINDER_SECRET;
  } catch {
    return NextResponse.json(
      { error: "Task reminder job is not configured." },
      { status: 503, headers: responseHeaders },
    );
  }

  if (!isTaskReminderRequestAuthorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers: responseHeaders },
    );
  }

  try {
    const result = await runTaskReminderJob();
    return NextResponse.json({ status: "ok", ...result }, { headers: responseHeaders });
  } catch {
    return NextResponse.json(
      { error: "Task reminder job failed." },
      { status: 500, headers: responseHeaders },
    );
  }
}
