import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = '/api/v1';

class ApiClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const storedToken = window.localStorage.getItem('accessToken');
      if (storedToken) {
        this.accessToken = storedToken;
      }
    }

    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.clearToken();
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string | null): void {
    this.accessToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        window.localStorage.setItem('accessToken', token);
      } else {
        window.localStorage.removeItem('accessToken');
      }
    }
  }

  clearToken(): void {
    this.accessToken = null;
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('accessToken');
    }
  }

  getToken(): string | null {
    return this.accessToken;
  }

  getTokenFromStorage(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.localStorage.getItem('accessToken');
  }

  getBaseUrl(): string {
    return API_BASE_URL;
  }

  async get<T>(url: string, params?: any): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async getBlob(url: string, params?: any): Promise<{ data: Blob; headers: Record<string, string> }> {
    const response = await this.client.get(url, { params, responseType: 'blob' });
    return { data: response.data, headers: response.headers as Record<string, string> };
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.patch<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }

  async postBlob(url: string, data?: any): Promise<{ data: Blob; headers: Record<string, string> }> {
    const response = await this.client.post(url, data, { responseType: 'blob' });
    return { data: response.data, headers: response.headers as Record<string, string> };
  }
}

export default new ApiClient();
