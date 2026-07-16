import { describe, expect, it } from "vitest";

import {
  assertFeatureFlagRuntimeDatabasePrivileges,
  readFeatureFlagVersions,
} from "../src/feature-flags.js";

type PrivilegeAttestationFixture = Readonly<{
  canCreateInDatabase: boolean;
  canCreateInSchema: boolean;
  canMutateFeatureFlags: boolean;
  canReadFeatureFlags: boolean;
  databaseOwner: string;
  privilegedRole: boolean;
  reachablePrivilegeEscalation: boolean;
  roleName: string;
  schemaOwner: string;
  sessionRoleName: string;
  tableOwner: string;
}>;

const safePrivilegeAttestation: PrivilegeAttestationFixture = Object.freeze({
  canCreateInDatabase: false,
  canCreateInSchema: false,
  canMutateFeatureFlags: false,
  canReadFeatureFlags: true,
  databaseOwner: "rituvia_migrator",
  privilegedRole: false,
  reachablePrivilegeEscalation: false,
  roleName: "rituvia_app",
  schemaOwner: "rituvia_migrator",
  sessionRoleName: "rituvia_app",
  tableOwner: "rituvia_migrator",
});

const privilegeDatabase = (
  rows: readonly PrivilegeAttestationFixture[],
  inspectQuery?: (query: string) => void,
): Parameters<typeof assertFeatureFlagRuntimeDatabasePrivileges>[0] =>
  ({
    $queryRaw: (parts: TemplateStringsArray) => {
      inspectQuery?.(parts.join("?"));
      return Promise.resolve(rows);
    },
  }) as unknown as Parameters<typeof assertFeatureFlagRuntimeDatabasePrivileges>[0];

describe("feature-flag runtime privilege attestation", () => {
  it("accepts exactly one read-only non-owner runtime role", async () => {
    let query = "";
    await expect(
      assertFeatureFlagRuntimeDatabasePrivileges(
        privilegeDatabase([safePrivilegeAttestation], (value) => {
          query = value;
        }),
      ),
    ).resolves.toBeUndefined();
    expect(query).toContain("pg_has_role(current_user, role.oid, 'MEMBER')");
    expect(query).toContain('session_user AS "sessionRoleName"');
    expect(query).toContain("rolcreatedb");
    expect(query).toContain("rolcreaterole");
    expect(query).toContain("rolreplication");
    expect(query).toContain("rolbypassrls");
    expect(query).toContain("MAINTAIN");
    expect(query).toContain("has_any_column_privilege");
  });

  const unsafeAttestations: readonly (readonly [string, Partial<PrivilegeAttestationFixture>])[] = [
    ["database owner", { roleName: "rituvia_migrator" }],
    ["schema owner", { schemaOwner: "rituvia_app" }],
    ["table owner", { tableOwner: "rituvia_app" }],
    ["database creator", { canCreateInDatabase: true }],
    ["schema creator", { canCreateInSchema: true }],
    ["missing reader", { canReadFeatureFlags: false }],
    ["table mutator", { canMutateFeatureFlags: true }],
    ["privileged role", { privilegedRole: true }],
    ["reachable privilege escalation", { reachablePrivilegeEscalation: true }],
    ["preselected startup role", { sessionRoleName: "rituvia_ci_admin" }],
  ];

  it.each(unsafeAttestations)("rejects an unsafe %s attestation", async (_label, override) => {
    const row: PrivilegeAttestationFixture = Object.freeze({
      ...safePrivilegeAttestation,
      ...override,
    });
    await expect(
      assertFeatureFlagRuntimeDatabasePrivileges(privilegeDatabase([row])),
    ).rejects.toThrow("runtime database privileges are unsafe");
  });

  it("rejects missing or ambiguous attestation rows", async () => {
    await expect(assertFeatureFlagRuntimeDatabasePrivileges(privilegeDatabase([]))).rejects.toThrow(
      "runtime database privileges are unsafe",
    );
    await expect(
      assertFeatureFlagRuntimeDatabasePrivileges(
        privilegeDatabase([safePrivilegeAttestation, safePrivilegeAttestation]),
      ),
    ).rejects.toThrow("runtime database privileges are unsafe");
  });
});

describe("feature-flag database reader", () => {
  it("reads a bounded deterministic snapshot and projects only configuration fields", async () => {
    let query: unknown;
    const countryCodes = ["US"];
    const localeTags = ["en-US"];
    const database = {
      featureFlagVersion: {
        findMany: (input: unknown) => {
          query = input;
          return Promise.resolve([
            {
              actorId: "codex.local",
              approvalReference: "OWN-002:approval",
              changeReference: "RIT-007",
              countryCodes,
              createdAt: new Date("2026-07-17T10:00:00.000Z"),
              effectiveAt: new Date("2026-07-17T11:00:00.000Z"),
              expiresAt: new Date("2026-08-17T11:00:00.000Z"),
              flagKey: "payments.fiat_checkout",
              localeTags,
              registryVersion: 1,
              state: "off",
              version: 1,
            },
          ]);
        },
      },
    } as unknown as Parameters<typeof readFeatureFlagVersions>[0];

    const records = await readFeatureFlagVersions(database, 1);

    expect(query).toEqual({
      orderBy: [{ flagKey: "asc" }, { version: "asc" }],
      select: {
        actorId: true,
        approvalReference: true,
        changeReference: true,
        countryCodes: true,
        createdAt: true,
        effectiveAt: true,
        expiresAt: true,
        flagKey: true,
        localeTags: true,
        registryVersion: true,
        state: true,
        version: true,
      },
      take: 10_001,
      where: { registryVersion: 1 },
    });
    expect(records).toEqual([
      {
        actorId: "codex.local",
        approvalReference: "OWN-002:approval",
        changeReference: "RIT-007",
        countryCodes: ["US"],
        createdAt: "2026-07-17T10:00:00.000Z",
        effectiveAt: "2026-07-17T11:00:00.000Z",
        expiresAt: "2026-08-17T11:00:00.000Z",
        flagKey: "payments.fiat_checkout",
        localeTags: ["en-US"],
        registryVersion: 1,
        state: "off",
        version: 1,
      },
    ]);
    expect(Object.isFrozen(records)).toBe(true);
    expect(Object.isFrozen(records[0])).toBe(true);
    expect(Object.isFrozen(records[0]?.countryCodes)).toBe(true);
    expect(Object.isFrozen(records[0]?.localeTags)).toBe(true);
    expect(Object.isFrozen(countryCodes)).toBe(false);
    expect(Object.isFrozen(localeTags)).toBe(false);
  });

  it("rejects invalid registry versions before querying", async () => {
    const database = {
      featureFlagVersion: {
        findMany: () => Promise.reject(new Error("must not query")),
      },
    } as unknown as Parameters<typeof readFeatureFlagVersions>[0];

    await expect(readFeatureFlagVersions(database, 0)).rejects.toThrow("positive 32-bit integer");
    await expect(readFeatureFlagVersions(database, 2_147_483_648)).rejects.toThrow(
      "positive 32-bit integer",
    );
  });

  it("keeps rolling registry histories isolated for upgrade and rollback", async () => {
    const queries: unknown[] = [];
    const database = {
      featureFlagVersion: {
        findMany: (input: { where: { registryVersion: number } }) => {
          queries.push(input);
          return Promise.resolve([
            {
              actorId: "control.local",
              approvalReference: null,
              changeReference: "RIT-007",
              countryCodes: [],
              createdAt: new Date("2026-07-17T10:00:00.000Z"),
              effectiveAt: new Date("2026-07-17T11:00:00.000Z"),
              expiresAt: null,
              flagKey: "experience.public_shell",
              localeTags: [],
              registryVersion: input.where.registryVersion,
              state: "off",
              version: 1,
            },
          ]);
        },
      },
    } as unknown as Parameters<typeof readFeatureFlagVersions>[0];

    expect((await readFeatureFlagVersions(database, 1))[0]?.registryVersion).toBe(1);
    expect((await readFeatureFlagVersions(database, 2))[0]?.registryVersion).toBe(2);
    expect((await readFeatureFlagVersions(database, 1))[0]?.registryVersion).toBe(1);
    expect(queries.map((query) => (query as { where: unknown }).where)).toEqual([
      { registryVersion: 1 },
      { registryVersion: 2 },
      { registryVersion: 1 },
    ]);
  });
});
