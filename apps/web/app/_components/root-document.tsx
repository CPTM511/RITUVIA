import { resolveThemeMode } from "@rituvia/ui";
import type { ReactNode } from "react";

import { RuntimeConfigurationProvider } from "../../config/client-provider";
import { getWebRuntimeConfiguration } from "../../config/server";
import type { GoldenShellLocale } from "../_i18n/golden-shell-messages";
import { getTextDirection } from "../_i18n/routing";

type RootDocumentProps = Readonly<{
  children: ReactNode;
  locale: GoldenShellLocale;
}>;

export function RootDocument({ children, locale }: RootDocumentProps) {
  const { client } = getWebRuntimeConfiguration();
  return (
    <html data-theme={resolveThemeMode(undefined)} dir={getTextDirection(locale)} lang={locale}>
      <body data-brand={client.brand.name}>
        <RuntimeConfigurationProvider configuration={client}>
          {children}
        </RuntimeConfigurationProvider>
      </body>
    </html>
  );
}
