import {
  localPostgresConstants,
  resetDevelopmentDatabase,
  runLocalPrisma,
  withLocalPostgresLease,
} from "./local-postgres.mjs";

const [command, ...args] = process.argv.slice(2);

if (command !== "setup" && command !== "reset") {
  throw new Error("Development database command must be setup or reset.");
}

await withLocalPostgresLease(async (lease) => {
  let databaseUrl = lease.developmentDatabaseUrl;

  if (command === "reset") {
    const confirmationArgument = args.find((argument) => argument.startsWith("--confirm="));
    const confirmation = confirmationArgument?.slice("--confirm=".length);
    databaseUrl = await resetDevelopmentDatabase(lease.runtime, confirmation);
  }

  runLocalPrisma(lease.runtime, databaseUrl, ["generate"]);
  runLocalPrisma(lease.runtime, databaseUrl, ["migrate", "deploy"]);
  runLocalPrisma(lease.runtime, databaseUrl, ["db", "seed"]);

  process.stdout.write(
    command === "reset"
      ? "Reset, migrated, and seeded the attested local development database.\n"
      : "Started, migrated, and seeded the attested local development database.\n",
  );
  process.stdout.write(`Reset confirmation token: ${localPostgresConstants.resetConfirmation}\n`);
});
