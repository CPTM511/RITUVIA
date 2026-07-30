import type { ReactNode } from "react";

import { RootDocument } from "../_components/root-document";
import { defaultLocale } from "../_i18n/routing";

import "@rituvia/ui/styles";
import "../styles.css";

export default function RedirectRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RootDocument locale={defaultLocale}>{children}</RootDocument>;
}
