/**
 * Pure functions for extracting and transforming data from Bases entries
 * into scatter plot points.
 *
 * All functions in this module are pure - no side effects, no mutations.
 */

import type { BasesEntry } from "obsidian";
import type {
  ScatterPoint,
  ScatterConfig,
  NumericExtractionResult,
  CategoryExtractionResult,
  DataExtractionResult,
  SkippedEntry,
  AxisBounds,
  PlotBounds,
} from "./types";

// ============================================================================
// Value Helpers
// ============================================================================

/**
 * Checks if a value from the Bases API is empty.
 * Handles the Value wrapper which may have an isEmpty() method.
 */
const isValueEmpty = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === "object" && value !== null && "isEmpty" in value) {
    const v = value as { isEmpty: () => boolean };
    return v.isEmpty();
  }
  return !value;
};

// ============================================================================
// Value Extraction
// ============================================================================

/**
 * Attempts to extract a numeric value from a Bases entry for a given property.
 * Handles the Value wrapper returned by entry.getValue().
 */
export const extractNumericValue = (
  entry: BasesEntry,
  propertyId: string
): NumericExtractionResult => {
  try {
    // Cast to expected template literal type - the API accepts these prefixes
    const value = entry.getValue(propertyId as `note.${string}`);

    // Check if value is empty using the Value wrapper's isEmpty method if available
    if (value === null || value === undefined || isValueEmpty(value)) {
      return { success: false, reason: `Property "${propertyId}" is empty` };
    }

    const stringValue = value.toString();
    const numericValue = Number(stringValue);

    if (Number.isNaN(numericValue)) {
      return {
        success: false,
        reason: `Property "${propertyId}" value "${stringValue}" is not numeric`,
      };
    }

    if (!Number.isFinite(numericValue)) {
      return {
        success: false,
        reason: `Property "${propertyId}" value is not finite`,
      };
    }

    return { success: true, value: numericValue };
  } catch (e) {
    return {
      success: false,
      reason: `Failed to read property "${propertyId}": ${String(e)}`,
    };
  }
};

/**
 * Attempts to extract a categorical (string) value from a Bases entry.
 * Returns the string representation of the value, or null if empty.
 */
export const extractCategoryValue = (
  entry: BasesEntry,
  propertyId: string | null
): CategoryExtractionResult => {
  if (propertyId === null) {
    return { success: false };
  }

  try {
    // Cast to expected template literal type
    const value = entry.getValue(propertyId as `note.${string}`);

    // Check if value is empty using the Value wrapper's isEmpty method if available
    if (value === null || value === undefined || isValueEmpty(value)) {
      return { success: false };
    }

    return { success: true, value: value.toString() };
  } catch {
    return { success: false };
  }
};

// ============================================================================
// Point Extraction
// ============================================================================

/**
 * Attempts to create a ScatterPoint from a single Bases entry.
 * Returns either the point or a SkippedEntry with reason.
 */
export const entryToPoint = (
  entry: BasesEntry,
  config: ScatterConfig
): ScatterPoint | SkippedEntry => {
  const { xAxis, yAxis, colorBy } = config;

  // Validate config
  if (xAxis === null) {
    return { file: entry.file, reason: "X axis property not configured" };
  }
  if (yAxis === null) {
    return { file: entry.file, reason: "Y axis property not configured" };
  }

  // Extract X value
  const xResult = extractNumericValue(entry, xAxis);
  if (!xResult.success) {
    return { file: entry.file, reason: xResult.reason };
  }

  // Extract Y value
  const yResult = extractNumericValue(entry, yAxis);
  if (!yResult.success) {
    return { file: entry.file, reason: yResult.reason };
  }

  // Extract category (optional)
  const categoryResult = extractCategoryValue(entry, colorBy);
  const category = categoryResult.success ? categoryResult.value : null;

  return {
    x: xResult.value,
    y: yResult.value,
    category,
    label: entry.file.basename,
    file: entry.file,
    entry,
  };
};

/**
 * Type guard to check if extraction result is a valid point
 */
export const isScatterPoint = (
  result: ScatterPoint | SkippedEntry
): result is ScatterPoint => {
  return "x" in result && "y" in result;
};

/**
 * Type guard to check if extraction result is a skipped entry
 */
export const isSkippedEntry = (
  result: ScatterPoint | SkippedEntry
): result is SkippedEntry => {
  return "reason" in result;
};

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Extracts unique categories from a list of points.
 * Preserves insertion order, filters out nulls.
 */
export const extractCategories = (points: readonly ScatterPoint[]): string[] => {
  const seen = new Set<string>();
  const categories: string[] = [];

  for (const point of points) {
    if (point.category !== null && !seen.has(point.category)) {
      seen.add(point.category);
      categories.push(point.category);
    }
  }

  return categories;
};

/**
 * Processes all entries from grouped data into scatter points.
 * This is the main entry point for data extraction.
 */
export const extractDataFromEntries = (
  entries: readonly BasesEntry[],
  config: ScatterConfig
): DataExtractionResult => {
  const points: ScatterPoint[] = [];
  const skipped: SkippedEntry[] = [];

  for (const entry of entries) {
    const result = entryToPoint(entry, config);

    if (isScatterPoint(result)) {
      points.push(result);
    } else {
      skipped.push(result);
    }
  }

  const categories = extractCategories(points);

  return { points, skipped, categories };
};

/**
 * Flattens grouped data from Bases into a single array of entries.
 * Bases provides data in groups, but for scatter plot we treat them uniformly.
 */
export const flattenGroupedData = (
  groupedData: readonly { entries: readonly BasesEntry[] }[]
): BasesEntry[] => {
  return groupedData.flatMap((group) => [...group.entries]);
};

// ============================================================================
// Bounds Calculation
// ============================================================================

/**
 * Calculates axis bounds from a list of values with optional padding.
 * Returns null if the list is empty.
 */
export const calculateAxisBounds = (
  values: readonly number[],
  paddingPercent: number = 0.05
): AxisBounds | null => {
  if (values.length === 0) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  // Handle case where all values are the same
  const padding = range === 0 ? Math.abs(min) * paddingPercent || 1 : range * paddingPercent;

  return {
    min: min - padding,
    max: max + padding,
  };
};

/**
 * Calculates bounds for both axes from scatter points.
 * Returns null if there are no points.
 */
export const calculatePlotBounds = (
  points: readonly ScatterPoint[],
  paddingPercent: number = 0.05
): PlotBounds | null => {
  if (points.length === 0) {
    return null;
  }

  const xValues = points.map((p) => p.x);
  const yValues = points.map((p) => p.y);

  const xBounds = calculateAxisBounds(xValues, paddingPercent);
  const yBounds = calculateAxisBounds(yValues, paddingPercent);

  if (xBounds === null || yBounds === null) {
    return null;
  }

  return { x: xBounds, y: yBounds };
};

// ============================================================================
// Coordinate Transformation
// ============================================================================

/**
 * Creates a linear scale function that maps from data space to screen space.
 * Returns a function that transforms a data value to a screen coordinate.
 */
export const createLinearScale = (
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number
): ((value: number) => number) => {
  const domainSpan = domainMax - domainMin;
  const rangeSpan = rangeMax - rangeMin;

  // Handle degenerate case where domain has no span
  if (domainSpan === 0) {
    return () => (rangeMin + rangeMax) / 2;
  }

  return (value: number): number => {
    const normalized = (value - domainMin) / domainSpan;
    return rangeMin + normalized * rangeSpan;
  };
};

/**
 * Creates an inverse linear scale (screen space to data space).
 * Useful for zoom/pan calculations.
 */
export const createInverseLinearScale = (
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number
): ((screenValue: number) => number) => {
  const domainSpan = domainMax - domainMin;
  const rangeSpan = rangeMax - rangeMin;

  if (rangeSpan === 0) {
    return () => (domainMin + domainMax) / 2;
  }

  return (screenValue: number): number => {
    const normalized = (screenValue - rangeMin) / rangeSpan;
    return domainMin + normalized * domainSpan;
  };
};
