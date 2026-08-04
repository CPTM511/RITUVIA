import type { ReactNode } from "react";

import "./recovery/recovery.css";

export default function RecoveryRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html data-theme="dark" dir="ltr" lang="en">
      <body>{children}</body>
    </html>
  );
}
