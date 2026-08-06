import { describe, expect, it } from "vitest";
import { CsvParseError, parseCsv, parseCsvWithHeader } from "./csv";

describe("parseCsv", () => {
  it("parses a plain grid", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("ignores a trailing newline instead of inventing a record", () => {
    expect(parseCsv("a,b\n1,2\n")).toHaveLength(2);
  });

  it("accepts CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("strips a UTF-8 BOM", () => {
    expect(parseCsv("\uFEFFa,b\n1,2")[0]).toEqual(["a", "b"]);
  });

  it("keeps commas inside quoted fields", () => {
    expect(parseCsv('name,notes\nSpider-Man,"red, blue, and web"')[1]).toEqual([
      "Spider-Man",
      "red, blue, and web",
    ]);
  });

  it("unescapes doubled quotes", () => {
    expect(parseCsv('a\n"he said ""hi"""')[1]).toEqual(['he said "hi"']);
  });

  it("keeps line breaks inside quoted fields", () => {
    const records = parseCsv('a,b\n"line one\nline two",2');
    expect(records[1]).toEqual(["line one\nline two", "2"]);
  });

  it("keeps empty fields, including quoted ones", () => {
    expect(parseCsv('a,b,c,d\n,"",x,')[1]).toEqual(["", "", "x", ""]);
  });

  it("treats a quoted field that only holds separators as data", () => {
    expect(parseCsv('a,b\n","," "')[1]).toEqual([",", " "]);
  });

  it("rejects a record with the wrong number of fields", () => {
    expect(() => parseCsv("a,b,c\n1,2")).toThrow(CsvParseError);
    expect(() => parseCsv("a,b,c\n1,2")).toThrow(/line 2: expected 3 fields, found 2/);
  });

  it("reports the real line number when a quoted field spans lines", () => {
    expect(() => parseCsv('a,b\n"multi\nline",2\n1,2,3')).toThrow(/line 4/);
  });

  it("rejects an unterminated quoted field", () => {
    expect(() => parseCsv('a\n"never closed')).toThrow(/unterminated quoted field/);
  });

  it("rejects a stray quote inside an unquoted field", () => {
    expect(() => parseCsv('a\nab"c')).toThrow(/in the middle of an unquoted field/);
  });

  it("rejects text after a closing quote", () => {
    expect(() => parseCsv('a\n"abc"def')).toThrow(/unescaped/);
  });

  it("rejects a bare CR", () => {
    expect(() => parseCsv("a,b\r1,2")).toThrow(/bare CR/);
  });
});

describe("parseCsvWithHeader", () => {
  it("keys rows by header and tracks source lines", () => {
    const table = parseCsvWithHeader(
      'pop_number,name\n3,Spider-Man\n1450,"Spider-Man, Last Stand"\n',
    );
    expect(table.header).toEqual(["pop_number", "name"]);
    expect(table.rows).toEqual([
      { pop_number: "3", name: "Spider-Man" },
      { pop_number: "1450", name: "Spider-Man, Last Stand" },
    ]);
    expect(table.lines).toEqual([2, 3]);
  });

  it("yields no rows for a header-only file", () => {
    expect(parseCsvWithHeader("a,b\n").rows).toEqual([]);
  });

  it("rejects an empty file", () => {
    expect(() => parseCsvWithHeader("")).toThrow(/header row is required/);
  });

  it("rejects duplicate column names", () => {
    expect(() => parseCsvWithHeader("a,a\n1,2")).toThrow(/duplicate column/);
  });
});
