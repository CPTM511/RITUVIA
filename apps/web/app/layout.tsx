import type { ReactNode } from "react";

import { RuntimeConfigurationProvider } from "../config/client-provider";
import { getWebRuntimeConfiguration } from "../config/server";

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  const { client } = getWebRuntimeConfiguration();

  return (
    <html lang="en">
      <body data-brand={client.brand.name}>
        <RuntimeConfigurationProvider configuration={client}>
          {children}
        </RuntimeConfigurationProvider>
      </body>
    </html>
  );
}
