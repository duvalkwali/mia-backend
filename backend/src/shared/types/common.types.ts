export interface TenantContext {
  tenantId: string;
  userId: string;
  role: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * COST OPTIMIZATION: Cost tracking interface
 */
export interface CostMetrics {
  operation: string;
  modelUsed: string;
  tokensUsed: number;
  costUsd: number;
}
