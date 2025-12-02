/**
 * Type definitions for obsidian-bases-scatter plugin
 */

import type { BasesEntry, TFile } from "obsidian";

// ============================================================================
// Configuration Types
// ============================================================================

/** Keys used in view configuration storage */
export type ConfigKey = "xAxis" | "yAxis" | "colorBy";

/** The raw configuration values stored in .base file */
export interface ScatterConfig {
  readonly xAxis: string | null;
  readonly yAxis: string | null;
  readonly colorBy: string | null;
}

/** Default configuration values */
export const DEFAULT_CONFIG: ScatterConfig = {
  xAxis: null,
  yAxis: null,
  colorBy: null,
} as const;

// ============================================================================
// Data Types
// ============================================================================

/** A single point that can be rendered on the scatter plot */
export interface ScatterPoint {
  readonly x: number;
  readonly y: number;
  readonly category: string | null;
  readonly label: string;
  readonly file: TFile;
  readonly entry: BasesEntry;
}

/** Result of extracting a numeric value from an entry */
export type NumericExtractionResult =
  | { readonly success: true; readonly value: number }
  | { readonly success: false; readonly reason: string };

/** Result of extracting a categorical value from an entry */
export type CategoryExtractionResult =
  | { readonly success: true; readonly value: string }
  | { readonly success: false };

/** Result of processing all entries into plottable points */
export interface DataExtractionResult {
  readonly points: readonly ScatterPoint[];
  readonly skipped: readonly SkippedEntry[];
  readonly categories: readonly string[];
}

/** An entry that was skipped during extraction with reason */
export interface SkippedEntry {
  readonly file: TFile;
  readonly reason: string;
}

// ============================================================================
// Axis / Bounds Types
// ============================================================================

/** Numeric bounds for an axis */
export interface AxisBounds {
  readonly min: number;
  readonly max: number;
}

/** Bounds for both axes */
export interface PlotBounds {
  readonly x: AxisBounds;
  readonly y: AxisBounds;
}

/** Dimensions for the SVG viewport */
export interface ViewportDimensions {
  readonly width: number;
  readonly height: number;
  readonly margin: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
}

/** Computed inner dimensions (viewport minus margins) */
export interface InnerDimensions {
  readonly width: number;
  readonly height: number;
}

// ============================================================================
// Rendering Types
// ============================================================================

/** A point with screen coordinates ready for rendering */
export interface RenderedPoint extends ScatterPoint {
  readonly screenX: number;
  readonly screenY: number;
  readonly color: string;
}

/** Color palette for categories */
export interface ColorPalette {
  readonly fallback: string;
  readonly colors: readonly string[];
}

/** Default color palette using Obsidian CSS variables where possible */
export const DEFAULT_PALETTE: ColorPalette = {
  fallback: "var(--text-muted)",
  colors: [
    "var(--color-blue)",
    "var(--color-green)",
    "var(--color-yellow)",
    "var(--color-orange)",
    "var(--color-red)",
    "var(--color-purple)",
    "var(--color-pink)",
    "var(--color-cyan)",
  ],
} as const;

// ============================================================================
// Interaction Types
// ============================================================================

/** Data passed to click handler */
export interface PointClickEvent {
  readonly point: ScatterPoint;
  readonly originalEvent: MouseEvent;
}

/** Data passed to hover handler */
export interface PointHoverEvent {
  readonly point: ScatterPoint;
  readonly targetEl: HTMLElement | SVGElement;
  readonly originalEvent: MouseEvent;
}

// ============================================================================
// View State Types
// ============================================================================

/** Current state of the scatter plot view */
export interface ViewState {
  readonly config: ScatterConfig;
  readonly data: DataExtractionResult | null;
  readonly bounds: PlotBounds | null;
  readonly viewport: ViewportDimensions;
}

export const DEFAULT_VIEWPORT: ViewportDimensions = {
  width: 800,
  height: 600,
  margin: {
    top: 20,
    right: 20,
    bottom: 40,
    left: 50,
  },
} as const;

// ============================================================================
// Utility Types
// ============================================================================

/** Generic result type for operations that can fail */
export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Helper to create success result */
export const ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

/** Helper to create error result */
export const err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});
