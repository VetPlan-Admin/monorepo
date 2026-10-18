"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { describeApiError, useApiClient, useApiQuery } from "@vet-plan/app";
import { isCaseEditable, PROCEDURE_TYPE_LABELS } from "@vet-plan/shared";
import type { RadiographPlanDto } from "@vet-plan/shared";
import { Save, Upload } from "lucide-react";
import type { RadiographImage } from "./image/types";
import type { PlannedMeasurement } from "./planner-state";

interface PlannerCasePanelProps {
  caseId: string | null;
  planId: string | null;
  image: RadiographImage | null;
  measurements: PlannedMeasurement[];
  onLoadPlan: (measurements: PlannedMeasurement[]) => void;
}

const BUTTON =
  "flex w-full items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50";

/**
 * Links the planner to a surgical case: saves landmarks (never computed values: the API
 * recomputes them) and re-attaches a saved plan to the same radiograph.
 */
export function PlannerCasePanel({ caseId, planId, image, measurements, onLoadPlan }: PlannerCasePanelProps) {
  const client = useApiClient();
  const router = useRouter();
  const cases = useApiQuery(`planner-cases:${caseId ?? "pick"}`, (api, signal) =>
    caseId ? Promise.resolve(null) : api.listCases({ pageSize: 50 }, signal),
  );
  const detail = useApiQuery(`planner-case:${caseId ?? "none"}`, (api, signal) =>
    caseId ? api.getCase(caseId, signal) : Promise.resolve(null),
  );
  const [label, setLabel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const go = (nextCase: string | null, nextPlan: string | null = null) => {
    const params = new URLSearchParams();
    if (nextCase) params.set("case", nextCase);
    if (nextPlan) params.set("plan", nextPlan);
    setLabel(null);
    setMessage(null);
    router.replace(params.size > 0 ? `/planner?${params}` : "/planner");
  };

  if (!caseId) {
    const editable = cases.data?.items.filter((c) => isCaseEditable(c.status)) ?? [];
    return (
      <div className="space-y-2 text-sm">
        <p className="text-xs text-brand-yellow/70">Choose a case to save these measurements to.</p>
        {cases.error ? <p className="text-red-200">{describeApiError(cases.error)}</p> : null}
        <select
          aria-label="Case"
          className="w-full rounded border border-brand-yellow/40 bg-black/40 px-2 py-1.5 text-brand-yellow"
          value=""
          onChange={(event) => go(event.currentTarget.value || null)}
        >
          <option value="">{cases.loading ? "Loading cases…" : editable.length ? "Select a case…" : "No open cases"}</option>
          {editable.map((c) => (
            <option key={c.id} value={c.id}>
              {c.patient.name} · {PROCEDURE_TYPE_LABELS[c.procedureType]} · {c.status.toLowerCase()}
            </option>
          ))}
        </select>
        <Link href="/cases/new" className="block text-xs underline">
          Create a case
        </Link>
      </div>
    );
  }

  if (detail.error) {
    return <p className="text-sm text-red-200">{describeApiError(detail.error)}</p>;
  }
  const surgicalCase = detail.data;
  if (!surgicalCase) {
    return <p className="text-xs text-brand-yellow/70">Loading case…</p>;
  }

  const plan: RadiographPlanDto | undefined = surgicalCase.plans.find((p) => p.id === planId);
  const editable = isCaseEditable(surgicalCase.status);
  const effectiveLabel = label ?? plan?.label ?? `${PROCEDURE_TYPE_LABELS[surgicalCase.procedureType]} plan`;
  const sizeMatches = !plan || !image || (plan.imageWidth === image.width && plan.imageHeight === image.height);

  async function save() {
    if (!image) return;
    setSaving(true);
    setMessage(null);
    const dto = {
      label: effectiveLabel.trim() || "Plan",
      imageWidth: image.width,
      imageHeight: image.height,
      imageSpacing: image.pixelSpacing ?? null,
      measurements,
    };
    try {
      const saved = plan ? await client.updatePlan(caseId!, plan.id, dto) : await client.createPlan(caseId!, dto);
      // Point the URL at the saved plan so the next save updates it (go() resets the panel first)
      if (!plan) go(caseId, saved.id);
      detail.reload();
      setLabel(dto.label);
      setMessage({ kind: "ok", text: "Saved. Results were recomputed by the server." });
    } catch (error) {
      setMessage({ kind: "error", text: describeApiError(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2 text-sm">
      <p>
        <Link href={`/cases/${surgicalCase.id}`} className="font-semibold underline">
          {surgicalCase.patient.name}
        </Link>{" "}
        · {PROCEDURE_TYPE_LABELS[surgicalCase.procedureType]} · {surgicalCase.status.toLowerCase()}
        <button type="button" onClick={() => go(null)} className="ml-2 text-xs underline">
          change
        </button>
      </p>

      {plan && (
        <div className="space-y-1 rounded bg-black/20 p-2 text-xs">
          <p>
            Saved plan <span className="font-semibold">{plan.label}</span> ({plan.imageWidth} × {plan.imageHeight} px,{" "}
            {plan.measurements.length} measurement{plan.measurements.length === 1 ? "" : "s"})
          </p>
          {!image ? <p className="text-brand-yellow/70">Open the same radiograph to reload its landmarks.</p> : null}
          {image && !sizeMatches ? (
            <p className="text-amber-200">⚠ This image is {image.width} × {image.height} px: open the radiograph the plan was made on.</p>
          ) : null}
          <button
            type="button"
            disabled={!image || !sizeMatches}
            onClick={() => onLoadPlan(plan.measurements)}
            className={`${BUTTON} border border-brand-yellow/50 text-brand-yellow`}
          >
            <Upload aria-hidden className="size-4" /> Load saved landmarks
          </button>
        </div>
      )}

      {editable ? (
        <>
          <label className="block text-xs text-brand-yellow/80">
            Plan name
            <input
              value={effectiveLabel}
              onChange={(event) => setLabel(event.currentTarget.value)}
              maxLength={120}
              className="mt-1 w-full rounded border border-brand-yellow/30 bg-black/40 px-2 py-1 text-sm text-brand-yellow"
            />
          </label>
          <button
            type="button"
            disabled={!image || measurements.length === 0 || saving || !sizeMatches}
            onClick={() => void save()}
            className={`${BUTTON} bg-brand-yellow text-brand-purple`}
          >
            <Save aria-hidden className="size-4" />
            {saving ? "Saving…" : plan ? "Update plan" : "Save plan to case"}
          </button>
        </>
      ) : (
        <p className="text-xs text-brand-yellow/70">This case is {surgicalCase.status.toLowerCase()}: its plans are read-only.</p>
      )}
      {message ? (
        <p role="status" className={message.kind === "ok" ? "text-xs text-green-200" : "text-xs text-red-200"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
