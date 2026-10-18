"use client";

import Link from "next/link";
import { CaseDetailScreen, useApiClient } from "@vet-plan/app";
import { isCaseEditable } from "@vet-plan/shared";
import { Download, ScanLine } from "lucide-react";

const ACTION_CLASS =
  "inline-flex items-center gap-1.5 rounded-full border border-brand-yellow px-4 py-2 text-sm font-semibold text-brand-yellow hover:bg-brand-yellow hover:text-brand-purple";

/** Web-only extras for the shared case screen: planner links and the JSON report download. */
export function WebCaseDetail({ caseId }: { caseId: string }) {
  const client = useApiClient();
  return (
    <CaseDetailScreen
      caseId={caseId}
      renderCaseActions={(detail) => (
        <>
          {isCaseEditable(detail.status) && (
            <Link href={`/planner?case=${detail.id}`} className={ACTION_CLASS}>
              <ScanLine aria-hidden className="size-4" /> New plan in planner
            </Link>
          )}
          {/* A plain anchor: the report is a file download, not a page */}
          <a href={client.reportUrl(detail.id)} download className={ACTION_CLASS}>
            <Download aria-hidden className="size-4" /> Download report (JSON)
          </a>
        </>
      )}
      renderPlanActions={(detail, plan) => (
        <Link href={`/planner?case=${detail.id}&plan=${plan.id}`} className={ACTION_CLASS}>
          <ScanLine aria-hidden className="size-4" /> {isCaseEditable(detail.status) ? "Edit in planner" : "View in planner"}
        </Link>
      )}
    />
  );
}
