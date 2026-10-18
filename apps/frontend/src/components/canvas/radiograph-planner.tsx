"use client";

import { useCallback, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getMeasurementDefinition, MeasurementType } from "@vet-plan/shared";
import type { Point2D } from "@vet-plan/shared";
import { FolderOpen, Maximize2, ShieldCheck } from "lucide-react";
import { loadRadiograph } from "./image/load-image";
import { ImageLoadError } from "./image/types";
import type { RadiographImage, WindowLevel } from "./image/types";
import { MeasurementCard } from "./measurement-card";
import { PlannerCasePanel } from "./planner-case-panel";
import { PlannerCanvas } from "./planner-canvas";
import type { CanvasLayer } from "./planner-canvas";
import { evaluatePlan, findHandle, initialPlannerState, plannerReducer, resolveCalibration } from "./planner-state";
import type { PointHandle } from "./planner-state";
import type { Viewport } from "./viewport";

const TOOL_GROUPS: { title: string; types: MeasurementType[] }[] = [
  { title: "Calibrate", types: [MeasurementType.CALIBRATION_MARKER, MeasurementType.CALIBRATION_LENGTH] },
  {
    title: "Measure",
    types: [
      MeasurementType.TIBIAL_PLATEAU_ANGLE,
      MeasurementType.MEDIAL_PROXIMAL_TIBIAL_ANGLE,
      MeasurementType.TTA_ADVANCEMENT,
      MeasurementType.NORBERG_ANGLE,
    ],
  },
  { title: "Tools", types: [MeasurementType.DISTANCE, MeasurementType.ANGLE_BETWEEN_LINES] },
];

/** Interactive radiograph viewer + surgical planning overlays. Everything runs in the browser. */
export function RadiographPlanner() {
  const [image, setImage] = useState<RadiographImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [windowLevel, setWindowLevel] = useState<WindowLevel | null>(null);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [plan, dispatch] = useReducer(plannerReducer, initialPlannerState);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();

  const { calibration, source: calibrationSource } = useMemo(
    () => resolveCalibration(plan, image?.pixelSpacing),
    [plan, image],
  );
  const evaluations = useMemo(() => evaluatePlan(plan, calibration), [plan, calibration]);
  const active = evaluations.find(({ measurement }) => measurement.id === plan.activeId);

  const layers = useMemo<CanvasLayer[]>(
    () =>
      evaluations.map(({ measurement, evaluation }) => ({
        id: measurement.id,
        active: measurement.id === plan.activeId,
        overlay: evaluation.overlay,
        handles: Object.entries(measurement.points).flatMap(([landmarkKey, points]) =>
          points.map((point, index) => ({ id: measurement.id, landmarkKey, index, point })),
        ),
      })),
    [evaluations, plan.activeId],
  );

  async function openFile(file: File | undefined) {
    if (!file) return;
    setLoading(true);
    setLoadError(null);
    try {
      const loaded = await loadRadiograph(file);
      setImage(loaded);
      setWindowLevel(loaded.defaultWindow);
      setViewport(null);
      dispatch({ type: "reset" });
    } catch (error) {
      console.error("Failed to open radiograph", error);
      setLoadError(error instanceof ImageLoadError ? error.message : "This file couldn't be opened.");
    } finally {
      setLoading(false);
    }
  }

  const onPlacePoint = useCallback((point: Point2D) => dispatch({ type: "placePoint", point }), []);
  const onMovePoint = useCallback(
    (handle: PointHandle, point: Point2D) => {
      if (!image) return;
      // Landmarks stay inside the image (the API rejects points outside it)
      const clamped = { x: Math.min(Math.max(point.x, 0), image.width), y: Math.min(Math.max(point.y, 0), image.height) };
      dispatch({ type: "movePoint", ...handle, point: clamped });
    },
    [image],
  );
  const onUndo = useCallback(() => dispatch({ type: "undoPoint" }), []);
  const onFindHandle = useCallback((point: Point2D, tolerance: number) => findHandle(plan, point, tolerance), [plan]);

  const range = image ? Math.max(image.maxValue - image.minValue, 1) : 1;

  return (
    <div className="flex h-dvh flex-col bg-neutral-950 lg:flex-row">
      <aside className="flex max-h-[45dvh] w-full shrink-0 flex-col gap-5 overflow-y-auto bg-brand-purple p-4 text-brand-yellow lg:max-h-none lg:w-96">
        <header className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold">Surgical planner</h1>
          <Link href="/" className="text-sm underline">
            Home
          </Link>
        </header>

        <p className="flex items-start gap-2 rounded-lg bg-black/20 p-2 text-xs text-brand-yellow/80">
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          Radiographs are opened and measured on this device. Nothing is uploaded.
        </p>

        <section aria-labelledby="image-heading" className="space-y-2">
          <h2 id="image-heading" className="text-sm font-semibold uppercase tracking-wide text-brand-yellow/70">
            Image
          </h2>
          <input
            ref={fileInputRef}
            type="file"
            accept=".dcm,application/dicom,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              void openFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand-yellow px-4 py-2 font-semibold text-brand-purple disabled:opacity-60"
          >
            <FolderOpen aria-hidden className="size-4" />
            {loading ? "Opening…" : "Open radiograph"}
          </button>
          {loadError && (
            <p role="alert" className="rounded bg-red-500/15 px-2 py-1 text-sm text-red-200">
              {loadError}
            </p>
          )}
          {image && (
            <div className="space-y-2 text-xs text-brand-yellow/80">
              <p className="break-all font-semibold text-brand-yellow">{image.metadata.fileName}</p>
              <p>
                {image.metadata.format} · {image.width} × {image.height} px
                {image.metadata.modality && ` · ${image.metadata.modality}`}
                {image.metadata.viewPosition && ` · ${image.metadata.viewPosition}`}
              </p>
              {(image.metadata.patientName || image.metadata.species || image.metadata.studyDate) && (
                <p>
                  {[image.metadata.patientName, image.metadata.species, image.metadata.studyDate].filter(Boolean).join(" · ")}
                </p>
              )}
              {image.warnings.map((warning) => (
                <p key={warning} className="text-amber-200">
                  ⚠ {warning}
                </p>
              ))}
              {windowLevel && (
                <div className="grid grid-cols-2 gap-2">
                  <label>
                    Brightness (level)
                    <input
                      type="range"
                      min={image.minValue}
                      max={image.maxValue}
                      step={range / 512}
                      value={windowLevel.center}
                      onChange={(e) => setWindowLevel({ ...windowLevel, center: e.currentTarget.valueAsNumber })}
                      className="w-full accent-brand-yellow"
                    />
                  </label>
                  <label>
                    Contrast (window)
                    <input
                      type="range"
                      min={1}
                      max={range * 2}
                      step={range / 512}
                      value={windowLevel.width}
                      onChange={(e) => setWindowLevel({ ...windowLevel, width: e.currentTarget.valueAsNumber })}
                      className="w-full accent-brand-yellow"
                    />
                  </label>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWindowLevel(image.defaultWindow)}
                  className="rounded border border-brand-yellow/40 px-2 py-1"
                >
                  Reset window
                </button>
                <button
                  type="button"
                  onClick={() => setViewport(null)}
                  className="flex items-center gap-1 rounded border border-brand-yellow/40 px-2 py-1"
                >
                  <Maximize2 aria-hidden className="size-3.5" /> Fit
                </button>
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="scale-heading" className="space-y-1 text-sm">
          <h2 id="scale-heading" className="text-sm font-semibold uppercase tracking-wide text-brand-yellow/70">
            Scale
          </h2>
          {calibration ? (
            <p>
              <span className="font-semibold tabular-nums">{calibration.mmPerPixel.toFixed(4)} mm/px</span>
              <span className="block text-xs text-brand-yellow/70">from {calibrationSource}</span>
            </p>
          ) : (
            <p className="text-xs text-brand-yellow/70">Not calibrated: angles work, millimetre results need a calibration.</p>
          )}
        </section>

        <section aria-labelledby="case-heading" className="space-y-2">
          <h2 id="case-heading" className="text-sm font-semibold uppercase tracking-wide text-brand-yellow/70">
            Case
          </h2>
          <PlannerCasePanel
            caseId={searchParams.get("case")}
            planId={searchParams.get("plan")}
            image={image}
            measurements={plan.measurements}
            onLoadPlan={(measurements) => dispatch({ type: "load", measurements })}
          />
        </section>

        {TOOL_GROUPS.map((group) => (
          <section key={group.title} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-yellow/70">{group.title}</h2>
            <div className="grid grid-cols-2 gap-2">
              {group.types.map((type) => (
                <button
                  key={type}
                  type="button"
                  disabled={!image}
                  onClick={() => dispatch({ type: "add", id: crypto.randomUUID(), measurementType: type })}
                  className="rounded border border-brand-yellow/40 px-2 py-1.5 text-left text-xs font-medium hover:bg-brand-yellow hover:text-brand-purple disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-brand-yellow"
                >
                  {getMeasurementDefinition(type).name}
                </button>
              ))}
            </div>
          </section>
        ))}

        {evaluations.length > 0 && (
          <section aria-labelledby="measurements-heading" className="space-y-2">
            <h2 id="measurements-heading" className="text-sm font-semibold uppercase tracking-wide text-brand-yellow/70">
              Measurements
            </h2>
            <ul className="space-y-2">
              {evaluations.map(({ measurement, evaluation }) => (
                <MeasurementCard
                  key={measurement.id}
                  measurement={measurement}
                  evaluation={evaluation}
                  active={measurement.id === plan.activeId}
                  onSelect={() => dispatch({ type: "select", id: measurement.id })}
                  onUndo={onUndo}
                  onRemove={() => dispatch({ type: "remove", id: measurement.id })}
                  onParameterChange={(key, value) => dispatch({ type: "setParameter", id: measurement.id, key, value })}
                />
              ))}
            </ul>
          </section>
        )}

        <p className="mt-auto text-xs text-brand-yellow/60">
          Decision support only: verify landmarks and results before planning surgery.
        </p>
      </aside>

      <section
        className="relative min-h-0 flex-1"
        aria-label="Radiograph viewer"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void openFile(event.dataTransfer.files[0]);
        }}
      >
        {image && windowLevel ? (
          <>
            <PlannerCanvas
              image={image}
              windowLevel={windowLevel}
              onWindowLevelChange={setWindowLevel}
              viewport={viewport}
              onViewportChange={setViewport}
              layers={layers}
              placing={active?.evaluation.status === "incomplete"}
              onPlacePoint={onPlacePoint}
              onMovePoint={onMovePoint}
              findHandle={onFindHandle}
              onUndo={onUndo}
            />
            {active?.evaluation.status === "incomplete" && (
              <p className="pointer-events-none absolute left-1/2 top-3 max-w-[90%] -translate-x-1/2 rounded-full bg-brand-purple/90 px-4 py-2 text-center text-sm font-medium text-brand-yellow shadow-lg">
                {active.evaluation.nextLandmark.instruction}
              </p>
            )}
            <p className="pointer-events-none absolute bottom-2 left-1/2 hidden -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-xs text-white/80 md:block">
              Click: place · Drag point: adjust · Scroll: zoom · Drag: pan · Right-drag: window/level · Backspace: undo · F: fit
            </p>
          </>
        ) : (
          <div className="flex h-full min-h-[50dvh] flex-col items-center justify-center gap-3 p-8 text-center text-brand-yellow/80">
            <FolderOpen aria-hidden className="size-10" />
            <p className="text-lg font-semibold text-brand-yellow">Drop a radiograph here</p>
            <p className="max-w-sm text-sm">
              DICOM (uncompressed, JPEG Lossless or JPEG Baseline), PNG, JPEG or WebP. The file stays on this device.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
