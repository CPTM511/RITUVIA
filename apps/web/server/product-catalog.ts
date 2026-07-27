import "server-only";

import { assertCatalogRuntimeDatabasePrivileges, readCatalogVersions } from "@rituvia/db";
import {
  parseCatalogVersionV1,
  selectActiveCatalogVersionV1,
  type CatalogEnvironment,
  type CatalogVersionV1,
} from "@rituvia/payments";

import { getWebRuntimeConfiguration } from "../config/server";
import { loadWebDatabase } from "./database";

export type ProductCatalogApplicationDependencies = Readonly<{
  assertPrivileges(): Promise<void>;
  clock(): string;
  environment: CatalogEnvironment;
  read(environment: CatalogEnvironment): Promise<readonly CatalogVersionV1[]>;
}>;

export const createProductCatalogApplicationService = (
  dependencies: ProductCatalogApplicationDependencies,
) =>
  Object.freeze({
    async readActive(): Promise<CatalogVersionV1> {
      await dependencies.assertPrivileges();
      return selectActiveCatalogVersionV1(await dependencies.read(dependencies.environment), {
        asOf: dependencies.clock(),
        environment: dependencies.environment,
      });
    },
  });

export type ProductCatalogApplicationService = ReturnType<
  typeof createProductCatalogApplicationService
>;

let privilegeAttestation: Promise<void> | undefined;
let service: ProductCatalogApplicationService | undefined;

export const loadWebProductCatalogApplicationService = (): ProductCatalogApplicationService => {
  if (service !== undefined) return service;
  const configuration = getWebRuntimeConfiguration();
  service = createProductCatalogApplicationService({
    assertPrivileges: () => {
      privilegeAttestation ??= assertCatalogRuntimeDatabasePrivileges(loadWebDatabase());
      return privilegeAttestation;
    },
    clock: () => new Date().toISOString(),
    environment: configuration.deploymentEnvironment,
    read: async (environment) =>
      (await readCatalogVersions(loadWebDatabase(), { environment })).map((record) =>
        parseCatalogVersionV1(record),
      ),
  });
  return service;
};
