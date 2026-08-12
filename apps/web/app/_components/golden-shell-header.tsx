"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";

import type { GoldenShellLocale, GoldenShellMessages } from "../_i18n/golden-shell-messages";

type GoldenShellHeaderProps = Readonly<{
  brandName: string;
  locale: GoldenShellLocale;
  messages: GoldenShellMessages;
}>;

type NavigationItem = Readonly<{
  disabled?: boolean;
  href: Route;
  label: string;
}>;

export function GoldenShellHeader({ brandName, locale, messages }: GoldenShellHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const homeHref = `/${locale}` as Route;
  const englishJourney = locale === "en";
  const navigationItems: readonly NavigationItem[] = [
    { href: homeHref, label: messages.navigation.home },
    { href: `${homeHref}#readings` as Route, label: messages.navigation.readings },
    {
      href: (englishJourney ? "/en/sanctuary" : `${homeHref}#free-path`) as Route,
      label: messages.navigation.sanctuary,
    },
    {
      href: (englishJourney ? "/en/sanctuary" : `${homeHref}#free-path`) as Route,
      label: messages.navigation.journal,
    },
    {
      href: (englishJourney ? "/en/revisit" : `${homeHref}#loop`) as Route,
      label: messages.navigation.revisit,
    },
    {
      disabled: true,
      href: `${homeHref}#free-path` as Route,
      label: messages.navigation.plus,
    },
    { disabled: true, href: homeHref, label: messages.navigation.account },
  ];
  const languageHref = locale === "en" ? "/zh-Hans" : "/en";
  const languageLabel = messages.navigation.switchLabel;

  const toggleReducedMotion = () => {
    const next = !reducedMotion;
    setReducedMotion(next);
    document.getElementById("golden-shell-frame")?.toggleAttribute("data-reduced-motion", next);
  };

  const renderNavigationItem = (item: NavigationItem) =>
    item.disabled === true ? (
      <span
        aria-disabled="true"
        className="golden-nav-link golden-nav-link-disabled"
        key={item.label}
        title={messages.accessibility.disabledAction}
      >
        {item.label}
      </span>
    ) : (
      <Link
        className="golden-nav-link"
        href={item.href}
        key={item.label}
        onClick={() => setMenuOpen(false)}
      >
        {item.label}
      </Link>
    );

  return (
    <header className="golden-site-header">
      <div className="golden-shell-container golden-header-row">
        <Link
          aria-label={messages.navigation.brandHomeLabel}
          className="golden-brand"
          href={homeHref}
        >
          <span aria-hidden="true" className="golden-brand-mark">
            ✦
          </span>
          <span>
            <span className="golden-brand-word">{brandName}</span>
            <span className="golden-brand-sub">{messages.navigation.brandTagline}</span>
          </span>
        </Link>

        <nav
          aria-label={messages.accessibility.primaryNavigation}
          className="golden-desktop-navigation"
        >
          {navigationItems.map(renderNavigationItem)}
        </nav>

        <div className="golden-header-actions">
          <button
            aria-label={messages.accessibility.reduceMotion}
            aria-pressed={reducedMotion}
            className="golden-icon-button"
            onClick={toggleReducedMotion}
            type="button"
          >
            {reducedMotion ? "■" : "◌"}
          </button>
          <Link
            aria-label={messages.accessibility.switchLanguage}
            className="golden-ghost-button golden-language-switch"
            href={languageHref}
            hrefLang={locale === "en" ? "zh-Hans" : "en"}
            lang={locale === "en" ? "zh-Hans" : "en"}
          >
            {languageLabel}
          </Link>
          <span
            aria-disabled="true"
            className="golden-primary-button golden-sign-in-disabled"
            title={messages.accessibility.disabledAction}
          >
            {messages.navigation.signIn}
          </span>
          <button
            aria-controls="golden-mobile-navigation"
            aria-expanded={menuOpen}
            aria-label={
              menuOpen ? messages.accessibility.closeMenu : messages.accessibility.openMenu
            }
            className="golden-icon-button golden-mobile-menu-button"
            onClick={() => setMenuOpen((current) => !current)}
            type="button"
          >
            {menuOpen ? "×" : "☰"}
          </button>
        </div>
      </div>

      <nav
        aria-label={messages.accessibility.mobileNavigation}
        className={`golden-shell-container golden-mobile-navigation${menuOpen ? " open" : ""}`}
        id="golden-mobile-navigation"
      >
        {navigationItems.map(renderNavigationItem)}
      </nav>
    </header>
  );
}
