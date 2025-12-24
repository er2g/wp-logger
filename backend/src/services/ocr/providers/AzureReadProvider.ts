import axios from 'axios';
import * as mime from 'mime-types';
import { OCRExtractInput, OCRExtractResult, OCRProvider } from '../OcrProvider';

export class AzureReadProvider implements OCRProvider {
  name = 'azure-read';
  private endpoint: string;
  private apiVersion: string;
  private subscriptionKey: string;
  private pollIntervalMs: number;
  private maxPolls: number;

  constructor() {
    this.endpoint = (process.env.OCR_AZURE_ENDPOINT || '').replace(/\/$/, '');
    this.apiVersion = process.env.OCR_AZURE_API_VERSION || 'v3.2';
    this.subscriptionKey = process.env.OCR_AZURE_KEY || '';
    this.pollIntervalMs = parseInt(process.env.OCR_AZURE_POLL_INTERVAL_MS || '1000', 10);
    this.maxPolls = parseInt(process.env.OCR_AZURE_MAX_POLLS || '120', 10);
  }

  supportsMimeType(mimeType: string | null, fileName?: string | null): boolean {
    if (!mimeType && fileName) {
      const guess = mime.lookup(fileName);
      mimeType = typeof guess === 'string' ? guess : null;
    }
    if (!mimeType) {
      return false;
    }
    return (
      mimeType.startsWith('image/') ||
      mimeType === 'application/pdf' ||
      mimeType === 'application/octet-stream'
    );
  }

  async extractText(input: OCRExtractInput): Promise<OCRExtractResult> {
    if (!this.endpoint || !this.subscriptionKey) {
      throw new Error('Azure OCR credentials are not configured');
    }

    const contentType = input.mimeType || 'application/octet-stream';
    const analyzeUrl = `${this.endpoint}/vision/${this.apiVersion}/read/analyze`;
    const language = input.language || 'unk';

    const response = await axios.post(analyzeUrl, input.buffer, {
      headers: {
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Content-Type': contentType,
      },
      params: {
        language,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const operationLocation = response.headers['operation-location'] as string | undefined;
    if (!operationLocation) {
      throw new Error('Azure OCR did not return operation location');
    }

    let attempt = 0;
    while (attempt < this.maxPolls) {
      attempt += 1;
      const pollResponse = await axios.get(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        },
      });

      const status = pollResponse.data?.status;
      if (status === 'succeeded') {
        const analyzeResult = pollResponse.data?.analyzeResult || {};
        const readResults = analyzeResult.readResults || [];
        const lines: string[] = [];
        readResults.forEach((page: any) => {
          (page.lines || []).forEach((line: any) => {
            if (line.text) {
              lines.push(line.text);
            }
          });
        });

        return {
          text: lines.join('\n'),
          json: pollResponse.data,
          provider: this.name,
          language,
        };
      }

      if (status === 'failed') {
        throw new Error('Azure OCR failed to process document');
      }

      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
    }

    throw new Error('Azure OCR timeout');
  }
}

export default new AzureReadProvider();
