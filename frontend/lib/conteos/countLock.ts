"use client";

import { useSyncExternalStore } from "react";

/**
 * Mientras una captura está en curso el conteo debe terminarse: la sesión no se
 * puede cerrar desde el shell. La página del conteo prende y apaga este candado.
 */
let locked = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setCountInProgress(next: boolean) {
  if (locked === next) return;
  locked = next;
  listeners.forEach((listener) => listener());
}

export function useCountInProgress() {
  return useSyncExternalStore(
    subscribe,
    () => locked,
    () => false,
  );
}
