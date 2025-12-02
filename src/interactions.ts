/**
 * Interaction handlers for the scatter plot.
 *
 * Handles click-to-open and hover tooltips.
 */

import type { App, HoverParent, HoverPopover } from "obsidian";
import { Keymap } from "obsidian";
import type { RenderedPoint, ScatterPoint } from "./types";
import { DEFAULT_POINT_CONFIG, type PointRenderConfig } from "./render";

// ============================================================================
// Point Lookup
// ============================================================================

/**
 * Creates an index from file paths to rendered points for quick lookup.
 */
export const createPointIndex = (
	points: readonly RenderedPoint[]
): Map<string, RenderedPoint> => {
	const index = new Map<string, RenderedPoint>();
	for (const point of points) {
		index.set(point.file.path, point);
	}
	return index;
};

/**
 * Finds a point from a circle element using its data attribute.
 */
export const findPointFromElement = (
	element: SVGCircleElement,
	pointIndex: Map<string, RenderedPoint>
): RenderedPoint | null => {
	const filePath = element.getAttribute("data-file-path");
	if (filePath === null) return null;
	return pointIndex.get(filePath) ?? null;
};

// ============================================================================
// Click Handler
// ============================================================================

export interface ClickHandlerConfig {
	readonly app: App;
}

/**
 * Creates a click handler that opens the note associated with a point.
 * Respects modifier keys (Cmd/Ctrl for new tab, etc.)
 */
export const createClickHandler = (
	config: ClickHandlerConfig
): ((point: ScatterPoint, event: MouseEvent) => void) => {
	const { app } = config;

	return (point: ScatterPoint, event: MouseEvent): void => {
		// Only handle left and middle click
		if (event.button !== 0 && event.button !== 1) return;

		event.preventDefault();
		event.stopPropagation();

		const path = point.file.path;
		const modEvent = Keymap.isModEvent(event);

		void app.workspace.openLinkText(path, "", modEvent);
	};
};

// ============================================================================
// Hover Handler
// ============================================================================

export interface HoverHandlerConfig {
	readonly app: App;
	readonly hoverParent: HoverParent;
	readonly source: string;
}

/**
 * Creates a hover handler that triggers Obsidian's hover preview.
 */
export const createHoverHandler = (
	config: HoverHandlerConfig
): ((point: ScatterPoint, element: Element, event: MouseEvent) => void) => {
	const { app, hoverParent, source } = config;

	return (point: ScatterPoint, element: Element, event: MouseEvent): void => {
		app.workspace.trigger("hover-link", {
			event,
			source,
			hoverParent,
			targetEl: element,
			linktext: point.file.path,
		});
	};
};

// ============================================================================
// Hover Visual Effects
// ============================================================================

/**
 * Applies hover-in visual effect to a point element.
 */
export const applyHoverEffect = (
	circle: SVGCircleElement,
	config: PointRenderConfig = DEFAULT_POINT_CONFIG
): void => {
	circle.setAttribute("r", String(config.hoverRadius));
	circle.setAttribute("opacity", "1");
};

/**
 * Removes hover visual effect from a point element.
 */
export const removeHoverEffect = (
	circle: SVGCircleElement,
	config: PointRenderConfig = DEFAULT_POINT_CONFIG
): void => {
	circle.setAttribute("r", String(config.radius));
	circle.setAttribute("opacity", String(config.opacity));
};

// ============================================================================
// Tooltip
// ============================================================================

export interface TooltipData {
	readonly label: string;
	readonly x: number;
	readonly y: number;
	readonly xLabel: string;
	readonly yLabel: string;
	readonly category: string | null;
}

/**
 * Creates a tooltip element for a point.
 */
export const createTooltip = (data: TooltipData): HTMLDivElement => {
	const tooltip = document.createElement("div");
	tooltip.className = "scatter-tooltip";
	tooltip.style.cssText = `
    position: absolute;
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    box-shadow: var(--shadow-s);
    z-index: 1000;
    pointer-events: none;
    max-width: 250px;
  `;

	const title = document.createElement("div");
	title.style.cssText = "font-weight: 600; margin-bottom: 4px;";
	title.textContent = data.label;
	tooltip.appendChild(title);

	const formatValue = (v: number): string =>
		v.toLocaleString(undefined, { maximumFractionDigits: 2 });

	const values = document.createElement("div");
	values.style.cssText = "color: var(--text-muted); font-size: 11px;";
	values.innerHTML = `
    <div>${data.xLabel}: ${formatValue(data.x)}</div>
    <div>${data.yLabel}: ${formatValue(data.y)}</div>
    ${data.category ? `<div>Category: ${data.category}</div>` : ""}
  `;
	tooltip.appendChild(values);

	return tooltip;
};

/**
 * Positions a tooltip near an element without overflowing the container.
 */
export const positionTooltip = (
	tooltip: HTMLElement,
	targetRect: DOMRect,
	containerRect: DOMRect
): void => {
	const offset = 12;
	let left = targetRect.right + offset - containerRect.left;
	let top = targetRect.top - containerRect.top;

	// Check if tooltip would overflow right
	const tooltipWidth = tooltip.offsetWidth || 200; // Estimate if not rendered yet
	if (left + tooltipWidth > containerRect.width) {
		left = targetRect.left - tooltipWidth - offset - containerRect.left;
	}

	// Check if tooltip would overflow bottom
	const tooltipHeight = tooltip.offsetHeight || 80;
	if (top + tooltipHeight > containerRect.height) {
		top = containerRect.height - tooltipHeight - offset;
	}

	// Ensure not negative
	left = Math.max(8, left);
	top = Math.max(8, top);

	tooltip.style.left = `${left}px`;
	tooltip.style.top = `${top}px`;
};

// ============================================================================
// Event Attachment
// ============================================================================

export interface EventAttachmentConfig {
	readonly app: App;
	readonly hoverParent: HoverParent;
	readonly containerEl: HTMLElement;
	readonly pointIndex: Map<string, RenderedPoint>;
	readonly xLabel: string;
	readonly yLabel: string;
	readonly pointConfig: PointRenderConfig;
}

/**
 * Attaches all event listeners to point elements in the SVG.
 * Returns a cleanup function to remove all listeners.
 */
export const attachPointEvents = (
	svg: SVGSVGElement,
	config: EventAttachmentConfig
): (() => void) => {
	const {
		app,
		hoverParent,
		containerEl,
		pointIndex,
		xLabel,
		yLabel,
		pointConfig,
	} = config;

	const clickHandler = createClickHandler({ app });
	const hoverHandler = createHoverHandler({
		app,
		hoverParent,
		source: "scatter-plot",
	});

	let activeTooltip: HTMLElement | null = null;

	const handleMouseEnter = (event: MouseEvent): void => {
		const target = event.target as SVGCircleElement;
		if (!target.classList.contains("scatter-point")) return;

		const point = findPointFromElement(target, pointIndex);
		if (point === null) return;

		// Visual effect
		applyHoverEffect(target, pointConfig);

		// Trigger hover preview
		hoverHandler(point, target, event);

		// Show tooltip
		if (activeTooltip) {
			activeTooltip.remove();
		}

		activeTooltip = createTooltip({
			label: point.label,
			x: point.x,
			y: point.y,
			xLabel,
			yLabel,
			category: point.category,
		});
		containerEl.appendChild(activeTooltip);

		const targetRect = target.getBoundingClientRect();
		const containerRect = containerEl.getBoundingClientRect();
		positionTooltip(activeTooltip, targetRect, containerRect);
	};

	const handleMouseLeave = (event: MouseEvent): void => {
		const target = event.target as SVGCircleElement;
		if (!target.classList.contains("scatter-point")) return;

		// Remove visual effect
		removeHoverEffect(target, pointConfig);

		// Remove tooltip
		if (activeTooltip) {
			activeTooltip.remove();
			activeTooltip = null;
		}
	};

	const handleClick = (event: MouseEvent): void => {
		const target = event.target as SVGCircleElement;
		if (!target.classList.contains("scatter-point")) return;

		const point = findPointFromElement(target, pointIndex);
		if (point === null) return;

		clickHandler(point, event);
	};

	// Attach listeners to the SVG (event delegation)
	svg.addEventListener("mouseenter", handleMouseEnter, true);
	svg.addEventListener("mouseleave", handleMouseLeave, true);
	svg.addEventListener("click", handleClick);

	// Return cleanup function
	return (): void => {
		svg.removeEventListener("mouseenter", handleMouseEnter, true);
		svg.removeEventListener("mouseleave", handleMouseLeave, true);
		svg.removeEventListener("click", handleClick);

		if (activeTooltip) {
			activeTooltip.remove();
			activeTooltip = null;
		}
	};
};
