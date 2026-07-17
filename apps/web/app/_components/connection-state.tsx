"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const subscribeToConnection = (onStoreChange: () => void): (() => void) => {
  window.addEventListener("offline", onStoreChange);
  window.addEventListener("online", onStoreChange);
  return () => {
    window.removeEventListener("offline", onStoreChange);
    window.removeEventListener("online", onStoreChange);
  };
};

const getConnectionSnapshot = (): boolean => navigator.onLine;
const getServerConnectionSnapshot = (): true => true;

export const useConnectionStatus = (): boolean =>
  useSyncExternalStore(subscribeToConnection, getConnectionSnapshot, getServerConnectionSnapshot);

export const useConnectionAnnouncement = (
  isOnline: boolean,
  offlineAnnouncement: string,
  onlineAnnouncement: string,
): string => {
  const previousConnection = useRef(isOnline);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (previousConnection.current === isOnline) return;
    previousConnection.current = isOnline;
    setAnnouncement(isOnline ? onlineAnnouncement : offlineAnnouncement);
  }, [isOnline, offlineAnnouncement, onlineAnnouncement]);

  return announcement;
};

export function ConnectionAnnouncement({ announcement }: Readonly<{ announcement: string }>) {
  return (
    <p
      aria-atomic="true"
      aria-live="polite"
      className="visually-hidden"
      data-connection-announcement=""
      role="status"
    >
      {announcement}
    </p>
  );
}
