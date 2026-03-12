/**
 * Ensures ghostty-web WASM is initialized exactly once before any Terminal is created.
 */
import { init } from 'ghostty-web';

let initPromise: Promise<void> | undefined;

export function ensureGhosttyInit(): Promise<void> {
  initPromise ??= init();
  return initPromise;
}
