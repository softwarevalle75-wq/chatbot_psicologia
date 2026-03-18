declare module "pdfreader" {
  export class PdfReader {
    parseBuffer(
      buffer: Buffer,
      callback: (err: unknown, item: unknown) => void
    ): void;
    parseFileItems(
      filePath: string,
      callback: (err: unknown, item: unknown) => void
    ): void;
  }
}
