import { calibrationFromKnownLength, calibrationFromMarker, pixelsToMillimetres } from '../math/calibration.js';
import { add, angleBetweenVectors, distance, fitCircle, midpoint, normalize, scale, subtract, vectorBetween } from '../math/geometry.js';
import { bilateralNorbergAngles, isNorbergAngleWithinNormalLimits, NORBERG_NORMAL_THRESHOLD_DEGREES } from '../math/norberg.js';
import { DEFAULT_TPLO_TARGET_PLATEAU_ANGLE, mechanicalMedialProximalTibialAngle, tibialPlateauAngle, tploRotationPlan } from '../math/tplo.js';
import {
    DEFAULT_TTA_TARGET_TENDON_ANGLE,
    patellarTendonAngle,
    selectTtaCageSize,
    ttaAdvancement,
    ttaAdvancementMatrix,
} from '../math/tta.js';
import { formatMeasurementValue } from './format.js';
import { MeasurementType } from './types.js';
import type { MeasurementDefinition, MeasurementOutput, MeasurementValue, OverlayShape } from './types.js';
import { landmark, landmarkPoints, tryOrWarn } from './utils.js';

function angleValue(key: string, label: string, value: number): MeasurementValue {
    return { key, label, value, unit: '°', decimals: 1 };
}

function mmValue(key: string, label: string, value: number): MeasurementValue {
    return { key, label, value, unit: 'mm', decimals: 1 };
}

function label(at: { x: number; y: number }, text: string, value: MeasurementValue): OverlayShape {
    const formatted = formatMeasurementValue(value);
    return { kind: 'label', at, text: text ? `${text} ${formatted}` : formatted };
}

const tibialPlateauAngleDefinition: MeasurementDefinition = {
    type: MeasurementType.TIBIAL_PLATEAU_ANGLE,
    name: 'Tibial plateau angle (TPLO)',
    view: 'Mediolateral tibia, stifle and tarsus at 90°',
    landmarks: [
        { key: 'plateauCaudal', label: 'Caudal plateau', instruction: 'Click the caudal margin of the medial tibial plateau', pointCount: 1 },
        { key: 'plateauCranial', label: 'Cranial plateau', instruction: 'Click the cranial margin of the medial tibial plateau', pointCount: 1 },
        { key: 'intercondylarEminence', label: 'Eminences', instruction: 'Click the centre of the intercondylar eminences', pointCount: 1 },
        { key: 'talusCenter', label: 'Talus', instruction: 'Click the centre of the talus', pointCount: 1 },
    ],
    parameters: [
        { key: 'targetPlateauAngle', label: 'Target TPA', unit: '°', defaultValue: DEFAULT_TPLO_TARGET_PLATEAU_ANGLE, min: 0, max: 15, step: 0.5 },
        { key: 'sawBladeRadiusMm', label: 'Saw blade radius', unit: 'mm', defaultValue: 24, min: 5, max: 40, step: 0.5 },
    ],
    segments: [
        { from: 'plateauCaudal', to: 'plateauCranial', emphasis: 'primary' },
        { from: 'talusCenter', to: 'intercondylarEminence', emphasis: 'secondary' },
    ],
    compute(context) {
        const plateauCaudal = landmark(context, 'plateauCaudal');
        const plateauCranial = landmark(context, 'plateauCranial');
        const intercondylarEminence = landmark(context, 'intercondylarEminence');
        const talusCenter = landmark(context, 'talusCenter');

        const tpa = angleValue('tpa', 'TPA', tibialPlateauAngle({ plateauCaudal, plateauCranial, intercondylarEminence, talusCenter }));
        const output: MeasurementOutput = { values: [tpa], overlay: [], warnings: [] };

        tryOrWarn(() => {
            const plan = tploRotationPlan({
                tibialPlateauAngle: tpa.value,
                targetPlateauAngle: context.parameters.targetPlateauAngle,
                sawBladeRadiusMm: context.parameters.sawBladeRadiusMm!,
            });
            output.values.push(
                angleValue('rotation', 'Rotation', plan.rotationDegrees),
                mmValue('chord', 'Rotation chord', plan.chordLengthMm),
            );
        }, output.warnings);

        // Perpendicular to the functional axis through the eminences: the TPA reference line
        const axis = normalize(subtract(intercondylarEminence, talusCenter));
        const halfLength = distance(plateauCaudal, plateauCranial) * 0.75;
        const perpendicular = scale({ x: -axis.y, y: axis.x }, halfLength);
        output.overlay.push(
            { kind: 'segment', from: subtract(intercondylarEminence, perpendicular), to: add(intercondylarEminence, perpendicular), emphasis: 'guide' },
            label(midpoint(plateauCaudal, plateauCranial), 'TPA', tpa),
        );
        return output;
    },
};

const medialProximalTibialAngleDefinition: MeasurementDefinition = {
    type: MeasurementType.MEDIAL_PROXIMAL_TIBIAL_ANGLE,
    name: 'Medial proximal tibial angle (mMPTA)',
    view: 'Craniocaudal tibia',
    landmarks: [
        { key: 'plateauLateral', label: 'Lateral plateau', instruction: 'Click the lateral margin of the proximal tibial joint surface', pointCount: 1 },
        { key: 'plateauMedial', label: 'Medial plateau', instruction: 'Click the medial margin of the proximal tibial joint surface', pointCount: 1 },
        { key: 'proximalAxisPoint', label: 'Proximal axis', instruction: 'Click the centre of the intercondylar eminences', pointCount: 1 },
        { key: 'distalAxisPoint', label: 'Distal axis', instruction: 'Click the centre of the distal tibia (talus)', pointCount: 1 },
    ],
    parameters: [],
    segments: [
        { from: 'plateauLateral', to: 'plateauMedial', emphasis: 'primary' },
        { from: 'proximalAxisPoint', to: 'distalAxisPoint', emphasis: 'secondary' },
    ],
    compute(context) {
        const plateauLateral = landmark(context, 'plateauLateral');
        const plateauMedial = landmark(context, 'plateauMedial');
        const mpta = angleValue(
            'mmpta',
            'mMPTA',
            mechanicalMedialProximalTibialAngle({
                plateauLateral,
                plateauMedial,
                proximalAxisPoint: landmark(context, 'proximalAxisPoint'),
                distalAxisPoint: landmark(context, 'distalAxisPoint'),
            }),
        );
        return { values: [mpta], overlay: [label(midpoint(plateauLateral, plateauMedial), 'mMPTA', mpta)], warnings: [] };
    },
};

const ttaAdvancementDefinition: MeasurementDefinition = {
    type: MeasurementType.TTA_ADVANCEMENT,
    name: 'TTA advancement',
    view: 'Mediolateral stifle at 135° extension',
    landmarks: [
        { key: 'referenceCaudal', label: 'Reference (caudal)', instruction: 'Click the caudal point of the tibial plateau line (or common tangent)', pointCount: 1 },
        { key: 'referenceCranial', label: 'Reference (cranial)', instruction: 'Click the cranial point of the tibial plateau line (or common tangent)', pointCount: 1 },
        { key: 'tendonOrigin', label: 'Tendon origin', instruction: 'Click the patellar tendon origin at the distal pole of the patella', pointCount: 1 },
        { key: 'tendonInsertion', label: 'Tendon insertion', instruction: 'Click the patellar tendon insertion on the tibial tuberosity', pointCount: 1 },
    ],
    parameters: [
        { key: 'targetTendonAngle', label: 'Target tendon angle', unit: '°', defaultValue: DEFAULT_TTA_TARGET_TENDON_ANGLE, min: 80, max: 100, step: 0.5 },
    ],
    segments: [
        { from: 'referenceCaudal', to: 'referenceCranial', emphasis: 'primary' },
        { from: 'tendonInsertion', to: 'tendonOrigin', emphasis: 'primary' },
    ],
    compute(context) {
        const input = {
            referenceCaudal: landmark(context, 'referenceCaudal'),
            referenceCranial: landmark(context, 'referenceCranial'),
            tendonOrigin: landmark(context, 'tendonOrigin'),
            tendonInsertion: landmark(context, 'tendonInsertion'),
        };
        const targetTendonAngle = context.parameters.targetTendonAngle;
        const pta = angleValue('pta', 'PTA', patellarTendonAngle(input));
        const output: MeasurementOutput = {
            values: [pta],
            overlay: [label(midpoint(input.tendonOrigin, input.tendonInsertion), 'PTA', pta)],
            warnings: [],
        };

        // Advancement in pixels (calibration-independent) to draw the planned tendon position
        const { requiredAdvancementMm: advancementPx } = ttaAdvancement({ ...input, targetTendonAngle, calibration: { mmPerPixel: 1 } });
        const cranial = normalize(subtract(input.referenceCranial, input.referenceCaudal));
        const advancedInsertion = add(input.tendonInsertion, scale(cranial, advancementPx));
        output.overlay.push({ kind: 'segment', from: input.tendonOrigin, to: advancedInsertion, emphasis: 'guide' });
        if (advancementPx > 0) {
            output.overlay.push({ kind: 'arrow', from: input.tendonInsertion, to: advancedInsertion, emphasis: 'guide' });
        }

        const calibration = context.calibration;
        if (!calibration) {
            output.warnings.push('Calibrate the image to get the advancement and cage size in millimetres');
            return output;
        }
        const advancementMm = pixelsToMillimetres(advancementPx, calibration);
        output.values.push(mmValue('advancement', 'Required advancement', advancementMm));
        if (advancementMm <= 0) {
            output.warnings.push('No advancement needed: the tendon is already at or past the target angle');
            return output;
        }
        tryOrWarn(() => {
            const cageSizeMm = selectTtaCageSize(advancementMm);
            const [row] = ttaAdvancementMatrix({ ...input, calibration, targetTendonAngle, availableSizesMm: [cageSizeMm] });
            output.values.push(mmValue('cage', 'Cage size', cageSizeMm), angleValue('predictedPta', 'Predicted PTA', row!.resultingTendonAngle));
        }, output.warnings);
        return output;
    },
};

const norbergAngleDefinition: MeasurementDefinition = {
    type: MeasurementType.NORBERG_ANGLE,
    name: 'Norberg angle',
    view: 'Ventrodorsal pelvis, hips extended',
    landmarks: [
        { key: 'rightHeadOutline', label: 'Right femoral head', instruction: 'Click 3 points around the RIGHT femoral head outline', pointCount: 3 },
        { key: 'rightRim', label: 'Right rim', instruction: 'Click the craniolateral rim of the RIGHT acetabulum', pointCount: 1 },
        { key: 'leftHeadOutline', label: 'Left femoral head', instruction: 'Click 3 points around the LEFT femoral head outline', pointCount: 3 },
        { key: 'leftRim', label: 'Left rim', instruction: 'Click the craniolateral rim of the LEFT acetabulum', pointCount: 1 },
    ],
    parameters: [
        { key: 'thresholdDegrees', label: 'Normal threshold', unit: '°', defaultValue: NORBERG_NORMAL_THRESHOLD_DEGREES, min: 90, max: 115, step: 0.5 },
    ],
    segments: [],
    compute(context) {
        const right = { femoralHeadCenter: fitCircle(landmarkPoints(context, 'rightHeadOutline')).center, craniolateralAcetabularRim: landmark(context, 'rightRim') };
        const left = { femoralHeadCenter: fitCircle(landmarkPoints(context, 'leftHeadOutline')).center, craniolateralAcetabularRim: landmark(context, 'leftRim') };
        const angles = bilateralNorbergAngles(left, right);
        const threshold = context.parameters.thresholdDegrees!;

        const values = (['right', 'left'] as const).map((side): MeasurementValue => ({
            ...angleValue(`${side}Norberg`, `${side === 'right' ? 'Right' : 'Left'} Norberg angle`, angles[side]),
            assessment: isNorbergAngleWithinNormalLimits(angles[side], threshold) ? 'within-limits' : 'outside-limits',
        }));
        return {
            values,
            overlay: [
                { kind: 'segment', from: right.femoralHeadCenter, to: left.femoralHeadCenter, emphasis: 'secondary' },
                { kind: 'segment', from: right.femoralHeadCenter, to: right.craniolateralAcetabularRim, emphasis: 'primary' },
                { kind: 'segment', from: left.femoralHeadCenter, to: left.craniolateralAcetabularRim, emphasis: 'primary' },
                label(right.craniolateralAcetabularRim, 'NA', values[0]!),
                label(left.craniolateralAcetabularRim, 'NA', values[1]!),
            ],
            warnings: [],
        };
    },
};

function calibrationValue(mmPerPixel: number): MeasurementValue {
    return { key: 'mmPerPixel', label: 'Scale', value: mmPerPixel, unit: 'mm/px', decimals: 4 };
}

const calibrationMarkerDefinition: MeasurementDefinition = {
    type: MeasurementType.CALIBRATION_MARKER,
    name: 'Calibration (marker ball)',
    view: 'Any view with a calibration marker at bone level',
    landmarks: [
        { key: 'markerOutline', label: 'Marker', instruction: 'Click 3 points around the calibration marker outline', pointCount: 3 },
    ],
    parameters: [{ key: 'markerDiameterMm', label: 'Marker diameter', unit: 'mm', defaultValue: 25, min: 1, max: 200, step: 0.5 }],
    segments: [],
    compute(context) {
        const outline = landmarkPoints(context, 'markerOutline');
        const calibration = calibrationFromMarker(outline, context.parameters.markerDiameterMm!);
        const { center, radius } = fitCircle(outline);
        return {
            values: [calibrationValue(calibration.mmPerPixel)],
            overlay: [{ kind: 'label', at: { x: center.x, y: center.y - radius }, text: `⌀ ${context.parameters.markerDiameterMm} mm` }],
            warnings: [],
            calibration,
        };
    },
};

const calibrationLengthDefinition: MeasurementDefinition = {
    type: MeasurementType.CALIBRATION_LENGTH,
    name: 'Calibration (known length)',
    view: 'Any view with an object of known length at bone level',
    landmarks: [
        { key: 'lengthStart', label: 'Start', instruction: 'Click one end of the object of known length', pointCount: 1 },
        { key: 'lengthEnd', label: 'End', instruction: 'Click the other end', pointCount: 1 },
    ],
    parameters: [{ key: 'knownLengthMm', label: 'Known length', unit: 'mm', defaultValue: 100, min: 1, max: 2000, step: 0.5 }],
    segments: [{ from: 'lengthStart', to: 'lengthEnd', emphasis: 'primary' }],
    compute(context) {
        const start = landmark(context, 'lengthStart');
        const end = landmark(context, 'lengthEnd');
        const calibration = calibrationFromKnownLength(start, end, context.parameters.knownLengthMm!);
        return {
            values: [calibrationValue(calibration.mmPerPixel)],
            overlay: [{ kind: 'label', at: midpoint(start, end), text: `${context.parameters.knownLengthMm} mm` }],
            warnings: [],
            calibration,
        };
    },
};

const distanceDefinition: MeasurementDefinition = {
    type: MeasurementType.DISTANCE,
    name: 'Distance',
    view: 'Any',
    landmarks: [
        { key: 'start', label: 'Start', instruction: 'Click the first point', pointCount: 1 },
        { key: 'end', label: 'End', instruction: 'Click the second point', pointCount: 1 },
    ],
    parameters: [],
    segments: [{ from: 'start', to: 'end', emphasis: 'primary' }],
    compute(context) {
        const start = landmark(context, 'start');
        const end = landmark(context, 'end');
        const pixels = distance(start, end);
        if (pixels === 0) {
            throw new RangeError('Distance: the two points must not coincide');
        }
        const value: MeasurementValue = context.calibration
            ? mmValue('distance', 'Distance', pixelsToMillimetres(pixels, context.calibration))
            : { key: 'distance', label: 'Distance', value: pixels, unit: 'px', decimals: 0 };
        return {
            values: [value],
            overlay: [label(midpoint(start, end), '', value)],
            warnings: context.calibration ? [] : ['Calibrate the image to measure in millimetres'],
        };
    },
};

const angleBetweenLinesDefinition: MeasurementDefinition = {
    type: MeasurementType.ANGLE_BETWEEN_LINES,
    name: 'Angle between two lines',
    view: 'Any',
    landmarks: [
        { key: 'firstStart', label: 'Line 1 start', instruction: 'Click the start of the first line', pointCount: 1 },
        { key: 'firstEnd', label: 'Line 1 end', instruction: 'Click the end of the first line', pointCount: 1 },
        { key: 'secondStart', label: 'Line 2 start', instruction: 'Click the start of the second line', pointCount: 1 },
        { key: 'secondEnd', label: 'Line 2 end', instruction: 'Click the end of the second line', pointCount: 1 },
    ],
    parameters: [],
    segments: [
        { from: 'firstStart', to: 'firstEnd', emphasis: 'primary' },
        { from: 'secondStart', to: 'secondEnd', emphasis: 'primary' },
    ],
    compute(context) {
        const first = vectorBetween(landmark(context, 'firstStart'), landmark(context, 'firstEnd'), 'Line 1');
        const second = vectorBetween(landmark(context, 'secondStart'), landmark(context, 'secondEnd'), 'Line 2');
        // Lines (not rays): report the acute/right angle between them
        const raw = angleBetweenVectors(first, second);
        const value = angleValue('angle', 'Angle', Math.min(raw, 180 - raw));
        return {
            values: [value],
            overlay: [label(landmark(context, 'secondStart'), '', value)],
            warnings: [],
        };
    },
};

export const MEASUREMENT_DEFINITIONS: Readonly<Record<MeasurementType, MeasurementDefinition>> = {
    [MeasurementType.TIBIAL_PLATEAU_ANGLE]: tibialPlateauAngleDefinition,
    [MeasurementType.MEDIAL_PROXIMAL_TIBIAL_ANGLE]: medialProximalTibialAngleDefinition,
    [MeasurementType.TTA_ADVANCEMENT]: ttaAdvancementDefinition,
    [MeasurementType.NORBERG_ANGLE]: norbergAngleDefinition,
    [MeasurementType.CALIBRATION_MARKER]: calibrationMarkerDefinition,
    [MeasurementType.CALIBRATION_LENGTH]: calibrationLengthDefinition,
    [MeasurementType.DISTANCE]: distanceDefinition,
    [MeasurementType.ANGLE_BETWEEN_LINES]: angleBetweenLinesDefinition,
};
