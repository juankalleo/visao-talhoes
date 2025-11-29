import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Ensure TypeScript emitted helper used by some transpiled libs is defined at runtime.
// Some bundles/transpiled files call "__publicField(this, 'x', value)" — define fallback.
if (typeof (globalThis as any).__publicField !== 'function') {
  (globalThis as any).__publicField = function (obj: any, prop: string, value: any) {
    Object.defineProperty(obj, prop, {
      configurable: true,
      enumerable: true,
      writable: true,
      value
    });
    return value;
  };
}

createRoot(document.getElementById("root")!).render(<App />);
