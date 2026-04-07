"use client";

import { useEffect, useState } from "react";

type Updater<T> = T | ((prev: T) => T);

export function useDraftStorage<T>(key: string, initialValue: T) {
  const [value, setValueState] = useState<T>(initialValue);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(key);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as T;
      setValueState(parsed);
    } catch {
      localStorage.removeItem(key);
    }
  }, [key]);

  const setValue = (next: Updater<T>) => {
    setValueState((prev) => {
      const resolved = typeof next === "function" ? (next as (current: T) => T)(prev) : next;
      if (typeof window !== "undefined") {
        localStorage.setItem(key, JSON.stringify(resolved));
      }
      return resolved;
    });
  };

  const clear = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(key);
    }
    setValueState(initialValue);
  };

  return { value, setValue, clear };
}
