"use client";

import { formatMeasurementValue, getMeasurementDefinition } from "@vet-plan/shared";
import type { MeasurementEvaluation } from "@vet-plan/shared";
import { Trash2, Undo2 } from "lucide-react";
import type { PlannedMeasurement } from "./planner-state";

interface MeasurementCardProps {
  measurement: PlannedMeasurement;
  evaluation: MeasurementEvaluation;
  active: boolean;
  onSelect: () => void;
  onUndo: () => void;
  onRemove: () => void;
  onParameterChange: (key: string, value: number) => void;
}

function progress(measurement: PlannedMeasurement): { placed: number; total: number } {
  const { landmarks } = getMeasurementDefinition(measurement.type);
  return {
    placed: landmarks.reduce((sum, l) => sum + Math.min(measurement.points[l.key]?.length ?? 0, l.pointCount), 0),
    total: landmarks.reduce((sum, l) => sum + l.pointCount, 0),
  };
}

export function MeasurementCard(props: MeasurementCardProps) {
  const { measurement, evaluation, active, onSelect, onUndo, onRemove, onParameterChange } = props;
  const definition = getMeasurementDefinition(measurement.type);
  const { placed, total } = progress(measurement);

  return (
    <li
      className={`rounded-lg border p-3 ${active ? "border-brand-yellow bg-black/30" : "border-brand-yellow/20 bg-black/10"}`}
    >
      <button type="button" onClick={onSelect} className="w-full text-left" aria-pressed={active}>
        <span className="block font-semibold text-brand-yellow">{definition.name}</span>
        <span className="block text-xs text-brand-yellow/60">{definition.view}</span>
      </button>

      {evaluation.status === "incomplete" && (
        <p className="mt-2 text-sm text-brand-yellow/90" aria-live={active ? "polite" : undefined}>
          <span className="font-semibold">
            Step {placed + 1}/{total}:
          </span>{" "}
          {evaluation.nextLandmark.instruction}
          {evaluation.nextLandmark.pointCount > 1 && ` (point ${evaluation.nextPointIndex + 1} of ${evaluation.nextLandmark.pointCount})`}
        </p>
      )}

      {evaluation.status === "invalid" && (
        <p role="alert" className="mt-2 rounded bg-red-500/15 px-2 py-1 text-sm text-red-200">
          {evaluation.message}
        </p>
      )}

      {evaluation.status === "complete" && (
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-sm">
          {evaluation.values.map((value) => (
            <div key={value.key} className="contents">
              <dt className="text-brand-yellow/80">{value.label}</dt>
              <dd className="text-right font-semibold tabular-nums text-brand-yellow">
                {formatMeasurementValue(value)}
                {value.assessment && (
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                      value.assessment === "within-limits" ? "bg-green-500/20 text-green-200" : "bg-red-500/20 text-red-200"
                    }`}
                  >
                    {value.assessment === "within-limits" ? "normal" : "reduced"}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {evaluation.status === "complete" && evaluation.warnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-amber-200">
          {evaluation.warnings.map((warning) => (
            <li key={warning}>⚠ {warning}</li>
          ))}
        </ul>
      )}

      {active && definition.parameters.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {definition.parameters.map((parameter) => (
            <label key={parameter.key} className="text-xs text-brand-yellow/80">
              {parameter.label} ({parameter.unit})
              <input
                type="number"
                min={parameter.min}
                max={parameter.max}
                step={parameter.step}
                value={measurement.parameters[parameter.key] ?? parameter.defaultValue}
                onChange={(event) => onParameterChange(parameter.key, event.currentTarget.valueAsNumber)}
                className="mt-1 w-full rounded border border-brand-yellow/30 bg-black/40 px-2 py-1 text-sm text-brand-yellow"
              />
            </label>
          ))}
        </div>
      )}

      {active && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={placed === 0}
            className="flex items-center gap-1 rounded border border-brand-yellow/40 px-2 py-1 text-xs text-brand-yellow disabled:opacity-40"
          >
            <Undo2 aria-hidden className="size-3.5" /> Undo point
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1 rounded border border-red-300/40 px-2 py-1 text-xs text-red-200"
          >
            <Trash2 aria-hidden className="size-3.5" /> Remove
          </button>
        </div>
      )}
    </li>
  );
}
