import type { ReactNode } from "react";
import { resolveThemeMode } from "@rituvia/ui";

import { RuntimeConfigurationProvider } from "../config/client-provider";
import { getWebRuntimeConfiguration } from "../config/server";
import { defaultLocale, getTextDirection } from "./_i18n/routing";

import "@rituvia/ui/styles";
import "./styles.css";

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  const { client } = getWebRuntimeConfiguration();

  return (
    <html
      data-theme={resolveThemeMode(undefined)}
      dir={getTextDirection(defaultLocale)}
      lang={defaultLocale}
    >
      <body data-brand={client.brand.name}>
        <RuntimeConfigurationProvider configuration={client}>
          {children}
        </RuntimeConfigurationProvider>
      </body>
    </html>
  );
}
