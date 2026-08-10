import { createHash } from "node:crypto";

import { parseCountryPolicyVersionV1 } from "../../country-policy/dist/index.js";
import pg from "pg";

const { Client } = pg;

const resourceName = "rituvia-recovery-staging";
const databaseName = "neondb";
const appRole = "rituvia_app";
const paymentWebhookRole = "rituvia_payment_webhook";
const aiGenerationRole = "rituvia_ai_generation";
const countryPolicyVersion = "staging.us.coinbase-sandbox.item11.v1";
const previousCountryPolicyVersion = "staging.us.stripe-test.item10.v1";
const expectedConfirmation = `repair:${resourceName}/item-11-country-policy-order`;
const expectedInvalidProductCodes = Object.freeze([
  "pack_15",
  "pack_40",
  "pack_6",
  "plus_annual",
  "plus_monthly",
  "deep_one",
]);
const expectedCorrectedProductCodes = Object.freeze([
  "deep_one",
  "pack_15",
  "pack_40",
  "pack_6",
  "plus_annual",
  "plus_monthly",
]);

const fail = (message) => {
  throw new TypeError(message);
};

const environmentValue = (name) => {
  const value = process.env[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
};

const canonicalJson = (value) =>
  JSON.stringify(
    Array.isArray(value)
      ? value.map((entry) => JSON.parse(canonicalJson(entry)))
      : typeof value === "object" && value !== null
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([key, entry]) => [key, JSON.parse(canonicalJson(entry))]),
          )
        : value,
  );

const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");

const adminDatabaseUrl = environmentValue("RITUVIA_ITEM11_ADMIN_DATABASE_URL");
if (
  process.env.APP_ENV !== "staging" ||
  process.env.RITUVIA_STAGING_RESOURCE_NAME !== resourceName ||
  process.env.RITUVIA_ITEM11_POLICY_REPAIR_CONFIRM !== expectedConfirmation ||
  process.env.VERCEL_ENV === "production" ||
  adminDatabaseUrl === undefined
) {
  fail("Recovery Item 11 country-policy repair is not explicitly authorized.");
}

const parsedAdminUrl = new URL(adminDatabaseUrl);
if (
  !["postgres:", "postgresql:"].includes(parsedAdminUrl.protocol) ||
  !parsedAdminUrl.hostname.endsWith(".neon.tech") ||
  parsedAdminUrl.pathname !== `/${databaseName}` ||
  parsedAdminUrl.username === "" ||
  [appRole, paymentWebhookRole, aiGenerationRole].includes(
    decodeURIComponent(parsedAdminUrl.username),
  ) ||
  parsedAdminUrl.password === "" ||
  parsedAdminUrl.searchParams.get("sslmode") !== "require"
) {
  fail("Recovery Item 11 repair administrator connection is not the expected Neon TLS target.");
}

const client = new Client({
  application_name: "rituvia-recovery-item-11-country-policy-order-repair",
  connectionString: adminDatabaseUrl,
});

try {
  await client.connect();
  const attestation = await client.query(
    `SELECT current_database() AS "databaseName",
            current_user AS "currentUser",
            EXISTS (
              SELECT 1 FROM "_prisma_migrations"
               WHERE finished_at IS NULL AND rolled_back_at IS NULL
            ) AS "incompleteMigrationExists"`,
  );
  const facts = attestation.rows[0];
  if (
    facts === undefined ||
    facts.databaseName !== databaseName ||
    [appRole, paymentWebhookRole, aiGenerationRole].includes(facts.currentUser) ||
    facts.incompleteMigrationExists
  ) {
    fail("Recovery Item 11 repair database attestation failed.");
  }

  await client.query("BEGIN");
  try {
    const selected = await client.query(
      `SELECT policy_document AS "policyDocument",
              supersedes_version AS "supersedesVersion"
         FROM country_policy_version
        WHERE version = $1
        FOR UPDATE`,
      [countryPolicyVersion],
    );
    if (selected.rowCount !== 1) {
      fail("Recovery Item 11 repair expected exactly one country-policy row.");
    }

    const policyDocument = selected.rows[0]?.policyDocument;
    if (
      typeof policyDocument !== "object" ||
      policyDocument === null ||
      selected.rows[0]?.supersedesVersion !== previousCountryPolicyVersion ||
      policyDocument.schemaVersion !== "country-policy-version.v1" ||
      policyDocument.version !== countryPolicyVersion ||
      policyDocument.supersedesVersion !== previousCountryPolicyVersion ||
      policyDocument.countryCode !== "US" ||
      policyDocument.environment !== "staging" ||
      policyDocument.status !== "paid" ||
      policyDocument.approvalMode !== "written" ||
      policyDocument.evidence?.ownerReference !==
        "D-098:OWNER:item-11:protected-staging" ||
      policyDocument.evidence?.providerReference !==
        "coinbase-business:sandbox:usdc-base:item-11" ||
      policyDocument.crypto?.enabled !== true ||
      policyDocument.crypto?.providerRoute !== "coinbase_usdc_base" ||
      !Array.isArray(policyDocument.products)
    ) {
      fail("Recovery Item 11 repair source row is outside the approved envelope.");
    }

    const beforeCanonicalJson = canonicalJson(policyDocument);
    const beforeSha256 = sha256(beforeCanonicalJson);
    const currentProductCodes = policyDocument.products.map(({ productCode }) => productCode);

    if (
      canonicalJson(currentProductCodes) === canonicalJson(expectedCorrectedProductCodes)
    ) {
      parseCountryPolicyVersionV1(policyDocument);
      await client.query("COMMIT");
      process.stdout.write(
        `${JSON.stringify({
          afterSha256: beforeSha256,
          beforeSha256,
          countryPolicyVersion,
          databaseName,
          repaired: false,
          resourceName,
          rowsUpdated: 0,
        })}\n`,
      );
    } else {
      if (canonicalJson(currentProductCodes) !== canonicalJson(expectedInvalidProductCodes)) {
        fail("Recovery Item 11 repair found an unexpected product order.");
      }

      const productByCode = new Map(
        policyDocument.products.map((product) => [product.productCode, product]),
      );
      const correctedPolicyDocument = {
        ...policyDocument,
        products: expectedCorrectedProductCodes.map((productCode) => {
          const product = productByCode.get(productCode);
          if (product === undefined) {
            fail("Recovery Item 11 repair found a missing product.");
          }
          return product;
        }),
      };
      parseCountryPolicyVersionV1(correctedPolicyDocument);

      const afterCanonicalJson = canonicalJson(correctedPolicyDocument);
      const afterSha256 = sha256(afterCanonicalJson);
      const updated = await client.query(
        `UPDATE country_policy_version
            SET policy_document = $3::jsonb
          WHERE version = $1
            AND policy_document = $2::jsonb`,
        [countryPolicyVersion, beforeCanonicalJson, afterCanonicalJson],
      );
      if (updated.rowCount !== 1) {
        fail("Recovery Item 11 repair did not update exactly one attested row.");
      }

      const verified = await client.query(
        `SELECT policy_document AS "policyDocument"
           FROM country_policy_version
          WHERE version = $1`,
        [countryPolicyVersion],
      );
      if (
        verified.rowCount !== 1 ||
        canonicalJson(verified.rows[0]?.policyDocument) !== afterCanonicalJson
      ) {
        fail("Recovery Item 11 repair verification failed.");
      }

      await client.query("COMMIT");
      process.stdout.write(
        `${JSON.stringify({
          afterSha256,
          beforeSha256,
          countryPolicyVersion,
          databaseName,
          repaired: true,
          resourceName,
          rowsUpdated: 1,
        })}\n`,
      );
    }
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
} finally {
  await client.end().catch(() => undefined);
}
