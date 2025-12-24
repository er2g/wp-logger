import { OCRExtractInput, OCRExtractResult, OCRProvider } from './OcrProvider';
import azureReadProvider from './providers/AzureReadProvider';
import tesseractProvider from './providers/TesseractProvider';

export class OcrService {
  private primary: OCRProvider;
  private fallback: OCRProvider | null;

  constructor() {
    const primaryName = (process.env.OCR_PROVIDER || 'azure').toLowerCase();
    const fallbackName = (process.env.OCR_FALLBACK_PROVIDER || '').toLowerCase();
    this.primary = this.resolveProvider(primaryName);
    this.fallback = fallbackName ? this.resolveProvider(fallbackName) : null;
  }

  private resolveProvider(name: string): OCRProvider {
    switch (name) {
      case 'tesseract':
        return tesseractProvider;
      case 'azure':
      case 'azure-read':
      default:
        return azureReadProvider;
    }
  }

  async extractText(input: OCRExtractInput): Promise<OCRExtractResult> {
    if (this.primary.supportsMimeType(input.mimeType || null, input.fileName || undefined)) {
      try {
        return await this.primary.extractText(input);
      } catch (error) {
        if (!this.fallback) {
          throw error;
        }
      }
    }

    if (this.fallback && this.fallback.supportsMimeType(input.mimeType || null, input.fileName || undefined)) {
      return this.fallback.extractText(input);
    }

    throw new Error('No OCR provider available for this file type');
  }
}

export default new OcrService();
