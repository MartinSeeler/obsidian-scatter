/**
 * Unit tests for data.ts pure functions
 */

import { describe, it, expect } from "vitest";
import type { TFile } from "obsidian";
import type { ScatterPoint, SkippedEntry } from "./types";
import {
	calculateAxisBounds,
	calculatePlotBounds,
	createLinearScale,
	createInverseLinearScale,
	extractCategories,
	isScatterPoint,
	isSkippedEntry,
	flattenGroupedData,
} from "./data";

// ============================================================================
// Test Helpers
// ============================================================================

/** Creates a mock TFile for testing */
const mockFile = (path: string): TFile =>
	({
		path,
		basename: path.split("/").pop()?.replace(".md", "") ?? path,
	} as TFile);

/** Creates a minimal ScatterPoint for testing */
const mockPoint = (
	x: number,
	y: number,
	category: string | null = null
): ScatterPoint =>
	({
		x,
		y,
		category,
		label: "test",
		file: mockFile("test.md"),
		entry: {} as any,
	} as ScatterPoint);

// ============================================================================
// calculateAxisBounds
// ============================================================================

describe("calculateAxisBounds", () => {
	it("returns null for empty array", () => {
		expect(calculateAxisBounds([])).toBeNull();
	});

	it("calculates bounds with default 5% padding", () => {
		const bounds = calculateAxisBounds([0, 100]);
		expect(bounds).not.toBeNull();
		expect(bounds!.min).toBe(-5); // 0 - 5% of 100
		expect(bounds!.max).toBe(105); // 100 + 5% of 100
	});

	it("calculates bounds with custom padding", () => {
		const bounds = calculateAxisBounds([0, 100], 0.1);
		expect(bounds).not.toBeNull();
		expect(bounds!.min).toBe(-10); // 0 - 10% of 100
		expect(bounds!.max).toBe(110); // 100 + 10% of 100
	});

	it("handles single value with fallback padding", () => {
		const bounds = calculateAxisBounds([50]);
		expect(bounds).not.toBeNull();
		// When range is 0, padding = abs(value) * paddingPercent = 50 * 0.05 = 2.5
		expect(bounds!.min).toBe(47.5);
		expect(bounds!.max).toBe(52.5);
	});

	it("handles single zero value with minimum padding of 1", () => {
		const bounds = calculateAxisBounds([0]);
		expect(bounds).not.toBeNull();
		// When range is 0 and value is 0, padding = 1 (fallback)
		expect(bounds!.min).toBe(-1);
		expect(bounds!.max).toBe(1);
	});

	it("handles negative values", () => {
		const bounds = calculateAxisBounds([-100, -50]);
		expect(bounds).not.toBeNull();
		const range = 50;
		expect(bounds!.min).toBe(-100 - range * 0.05);
		expect(bounds!.max).toBe(-50 + range * 0.05);
	});

	it("handles mixed positive and negative values", () => {
		const bounds = calculateAxisBounds([-50, 50]);
		expect(bounds).not.toBeNull();
		const range = 100;
		expect(bounds!.min).toBe(-50 - range * 0.05);
		expect(bounds!.max).toBe(50 + range * 0.05);
	});

	it("handles unsorted values", () => {
		const bounds = calculateAxisBounds([50, 10, 90, 30]);
		expect(bounds).not.toBeNull();
		const range = 80;
		expect(bounds!.min).toBe(10 - range * 0.05);
		expect(bounds!.max).toBe(90 + range * 0.05);
	});
});

// ============================================================================
// calculatePlotBounds
// ============================================================================

describe("calculatePlotBounds", () => {
	it("returns null for empty points array", () => {
		expect(calculatePlotBounds([])).toBeNull();
	});

	it("calculates bounds for both axes", () => {
		const points = [mockPoint(0, 0), mockPoint(100, 200)];
		const bounds = calculatePlotBounds(points);

		expect(bounds).not.toBeNull();
		expect(bounds!.x.min).toBe(-5);
		expect(bounds!.x.max).toBe(105);
		expect(bounds!.y.min).toBe(-10);
		expect(bounds!.y.max).toBe(210);
	});

	it("respects custom padding", () => {
		const points = [mockPoint(0, 0), mockPoint(100, 100)];
		const bounds = calculatePlotBounds(points, 0.1);

		expect(bounds).not.toBeNull();
		expect(bounds!.x.min).toBe(-10);
		expect(bounds!.x.max).toBe(110);
		expect(bounds!.y.min).toBe(-10);
		expect(bounds!.y.max).toBe(110);
	});

	it("handles single point", () => {
		const points = [mockPoint(50, 100)];
		const bounds = calculatePlotBounds(points);

		expect(bounds).not.toBeNull();
		// Single value: padding = abs(value) * 0.05
		expect(bounds!.x.min).toBe(47.5);
		expect(bounds!.x.max).toBe(52.5);
		expect(bounds!.y.min).toBe(95);
		expect(bounds!.y.max).toBe(105);
	});
});

// ============================================================================
// createLinearScale
// ============================================================================

describe("createLinearScale", () => {
	it("maps domain to range linearly", () => {
		const scale = createLinearScale(0, 100, 0, 500);

		expect(scale(0)).toBe(0);
		expect(scale(50)).toBe(250);
		expect(scale(100)).toBe(500);
	});

	it("handles inverted range (for Y axis)", () => {
		const scale = createLinearScale(0, 100, 500, 0);

		expect(scale(0)).toBe(500);
		expect(scale(50)).toBe(250);
		expect(scale(100)).toBe(0);
	});

	it("handles negative domains", () => {
		const scale = createLinearScale(-50, 50, 0, 100);

		expect(scale(-50)).toBe(0);
		expect(scale(0)).toBe(50);
		expect(scale(50)).toBe(100);
	});

	it("handles degenerate domain (min === max)", () => {
		const scale = createLinearScale(50, 50, 0, 100);

		// Should return center of range for any input
		expect(scale(50)).toBe(50);
		expect(scale(0)).toBe(50);
		expect(scale(100)).toBe(50);
	});

	it("extrapolates outside domain", () => {
		const scale = createLinearScale(0, 100, 0, 500);

		expect(scale(-20)).toBe(-100);
		expect(scale(120)).toBe(600);
	});
});

// ============================================================================
// createInverseLinearScale
// ============================================================================

describe("createInverseLinearScale", () => {
	it("inverts linear scale correctly", () => {
		const scale = createLinearScale(0, 100, 0, 500);
		const inverse = createInverseLinearScale(0, 100, 0, 500);

		expect(inverse(scale(25))).toBeCloseTo(25);
		expect(inverse(scale(75))).toBeCloseTo(75);
	});

	it("maps range to domain", () => {
		const inverse = createInverseLinearScale(0, 100, 0, 500);

		expect(inverse(0)).toBe(0);
		expect(inverse(250)).toBe(50);
		expect(inverse(500)).toBe(100);
	});

	it("handles degenerate range (min === max)", () => {
		const inverse = createInverseLinearScale(0, 100, 50, 50);

		// Should return center of domain for any input
		expect(inverse(50)).toBe(50);
		expect(inverse(0)).toBe(50);
		expect(inverse(100)).toBe(50);
	});
});

// ============================================================================
// extractCategories
// ============================================================================

describe("extractCategories", () => {
	it("returns empty array for no points", () => {
		expect(extractCategories([])).toEqual([]);
	});

	it("returns empty array when all points have null category", () => {
		const points = [mockPoint(1, 1, null), mockPoint(2, 2, null)];
		expect(extractCategories(points)).toEqual([]);
	});

	it("extracts unique categories", () => {
		const points = [
			mockPoint(1, 1, "A"),
			mockPoint(2, 2, "B"),
			mockPoint(3, 3, "A"),
			mockPoint(4, 4, "C"),
		];
		expect(extractCategories(points)).toEqual(["A", "B", "C"]);
	});

	it("preserves insertion order", () => {
		const points = [
			mockPoint(1, 1, "C"),
			mockPoint(2, 2, "A"),
			mockPoint(3, 3, "B"),
		];
		expect(extractCategories(points)).toEqual(["C", "A", "B"]);
	});

	it("filters out null categories", () => {
		const points = [
			mockPoint(1, 1, "A"),
			mockPoint(2, 2, null),
			mockPoint(3, 3, "B"),
			mockPoint(4, 4, null),
		];
		expect(extractCategories(points)).toEqual(["A", "B"]);
	});
});

// ============================================================================
// Type Guards
// ============================================================================

describe("isScatterPoint", () => {
	it("returns true for valid ScatterPoint", () => {
		const point = mockPoint(1, 2);
		expect(isScatterPoint(point)).toBe(true);
	});

	it("returns false for SkippedEntry", () => {
		const skipped: SkippedEntry = {
			file: mockFile("test.md"),
			reason: "Missing value",
		};
		expect(isScatterPoint(skipped)).toBe(false);
	});
});

describe("isSkippedEntry", () => {
	it("returns true for SkippedEntry", () => {
		const skipped: SkippedEntry = {
			file: mockFile("test.md"),
			reason: "Missing value",
		};
		expect(isSkippedEntry(skipped)).toBe(true);
	});

	it("returns false for ScatterPoint", () => {
		const point = mockPoint(1, 2);
		expect(isSkippedEntry(point)).toBe(false);
	});
});

// ============================================================================
// flattenGroupedData
// ============================================================================

describe("flattenGroupedData", () => {
	it("returns empty array for empty groups", () => {
		expect(flattenGroupedData([])).toEqual([]);
	});

	it("flattens single group", () => {
		const entry1 = { file: mockFile("a.md") } as any;
		const entry2 = { file: mockFile("b.md") } as any;
		const grouped = [{ entries: [entry1, entry2] }];

		const result = flattenGroupedData(grouped);
		expect(result).toHaveLength(2);
		expect(result[0]).toBe(entry1);
		expect(result[1]).toBe(entry2);
	});

	it("flattens multiple groups", () => {
		const entry1 = { file: mockFile("a.md") } as any;
		const entry2 = { file: mockFile("b.md") } as any;
		const entry3 = { file: mockFile("c.md") } as any;
		const grouped = [{ entries: [entry1] }, { entries: [entry2, entry3] }];

		const result = flattenGroupedData(grouped);
		expect(result).toHaveLength(3);
		expect(result).toEqual([entry1, entry2, entry3]);
	});

	it("handles groups with empty entries", () => {
		const entry1 = { file: mockFile("a.md") } as any;
		const grouped = [
			{ entries: [] },
			{ entries: [entry1] },
			{ entries: [] },
		];

		const result = flattenGroupedData(grouped);
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(entry1);
	});
});
