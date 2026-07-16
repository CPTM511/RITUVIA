import type { ReactNode } from "react";

import { RuntimeConfigurationProvider } from "../config/client-provider";
import { getWebRuntimeConfiguration } from "../config/server";
import { defaultLocale, getTextDirection } from "./_i18n/routing";

import "./styles.css";

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  const { client } = getWebRuntimeConfiguration();

  return (
    <html dir={getTextDirection(defaultLocale)} lang={defaultLocale}>
      <body data-brand={client.brand.name}>
        <RuntimeConfigurationProvider configuration={client}>
          {children}
        </RuntimeConfigurationProvider>
      </body>
    </html>
  );
}
