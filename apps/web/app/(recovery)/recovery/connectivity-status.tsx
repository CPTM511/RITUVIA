"use client";

import { useEffect, useState } from "react";

import { recoveryStagingMessages as messages } from "../../_i18n/recovery-staging-messages";

export function ConnectivityStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("offline", update);
    window.addEventListener("online", update);
    return () => {
      window.removeEventListener("offline", update);
      window.removeEventListener("online", update);
    };
  }, []);

  return (
    <p aria-live="polite" className={online ? "connectivity online" : "connectivity offline"}>
      {online ? messages.online : messages.offline}
    </p>
  );
}
