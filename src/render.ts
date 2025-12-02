/**
 * SVG rendering functions for the scatter plot.
 *
 * Uses vanilla DOM manipulation for SVG creation.
 * All rendering functions are pure - they create new elements rather than mutating.
 */

import type {
  ScatterPoint,
  RenderedPoint,
  PlotBounds,
  ViewportDimensions,
  InnerDimensions,
  ColorPalette,
  AxisBounds,
} from "./types";
import { DEFAULT_PALETTE } from "./types";
import { createLinearScale } from "./data";

// ============================================================================
// SVG Namespace
// ============================================================================

const SVG_NS = "http://www.w3.org/2000/svg";

/** Helper to create an SVG element with attributes */
const createSvgElement = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number> = {}
): SVGElementTagNameMap[K] => {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
};

// ============================================================================
// Dimension Calculations
// ============================================================================

/** Calculates inner dimensions (viewport minus margins) */
export const calculateInnerDimensions = (
  viewport: ViewportDimensions
): InnerDimensions => ({
  width: viewport.width - viewport.margin.left - viewport.margin.right,
  height: viewport.height - viewport.margin.top - viewport.margin.bottom,
});

// ============================================================================
// Color Assignment
// ============================================================================

/** Creates a mapping from category names to colors */
export const createCategoryColorMap = (
  categories: readonly string[],
  palette: ColorPalette = DEFAULT_PALETTE
): Map<string, string> => {
  const colorMap = new Map<string, string>();

  categories.forEach((category, index) => {
    const colorIndex = index % palette.colors.length;
    colorMap.set(category, palette.colors[colorIndex]);
  });

  return colorMap;
};

/** Gets the color for a point based on its category */
export const getPointColor = (
  point: ScatterPoint,
  colorMap: Map<string, string>,
  fallback: string = DEFAULT_PALETTE.fallback
): string => {
  if (point.category === null) {
    return fallback;
  }
  return colorMap.get(point.category) ?? fallback;
};

// ============================================================================
// Point Transformation
// ============================================================================

/** Transforms data points to screen coordinates */
export const transformPointsToScreen = (
  points: readonly ScatterPoint[],
  bounds: PlotBounds,
  inner: InnerDimensions,
  colorMap: Map<string, string>,
  palette: ColorPalette = DEFAULT_PALETTE
): RenderedPoint[] => {
  const scaleX = createLinearScale(bounds.x.min, bounds.x.max, 0, inner.width);
  // Y axis is inverted (screen Y increases downward)
  const scaleY = createLinearScale(bounds.y.min, bounds.y.max, inner.height, 0);

  return points.map((point) => ({
    ...point,
    screenX: scaleX(point.x),
    screenY: scaleY(point.y),
    color: getPointColor(point, colorMap, palette.fallback),
  }));
};

// ============================================================================
// Axis Rendering
// ============================================================================

/** Configuration for axis tick generation */
interface TickConfig {
  readonly count: number;
  readonly format: (value: number) => string;
}

const DEFAULT_TICK_CONFIG: TickConfig = {
  count: 5,
  format: (v) => v.toLocaleString(undefined, { maximumFractionDigits: 2 }),
};

/** Generates nice tick values for an axis */
export const generateTicks = (
  bounds: AxisBounds,
  count: number = DEFAULT_TICK_CONFIG.count
): number[] => {
  const range = bounds.max - bounds.min;
  const step = range / (count - 1);

  return Array.from({ length: count }, (_, i) => bounds.min + i * step);
};

/** Creates an X axis SVG group */
export const createXAxis = (
  bounds: AxisBounds,
  inner: InnerDimensions,
  label: string,
  tickConfig: TickConfig = DEFAULT_TICK_CONFIG
): SVGGElement => {
  const group = createSvgElement("g", { class: "scatter-axis scatter-axis-x" });
  const scale = createLinearScale(bounds.min, bounds.max, 0, inner.width);
  const ticks = generateTicks(bounds, tickConfig.count);

  // Axis line
  const axisLine = createSvgElement("line", {
    x1: 0,
    y1: inner.height,
    x2: inner.width,
    y2: inner.height,
    class: "scatter-axis-line",
    stroke: "var(--text-muted)",
    "stroke-width": 1,
  });
  group.appendChild(axisLine);

  // Ticks and labels
  for (const tick of ticks) {
    const x = scale(tick);

    const tickLine = createSvgElement("line", {
      x1: x,
      y1: inner.height,
      x2: x,
      y2: inner.height + 6,
      class: "scatter-tick",
      stroke: "var(--text-muted)",
      "stroke-width": 1,
    });
    group.appendChild(tickLine);

    const tickLabel = createSvgElement("text", {
      x,
      y: inner.height + 20,
      class: "scatter-tick-label",
      "text-anchor": "middle",
      fill: "var(--text-muted)",
      "font-size": "11px",
    });
    tickLabel.textContent = tickConfig.format(tick);
    group.appendChild(tickLabel);
  }

  // Axis label
  const axisLabel = createSvgElement("text", {
    x: inner.width / 2,
    y: inner.height + 35,
    class: "scatter-axis-label",
    "text-anchor": "middle",
    fill: "var(--text-normal)",
    "font-size": "12px",
  });
  axisLabel.textContent = label;
  group.appendChild(axisLabel);

  return group;
};

/** Creates a Y axis SVG group */
export const createYAxis = (
  bounds: AxisBounds,
  inner: InnerDimensions,
  label: string,
  tickConfig: TickConfig = DEFAULT_TICK_CONFIG
): SVGGElement => {
  const group = createSvgElement("g", { class: "scatter-axis scatter-axis-y" });
  const scale = createLinearScale(bounds.min, bounds.max, inner.height, 0);
  const ticks = generateTicks(bounds, tickConfig.count);

  // Axis line
  const axisLine = createSvgElement("line", {
    x1: 0,
    y1: 0,
    x2: 0,
    y2: inner.height,
    class: "scatter-axis-line",
    stroke: "var(--text-muted)",
    "stroke-width": 1,
  });
  group.appendChild(axisLine);

  // Ticks and labels
  for (const tick of ticks) {
    const y = scale(tick);

    const tickLine = createSvgElement("line", {
      x1: -6,
      y1: y,
      x2: 0,
      y2: y,
      class: "scatter-tick",
      stroke: "var(--text-muted)",
      "stroke-width": 1,
    });
    group.appendChild(tickLine);

    const tickLabel = createSvgElement("text", {
      x: -10,
      y: y + 4,
      class: "scatter-tick-label",
      "text-anchor": "end",
      fill: "var(--text-muted)",
      "font-size": "11px",
    });
    tickLabel.textContent = tickConfig.format(tick);
    group.appendChild(tickLabel);
  }

  // Axis label (rotated)
  const axisLabel = createSvgElement("text", {
    x: -inner.height / 2,
    y: -35,
    class: "scatter-axis-label",
    "text-anchor": "middle",
    fill: "var(--text-normal)",
    "font-size": "12px",
    transform: "rotate(-90)",
  });
  axisLabel.textContent = label;
  group.appendChild(axisLabel);

  return group;
};

// ============================================================================
// Point Rendering
// ============================================================================

/** Configuration for point rendering */
export interface PointRenderConfig {
  readonly radius: number;
  readonly opacity: number;
  readonly hoverRadius: number;
}

export const DEFAULT_POINT_CONFIG: PointRenderConfig = {
  radius: 8,
  opacity: 0.7,
  hoverRadius: 12,
};

/** Creates an SVG circle for a single point */
export const createPointElement = (
  point: RenderedPoint,
  config: PointRenderConfig = DEFAULT_POINT_CONFIG
): SVGCircleElement => {
  const circle = createSvgElement("circle", {
    cx: point.screenX,
    cy: point.screenY,
    r: config.radius,
    fill: point.color,
    opacity: config.opacity,
    class: "scatter-point",
    "data-file-path": point.file.path,
  });

  // Add CSS for hover effect
  circle.style.cursor = "pointer";
  circle.style.transition = "r 0.15s ease-out, opacity 0.15s ease-out";

  return circle;
};

/** Creates the points layer SVG group */
export const createPointsLayer = (
  points: readonly RenderedPoint[],
  config: PointRenderConfig = DEFAULT_POINT_CONFIG
): SVGGElement => {
  const group = createSvgElement("g", { class: "scatter-points" });

  for (const point of points) {
    const circle = createPointElement(point, config);
    group.appendChild(circle);
  }

  return group;
};

// ============================================================================
// Grid Lines (Optional)
// ============================================================================

/** Creates grid lines for better readability */
export const createGridLines = (
  xBounds: AxisBounds,
  yBounds: AxisBounds,
  inner: InnerDimensions,
  tickCount: number = 5
): SVGGElement => {
  const group = createSvgElement("g", { class: "scatter-grid" });

  const xScale = createLinearScale(xBounds.min, xBounds.max, 0, inner.width);
  const yScale = createLinearScale(yBounds.min, yBounds.max, inner.height, 0);

  const xTicks = generateTicks(xBounds, tickCount);
  const yTicks = generateTicks(yBounds, tickCount);

  // Vertical grid lines
  for (const tick of xTicks) {
    const x = xScale(tick);
    const line = createSvgElement("line", {
      x1: x,
      y1: 0,
      x2: x,
      y2: inner.height,
      class: "scatter-grid-line",
      stroke: "var(--background-modifier-border)",
      "stroke-width": 1,
      "stroke-dasharray": "2,2",
      opacity: 0.5,
    });
    group.appendChild(line);
  }

  // Horizontal grid lines
  for (const tick of yTicks) {
    const y = yScale(tick);
    const line = createSvgElement("line", {
      x1: 0,
      y1: y,
      x2: inner.width,
      y2: y,
      class: "scatter-grid-line",
      stroke: "var(--background-modifier-border)",
      "stroke-width": 1,
      "stroke-dasharray": "2,2",
      opacity: 0.5,
    });
    group.appendChild(line);
  }

  return group;
};

// ============================================================================
// Full Chart Assembly
// ============================================================================

export interface ChartRenderConfig {
  readonly viewport: ViewportDimensions;
  readonly pointConfig: PointRenderConfig;
  readonly palette: ColorPalette;
  readonly showGrid: boolean;
  readonly xLabel: string;
  readonly yLabel: string;
}

/** Assembles the complete SVG chart */
export const createChartSvg = (
  points: readonly ScatterPoint[],
  bounds: PlotBounds,
  categories: readonly string[],
  config: ChartRenderConfig
): SVGSVGElement => {
  const { viewport, pointConfig, palette, showGrid, xLabel, yLabel } = config;
  const inner = calculateInnerDimensions(viewport);

  // Create root SVG
  const svg = createSvgElement("svg", {
    width: viewport.width,
    height: viewport.height,
    viewBox: `0 0 ${viewport.width} ${viewport.height}`,
    class: "scatter-chart",
  });

  // Create main group with margin offset
  const mainGroup = createSvgElement("g", {
    transform: `translate(${viewport.margin.left}, ${viewport.margin.top})`,
  });
  svg.appendChild(mainGroup);

  // Add grid (behind everything)
  if (showGrid) {
    mainGroup.appendChild(createGridLines(bounds.x, bounds.y, inner));
  }

  // Color mapping
  const colorMap = createCategoryColorMap(categories, palette);

  // Transform points to screen coordinates
  const renderedPoints = transformPointsToScreen(
    points,
    bounds,
    inner,
    colorMap,
    palette
  );

  // Add axes
  mainGroup.appendChild(createXAxis(bounds.x, inner, xLabel));
  mainGroup.appendChild(createYAxis(bounds.y, inner, yLabel));

  // Add points (on top)
  mainGroup.appendChild(createPointsLayer(renderedPoints, pointConfig));

  return svg;
};

// ============================================================================
// Empty State
// ============================================================================

/** Creates an empty state message element */
export const createEmptyState = (message: string): HTMLDivElement => {
  const container = document.createElement("div");
  container.className = "scatter-empty-state";
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    text-align: center;
    padding: 20px;
  `;

  const icon = document.createElement("div");
  icon.style.cssText = "font-size: 48px; margin-bottom: 16px;";
  icon.textContent = "📊";
  container.appendChild(icon);

  const text = document.createElement("div");
  text.textContent = message;
  container.appendChild(text);

  return container;
};

/** Creates a warning message about skipped entries */
export const createSkippedWarning = (count: number): HTMLDivElement => {
  const warning = document.createElement("div");
  warning.className = "scatter-skipped-warning";
  warning.style.cssText = `
    position: absolute;
    bottom: 8px;
    right: 8px;
    font-size: 11px;
    color: var(--text-muted);
    background: var(--background-secondary);
    padding: 4px 8px;
    border-radius: 4px;
  `;
  warning.textContent = `${count} note${count === 1 ? "" : "s"} skipped (missing numeric values)`;

  return warning;
};
