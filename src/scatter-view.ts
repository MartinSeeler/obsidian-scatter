/**
 * ScatterPlotView - The main Bases view implementation.
 *
 * Extends BasesView and orchestrates data extraction, rendering, and interactions.
 */

import {
  BasesView,
  type QueryController,
  type HoverParent,
  type HoverPopover,
} from "obsidian";
import type {
  ScatterConfig,
  DataExtractionResult,
  PlotBounds,
  ViewportDimensions,
  RenderedPoint,
} from "./types";
import {
  DEFAULT_CONFIG,
  DEFAULT_VIEWPORT,
  DEFAULT_PALETTE,
} from "./types";
import {
  extractDataFromEntries,
  flattenGroupedData,
  calculatePlotBounds,
} from "./data";
import {
  createChartSvg,
  createEmptyState,
  createSkippedWarning,
  calculateInnerDimensions,
  transformPointsToScreen,
  createCategoryColorMap,
  DEFAULT_POINT_CONFIG,
} from "./render";
import {
  attachPointEvents,
  attachWheelZoom,
  createPointIndex,
} from "./interactions";

// ============================================================================
// View Type Identifier
// ============================================================================

export const SCATTER_VIEW_TYPE = "scatter-plot" as const;

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Reads the scatter config from the view config.
 * Returns defaults for missing values.
 */
const readConfig = (view: ScatterPlotView): ScatterConfig => {
  const xAxis = view.config.get("xAxis");
  const yAxis = view.config.get("yAxis");
  const colorBy = view.config.get("colorBy");

  return {
    xAxis: typeof xAxis === "string" && xAxis.length > 0 ? xAxis : null,
    yAxis: typeof yAxis === "string" && yAxis.length > 0 ? yAxis : null,
    colorBy: typeof colorBy === "string" && colorBy.length > 0 ? colorBy : null,
  };
};

/**
 * Extracts a human-readable label from a property ID.
 * Property IDs can be like "property.effort" or "formula.computed_score"
 */
const propertyIdToLabel = (propertyId: string | null): string => {
  if (propertyId === null) return "";

  // Remove prefix like "property." or "formula."
  const parts = propertyId.split(".");
  const name = parts.length > 1 ? parts.slice(1).join(".") : propertyId;

  // Convert snake_case or camelCase to Title Case
  return name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
};

// ============================================================================
// ScatterPlotView Class
// ============================================================================

export class ScatterPlotView extends BasesView implements HoverParent {
  /** Required by BasesView */
  public readonly type = SCATTER_VIEW_TYPE;

  /** Required by HoverParent */
  public hoverPopover: HoverPopover | null = null;

  /** The container element for rendering */
  private readonly containerEl: HTMLElement;

  /** Cleanup function for event listeners */
  private cleanup: (() => void) | null = null;

  /** Current viewport dimensions */
  private viewport: ViewportDimensions = DEFAULT_VIEWPORT;

  /** Cached rendered points for interaction lookups */
  private renderedPoints: readonly RenderedPoint[] = [];

  constructor(controller: QueryController, parentEl: HTMLElement) {
    super(controller);

    // Create container with relative positioning for tooltips
    this.containerEl = parentEl.createDiv({
      cls: "scatter-plot-container",
    });
    this.containerEl.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    `;

    // Set up resize observer to track container size
    this.setupResizeObserver();
  }

  /**
   * Called by Obsidian when data or configuration changes.
   * This is the main render entry point.
   */
  public onDataUpdated(): void {
    // Clean up previous render
    this.cleanup?.();
    this.cleanup = null;
    this.containerEl.empty();

    // Read configuration
    const config = readConfig(this);

    // Check if axes are configured
    if (config.xAxis === null || config.yAxis === null) {
      this.renderEmptyState(
        "Configure X and Y axis properties in the view settings to display the scatter plot."
      );
      return;
    }

    // Extract data from entries
    const entries = flattenGroupedData(this.data.groupedData);
    const extraction = extractDataFromEntries(entries, config);

    // Check if we have any plottable points
    if (extraction.points.length === 0) {
      const message =
        extraction.skipped.length > 0
          ? `No plottable points. ${extraction.skipped.length} note${extraction.skipped.length === 1 ? "" : "s"} skipped due to missing or non-numeric values.`
          : "No notes match the current filters.";
      this.renderEmptyState(message);
      return;
    }

    // Calculate bounds
    const bounds = calculatePlotBounds(extraction.points);
    if (bounds === null) {
      this.renderEmptyState("Unable to calculate plot bounds.");
      return;
    }

    // Render the chart
    this.renderChart(config, extraction, bounds);
  }

  /**
   * Renders the empty state message.
   */
  private renderEmptyState(message: string): void {
    const emptyState = createEmptyState(message);
    this.containerEl.appendChild(emptyState);
  }

  /**
   * Renders the full scatter plot chart.
   */
  private renderChart(
    config: ScatterConfig,
    extraction: DataExtractionResult,
    bounds: PlotBounds
  ): void {
    const { points, skipped, categories } = extraction;

    // Update viewport dimensions from container
    this.updateViewportFromContainer();

    // Labels for axes
    const xLabel = propertyIdToLabel(config.xAxis);
    const yLabel = propertyIdToLabel(config.yAxis);

    // Create SVG
    const svg = createChartSvg(points, bounds, categories, {
      viewport: this.viewport,
      pointConfig: DEFAULT_POINT_CONFIG,
      palette: DEFAULT_PALETTE,
      showGrid: true,
      xLabel,
      yLabel,
    });

    this.containerEl.appendChild(svg);

    // Cache rendered points for interaction lookups
    const inner = calculateInnerDimensions(this.viewport);
    const colorMap = createCategoryColorMap(categories, DEFAULT_PALETTE);
    this.renderedPoints = transformPointsToScreen(
      points,
      bounds,
      inner,
      colorMap,
      DEFAULT_PALETTE
    );

    // Attach event handlers
    const pointIndex = createPointIndex(this.renderedPoints);
    const cleanupEvents = attachPointEvents(svg, {
      app: this.app,
      hoverParent: this,
      containerEl: this.containerEl,
      pointIndex,
      xLabel,
      yLabel,
      pointConfig: DEFAULT_POINT_CONFIG,
    });

    const cleanupZoom = attachWheelZoom(svg, {
      minScale: 0.5,
      maxScale: 5,
      onZoomChange: () => {}, // Could be used for state tracking
    });

    this.cleanup = (): void => {
      cleanupEvents();
      cleanupZoom();
    };

    // Show warning about skipped entries
    if (skipped.length > 0) {
      const warning = createSkippedWarning(skipped.length);
      this.containerEl.appendChild(warning);
    }
  }

  /**
   * Updates viewport dimensions from the container element.
   */
  private updateViewportFromContainer(): void {
    const rect = this.containerEl.getBoundingClientRect();

    // Use container size if available, otherwise fall back to defaults
    const width = rect.width > 100 ? rect.width : DEFAULT_VIEWPORT.width;
    const height = rect.height > 100 ? rect.height : DEFAULT_VIEWPORT.height;

    this.viewport = {
      ...DEFAULT_VIEWPORT,
      width,
      height,
    };
  }

  /**
   * Sets up a ResizeObserver to re-render when container size changes.
   */
  private setupResizeObserver(): void {
    // Use Obsidian's Component.register for cleanup
    const observer = new ResizeObserver(() => {
      // Debounce resize events
      if (this.resizeTimeout !== null) {
        window.clearTimeout(this.resizeTimeout);
      }
      this.resizeTimeout = window.setTimeout(() => {
        this.onDataUpdated();
      }, 100);
    });

    observer.observe(this.containerEl);

    // Register cleanup
    this.register(() => {
      observer.disconnect();
      if (this.resizeTimeout !== null) {
        window.clearTimeout(this.resizeTimeout);
      }
    });
  }

  private resizeTimeout: number | null = null;

  /**
   * Cleanup when the view is unloaded.
   */
  public onunload(): void {
    this.cleanup?.();
    this.cleanup = null;
  }
}
