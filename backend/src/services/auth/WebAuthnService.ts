import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import { webauthnConfig } from '../../config/webauthn';
import logger from '../../utils/logger';

interface StoredChallenge {
  challenge: string;
  timestamp: number;
}

export class WebAuthnService {
  private challenges: Map<string, StoredChallenge> = new Map();
  private readonly challengeTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    setInterval(() => this.cleanupExpiredChallenges(), 60 * 1000);
  }

  private cleanupExpiredChallenges(): void {
    const now = Date.now();
    for (const [key, value] of this.challenges.entries()) {
      if (now - value.timestamp > this.challengeTimeout) {
        this.challenges.delete(key);
      }
    }
  }

  private storeChallenge(username: string, challenge: string): void {
    this.challenges.set(username, {
      challenge,
      timestamp: Date.now(),
    });
  }

  private getChallenge(username: string): string | null {
    const stored = this.challenges.get(username);
    if (!stored) return null;

    if (Date.now() - stored.timestamp > this.challengeTimeout) {
      this.challenges.delete(username);
      return null;
    }

    return stored.challenge;
  }

  private removeChallenge(username: string): void {
    this.challenges.delete(username);
  }

  async generateRegistrationOptions(username: string, userId: string) {
    try {
      const options = await generateRegistrationOptions({
        rpName: webauthnConfig.rpName,
        rpID: webauthnConfig.rpID,
        userID: userId,
        userName: username,
        timeout: webauthnConfig.timeout,
        attestationType: webauthnConfig.attestationType,
        authenticatorSelection: webauthnConfig.authenticatorSelection,
      });

      this.storeChallenge(username, options.challenge);

      return options;
    } catch (error) {
      logger.error('Failed to generate registration options:', error);
      throw error;
    }
  }

  async verifyRegistration(
    username: string,
    response: RegistrationResponseJSON
  ): Promise<VerifiedRegistrationResponse> {
    try {
      const expectedChallenge = this.getChallenge(username);
      if (!expectedChallenge) {
        throw new Error('Challenge not found or expired');
      }

      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: webauthnConfig.origin,
        expectedRPID: webauthnConfig.rpID,
      });

      if (verification.verified) {
        this.removeChallenge(username);
      }

      return verification;
    } catch (error) {
      logger.error('Failed to verify registration:', error);
      throw error;
    }
  }

  async generateAuthenticationOptions(
    username: string,
    allowCredentials?: { id: string; type: 'public-key'; transports?: string[] }[]
  ) {
    try {
      const options = await generateAuthenticationOptions({
        timeout: webauthnConfig.timeout,
        allowCredentials: (allowCredentials || []) as any,
        userVerification: webauthnConfig.authenticatorSelection.userVerification,
        rpID: webauthnConfig.rpID,
      });

      this.storeChallenge(username, options.challenge);

      return options;
    } catch (error) {
      logger.error('Failed to generate authentication options:', error);
      throw error;
    }
  }

  async verifyAuthentication(
    username: string,
    response: AuthenticationResponseJSON,
    credentialPublicKey: Uint8Array,
    credentialCounter: number
  ): Promise<VerifiedAuthenticationResponse> {
    try {
      const expectedChallenge = this.getChallenge(username);
      if (!expectedChallenge) {
        throw new Error('Challenge not found or expired');
      }

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: webauthnConfig.origin,
        expectedRPID: webauthnConfig.rpID,
        authenticator: {
          credentialPublicKey,
          credentialID: new Uint8Array(Buffer.from(response.id, 'base64url')),
          counter: credentialCounter,
        },
      });

      if (verification.verified) {
        this.removeChallenge(username);
      }

      return verification;
    } catch (error) {
      logger.error('Failed to verify authentication:', error);
      throw error;
    }
  }

  base64ToUint8Array(base64: string): Uint8Array {
    const buffer = Buffer.from(base64, 'base64');
    return new Uint8Array(buffer);
  }

  uint8ArrayToBase64(uint8Array: Uint8Array): string {
    return Buffer.from(uint8Array).toString('base64');
  }
}

export default new WebAuthnService();
