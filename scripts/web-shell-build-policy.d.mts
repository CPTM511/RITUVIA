export type WebShellBuildBudgets = Readonly<{
  cssGzipBytes: number;
  htmlGzipBytes: number;
  iconBytes: number;
  javascriptGzipBytes: number;
}>;

export type WebShellBuildAudit = Readonly<{
  cssGzipBytes: number;
  findings: readonly string[];
  htmlGzipBytes: number;
  iconBytes: number;
  javascriptGzipBytes: number;
}>;

export type WebShellBuildVerification = WebShellBuildAudit &
  Readonly<{
    routes: readonly string[];
  }>;

export const webShellBuildBudgets: WebShellBuildBudgets;

export function auditPublicSeoDocument(
  html: string,
  expectedPathname?: string,
  expectedCanonicalOrigin?: string,
  expectedRobots?: "index, follow" | "noindex, nofollow",
  options?: Readonly<{
    expectedOpenGraphType?: "article" | "website";
    expectedStructuredDataType?: "Article" | "CollectionPage" | "WebPage" | "WebSite" | null;
  }>,
): readonly string[];

export function auditWebShellBuildArtifacts(
  input: Readonly<{
    assets: ReadonlyMap<string, Buffer>;
    budgets?: WebShellBuildBudgets;
    expectedPathname?: string;
    html: string;
    icon: Buffer;
  }>,
): WebShellBuildAudit;

export function auditWebShellRouteArtifacts(
  input: Readonly<{
    dynamicRoute?: string;
    expectedCanonicalOrigin?: string;
    expectedPathname?: string;
    expectedRobots?: "index, follow" | "noindex, nofollow";
    html: string;
    prerenderManifest: unknown;
    requiresGeoAnswerContext?: boolean;
    routeMetadata: unknown;
    routesManifest: unknown;
  }>,
): readonly string[];

export function verifyWebShellBuild(
  repositoryRoot: string,
  expectedCanonicalOrigin?: string,
  expectedRobots?: "index, follow" | "noindex, nofollow",
): Promise<WebShellBuildVerification>;
