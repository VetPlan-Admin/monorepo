import type { MeasurementValue } from './types.js';

/** "24.5°", "12.9 mm", "0.1250 mm/px". */
export function formatMeasurementValue(value: Pick<MeasurementValue, 'value' | 'unit' | 'decimals'>): string {
    const number = value.value.toFixed(value.decimals);
    return value.unit === '°' ? `${number}°` : `${number} ${value.unit}`;
}
