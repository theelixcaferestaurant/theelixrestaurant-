import { useSyncExternalStore } from 'react';

// Tiny shared flag so the home page hero knows when the logo intro has finished (or never ran),
// and can start its own entrance animation at exactly that moment.
let done = true;
const listeners = new Set();

export const introStore = {
  set(value) {
    if (done === value) return;
    done = value;
    listeners.forEach((fn) => fn());
  },
  get: () => done,
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useIntroDone() {
  return useSyncExternalStore(introStore.subscribe, introStore.get, () => true);
}
