import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { RootDocument } from "../_components/root-document";
import { parseLocale, supportedLocales } from "../_i18n/routing";

import "@rituvia/ui/styles";
import "../styles.css";

type LocaleRootLayoutProps = Readonly<{
  children: ReactNode;
  params: Promise<Readonly<{ locale: string }>>;
}>;

export const dynamicParams = false;

export const generateStaticParams = () => supportedLocales.map((locale) => ({ locale }));

export default async function LocaleRootLayout({ children, params }: LocaleRootLayoutProps) {
  const locale = parseLocale((await params).locale);
  if (locale === null) notFound();
  return <RootDocument locale={locale}>{children}</RootDocument>;
}
