"use client";

import { useSyncExternalStore } from "react";

const subscribe = (): (() => void) => () => {};
const serverSnapshot = (): null => null;

const tomorrowLocalDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const useTomorrowLocalDate = (): string | null =>
  useSyncExternalStore(subscribe, tomorrowLocalDate, serverSnapshot);
