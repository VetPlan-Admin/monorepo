import { describe, expect, it } from "vitest";
import { MeasurementType } from "@vet-plan/shared";
import { evaluatePlan, findHandle, initialPlannerState, plannerReducer, resolveCalibration } from "./planner-state";
import type { PlannerAction, PlannerState } from "./planner-state";

function run(...actions: PlannerAction[]): PlannerState {
  return actions.reduce(plannerReducer, initialPlannerState);
}

const place = (x: number, y: number): PlannerAction => ({ type: "placePoint", point: { x, y } });

describe("plannerReducer", () => {
  it("adds measurements with default parameters and makes them active", () => {
    const state = run({ type: "add", id: "a", measurementType: MeasurementType.TIBIAL_PLATEAU_ANGLE });
    expect(state.activeId).toBe("a");
    expect(state.measurements[0]).toEqual({
      id: "a",
      type: MeasurementType.TIBIAL_PLATEAU_ANGLE,
      points: {},
      parameters: { targetPlateauAngle: 5, sawBladeRadiusMm: 24 },
    });
  });

  it("places points in landmark order and ignores clicks once complete", () => {
    const state = run(
      { type: "add", id: "d", measurementType: MeasurementType.DISTANCE },
      place(0, 0),
      place(10, 0),
      place(99, 99),
    );
    expect(state.measurements[0]!.points).toEqual({ start: [{ x: 0, y: 0 }], end: [{ x: 10, y: 0 }] });
  });

  it("fills 3-point outlines before moving on", () => {
    const state = run({ type: "add", id: "n", measurementType: MeasurementType.NORBERG_ANGLE }, place(1, 1), place(2, 2), place(3, 1), place(9, 9));
    expect(state.measurements[0]!.points.rightHeadOutline).toHaveLength(3);
    expect(state.measurements[0]!.points.rightRim).toEqual([{ x: 9, y: 9 }]);
  });

  it("ignores point actions without an active measurement", () => {
    expect(run(place(1, 1), { type: "undoPoint" })).toEqual(initialPlannerState);
  });

  it("moves, undoes and re-parametrises", () => {
    let state = run({ type: "add", id: "d", measurementType: MeasurementType.DISTANCE }, place(0, 0), place(10, 0));
    state = plannerReducer(state, { type: "movePoint", id: "d", landmarkKey: "end", index: 0, point: { x: 20, y: 5 } });
    expect(state.measurements[0]!.points.end).toEqual([{ x: 20, y: 5 }]);
    expect(plannerReducer(state, { type: "movePoint", id: "d", landmarkKey: "end", index: 3, point: { x: 0, y: 0 } })).toBe(state);
    expect(plannerReducer(state, { type: "movePoint", id: "d", landmarkKey: "nope", index: 0, point: { x: 0, y: 0 } })).toBe(state);

    state = plannerReducer(state, { type: "undoPoint" });
    expect(state.measurements[0]!.points).toEqual({ start: [{ x: 0, y: 0 }], end: [] });
    state = plannerReducer(plannerReducer(state, { type: "undoPoint" }), { type: "undoPoint" });
    expect(state.measurements[0]!.points).toEqual({ start: [], end: [] });

    state = plannerReducer(state, { type: "setParameter", id: "d", key: "x", value: 3 });
    expect(state.measurements[0]!.parameters).toEqual({ x: 3 });
  });

  it("selects, removes (re-activating the last one) and resets", () => {
    let state = run(
      { type: "add", id: "a", measurementType: MeasurementType.DISTANCE },
      { type: "add", id: "b", measurementType: MeasurementType.DISTANCE },
      { type: "select", id: "a" },
    );
    expect(state.activeId).toBe("a");
    expect(plannerReducer(state, { type: "select", id: "zzz" })).toBe(state);
    state = plannerReducer(state, { type: "remove", id: "a" });
    expect(state).toMatchObject({ activeId: "b", measurements: [{ id: "b" }] });
    expect(plannerReducer(state, { type: "remove", id: "x" }).activeId).toBe("b");
    expect(plannerReducer(state, { type: "remove", id: "b" })).toEqual({ measurements: [], activeId: null });
    expect(plannerReducer(state, { type: "reset" })).toEqual(initialPlannerState);
  });
});

describe("findHandle", () => {
  it("returns the closest point within tolerance, preferring the active measurement", () => {
    const state = run(
      { type: "add", id: "a", measurementType: MeasurementType.DISTANCE },
      place(100, 100),
      place(200, 100),
      { type: "add", id: "b", measurementType: MeasurementType.DISTANCE },
      place(102, 100),
    );
    expect(findHandle(state, { x: 101, y: 100 }, 5)).toEqual({ id: "b", landmarkKey: "start", index: 0 });
    expect(findHandle(state, { x: 199, y: 101 }, 5)).toEqual({ id: "a", landmarkKey: "end", index: 0 });
    expect(findHandle(state, { x: 150, y: 150 }, 5)).toBeNull();
  });
});

describe("calibration & evaluation", () => {
  const marker = [place(110, 100), place(90, 100), place(100, 110)]; // radius 10 px

  it("prefers the latest complete calibration measurement over DICOM spacing", () => {
    const spacing = { mmPerPixel: 0.2, source: "PixelSpacing" as const };
    expect(resolveCalibration(initialPlannerState)).toEqual({});
    expect(resolveCalibration(initialPlannerState, spacing)).toEqual({ calibration: { mmPerPixel: 0.2 }, source: "DICOM PixelSpacing" });

    const withMarker = run({ type: "add", id: "c", measurementType: MeasurementType.CALIBRATION_MARKER }, ...marker);
    const resolved = resolveCalibration(withMarker, spacing);
    expect(resolved.source).toBe("Calibration (marker ball)");
    expect(resolved.calibration?.mmPerPixel).toBeCloseTo(25 / 20, 9);

    const incomplete = run({ type: "add", id: "l", measurementType: MeasurementType.CALIBRATION_LENGTH }, place(0, 0));
    expect(resolveCalibration(incomplete, spacing).source).toBe("DICOM PixelSpacing");

    const withDistance = run({ type: "add", id: "d", measurementType: MeasurementType.DISTANCE }, place(0, 0), place(30, 40));
    const [{ evaluation }] = evaluatePlan(withDistance, { mmPerPixel: 0.5 });
    expect(evaluation).toMatchObject({ status: "complete", values: [{ value: 25, unit: "mm" }] });
  });
});
