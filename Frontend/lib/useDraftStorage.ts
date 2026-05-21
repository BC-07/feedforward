import { useEffect, useState } from "react";

type UseDraftStorageOptions<T> = {
  isEmpty?: (value: T) => boolean;
};

const defaultIsEmpty = <T,>(value: T) => {
  if (typeof value !== "object" || value === null) return !value;
  return Object.values(value as Record<string, string>).every(
    (field) => String(field).trim() === "",
  );
};

export function useDraftStorage<T>(
  key: string,
  initialValue: T,
  options: UseDraftStorageOptions<T> = {},
) {
  const isEmpty = options.isEmpty ?? defaultIsEmpty;
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(key);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as Partial<T>;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue((current) => ({ ...current, ...parsed }));
    } catch {
      // Ignore corrupted drafts
    }
  }, [key]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isEmpty(value)) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value, isEmpty]);

  const clear = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(key);
    }
    setValue(initialValue);
  };

  return { value, setValue, clear } as const;
}
