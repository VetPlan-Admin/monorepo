import * as dicomParserNamespace from "dicom-parser";

// dicom-parser ships a UMD/CommonJS bundle: bundlers expose its exports as the namespace,
// while Node's ESM loader (Vitest) only exposes them under `default`.
export const dicomParser: typeof dicomParserNamespace =
  (dicomParserNamespace as unknown as { default?: typeof dicomParserNamespace }).default ??
  dicomParserNamespace;

export type { DataSet, Element } from "dicom-parser";
