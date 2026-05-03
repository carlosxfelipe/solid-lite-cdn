# Solid Lite

[![JSR](https://jsr.io/badges/@carlosxfelipe/solid-lite)](https://jsr.io/@carlosxfelipe/solid-lite)

A minimalist implementation of the SolidJS reactivity engine running natively on
Deno, featuring granular reactivity using the real DOM without a complex
compiler.

## Features

- **Fine-grained reactivity**: Uses signals and effects for surgical updates to
  the real DOM.
- **JSX Runtime**: Interface processing via a HyperScript (h) function at
  runtime.

- **No Virtual DOM**: Unlike React, changes are applied directly to browser
  nodes.
- **Zero dependencies**: Pure JavaScript/TypeScript without external bloat.
- **Deno & JSR Native**: Fully compatible with the modern JavaScript ecosystem.
- **Lightweight**: Optimized for small bundles and fast CDN delivery.

## Installation

### From JSR

```bash
deno add @carlosxfelipe/solid-lite
# or
npx jsr add @carlosxfelipe/solid-lite
```

### Via CDN

```html
<script type="module">
  import {
    createSignal,
    h,
    render,
  } from "https://esm.sh/jsr/@carlosxfelipe/solid-lite@1.0.4";

  function Counter() {
    const [count, setCount] = createSignal(0);
    return h("button", {
      onClick: () => setCount(count() + 1),
    }, () => `Count: ${count()}`);
  }

  render(h(Counter), document.body);
</script>
```

## Usage

```javascript
import {
  createEffect,
  createSignal,
  h,
  render,
} from "@carlosxfelipe/solid-lite";

function App() {
  const [count, setCount] = createSignal(0);

  createEffect(() => {
    console.log("Count changed to:", count());
  });

  return h("div", null, [
    h("h1", null, "Hello Solid Lite"),
    h("button", { onClick: () => setCount((c) => c + 1) }, "Increment"),
  ]);
}

render(h(App), document.getElementById("app"));
```

## Development / CDN Build

The core framework used to generate this CDN package is developed at:  
[https://github.com/carlosxfelipe/solid-lite](https://github.com/carlosxfelipe/solid-lite)

To build the CDN files (ESM development and minified production versions), use the following Deno task:

```bash
deno task build:cdn
```

This command executes `scripts/build_cdn.ts` and outputs the compiled files into the `dist/` directory:
- `dist/solid-lite.js` (ESM development)
- `dist/solid-lite.min.js` (ESM production)

## Differences with SolidJS

Although inspired by SolidJS, **Solid Lite** is a pure runtime implementation with no compilation step. This leads to key syntax differences:

| Aspect | Solid Lite | SolidJS |
| --- | --- | --- |
| **Signal in JSX** | Pass the getter: `h("div", null, count)` | Call the getter: `<div>{count()}</div>` |
| **Compiler** | **None** (Pure JavaScript) | Required (Babel/Vite plugin) |
| **Reading Signals** | Pass function reference for reactivity | Compiler rewrites calls to be reactive |
| **Reactivity** | Functions are tracked by the runtime | Values are tracked via compiler magic |

> ⚠️ **Important:** When using Solid Lite, pass your signals as function references (e.g., `count`) to the `h()` function. Calling them (e.g., `count()`) will evaluate the value immediately and you will lose reactivity.

### Comparison Table

| Feature | solid-lite | SolidJS |
| --- | --- | --- |
| Signal in JSX | `count` (getter) | `count()` |
| `<Show when>` | `when={fn}` | `when={fn()}` |
| `<For each>` | `each={fn}` | `each={fn()}` |
| Style Object | Supports nested signals | Requires called signals |
| Mount | `createRoot` + `render` | `render(() => ..., el)` |
| Directives | Not supported | Supported |


---

## Important Note

**SolidJS** is a trademark of its respective owners.

This project, **Solid Lite**, is an independent, minimalist, and **strictly
experimental** implementation of a reactive runtime inspired by the principles
of SolidJS. It was created solely for educational purposes to demonstrate how
fine-grained reactivity and Single Page Application (SPA) architectures can be
built using the native DOM on Deno.

**Solid Lite has no commercial or business objectives.** It is a study of
architectural concepts and a hobbyist experiment in building lean web runtimes.

## License

MIT
