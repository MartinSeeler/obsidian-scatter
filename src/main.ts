/**
 * Obsidian Bases Scatter Plot Plugin
 *
 * Adds a scatter plot view type to Obsidian Bases for visualizing
 * notes along two numeric property axes.
 */

import { Plugin } from "obsidian";
import { ScatterPlotView, SCATTER_VIEW_TYPE } from "./scatter-view";

export default class ScatterPlotPlugin extends Plugin {
  onload(): void {
    console.debug("Loading Scatter Plot plugin");

    this.registerBasesView(SCATTER_VIEW_TYPE, {
      name: "Scatter Plot",
      icon: "lucide-scatter-chart",

      factory: (controller, containerEl) => {
        return new ScatterPlotView(controller, containerEl);
      },

      options: () => [
        {
          type: "property",
          key: "xAxis",
          displayName: "X axis",
          // Note: The 'property' type may need to be verified against
          // the actual ViewOption types available in the API.
          // If 'property' isn't available, fall back to 'text'.
        },
        {
          type: "property",
          key: "yAxis",
          displayName: "Y axis",
        },
        {
          type: "property",
          key: "colorBy",
          displayName: "Color by (optional)",
        },
        // Future options:
        // {
        //   type: "property",
        //   key: "sizeBy",
        //   displayName: "Size by (optional)",
        // },
        // {
        //   type: "toggle",
        //   key: "showGrid",
        //   displayName: "Show grid lines",
        //   default: true,
        // },
        // {
        //   type: "slider",
        //   key: "pointRadius",
        //   displayName: "Point size",
        //   default: 8,
        //   min: 4,
        //   max: 20,
        // },
      ],
    });
  }

  onunload(): void {
    console.debug("Unloading Scatter Plot plugin");
  }
}
