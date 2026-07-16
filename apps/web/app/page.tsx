import type { Route } from "next";
import { permanentRedirect } from "next/navigation";

import { defaultLocale, localeHomePath } from "./_i18n/routing";

export default function Page() {
  permanentRedirect(localeHomePath(defaultLocale) as Route);
}
