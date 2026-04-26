# Solid Lite

A minimalist, high-performance reactive UI library inspired by SolidJS, designed for zero-dependency usage and native performance.

## Features

- **Fine-grained reactivity**: Only updates exactly what needs to change.
- **Zero dependencies**: Pure JavaScript/TypeScript.
- **Native performance**: Leverages modern DOM APIs.
- **Lightweight**: Optimized for small bundles and CDN delivery.
- **Deno & JSR Native**: Fully compatible with the modern JavaScript ecosystem.

## Installation

### From JSR
```bash
deno add @carlos/solid-lite
# or
npx jsr add @carlos/solid-lite
```

### Via CDN
```html
<script type="module">
  import { createSignal, render, h } from "https://jsr.io/@carlos/solid-lite/1.0.0/solid-lite.js";
  
  function Counter() {
    const [count, setCount] = createSignal(0);
    return h("button", { 
      onClick: () => setCount(count() + 1) 
    }, () => `Count: ${count()}`);
  }

  render(Counter, document.body);
</script>
```

## Usage

```javascript
import { createSignal, createEffect, render, h } from "@carlos/solid-lite";

function App() {
  const [count, setCount] = createSignal(0);

  createEffect(() => {
    console.log("Count changed to:", count());
  });

  return h("div", null, [
    h("h1", null, "Hello Solid Lite"),
    h("button", { onClick: () => setCount(c => c + 1) }, "Increment")
  ]);
}

render(App, document.getElementById("app"));
```

## License

MIT
