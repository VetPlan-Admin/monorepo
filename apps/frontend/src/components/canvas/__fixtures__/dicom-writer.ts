// Minimal DICOM Part 10 writer for tests: enough to exercise the decoder, not a general encoder.
type Vr = "UL" | "UI" | "US" | "DS" | "CS" | "PN" | "DA" | "IS" | "LO" | "SH" | "OB" | "OW";

export interface TestElement {
  tag: [number, number];
  vr: Vr;
  value: string | number[] | Uint8Array;
}

const LONG_VRS = new Set<Vr>(["OB", "OW"]);
export const IMPLICIT_LE = "1.2.840.10008.1.2";

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function padEven(bytes: Uint8Array, padByte: number): Uint8Array {
  return bytes.length % 2 === 0 ? bytes : concat([bytes, new Uint8Array([padByte])]);
}

function encodeValue({ vr, value }: TestElement): Uint8Array {
  if (value instanceof Uint8Array) return padEven(value, 0);
  if (Array.isArray(value)) {
    const size = vr === "UL" ? 4 : 2;
    const out = new Uint8Array(value.length * size);
    const view = new DataView(out.buffer);
    value.forEach((n, i) => (size === 4 ? view.setUint32(i * 4, n, true) : view.setUint16(i * 2, n, true)));
    return out;
  }
  return padEven(new TextEncoder().encode(value), vr === "UI" ? 0 : 0x20);
}

function header(tag: [number, number], vr: Vr, length: number, explicit: boolean): Uint8Array {
  const long = !explicit || LONG_VRS.has(vr);
  const out = new Uint8Array(explicit ? (LONG_VRS.has(vr) ? 12 : 8) : 8);
  const view = new DataView(out.buffer);
  view.setUint16(0, tag[0], true);
  view.setUint16(2, tag[1], true);
  if (explicit) {
    out[4] = vr.charCodeAt(0);
    out[5] = vr.charCodeAt(1);
    if (LONG_VRS.has(vr)) view.setUint32(8, length, true);
    else view.setUint16(6, length, true);
  } else if (long) {
    view.setUint32(4, length, true);
  }
  return out;
}

function encodeElement(element: TestElement, explicit: boolean): Uint8Array {
  const value = encodeValue(element);
  return concat([header(element.tag, element.vr, value.length, explicit), value]);
}

function encapsulated(fragments: Uint8Array[]): Uint8Array {
  const item = (bytes: Uint8Array) => {
    const head = new Uint8Array(8);
    const view = new DataView(head.buffer);
    view.setUint16(0, 0xfffe, true);
    view.setUint16(2, 0xe000, true);
    view.setUint32(4, bytes.length, true);
    return concat([head, bytes]);
  };
  const delimiter = new Uint8Array(8);
  new DataView(delimiter.buffer).setUint16(0, 0xfffe, true);
  new DataView(delimiter.buffer).setUint16(2, 0xe0dd, true);
  return concat([
    header([0x7fe0, 0x0010], "OB", 0xffffffff, true),
    item(new Uint8Array(0)), // empty basic offset table
    ...fragments.map((f) => item(padEven(f, 0))),
    delimiter,
  ]);
}

export interface WriteDicomOptions {
  transferSyntax: string;
  elements: TestElement[];
  pixelData?: { native: Uint8Array } | { fragments: Uint8Array[] };
}

export function writeDicom({ transferSyntax, elements, pixelData }: WriteDicomOptions): Uint8Array {
  const explicit = transferSyntax !== IMPLICIT_LE;
  const meta = concat(
    [
      { tag: [0x0002, 0x0001], vr: "OB", value: new Uint8Array([0, 1]) },
      { tag: [0x0002, 0x0002], vr: "UI", value: "1.2.840.10008.5.1.4.1.1.1.1" },
      { tag: [0x0002, 0x0003], vr: "UI", value: "1.2.3.4" },
      { tag: [0x0002, 0x0010], vr: "UI", value: transferSyntax },
    ].map((e) => encodeElement(e as TestElement, true)),
  );
  const groupLength = encodeElement({ tag: [0x0002, 0x0000], vr: "UL", value: [meta.length] }, true);
  const sorted = [...elements].sort((a, b) => a.tag[0] - b.tag[0] || a.tag[1] - b.tag[1]);
  const body = concat(sorted.map((e) => encodeElement(e, explicit)));
  const pixels = !pixelData
    ? new Uint8Array(0)
    : "native" in pixelData
      ? encodeElement({ tag: [0x7fe0, 0x0010], vr: "OW", value: pixelData.native }, explicit)
      : encapsulated(pixelData.fragments);
  return concat([new Uint8Array(128), new TextEncoder().encode("DICM"), groupLength, meta, body, pixels]);
}

/** Image module elements for a grayscale image. */
export function imageElements(options: {
  rows: number;
  columns: number;
  bitsAllocated: number;
  bitsStored?: number;
  signed?: boolean;
  photometric?: string;
  samplesPerPixel?: number;
}): TestElement[] {
  return [
    { tag: [0x0028, 0x0002], vr: "US", value: [options.samplesPerPixel ?? 1] },
    { tag: [0x0028, 0x0004], vr: "CS", value: options.photometric ?? "MONOCHROME2" },
    { tag: [0x0028, 0x0010], vr: "US", value: [options.rows] },
    { tag: [0x0028, 0x0011], vr: "US", value: [options.columns] },
    { tag: [0x0028, 0x0100], vr: "US", value: [options.bitsAllocated] },
    { tag: [0x0028, 0x0101], vr: "US", value: [options.bitsStored ?? options.bitsAllocated] },
    { tag: [0x0028, 0x0103], vr: "US", value: [options.signed ? 1 : 0] },
  ];
}

export function uint16Bytes(values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 2);
  const view = new DataView(out.buffer);
  values.forEach((v, i) => view.setUint16(i * 2, v & 0xffff, true));
  return out;
}
