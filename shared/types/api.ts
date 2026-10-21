/**
 * Common API type definitions
 * Shared between frontend and backend to ensure type safety
 */

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Paginated API response
 */
export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Error response
 */
export interface ApiError {
  success: false;
  error: string;
  message?: string;
  statusCode?: number;
  details?: any;
}

/**
 * API query parameters for filtering
 */
export interface QueryFilters {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Upload file response
 */
export interface FileUploadResponse {
  success: boolean;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

/**
 * Batch operation response
 */
export interface BatchOperationResponse<T = any> {
  success: boolean;
  results: {
    successful: T[];
    failed: {
      item: T;
      error: string;
    }[];
  };
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}
