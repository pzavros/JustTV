import { adapter } from './state.js';

/**
 * Shared native-operation error reporting.
 */
export function recordReadResult(name, ok, value) {
  adapter.report.reads[name] = { ok: ok, detail: value || null };
}

export function recordReadFailure(name, e) {
  recordReadResult(name, false, (e && e.name) || String(e));
}

export function readSafely(name, fn) {
  try {
    return fn();
  } catch (e) {
    recordReadFailure(name, e);
    return null;
  }
}
