import type { LocalActionHref } from "@rituvia/ui";
import type { ReactNode } from "react";

import type { SharedMessages } from "../_i18n/messages";
import { formatCoreMessage } from "../_i18n/core-messages";
import {
  localeHomePath,
  localeAccountPath,
  localePublicPagePath,
  localeSanctuaryPath,
  localeSignInPath,
  type Locale,
  type PublicPageId,
} from "../_i18n/routing";
import { AccountNavigation } from "./account-experience";
import { ConnectionNotice } from "./connection-notice";

type PublicSiteFrameProps = Readonly<{
  brandName: string;
  brandTagline: string;
  children: ReactNode;
  currentPage: PublicPageId | null;
  locale: Locale;
  messages: SharedMessages;
}>;

type NavigationLink = Readonly<{
  current: boolean;
  href: LocalActionHref;
  label: string;
}>;

export function PublicSiteFrame({
  brandName,
  brandTagline,
  children,
  currentPage,
  locale,
  messages,
}: PublicSiteFrameProps) {
  const navigationLinks: readonly NavigationLink[] = [
    {
      current: currentPage === "home",
      href: localeHomePath(locale),
      label: messages.navigation.home,
    },
    {
      current: false,
      href: localeSanctuaryPath(locale),
      label: messages.navigation.sanctuary,
    },
    {
      current: currentPage === "methodology",
      href: localePublicPagePath(locale, "methodology"),
      label: messages.navigation.methodology,
    },
    {
      current: currentPage === "safety",
      href: localePublicPagePath(locale, "safety"),
      label: messages.navigation.safety,
    },
  ];
  const footerLinks: readonly NavigationLink[] = [
    ...navigationLinks,
    {
      current: currentPage === "privacy",
      href: localePublicPagePath(locale, "privacy"),
      label: messages.navigation.privacy,
    },
  ];

  return (
    <>
      <a className="skip-link" href="#main-content">
        {messages.accessibility.skipToContent}
      </a>

      <header className="site-header">
        <div className="shell header-inner">
          <a
            aria-label={formatCoreMessage(locale, "shell.navigation.homeLabel", {
              brand: brandName,
            })}
            className="brand-link"
            href={localeHomePath(locale)}
          >
            {brandName}
          </a>

          <nav aria-label={messages.navigation.primaryLabel} className="primary-navigation">
            <ul className="navigation-list">
              {navigationLinks.map((link) => (
                <li key={link.href}>
                  <a
                    aria-current={link.current ? "page" : undefined}
                    className="navigation-link"
                    href={link.href}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="header-actions">
            <div className="locale-control">
              <label className="locale-label" htmlFor="locale-select">
                {messages.navigation.localeLabel}
              </label>
              <select
                aria-describedby="locale-hint"
                className="locale-select"
                defaultValue={locale}
                id="locale-select"
                name="locale"
              >
                <option value={locale}>{messages.navigation.localeName}</option>
              </select>
              <span className="visually-hidden" id="locale-hint">
                {messages.navigation.localeHint}
              </span>
            </div>
            <AccountNavigation
              accountHref={localeAccountPath(locale)}
              accountLabel={messages.navigation.account}
              loadingLabel={messages.navigation.account}
              signInHref={localeSignInPath(locale)}
              signInLabel={messages.navigation.signIn}
            />
          </div>
        </div>
      </header>

      <noscript>
        <p className="no-script-note">{messages.accessibility.noScript}</p>
      </noscript>

      <ConnectionNotice locale={locale} />

      {children}

      <footer className="site-footer">
        <div className="shell footer-inner">
          <div>
            <p className="footer-brand">{brandName}</p>
            {brandTagline === "" ? null : <p className="footer-tagline">{brandTagline}</p>}
            <p className="footer-note">{messages.footer.foundationNote}</p>
          </div>
          <nav aria-label={messages.footer.navigationLabel}>
            <ul className="footer-navigation">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <a
                    aria-current={link.current ? "page" : undefined}
                    className="footer-link"
                    href={link.href}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>
    </>
  );
}
