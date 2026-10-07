import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("writes a BOM, semicolons and CRLF", () => {
    expect(toCsv(["Nom", "Points"], [["Inès", 3]])).toBe("﻿Nom;Points\r\nInès;3\r\n");
  });

  it("quotes separators, quotes and line breaks", () => {
    expect(toCsv(["a"], [['Dupont; "Jo"\nB']])).toBe('﻿a\r\n"Dupont; ""Jo""\nB"\r\n');
  });

  it("neutralizes formulas but keeps numbers", () => {
    const csv = toCsv(["a", "b", "c"], [['=HYPERLINK("x")', "@SUM(A1)", -2]]);
    expect(csv).toContain(`'=HYPERLINK(""x"")`);
    expect(csv).toContain("'@SUM(A1)");
    expect(csv).toContain(";-2\r\n");
  });

  it("writes empty cells for null and undefined", () => {
    expect(toCsv(["a", "b"], [[null, undefined]])).toBe("﻿a;b\r\n;\r\n");
  });
});
