import "server-only";

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

import {
  astrologyNativeExecutionSchemaVersion,
  createAstrologyEphemerisAdapterV1,
  parseAstrologyEngineBuildMetadataV1,
  parseAstrologyNativeExecutionV1,
  type AstrologyEngineBuildMetadataV1,
  type AstrologyEphemerisAdapterV1,
  type AstrologyEphemerisNativeExecutorV1,
  type AstrologyNativeExecutionRequestV1,
  type AstrologyNativeExecutionV1,
} from "@rituvia/divination";

export const swissEphemerisNativeErrorCodes = Object.freeze([
  "NATIVE_CONFIGURATION_INVALID",
  "NATIVE_ARTIFACT_ATTESTATION_FAILED",
  "NATIVE_EXECUTION_FAILED",
  "NATIVE_EXECUTION_TIMED_OUT",
  "NATIVE_OUTPUT_INVALID",
] as const);
export type SwissEphemerisNativeErrorCode = (typeof swissEphemerisNativeErrorCodes)[number];

export class SwissEphemerisNativeError extends Error {
  readonly code: SwissEphemerisNativeErrorCode;

  constructor(code: SwissEphemerisNativeErrorCode) {
    super("The native astrology engine is unavailable.");
    this.name = "SwissEphemerisNativeError";
    this.code = code;
  }
}

export type SwissEphemerisNativeConfigurationV1 = Readonly<{
  binaryPath: string;
  binarySha256: string;
  ephemerisFiles: readonly Readonly<{
    path: string;
    sha256: string;
  }>[];
  ephemerisPath: string;
  maximumOutputBytes: number;
  timeoutMilliseconds: number;
}>;

export type SwissEphemerisBuildMetadataConfigurationV1 = Readonly<{
  buildMetadataPath: string;
  maximumOutputBytes: number;
  timeoutMilliseconds: number;
}>;

const ephemerisFiles = Object.freeze([
  Object.freeze({
    path: "semo_18.se1",
    sha256: "1aca59fbd7f73d3882768a847890304261051c5ed965b952b4c9d7c5951833a4",
  }),
  Object.freeze({
    path: "sepl_18.se1",
    sha256: "20aa1c1d68d98895493aef8a4d67d596823309d55078f6d7a9bdbe0d0c7e8d80",
  }),
]);
const maximumBuildMetadataBytes = 65_536;
const nativeProcessEnvironment: NodeJS.ProcessEnv = Object.freeze({
  LANG: "C",
  LC_ALL: "C",
  NODE_ENV: "production",
});

const sha256 = (value: Uint8Array): string => createHash("sha256").update(value).digest("hex");

const attestFile = async (path: string, expectedSha256: string): Promise<void> => {
  const status = await lstat(path);
  if (
    !status.isFile() ||
    status.isSymbolicLink() ||
    sha256(await readFile(path)) !== expectedSha256
  ) {
    throw new SwissEphemerisNativeError("NATIVE_ARTIFACT_ATTESTATION_FAILED");
  }
};

const attestDirectory = async (path: string): Promise<void> => {
  const status = await lstat(path);
  if (!status.isDirectory() || status.isSymbolicLink()) {
    throw new SwissEphemerisNativeError("NATIVE_ARTIFACT_ATTESTATION_FAILED");
  }
};

const parseConfiguration = (
  configuration: SwissEphemerisNativeConfigurationV1,
): SwissEphemerisNativeConfigurationV1 => {
  if (
    !isAbsolute(configuration.binaryPath) ||
    !isAbsolute(configuration.ephemerisPath) ||
    !/^[0-9a-f]{64}$/u.test(configuration.binarySha256) ||
    !Number.isSafeInteger(configuration.maximumOutputBytes) ||
    configuration.maximumOutputBytes < 1_024 ||
    configuration.maximumOutputBytes > 1_048_576 ||
    !Number.isSafeInteger(configuration.timeoutMilliseconds) ||
    configuration.timeoutMilliseconds < 100 ||
    configuration.timeoutMilliseconds > 10_000 ||
    configuration.ephemerisFiles.length !== 2
  ) {
    throw new SwissEphemerisNativeError("NATIVE_CONFIGURATION_INVALID");
  }
  const ephemerisFiles = configuration.ephemerisFiles.map((entry) => {
    if (!/^se(?:mo|pl)_18\.se1$/u.test(entry.path) || !/^[0-9a-f]{64}$/u.test(entry.sha256)) {
      throw new SwissEphemerisNativeError("NATIVE_CONFIGURATION_INVALID");
    }
    return Object.freeze({ path: entry.path, sha256: entry.sha256 });
  });
  if (new Set(ephemerisFiles.map(({ path }) => path)).size !== 2) {
    throw new SwissEphemerisNativeError("NATIVE_CONFIGURATION_INVALID");
  }
  return Object.freeze({
    binaryPath: configuration.binaryPath,
    binarySha256: configuration.binarySha256,
    ephemerisFiles: Object.freeze(ephemerisFiles),
    ephemerisPath: configuration.ephemerisPath,
    maximumOutputBytes: configuration.maximumOutputBytes,
    timeoutMilliseconds: configuration.timeoutMilliseconds,
  });
};

const houseCode = Object.freeze({
  equal: "A",
  placidus: "P",
  whole_sign: "W",
} as const);

const executeProcess = async (
  configuration: SwissEphemerisNativeConfigurationV1,
  request: AstrologyNativeExecutionRequestV1,
): Promise<string> => {
  await attestDirectory(configuration.ephemerisPath);
  await attestFile(configuration.binaryPath, configuration.binarySha256);
  await Promise.all(
    configuration.ephemerisFiles.map(({ path, sha256: digest }) =>
      attestFile(resolve(configuration.ephemerisPath, path), digest),
    ),
  );

  const instant = new Date(request.utcInstant);
  const argumentsList = [
    configuration.ephemerisPath,
    String(instant.getUTCFullYear()),
    String(instant.getUTCMonth() + 1),
    String(instant.getUTCDate()),
    String(instant.getUTCHours()),
    String(instant.getUTCMinutes()),
    String(instant.getUTCSeconds() * 1_000 + instant.getUTCMilliseconds()),
    String(request.latitudeE6),
    String(request.longitudeE6),
    houseCode[request.houseSystem],
    request.includeHouses ? "1" : "0",
  ];

  return await new Promise<string>((resolvePromise, rejectPromise) => {
    const child = spawn(configuration.binaryPath, argumentsList, {
      cwd: configuration.ephemerisPath,
      env: nativeProcessEnvironment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output: Buffer[] = [];
    let outputBytes = 0;
    let settled = false;
    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      action();
    };
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => rejectPromise(new SwissEphemerisNativeError("NATIVE_EXECUTION_TIMED_OUT")));
    }, configuration.timeoutMilliseconds);
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > configuration.maximumOutputBytes) {
        child.kill("SIGKILL");
        finish(() => rejectPromise(new SwissEphemerisNativeError("NATIVE_OUTPUT_INVALID")));
        return;
      }
      output.push(chunk);
    });
    child.stderr.on("data", () => {
      // Native stderr is intentionally discarded because paths and inputs must never escape.
    });
    child.once("error", () =>
      finish(() => rejectPromise(new SwissEphemerisNativeError("NATIVE_EXECUTION_FAILED"))),
    );
    child.once("close", (code) =>
      finish(() => {
        if (code !== 0) {
          rejectPromise(new SwissEphemerisNativeError("NATIVE_EXECUTION_FAILED"));
          return;
        }
        resolvePromise(Buffer.concat(output).toString("utf8"));
      }),
    );
  });
};

export const createSwissEphemerisNativeExecutorV1 = (
  value: SwissEphemerisNativeConfigurationV1,
): AstrologyEphemerisNativeExecutorV1 => {
  const configuration = parseConfiguration(value);
  return Object.freeze({
    async execute(request: AstrologyNativeExecutionRequestV1): Promise<AstrologyNativeExecutionV1> {
      if (request.schemaVersion !== astrologyNativeExecutionSchemaVersion) {
        throw new SwissEphemerisNativeError("NATIVE_CONFIGURATION_INVALID");
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(await executeProcess(configuration, request)) as unknown;
      } catch (error) {
        if (error instanceof SwissEphemerisNativeError) throw error;
        throw new SwissEphemerisNativeError("NATIVE_OUTPUT_INVALID");
      }
      try {
        return parseAstrologyNativeExecutionV1(parsed, request.includeHouses);
      } catch {
        throw new SwissEphemerisNativeError("NATIVE_OUTPUT_INVALID");
      }
    },
  });
};

export const parseSwissEphemerisBuildMetadataV1 = (
  value: unknown,
): AstrologyEngineBuildMetadataV1 => parseAstrologyEngineBuildMetadataV1(value);

export const loadSwissEphemerisAdapterV1FromBuildMetadata = async (
  configuration: SwissEphemerisBuildMetadataConfigurationV1,
): Promise<AstrologyEphemerisAdapterV1> => {
  if (
    !isAbsolute(configuration.buildMetadataPath) ||
    !Number.isSafeInteger(configuration.maximumOutputBytes) ||
    configuration.maximumOutputBytes < 1_024 ||
    configuration.maximumOutputBytes > 1_048_576 ||
    !Number.isSafeInteger(configuration.timeoutMilliseconds) ||
    configuration.timeoutMilliseconds < 100 ||
    configuration.timeoutMilliseconds > 10_000
  ) {
    throw new SwissEphemerisNativeError("NATIVE_CONFIGURATION_INVALID");
  }

  let metadata: unknown;
  try {
    const status = await lstat(configuration.buildMetadataPath);
    if (
      !status.isFile() ||
      status.isSymbolicLink() ||
      status.size === 0 ||
      status.size > maximumBuildMetadataBytes
    ) {
      throw new Error();
    }
    metadata = JSON.parse(await readFile(configuration.buildMetadataPath, "utf8")) as unknown;
  } catch {
    throw new SwissEphemerisNativeError("NATIVE_CONFIGURATION_INVALID");
  }

  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    throw new SwissEphemerisNativeError("NATIVE_CONFIGURATION_INVALID");
  }
  const record = metadata as Record<string, unknown>;
  const metadataKeys = Object.keys(record).sort();
  if (
    metadataKeys.join("\0") !==
      ["buildProfile", "engine", "runtime", "securitySanitizers"].sort().join("\0") ||
    record.buildProfile !== "production" ||
    !Array.isArray(record.securitySanitizers) ||
    record.securitySanitizers.length !== 0 ||
    typeof record.runtime !== "object" ||
    record.runtime === null ||
    Array.isArray(record.runtime)
  ) {
    throw new SwissEphemerisNativeError("NATIVE_CONFIGURATION_INVALID");
  }
  const runtime = record.runtime as Record<string, unknown>;
  if (
    Object.keys(runtime).sort().join("\0") !== ["binaryPath", "ephemerisPath"].join("\0") ||
    typeof runtime.binaryPath !== "string" ||
    typeof runtime.ephemerisPath !== "string"
  ) {
    throw new SwissEphemerisNativeError("NATIVE_CONFIGURATION_INVALID");
  }

  let engine: AstrologyEngineBuildMetadataV1;
  try {
    engine = parseSwissEphemerisBuildMetadataV1(record.engine);
  } catch {
    throw new SwissEphemerisNativeError("NATIVE_CONFIGURATION_INVALID");
  }
  const executor = createSwissEphemerisNativeExecutorV1({
    binaryPath: runtime.binaryPath,
    binarySha256: engine.binarySha256,
    ephemerisFiles,
    ephemerisPath: runtime.ephemerisPath,
    maximumOutputBytes: configuration.maximumOutputBytes,
    timeoutMilliseconds: configuration.timeoutMilliseconds,
  });
  return createAstrologyEphemerisAdapterV1(executor, engine);
};
