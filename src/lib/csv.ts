/**
 * A small, strict RFC 4180 CSV reader.
 *
 * Written by hand on purpose: the only CSV in this project is the catalog seed
 * (`data/catalog/spiderman.csv`), and a seed that silently mis-parses a row is worse than
 * one that refuses to run. So this parser has no "best effort" mode — anything RFC 4180
 * forbids throws a {@link CsvParseError} that names the line.
 *
 * Rules enforced:
 *   - fields are separated by `,`, records by CRLF (a bare LF is accepted, a bare CR is not);
 *   - a quoted field starts with `"` at the field start; `""` inside it is a literal quote;
 *   - the closing `"` must be followed by `,`, a line break or EOF;
 *   - an unquoted field may not contain `"`;
 *   - every record must have the same number of fields as the first one;
 *   - a trailing line break does NOT produce a phantom empty record.
 *
 * A leading UTF-8 BOM is stripped (spreadsheet exports love adding one).
 */

export class CsvParseError extends Error {
  readonly line: number;

  constructor(message: string, line: number) {
    super(`CSV line ${line}: ${message}`);
    this.name = "CsvParseError";
    this.line = line;
  }
}

interface ParsedRecords {
  records: string[][];
  /** 1-based source line on which each record starts. */
  lines: number[];
}

function parseRecords(input: string): ParsedRecords {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;

  const records: string[][] = [];
  const lines: number[] = [];

  let record: string[] = [];
  let field = "";
  let fieldWasQuoted = false;
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let i = 0;

  const endField = () => {
    record.push(field);
    field = "";
    fieldWasQuoted = false;
  };

  const endRecord = () => {
    endField();
    records.push(record);
    lines.push(recordLine);
    record = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        const next = text[i];
        if (next !== undefined && next !== "," && next !== "\n" && next !== "\r") {
          throw new CsvParseError('unescaped `"` inside a quoted field (write it as `""`)', line);
        }
        continue;
      }
      if (char === "\n") line += 1;
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      if (field.length > 0 || fieldWasQuoted) {
        throw new CsvParseError('`"` in the middle of an unquoted field', line);
      }
      inQuotes = true;
      fieldWasQuoted = true;
      i += 1;
      continue;
    }

    if (char === ",") {
      endField();
      i += 1;
      continue;
    }

    if (char === "\r") {
      if (text[i + 1] !== "\n") {
        throw new CsvParseError("bare CR — line breaks must be CRLF or LF", line);
      }
      endRecord();
      i += 2;
      line += 1;
      recordLine = line;
      continue;
    }

    if (char === "\n") {
      endRecord();
      i += 1;
      line += 1;
      recordLine = line;
      continue;
    }

    field += char;
    i += 1;
  }

  if (inQuotes) {
    throw new CsvParseError("unterminated quoted field", recordLine);
  }

  // Anything still buffered is a final record without a trailing line break.
  if (field.length > 0 || fieldWasQuoted || record.length > 0) {
    endRecord();
  }

  const width = records[0]?.length ?? 0;
  for (let r = 1; r < records.length; r += 1) {
    if (records[r].length !== width) {
      throw new CsvParseError(`expected ${width} fields, found ${records[r].length}`, lines[r]);
    }
  }

  return { records, lines };
}

/** Parses CSV text into raw records. Returns `[]` for empty input. */
export function parseCsv(input: string): string[][] {
  return parseRecords(input).records;
}

export interface CsvTable {
  header: string[];
  /** One object per data record, keyed by header name. */
  rows: Record<string, string>[];
  /** 1-based source line of each row in `rows` — so errors can point at the real file. */
  lines: number[];
}

/** Parses CSV text whose first record is a header row. */
export function parseCsvWithHeader(input: string): CsvTable {
  const { records, lines } = parseRecords(input);
  if (records.length === 0) {
    throw new CsvParseError("empty file — a header row is required", 1);
  }

  const header = records[0];
  const seen = new Set<string>();
  for (const column of header) {
    if (seen.has(column)) {
      throw new CsvParseError(`duplicate column \`${column}\` in the header`, 1);
    }
    seen.add(column);
  }

  const rows = records.slice(1).map((record) => {
    const row: Record<string, string> = {};
    header.forEach((column, c) => {
      row[column] = record[c];
    });
    return row;
  });

  return { header, rows, lines: lines.slice(1) };
}
