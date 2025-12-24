export interface OCRExtractInput {
  buffer: Buffer;
  mimeType?: string | null;
  fileName?: string | null;
  language?: string | null;
}

export interface OCRExtractResult {
  text: string;
  json: Record<string, any>;
  provider: string;
  language?: string | null;
}

export interface OCRProvider {
  name: string;
  supportsMimeType(mimeType: string | null, fileName?: string | null): boolean;
  extractText(input: OCRExtractInput): Promise<OCRExtractResult>;
}
