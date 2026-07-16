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

export const webShellBuildBudgets: WebShellBuildBudgets;

export function auditWebShellBuildArtifacts(
  input: Readonly<{
    assets: ReadonlyMap<string, Buffer>;
    budgets?: WebShellBuildBudgets;
    html: string;
    icon: Buffer;
  }>,
): WebShellBuildAudit;

export function auditWebShellRouteArtifacts(
  input: Readonly<{
    html: string;
    prerenderManifest: unknown;
    routeMetadata: unknown;
    routesManifest: unknown;
  }>,
): readonly string[];

export function verifyWebShellBuild(repositoryRoot: string): Promise<WebShellBuildAudit>;
