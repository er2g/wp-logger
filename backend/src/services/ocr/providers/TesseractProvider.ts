import { OCRExtractInput, OCRExtractResult, OCRProvider } from '../OcrProvider';
import Tesseract from 'tesseract.js';

export class TesseractProvider implements OCRProvider {
  name = 'tesseract';

  supportsMimeType(mimeType: string | null): boolean {
    return Boolean(mimeType && mimeType.startsWith('image/'));
  }

  async extractText(input: OCRExtractInput): Promise<OCRExtractResult> {
    const language = input.language && input.language !== 'unk' ? input.language : 'eng';
    const result = await Tesseract.recognize(input.buffer, language);

    return {
      text: result.data?.text || '',
      json: result.data || {},
      provider: this.name,
      language,
    };
  }
}

export default new TesseractProvider();
