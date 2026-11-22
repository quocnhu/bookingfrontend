export type PaperSize = "A4" | "A5" | "Letter" | "Legal" | "A3" | "AUTO";

export const PAPER_SIZE_OPTIONS: Array<{
  value: PaperSize;
  label: string;
}> = [
  { value: "A4", label: "A4 · 210 × 297 mm" },
  { value: "A5", label: "A5 · 148 × 210 mm" },
  { value: "Letter", label: "Letter · 8.5 × 11 in" },
  { value: "Legal", label: "Legal · 8.5 × 14 in" },
  { value: "A3", label: "A3 · 297 × 420 mm" },
  { value: "AUTO", label: "Printer default" },
];

export const DEFAULT_PAPER_SIZE: PaperSize = "A4";

export function paperSizeCss(size: PaperSize): string {
  return size === "AUTO" ? "" : `size: ${size} portrait; `;
}

export function paperSizeLabel(size: PaperSize): string {
  return size === "AUTO" ? "printer default" : size;
}
