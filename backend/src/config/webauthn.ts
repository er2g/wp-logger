import * as dotenv from 'dotenv';

dotenv.config();

export const webauthnConfig = {
  rpID: process.env.RP_ID || 'localhost',
  rpName: process.env.RP_NAME || 'WhatsApp Manager',
  origin: process.env.RP_ORIGIN || 'http://localhost:5173',
  timeout: 60000,
  challengeSize: 32,
  attestationType: 'none' as const,
  authenticatorSelection: {
    residentKey: 'preferred' as const,
    userVerification: 'preferred' as const,
  },
};

if (process.env.NODE_ENV === 'production' && webauthnConfig.rpID === 'localhost') {
  console.warn('WARNING: RP_ID is set to localhost in production. Please configure proper domain.');
}
