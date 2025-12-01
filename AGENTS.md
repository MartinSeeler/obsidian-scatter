# Obsidian Scatter – Agent Context

This document provides project-specific context for AI coding agents, followed by general Obsidian plugin development guidelines.

---

## Project Summary

**Obsidian Scatter** is a scatter plot view plugin for Obsidian Bases. It plots notes as points on a 2D chart using numeric properties, enabling visual pattern discovery and prioritization.

- **Plugin ID:** `obsidian-scatter`
- **Entry point:** `src/main.ts` → compiled to `main.js`
- **View type:** Extends `BasesView` to add a scatter plot layout option
- **Required Obsidian version:** 1.10.0+ (Bases View API)

---

## Architecture

### Module Responsibilities

| Module | Responsibility | Purity |
|--------|---------------|--------|
| `types.ts` | Type definitions, constants | Pure (no runtime code) |
| `data.ts` | Extract values, transform points, calculate bounds | Pure functions |
| `render.ts` | Create SVG elements | Pure functions (create new elements) |
| `interactions.ts` | Event handling factories | Returns cleanup functions |
| `scatter-view.ts` | Orchestration, lifecycle | Stateful (required by API) |
| `main.ts` | Plugin registration | Side effects only |

### Data Flow

```
Bases API
    │
    ▼
this.data.groupedData (reactive, replaced on change)
    │
    ▼
flattenGroupedData() → BasesEntry[]
    │
    ▼
extractDataFromEntries() → { points, skipped, categories }
    │
    ▼
calculatePlotBounds() → { x: {min, max}, y: {min, max} }
    │
    ▼
transformPointsToScreen() → RenderedPoint[] (with screenX, screenY, color)
    │
    ▼
createChartSvg() → SVGSVGElement
    │
    ▼
attachPointEvents() → cleanup function
    │
    ▼
DOM (containerEl)
```

### Re-rendering Strategy

- **Current:** Clear container, rebuild everything on `onDataUpdated()`
- **Future:** Diff points, reuse/move existing circles, animate transitions

---

## Key Design Decisions

### Missing Data Handling

**Decision:** Skip entries missing X or Y values. Show count of skipped entries.

**Rationale:** Skipping is the least surprising behavior. Alternatives like defaulting to 0 create false clusters at the origin. The warning count helps users understand what's happening without cluttering the visualization.

### Axis Scaling

**Decision:** Linear scaling, auto-fit to data with 5% padding.

**Rationale:** Auto-fit maximizes visual spread of points. Including zero would waste space when data is clustered in a narrow range. Log scale is a future option for wide-range data.

### Axis Orientation

**Decision:** Small values bottom-left, large values top-right. Standard Cartesian convention.

**Rationale:** Users can create formula properties to invert values if needed. Axis inversion toggle deferred to future versions.

### Point Rendering

**Decision:** Fixed 8px radius, 0.7 opacity, CSS hover transitions.

**Rationale:** Fixed radius keeps MVP simple. Opacity handles overlapping points gracefully. Size-by-property is a future enhancement.

### Color Coding

**Decision:** Optional categorical coloring using Obsidian CSS variables (`--color-blue`, etc.). Cycles through 8 colors. Fallback to muted color for missing categories.

**Rationale:** Theme compatibility out of the box. Color adds information without requiring a third numeric property.

### Rendering Technology

**Decision:** Vanilla SVG with DOM manipulation. No D3 or other chart library.

**Rationale:** SVG is the right fit for up to ~1000 points. Native event handling per element. Keeps bundle small. D3 would add 70KB+ for features we don't need.

### Configuration UI

**Decision:** Use Bases `ViewOption` system for X/Y/Color property selection.

**Rationale:** Integrates with existing "Configure view" menu. Persists to `.base` file automatically.

---

## Performance Targets

| Points | Target Render Time |
|--------|-------------------|
| 100 | instant (<16ms) |
| 500 | smooth (<50ms) |
| 1000 | acceptable (<100ms) |
| 5000+ | consider Canvas or virtualization |

---

## Testing Approach

### Unit Tests

- `data.ts` and `render.ts` contain pure functions → easy to unit test
- Run with `npm test` (uses Vitest)
- Tests live alongside source files: `data.test.ts`, `render.test.ts`

### Manual Testing Checklist

1. Create Base with various filters
2. Test with 0, 1, 10, 100, 500 notes
3. Test with missing properties, non-numeric values
4. Test resize behavior (sidebar, split, full width)
5. Test theme compatibility (light, dark, custom)
6. Test click/hover on overlapping points

---

## Common Development Tasks

### Adding a new view option

1. Add the option to `VIEW_OPTIONS` array in `scatter-view.ts`
2. Read the value from `this.config` in the view
3. Pass it through the data flow to where it's needed

### Changing point styling

1. CSS variables are defined in `styles.css`
2. Point elements are created in `render.ts` → `createPointElement()`
3. Hover effects are in `interactions.ts`

### Modifying data extraction

1. All data extraction happens in `data.ts`
2. Functions are pure: input data, output transformed data
3. Write tests first in `data.test.ts`

### Changing SVG rendering

1. Axis and grid rendering is in `render.ts`
2. Functions return SVG elements, don't mutate external state
3. Constants like padding, margins are at the top of the file

---

## API Constraints

### Obsidian API

- Must extend `BasesView` class
- Must implement `onDataUpdated()` method
- Configuration via `ViewOption[]` in registration
- Access to `this.app`, `this.data`, `this.config`
- Cleanup via `this.register()` for resources

### Browser Support

Obsidian uses Chromium (Electron), so modern JS/CSS is fine:

- ES2022 target
- CSS variables
- SVG 2.0 features
- ResizeObserver

---

## Property Types

The plugin accepts any property that can be parsed as a number:

- Note properties: `property.effort`
- File properties: `file.size`
- Formula properties: `formula.computed_score`

Non-numeric values are skipped. The count of skipped notes is shown in the corner.

---

# Obsidian Community Plugin (General Guidelines)

## Project overview

- Target: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- Entry point: `main.ts` compiled to `main.js` and loaded by Obsidian.
- Required release artifacts: `main.js`, `manifest.json`, and optional `styles.css`.

## Environment & tooling

- Node.js: use current LTS (Node 18+ recommended).
- **Package manager: npm** (required for this sample - `package.json` defines npm scripts and dependencies).
- **Bundler: esbuild** (required for this sample - `esbuild.config.mjs` and build scripts depend on it). Alternative bundlers like Rollup or webpack are acceptable for other projects if they bundle all external dependencies into `main.js`.
- Types: `obsidian` type definitions.

**Note**: This sample project has specific technical dependencies on npm and esbuild. If you're creating a plugin from scratch, you can choose different tools, but you'll need to replace the build configuration accordingly.

### Install

```bash
npm install
```

### Dev (watch)

```bash
npm run dev
```

### Production build

```bash
npm run build
```

## Linting

- To use eslint install eslint from terminal: `npm install -g eslint`
- To use eslint to analyze this project use this command: `eslint main.ts`
- eslint will then create a report with suggestions for code improvement by file and line number.
- If your source code is in a folder, such as `src`, you can use eslint with this command to analyze all files in that folder: `eslint ./src/`

## File & folder conventions

- **Organize code into multiple files**: Split functionality across separate modules rather than putting everything in `main.ts`.
- Source lives in `src/`. Keep `main.ts` small and focused on plugin lifecycle (loading, unloading, registering commands).
- **Example file structure**:
  ```
  src/
    main.ts           # Plugin entry point, lifecycle management
    settings.ts       # Settings interface and defaults
    commands/         # Command implementations
      command1.ts
      command2.ts
    ui/              # UI components, modals, views
      modal.ts
      view.ts
    utils/           # Utility functions, helpers
      helpers.ts
      constants.ts
    types.ts         # TypeScript interfaces and types
  ```
- **Do not commit build artifacts**: Never commit `node_modules/`, `main.js`, or other generated files to version control.
- Keep the plugin small. Avoid large dependencies. Prefer browser-compatible packages.
- Generated output should be placed at the plugin root or `dist/` depending on your build setup. Release artifacts must end up at the top level of the plugin folder in the vault (`main.js`, `manifest.json`, `styles.css`).

## Manifest rules (`manifest.json`)

- Must include (non-exhaustive):  
  - `id` (plugin ID; for local dev it should match the folder name)  
  - `name`  
  - `version` (Semantic Versioning `x.y.z`)  
  - `minAppVersion`  
  - `description`  
  - `isDesktopOnly` (boolean)  
  - Optional: `author`, `authorUrl`, `fundingUrl` (string or map)
- Never change `id` after release. Treat it as stable API.
- Keep `minAppVersion` accurate when using newer APIs.
- Canonical requirements are coded here: https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml

## Testing

- Manual install for testing: copy `main.js`, `manifest.json`, `styles.css` (if any) to:
  ```
  <Vault>/.obsidian/plugins/<plugin-id>/
  ```
- Reload Obsidian and enable the plugin in **Settings → Community plugins**.

## Commands & settings

- Any user-facing commands should be added via `this.addCommand(...)`.
- If the plugin has configuration, provide a settings tab and sensible defaults.
- Persist settings using `this.loadData()` / `this.saveData()`.
- Use stable command IDs; avoid renaming once released.

## Versioning & releases

- Bump `version` in `manifest.json` (SemVer) and update `versions.json` to map plugin version → minimum app version.
- Create a GitHub release whose tag exactly matches `manifest.json`'s `version`. Do not use a leading `v`.
- Attach `manifest.json`, `main.js`, and `styles.css` (if present) to the release as individual assets.
- After the initial release, follow the process to add/update your plugin in the community catalog as required.

## Security, privacy, and compliance

Follow Obsidian's **Developer Policies** and **Plugin Guidelines**. In particular:

- Default to local/offline operation. Only make network requests when essential to the feature.
- No hidden telemetry. If you collect optional analytics or call third-party services, require explicit opt-in and document clearly in `README.md` and in settings.
- Never execute remote code, fetch and eval scripts, or auto-update plugin code outside of normal releases.
- Minimize scope: read/write only what's necessary inside the vault. Do not access files outside the vault.
- Clearly disclose any external services used, data sent, and risks.
- Respect user privacy. Do not collect vault contents, filenames, or personal information unless absolutely necessary and explicitly consented.
- Avoid deceptive patterns, ads, or spammy notifications.
- Register and clean up all DOM, app, and interval listeners using the provided `register*` helpers so the plugin unloads safely.

## UX & copy guidelines (for UI text, commands, settings)

- Prefer sentence case for headings, buttons, and titles.
- Use clear, action-oriented imperatives in step-by-step copy.
- Use **bold** to indicate literal UI labels. Prefer "select" for interactions.
- Use arrow notation for navigation: **Settings → Community plugins**.
- Keep in-app strings short, consistent, and free of jargon.

## Performance

- Keep startup light. Defer heavy work until needed.
- Avoid long-running tasks during `onload`; use lazy initialization.
- Batch disk access and avoid excessive vault scans.
- Debounce/throttle expensive operations in response to file system events.

## Coding conventions

- TypeScript with `"strict": true` preferred.
- **Keep `main.ts` minimal**: Focus only on plugin lifecycle (onload, onunload, addCommand calls). Delegate all feature logic to separate modules.
- **Split large files**: If any file exceeds ~200-300 lines, consider breaking it into smaller, focused modules.
- **Use clear module boundaries**: Each file should have a single, well-defined responsibility.
- Bundle everything into `main.js` (no unbundled runtime deps).
- Avoid Node/Electron APIs if you want mobile compatibility; set `isDesktopOnly` accordingly.
- Prefer `async/await` over promise chains; handle errors gracefully.

## Mobile

- Where feasible, test on iOS and Android.
- Don't assume desktop-only behavior unless `isDesktopOnly` is `true`.
- Avoid large in-memory structures; be mindful of memory and storage constraints.

## Agent do/don't

**Do**
- Add commands with stable IDs (don't rename once released).
- Provide defaults and validation in settings.
- Write idempotent code paths so reload/unload doesn't leak listeners or intervals.
- Use `this.register*` helpers for everything that needs cleanup.

**Don't**
- Introduce network calls without an obvious user-facing reason and documentation.
- Ship features that require cloud services without clear disclosure and explicit opt-in.
- Store or transmit vault contents unless essential and consented.

## Common tasks

### Organize code across multiple files

**main.ts** (minimal, lifecycle only):
```ts
import { Plugin } from "obsidian";
import { MySettings, DEFAULT_SETTINGS } from "./settings";
import { registerCommands } from "./commands";

export default class MyPlugin extends Plugin {
  settings: MySettings;

  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    registerCommands(this);
  }
}
```

**settings.ts**:
```ts
export interface MySettings {
  enabled: boolean;
  apiKey: string;
}

export const DEFAULT_SETTINGS: MySettings = {
  enabled: true,
  apiKey: "",
};
```

**commands/index.ts**:
```ts
import { Plugin } from "obsidian";
import { doSomething } from "./my-command";

export function registerCommands(plugin: Plugin) {
  plugin.addCommand({
    id: "do-something",
    name: "Do something",
    callback: () => doSomething(plugin),
  });
}
```

### Add a command

```ts
this.addCommand({
  id: "your-command-id",
  name: "Do the thing",
  callback: () => this.doTheThing(),
});
```

### Persist settings

```ts
interface MySettings { enabled: boolean }
const DEFAULT_SETTINGS: MySettings = { enabled: true };

async onload() {
  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  await this.saveData(this.settings);
}
```

### Register listeners safely

```ts
this.registerEvent(this.app.workspace.on("file-open", f => { /* ... */ }));
this.registerDomEvent(window, "resize", () => { /* ... */ });
this.registerInterval(window.setInterval(() => { /* ... */ }, 1000));
```

## Troubleshooting

- Plugin doesn't load after build: ensure `main.js` and `manifest.json` are at the top level of the plugin folder under `<Vault>/.obsidian/plugins/<plugin-id>/`. 
- Build issues: if `main.js` is missing, run `npm run build` or `npm run dev` to compile your TypeScript source code.
- Commands not appearing: verify `addCommand` runs after `onload` and IDs are unique.
- Settings not persisting: ensure `loadData`/`saveData` are awaited and you re-render the UI after changes.
- Mobile-only issues: confirm you're not using desktop-only APIs; check `isDesktopOnly` and adjust.

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide
