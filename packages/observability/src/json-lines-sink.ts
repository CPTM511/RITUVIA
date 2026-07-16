type JsonLineWriter = Readonly<{
  flush?: () => Promise<void>;
  maxLineBytes?: number;
  writeLine: (line: string) => void;
}>;

export type InternalJsonLineSink = Readonly<{
  flush(): Promise<void>;
  write(line: string): boolean;
}>;

export const createJsonLinesSink = (writer: JsonLineWriter): InternalJsonLineSink => {
  const maxLineBytes = Math.min(Math.max(writer.maxLineBytes ?? 16_384, 1_024), 65_536);
  return Object.freeze({
    async flush() {
      try {
        await writer.flush?.();
      } catch {
        // Telemetry failures never alter the application control flow.
      }
    },
    write(line: string) {
      if (
        /[\u0000-\u001f\u007f\u2028\u2029]/u.test(line) ||
        new TextEncoder().encode(line).byteLength > maxLineBytes
      ) {
        return false;
      }
      try {
        writer.writeLine(line);
        return true;
      } catch {
        return false;
      }
    },
  });
};
