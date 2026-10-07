import { render, screen } from "@testing-library/react";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { QrCode } from "./qr-code";

describe("QrCode", () => {
  it("draws one square per dark module, with an accessible label", () => {
    const value = "pX3-ExampleToken_0123456789abcdefghijklmnopq";
    render(<QrCode value={value} label="Billet" />);
    const svg = screen.getByRole("img", { name: "Billet" });
    const path = svg.querySelector("path")?.getAttribute("d") ?? "";
    const { data } = QRCode.create(value, { errorCorrectionLevel: "M" }).modules;
    const dark = data.reduce((n, bit) => n + (bit ? 1 : 0), 0);
    expect(path.match(/M/g)).toHaveLength(dark);
  });
});
