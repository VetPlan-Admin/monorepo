// jpeg-lossless-decoder-js 2.1.2 points "types" at a file it doesn't ship; declare what we use.
declare module "jpeg-lossless-decoder-js" {
  export class Decoder {
    /** Decodes a JPEG Lossless (process 14) stream; returns rows × cols × bytes-per-sample. */
    decompress(buffer: ArrayBuffer, offset?: number, length?: number): ArrayBuffer;
  }
}
