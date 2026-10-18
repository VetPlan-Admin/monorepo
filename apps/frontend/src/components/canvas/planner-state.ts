import {
  defaultParameters,
  evaluatePlanMeasurements,
  getMeasurementDefinition,
  nextLandmarkSlot,
  resolvePlanCalibration,
} from "@vet-plan/shared";
import type {
  Calibration,
  ImageSpacing,
  MeasurementEvaluation,
  MeasurementType,
  PlanCalibration,
  PlanMeasurement,
  Point2D,
} from "@vet-plan/shared";

/** Same shape the API stores, so plans round-trip without conversion. */
export type PlannedMeasurement = PlanMeasurement;

export interface PlannerState {
  measurements: PlannedMeasurement[];
  activeId: string | null;
}

export type PlannerAction =
  | { type: "add"; id: string; measurementType: MeasurementType }
  | { type: "select"; id: string }
  | { type: "placePoint"; point: Point2D }
  | { type: "movePoint"; id: string; landmarkKey: string; index: number; point: Point2D }
  | { type: "undoPoint" }
  | { type: "remove"; id: string }
  | { type: "setParameter"; id: string; key: string; value: number }
  | { type: "reset" }
  /** Replaces all measurements, e.g. with a plan saved to a case. */
  | { type: "load"; measurements: PlannedMeasurement[] };

export const initialPlannerState: PlannerState = { measurements: [], activeId: null };

function updateMeasurement(
  state: PlannerState,
  id: string | null,
  update: (measurement: PlannedMeasurement) => PlannedMeasurement,
): PlannerState {
  if (!id) return state;
  let changed = false;
  const measurements = state.measurements.map((m) => {
    if (m.id !== id) return m;
    const updated = update(m);
    changed ||= updated !== m;
    return updated;
  });
  // Keep the same state object for no-ops so React skips the re-render
  return changed ? { ...state, measurements } : state;
}

export function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case "add": {
      const definition = getMeasurementDefinition(action.measurementType);
      const measurement: PlannedMeasurement = {
        id: action.id,
        type: action.measurementType,
        points: {},
        parameters: defaultParameters(definition),
      };
      return { measurements: [...state.measurements, measurement], activeId: action.id };
    }
    case "select":
      return state.measurements.some((m) => m.id === action.id) ? { ...state, activeId: action.id } : state;
    case "placePoint":
      return updateMeasurement(state, state.activeId, (m) => {
        const slot = nextLandmarkSlot(getMeasurementDefinition(m.type), m.points);
        if (!slot) return m;
        const placed = m.points[slot.landmark.key] ?? [];
        return { ...m, points: { ...m.points, [slot.landmark.key]: [...placed, action.point] } };
      });
    case "movePoint":
      return updateMeasurement(state, action.id, (m) => {
        const placed = m.points[action.landmarkKey];
        if (!placed || action.index >= placed.length) return m;
        const moved = placed.map((p, i) => (i === action.index ? action.point : p));
        return { ...m, points: { ...m.points, [action.landmarkKey]: moved } };
      });
    case "undoPoint":
      return updateMeasurement(state, state.activeId, (m) => {
        const landmarks = getMeasurementDefinition(m.type).landmarks;
        const last = [...landmarks].reverse().find((l) => (m.points[l.key]?.length ?? 0) > 0);
        if (!last) return m;
        return { ...m, points: { ...m.points, [last.key]: m.points[last.key]!.slice(0, -1) } };
      });
    case "remove": {
      const measurements = state.measurements.filter((m) => m.id !== action.id);
      const activeId = state.activeId === action.id ? (measurements.at(-1)?.id ?? null) : state.activeId;
      return { measurements, activeId };
    }
    case "setParameter":
      return updateMeasurement(state, action.id, (m) => ({
        ...m,
        parameters: { ...m.parameters, [action.key]: action.value },
      }));
    case "reset":
      return initialPlannerState;
    case "load":
      return { measurements: action.measurements, activeId: null };
  }
}

export interface PointHandle {
  id: string;
  landmarkKey: string;
  index: number;
}

/** Nearest placed point within `tolerance` image pixels, preferring the active measurement. */
export function findHandle(state: PlannerState, point: Point2D, tolerance: number): PointHandle | null {
  const ordered = [...state.measurements].sort((a, b) => Number(b.id === state.activeId) - Number(a.id === state.activeId));
  for (const measurement of ordered) {
    let best: (PointHandle & { distance: number }) | null = null;
    for (const [landmarkKey, points] of Object.entries(measurement.points)) {
      points.forEach((p, index) => {
        const distance = Math.hypot(p.x - point.x, p.y - point.y);
        if (distance <= tolerance && (!best || distance < best.distance)) {
          best = { id: measurement.id, landmarkKey, index, distance };
        }
      });
    }
    if (best) {
      const { id, landmarkKey, index } = best;
      return { id, landmarkKey, index };
    }
  }
  return null;
}

export type ResolvedCalibration = PlanCalibration;

/**
 * Calibration for mm results (shared with the backend): the most recently added complete
 * calibration measurement wins, then the DICOM pixel spacing, otherwise none.
 */
export function resolveCalibration(state: PlannerState, spacing?: ImageSpacing): ResolvedCalibration {
  return resolvePlanCalibration(state.measurements, spacing);
}

/** Evaluates every measurement against the resolved calibration. */
export function evaluatePlan(
  state: PlannerState,
  calibration: Calibration | undefined,
): { measurement: PlannedMeasurement; evaluation: MeasurementEvaluation }[] {
  return evaluatePlanMeasurements(state.measurements, calibration);
}
