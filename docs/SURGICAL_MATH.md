# VetPlan — Surgical Math Engine

Pure, platform-neutral measurement functions in `@vet-plan/shared` (`packages/shared/src/math/`).
They run unchanged in the backend, the web canvas, and the mobile app.

> **Decision support only.** These functions compute geometry from landmarks a clinician places.
> Landmark placement, radiographic positioning, and the final surgical plan remain the surgeon's
> responsibility. Clinical defaults (targets, thresholds, cage sizes) are parameters: confirm
> them against your protocol and implant system.

## 1. Conventions
- **Coordinates:** image pixels as `Point2D { x, y }`, in any orientation. y may point up or down,
  and the image may be rotated or mirrored (left or right limb). Every measurement is built from
  dot/cross products of landmark vectors, so results don't depend on orientation; the tests
  re-run every case under rotation, translation, scaling, and mirroring.
- **Angles:** degrees at the API, radians internally.
- **Lengths:** pixels, converted to millimetres with a `Calibration { mmPerPixel }`.
- **Invalid input throws `RangeError`:** coincident landmarks, non-finite coordinates, impossible
  targets. The UI should show the message rather than a number.

## 2. Functions

### Geometry & calibration (`geometry.ts`, `calibration.ts`)
| Function | Purpose |
|---|---|
| `fitCircle(points)` | Least-squares circle (≥ 3 clicks). Femoral head centres and marker balls |
| `angleBetweenVectors(a, b)` | Unsigned angle via `atan2(|a×b|, a·b)` (accurate near 0° and 180°) |
| `calibrationFromMarker(outline, diameterMm)` | mm/pixel from a calibration ball (e.g. 25 mm) |
| `calibrationFromKnownLength(a, b, mm)` | mm/pixel from an object of known length |
| `pixelsToMillimetres` / `millimetresToPixels` | Conversions |

Place the calibration marker at the level of the bone. Radiographic magnification differs with
distance from the detector.

### TPLO (`tplo.ts`)
| Function | Landmarks / inputs | Output |
|---|---|---|
| `tibialPlateauAngle` | Mediolateral view: cranial and caudal margins of the medial tibial plateau; centre of the intercondylar eminences; centre of the talus | TPA: angle between the plateau line and the perpendicular to the functional axis. Positive = caudodistal slope |
| `mechanicalMedialProximalTibialAngle` | Craniocaudal view: medial and lateral margins of the proximal joint surface; proximal and distal mechanical-axis points | mMPTA. 90° = joint line perpendicular to the axis. Reference ≈ 93.5° in large-breed dogs (Dismukes et al., 2007) |
| `tploRotationPlan` | TPA, target TPA (default **5°**), saw blade radius (mm) | Rotation (°), chord length (mm, what calipers measure between the marks), arc length (mm) |

Model: `rotation = TPA − target`, `chord = 2·r·sin(rotation/2)`, `arc = r·rotation`. This
assumes the radial osteotomy is centred on the intercondylar eminences, so the functional axis
doesn't move. Off-centre cuts change the achieved TPA. Published rotation charts may differ from
the pure geometry, so check against the chart your team uses.

### TTA (`tta.ts`)
Mediolateral view with the stifle at about 135°. The reference line is the tibial plateau line or
the femorotibial common tangent, given **caudal point first**.

| Function | Output |
|---|---|
| `patellarTendonAngle` | PTA: angle between the patellar tendon (insertion → distal pole of the patella) and the reference line, measured on the caudal side. > 90° when the patella sits cranial to the insertion |
| `ttaAdvancement` | Current PTA and the cranial advancement (mm) that brings PTA to the target (default **90°**). ≤ 0 means none is needed |
| `selectTtaCageSize` | Cage width for an advancement. `rounding: 'up'` (default) or `'nearest'` (ties go up). Default sizes 3/6/9/12/15 mm |
| `ttaAdvancementMatrix` | For every cage size: predicted PTA and deviation from the target. Helps choose between neighbouring sizes |

Model (conventional, linear): with `u` the cranial unit vector along the reference line and `n`
its normal towards the patella, `advancement = x + y·cot(target)`, where `x = (origin − insertion)·u`
and `y = (origin − insertion)·n`. This reduces to `advancement = x` for a 90° target. It assumes
the tuberosity translates parallel to the reference line, the patella doesn't move, and the cage
width equals the advancement at the tendon insertion. **Hinged techniques** (Modified Maquet,
TTA Rapid) advance by rotation about a distal hinge and need their own correction (see ROADMAP).

### Norberg angle (`norberg.ts`)
| Function | Landmarks | Output |
|---|---|---|
| `norbergAngle(hip, contralateralHeadCenter)` | Ventrodorsal, hip-extended view: femoral head centre (use `fitCircle`), craniolateral acetabular rim | At the head centre, the angle between the line to the other head centre and the line to the rim |
| `bilateralNorbergAngles(left, right)` | Both hips | `{ left, right }` |
| `isNorbergAngleWithinNormalLimits(angle, threshold = 105)` | Angle | Screening flag only. Grading schemes (e.g. FCI) also weigh congruency and degenerative changes |

## 3. Measurement protocols (`src/measurements/`)
`evaluateMeasurement(type, points, parameters?, calibration?)` wraps the functions above for UIs and
the backend. Points are `Record<landmarkKey, Point2D[]>` in image pixels; outlines take 3 points
(fitted with `fitCircle`). Results: `incomplete` (next landmark + construction overlay), `complete`
(values, warnings, overlay, optional calibration) or `invalid` (message; never throws for clinical
input). Optional steps that fail (e.g. no cage large enough) become **warnings**, not errors.

| Type | Landmarks (placement order) | Parameters (default, range) | Values |
|---|---|---|---|
| `TIBIAL_PLATEAU_ANGLE` | caudal plateau, cranial plateau, eminences, talus | target TPA (5°, 0–15), saw blade radius (24 mm, 5–40) | TPA, rotation, rotation chord |
| `MEDIAL_PROXIMAL_TIBIAL_ANGLE` | lateral plateau, medial plateau, proximal axis, distal axis | — | mMPTA |
| `TTA_ADVANCEMENT` | reference caudal, reference cranial, tendon origin (patella), tendon insertion | target tendon angle (90°, 80–100) | PTA; with calibration: advancement, cage, predicted PTA |
| `NORBERG_ANGLE` | right head outline (3), right rim, left head outline (3), left rim | normal threshold (105°, 90–115) | right/left NA with within/outside-limits assessment |
| `CALIBRATION_MARKER` | marker outline (3) | marker diameter (25 mm) | mm/px (sets calibration) |
| `CALIBRATION_LENGTH` | start, end | known length (100 mm) | mm/px (sets calibration) |
| `DISTANCE` | start, end | — | px, or mm when calibrated |
| `ANGLE_BETWEEN_LINES` | line 1 start/end, line 2 start/end | — | acute angle between the lines |

Overlay shapes (`segment`, `arrow`, `circle`, `label`) carry an emphasis: `primary` (measured
lines), `secondary` (axes, fitted outlines), `guide` (reference/planned lines, drawn dashed). The
TTA guide shows the planned tendon line and the advancement arrow; the TPA guide shows the
perpendicular to the functional axis.

## 4. Example
```ts
import {
  calibrationFromMarker, fitCircle, selectTtaCageSize, tibialPlateauAngle,
  tploRotationPlan, ttaAdvancement,
} from '@vet-plan/shared';

const tpa = tibialPlateauAngle({ plateauCranial, plateauCaudal, intercondylarEminence, talusCenter });
const plan = tploRotationPlan({ tibialPlateauAngle: tpa, sawBladeRadiusMm: 24 });

const calibration = calibrationFromMarker(markerClicks, 25);
const { requiredAdvancementMm } = ttaAdvancement({
  referenceCaudal, referenceCranial, tendonOrigin, tendonInsertion, calibration,
});
const cage = selectTtaCageSize(requiredAdvancementMm);
```

## 5. Testing rules
- `pnpm --filter @vet-plan/shared test` runs Vitest with **100% line/branch/function/statement
  thresholds** on `src/math/**` and `src/measurements/**`. The run fails below 100%.
- Each clinical function is tested from a known geometric construction (landmarks built from a
  known angle) and under the transforms in `src/math/__fixtures__/transforms.ts`. Tolerances are
  at least 1e-9° and 1e-9 mm.
- Specs and fixtures are excluded from the package build (`tsconfig.build.json`).
- Changing a formula or a clinical default means updating this document and the tests together.

## 6. References
- Slocum B, Slocum TD. Tibial plateau leveling osteotomy for repair of cranial cruciate ligament
  rupture in the canine. *Vet Clin North Am Small Anim Pract*, 1993.
- Dismukes DI et al. Determination of pelvic limb alignment in the large-breed dog: a cadaveric
  radiographic study in the frontal plane. *Vet Surg*, 2007.
- Montavon PM, Damur DM, Tepic S. Advancement of the tibial tuberosity for the treatment of
  cranial cruciate deficient canine stifle. *1st World Orthopaedic Veterinary Congress*, 2002.
- Norberg I. Hip dysplasia in the dog, radiographic evaluation (Norberg angle), 1961, and the
  FCI hip dysplasia scoring scheme for its clinical use.
