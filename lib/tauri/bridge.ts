/**
 * Browser-side Tauri detection + lazy invoke.
 *
 * Inside the Tauri webview, `window.__TAURI__` is defined and we
 * can call native commands via `@tauri-apps/api`. Outside (regular
 * web), the bridge is null and callers fall back to web APIs.
 *
 * We intentionally don't `import` from `@tauri-apps/api` at the top
 * of any module — it's missing in the regular web bundle. Use
 * `loadTauriBridge()` from a "use client" component and gate on the
 * returned non-null value.
 */

export interface TauriBridge {
  invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  channel<T = unknown>(): TauriChannel<T>;
}

export interface TauriChannel<T> {
  /** Pass to a native command that expects a `Channel<T>`. */
  raw: unknown;
  /** Subscribe to messages emitted by the native command. */
  onMessage: (handler: (data: T) => void) => void;
}

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as Window & { __TAURI__?: unknown }).__TAURI__);
}

let cached: TauriBridge | null | undefined;

/**
 * Returns a Tauri bridge object when running inside the Tauri webview,
 * or null when running in a normal browser. Lazy-imports
 * `@tauri-apps/api` so the regular web bundle never tries to resolve
 * it. Callers must `await` and null-check.
 */
export async function loadTauriBridge(): Promise<TauriBridge | null> {
  if (cached !== undefined) return cached;
  if (!isTauri()) {
    cached = null;
    return null;
  }
  try {
    // The @tauri-apps/api package is only present in the desktop
    // build (we don't list it as a web dep to keep the regular
    // bundle slim). Resolve it through a string variable so the
    // bundler doesn't try to follow the import statically.
    const moduleId = "@tauri-apps/api/core";
    const core = (await import(/* webpackIgnore: true */ moduleId)) as {
      invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
      Channel: new <T>() => {
        onmessage: (data: T) => void;
      };
    };
    cached = {
      async invoke<T>(cmd: string, args?: Record<string, unknown>) {
        return core.invoke<T>(cmd, args);
      },
      channel<T>() {
        const ch = new core.Channel<T>();
        const wrapper: TauriChannel<T> = {
          raw: ch,
          onMessage: (handler) => {
            ch.onmessage = handler;
          },
        };
        return wrapper;
      },
    };
    return cached;
  } catch (err) {
    console.warn(
      "[tauri] Failed to load @tauri-apps/api — falling back to browser APIs",
      err,
    );
    cached = null;
    return null;
  }
}
