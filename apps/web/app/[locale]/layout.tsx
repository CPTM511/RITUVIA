import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { RootDocument } from "../_components/root-document";
import { goldenShellLocales, parseGoldenShellLocale } from "../_i18n/golden-shell-messages";

import "@rituvia/ui/styles";
import "../styles.css";
import "../golden-shell.css";

type LocaleRootLayoutProps = Readonly<{
  children: ReactNode;
  params: Promise<Readonly<{ locale: string }>>;
}>;

export const dynamicParams = false;

export const generateStaticParams = () => goldenShellLocales.map((locale) => ({ locale }));

export default async function LocaleRootLayout({ children, params }: LocaleRootLayoutProps) {
  const locale = parseGoldenShellLocale((await params).locale);
  if (locale === null) notFound();
  return <RootDocument locale={locale}>{children}</RootDocument>;
}
