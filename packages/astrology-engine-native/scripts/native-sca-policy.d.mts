export type NativeScaResult = Readonly<{
  commit: string;
  vulnerabilityIds: readonly string[];
}>;

export function parseOsvCommitResponse(value: unknown, expectedCommit: string): NativeScaResult;
