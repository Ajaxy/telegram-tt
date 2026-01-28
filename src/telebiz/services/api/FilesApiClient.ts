import type {
  ApiResponse,
} from '../types';

import { BaseApiClient } from './BaseApiClient';

/**
 * Telebiz Files API Client
 */
export class FilesApiClient extends BaseApiClient {
  // Provider Discovery
  async uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.request<ApiResponse<{ url: string }>>(
      '/files/upload',
      {
        method: 'PUT',
        body: formData,
      },
    );

    if (response.status !== 'success' || !response.data.url) {
      throw new Error('Failed to fetch providers');
    }

    return response.data.url;
  }
}
