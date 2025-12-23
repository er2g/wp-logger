import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

export const whatsappConfig = {
  sessionPath: process.env.WA_SESSION_PATH || path.join(process.cwd(), '.wwebjs_auth'),
  puppeteerOptions: {
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ],
  },
  clientOptions: {
    authTimeoutMs: 60000,
    qrMaxRetries: 10,
    restartOnAuthFail: true,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
  },
};
