import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';
import apiClient from '../api/ApiClient';

interface RegistrationResponse {
  success: boolean;
  data: {
    accessToken: string;
    expiresIn: string;
    user: {
      id: string;
      username: string;
      role: 'admin' | 'user';
    };
  };
}

interface LoginResponse {
  success: boolean;
  data: {
    accessToken: string;
    expiresIn: string;
    user: {
      id: string;
      username: string;
      role: 'admin' | 'user';
    };
  };
}

class WebAuthnClient {
  async register(username: string): Promise<RegistrationResponse> {
    const optionsResponse = await apiClient.post<{
      success: boolean;
      data: PublicKeyCredentialCreationOptionsJSON;
    }>('/auth/register/start', { username });

    if (!optionsResponse.success) {
      throw new Error('Failed to get registration options');
    }

    const credential = await startRegistration(optionsResponse.data);

    const verificationResponse = await apiClient.post<RegistrationResponse>(
      '/auth/register/complete',
      {
        username,
        credential,
      }
    );

    if (!verificationResponse.success) {
      throw new Error('Registration failed');
    }

    return verificationResponse;
  }

  async login(username: string): Promise<LoginResponse> {
    const optionsResponse = await apiClient.post<{
      success: boolean;
      data: PublicKeyCredentialRequestOptionsJSON;
    }>('/auth/login/start', { username });

    if (!optionsResponse.success) {
      throw new Error('Failed to get login options');
    }

    const assertion = await startAuthentication(optionsResponse.data);

    const verificationResponse = await apiClient.post<LoginResponse>(
      '/auth/login/complete',
      {
        username,
        assertion,
      }
    );

    if (!verificationResponse.success) {
      throw new Error('Login failed');
    }

    return verificationResponse;
  }

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  }
}

export default new WebAuthnClient();
