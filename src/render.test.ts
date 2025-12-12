/**
 * Unit tests for render.ts pure functions
 */

import { describe, it, expect } from "vitest";
import type { TFile } from "obsidian";
import type {
  ScatterPoint,
  ViewportDimensions,
  PlotBounds,
  ColorPalette,
  InnerDimensions,
} from "./types";
import { DEFAULT_PALETTE } from "./types";
import {
  calculateInnerDimensions,
  createCategoryColorMap,
  getPointColor,
  transformPointsToScreen,
  generateTicks,
  createEmptyState,
  createSkippedWarning,
} from "./render";

// ============================================================================
// Test Helpers
// ============================================================================

/** Mock file type with minimal properties needed for tests */
type MockFile = Pick<TFile, 'path' | 'basename'>;

/** Creates a mock file object for testing (minimal shape needed by tests) */
const mockFile = (path: string): MockFile => ({
  path,
  basename: path.split("/").pop()?.replace(".md", "") ?? path,
});

/** Creates a minimal ScatterPoint for testing */
const mockPoint = (
  x: number,
  y: number,
  category: string | null = null,
  label: string = "test"
): ScatterPoint =>
  ({
    x,
    y,
    category,
    label,
    file: mockFile("test.md"),
    entry: {} as unknown as ScatterPoint["entry"],
  }) as ScatterPoint;

/** Creates a standard viewport for testing */
const mockViewport = (
  width = 800,
  height = 600,
  margin = { top: 20, right: 20, bottom: 40, left: 50 }
): ViewportDimensions => ({
  width,
  height,
  margin,
});

/** Creates standard plot bounds for testing */
const mockBounds = (
  xMin = 0,
  xMax = 100,
  yMin = 0,
  yMax = 100
): PlotBounds => ({
  x: { min: xMin, max: xMax },
  y: { min: yMin, max: yMax },
});

// ============================================================================
// calculateInnerDimensions
// ============================================================================

describe("calculateInnerDimensions", () => {
  it("subtracts margins from viewport", () => {
    const viewport = mockViewport(800, 600, {
      top: 20,
      right: 20,
      bottom: 40,
      left: 50,
    });
    const inner = calculateInnerDimensions(viewport);

    expect(inner.width).toBe(730); // 800 - 50 - 20
    expect(inner.height).toBe(540); // 600 - 20 - 40
  });

  it("handles zero margins", () => {
    const viewport = mockViewport(400, 300, {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    const inner = calculateInnerDimensions(viewport);

    expect(inner.width).toBe(400);
    expect(inner.height).toBe(300);
  });

  it("handles large margins", () => {
    const viewport = mockViewport(200, 200, {
      top: 50,
      right: 50,
      bottom: 50,
      left: 50,
    });
    const inner = calculateInnerDimensions(viewport);

    expect(inner.width).toBe(100);
    expect(inner.height).toBe(100);
  });
});

// ============================================================================
// createCategoryColorMap
// ============================================================================

describe("createCategoryColorMap", () => {
  const testPalette: ColorPalette = {
    fallback: "gray",
    colors: ["red", "green", "blue"],
  };

  it("returns empty map for no categories", () => {
    const map = createCategoryColorMap([]);
    expect(map.size).toBe(0);
  });

  it("assigns colors in order", () => {
    const map = createCategoryColorMap(["A", "B", "C"], testPalette);

    expect(map.get("A")).toBe("red");
    expect(map.get("B")).toBe("green");
    expect(map.get("C")).toBe("blue");
  });

  it("cycles colors when more categories than colors", () => {
    const map = createCategoryColorMap(
      ["A", "B", "C", "D", "E"],
      testPalette
    );

    expect(map.get("A")).toBe("red");
    expect(map.get("B")).toBe("green");
    expect(map.get("C")).toBe("blue");
    expect(map.get("D")).toBe("red"); // cycles back
    expect(map.get("E")).toBe("green");
  });

  it("uses default palette when not specified", () => {
    const map = createCategoryColorMap(["A"]);
    expect(map.get("A")).toBe(DEFAULT_PALETTE.colors[0]);
  });
});

// ============================================================================
// getPointColor
// ============================================================================

describe("getPointColor", () => {
  it("returns mapped color for categorized point", () => {
    const colorMap = new Map([["category-a", "red"]]);
    const point = mockPoint(1, 1, "category-a");

    expect(getPointColor(point, colorMap)).toBe("red");
  });

  it("returns fallback for null category", () => {
    const colorMap = new Map([["category-a", "red"]]);
    const point = mockPoint(1, 1, null);

    expect(getPointColor(point, colorMap, "gray")).toBe("gray");
  });

  it("returns fallback for unmapped category", () => {
    const colorMap = new Map([["category-a", "red"]]);
    const point = mockPoint(1, 1, "unknown");

    expect(getPointColor(point, colorMap, "gray")).toBe("gray");
  });

  it("uses DEFAULT_PALETTE.fallback as default", () => {
    const point = mockPoint(1, 1, null);

    expect(getPointColor(point, new Map())).toBe(DEFAULT_PALETTE.fallback);
  });
});

// ============================================================================
// transformPointsToScreen
// ============================================================================

describe("transformPointsToScreen", () => {
  const inner: InnerDimensions = { width: 500, height: 400 };
  const bounds = mockBounds(0, 100, 0, 100);
  const colorMap = new Map([["A", "red"]]);

  it("transforms points to screen coordinates", () => {
    const points = [mockPoint(0, 0), mockPoint(100, 100), mockPoint(50, 50)];
    const rendered = transformPointsToScreen(points, bounds, inner, colorMap);

    // Point at (0, 0) -> screen (0, 400) (Y inverted)
    expect(rendered[0].screenX).toBe(0);
    expect(rendered[0].screenY).toBe(400);

    // Point at (100, 100) -> screen (500, 0)
    expect(rendered[1].screenX).toBe(500);
    expect(rendered[1].screenY).toBe(0);

    // Point at (50, 50) -> screen (250, 200)
    expect(rendered[2].screenX).toBe(250);
    expect(rendered[2].screenY).toBe(200);
  });

  it("assigns colors from colorMap", () => {
    const points = [mockPoint(0, 0, "A"), mockPoint(50, 50, null)];
    const rendered = transformPointsToScreen(points, bounds, inner, colorMap);

    expect(rendered[0].color).toBe("red");
    expect(rendered[1].color).toBe(DEFAULT_PALETTE.fallback);
  });

  it("preserves original point data", () => {
    const points = [mockPoint(25, 75, "A", "Test Label")];

    const rendered = transformPointsToScreen(points, bounds, inner, colorMap);

    expect(rendered[0].x).toBe(25);
    expect(rendered[0].y).toBe(75);
    expect(rendered[0].category).toBe("A");
    expect(rendered[0].label).toBe("Test Label");
  });

  it("returns empty array for empty input", () => {
    const rendered = transformPointsToScreen([], bounds, inner, colorMap);
    expect(rendered).toEqual([]);
  });
});

// ============================================================================
// generateTicks
// ============================================================================

describe("generateTicks", () => {
  it("generates correct number of ticks", () => {
    const ticks = generateTicks({ min: 0, max: 100 }, 5);
    expect(ticks).toHaveLength(5);
  });

  it("generates evenly spaced ticks", () => {
    const ticks = generateTicks({ min: 0, max: 100 }, 5);
    expect(ticks).toEqual([0, 25, 50, 75, 100]);
  });

  it("handles non-zero minimum", () => {
    const ticks = generateTicks({ min: 10, max: 50 }, 5);
    expect(ticks).toEqual([10, 20, 30, 40, 50]);
  });

  it("handles negative values", () => {
    const ticks = generateTicks({ min: -50, max: 50 }, 5);
    expect(ticks).toEqual([-50, -25, 0, 25, 50]);
  });

  it("handles three ticks", () => {
    const ticks = generateTicks({ min: 0, max: 100 }, 3);
    expect(ticks).toEqual([0, 50, 100]);
  });

  it("handles two ticks", () => {
    const ticks = generateTicks({ min: 0, max: 100 }, 2);
    expect(ticks).toEqual([0, 100]);
  });

  it("uses default count of 5", () => {
    const ticks = generateTicks({ min: 0, max: 100 });
    expect(ticks).toHaveLength(5);
  });
});

// ============================================================================
// createEmptyState
// ============================================================================

describe("createEmptyState", () => {
  it("creates a div element", () => {
    const el = createEmptyState("Test message");
    expect(el.tagName).toBe("DIV");
  });

  it("has correct class name", () => {
    const el = createEmptyState("Test message");
    expect(el.className).toBe("scatter-empty-state");
  });

  it("contains the message text", () => {
    const el = createEmptyState("No data available");
    expect(el.textContent).toContain("No data available");
  });

  it("contains chart emoji icon", () => {
    const el = createEmptyState("Test");
    expect(el.textContent).toContain("📊");
  });

  it("has two child elements (icon and text)", () => {
    const el = createEmptyState("Test");
    expect(el.children).toHaveLength(2);
  });
});

// ============================================================================
// createSkippedWarning
// ============================================================================

describe("createSkippedWarning", () => {
  it("creates a div element", () => {
    const el = createSkippedWarning(5);
    expect(el.tagName).toBe("DIV");
  });

  it("has correct class name", () => {
    const el = createSkippedWarning(5);
    expect(el.className).toBe("scatter-skipped-warning");
  });

  it("shows singular form for 1 note", () => {
    const el = createSkippedWarning(1);
    expect(el.textContent).toBe("1 note skipped (missing numeric values)");
  });

  it("shows plural form for multiple notes", () => {
    const el = createSkippedWarning(5);
    expect(el.textContent).toBe("5 notes skipped (missing numeric values)");
  });

  it("shows plural form for 0 notes", () => {
    const el = createSkippedWarning(0);
    expect(el.textContent).toBe("0 notes skipped (missing numeric values)");
  });
});

