import { ActionLink } from "@rituvia/ui";
import type { ReactNode } from "react";

import type { SharedMessages } from "../_i18n/messages";
import {
  localeHomePath,
  localePublicPagePath,
  localeSectionPath,
  type Locale,
  type PublicPageId,
} from "../_i18n/routing";

type PublicSiteFrameProps = Readonly<{
  brandName: string;
  brandTagline: string;
  children: ReactNode;
  currentPage: PublicPageId;
  locale: Locale;
  messages: SharedMessages;
}>;

type NavigationLink = Readonly<{
  label: string;
  page: PublicPageId;
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
    { label: messages.navigation.home, page: "home" },
    { label: messages.navigation.methodology, page: "methodology" },
    { label: messages.navigation.safety, page: "safety" },
    { label: messages.navigation.privacy, page: "privacy" },
  ];

  return (
    <>
      <a className="skip-link" href="#main-content">
        {messages.accessibility.skipToContent}
      </a>

      <header className="site-header">
        <div className="shell header-inner">
          <a
            aria-label={messages.navigation.homeLabel.replace("{brand}", brandName)}
            className="brand-link"
            href={localeHomePath(locale)}
          >
            {brandName}
          </a>

          <nav aria-label={messages.navigation.primaryLabel} className="primary-navigation">
            <ul className="navigation-list">
              {navigationLinks.map((link) => (
                <li key={link.page}>
                  <a
                    aria-current={link.page === currentPage ? "page" : undefined}
                    className="navigation-link"
                    href={localePublicPagePath(locale, link.page)}
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
            <ActionLink href={localeSectionPath(locale, "practice")}>
              {messages.navigation.primaryAction}
            </ActionLink>
          </div>
        </div>
      </header>

      <noscript>
        <p className="no-script-note">{messages.accessibility.noScript}</p>
      </noscript>

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
              {navigationLinks.map((link) => (
                <li key={link.page}>
                  <a className="footer-link" href={localePublicPagePath(locale, link.page)}>
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
