import { NextResponse } from 'next/server';
import { ApiResponse } from '@/shared/src';
import { formatErrorDetail } from './errors';

export function apiSuccess<T>(data: T, status = 200, headers?: HeadersInit): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      data,
      error: null,
    },
    {
      status,
      headers,
    }
  );
}

export function apiError(
  error: unknown,
  fallbackStatus = 500,
  fallbackMessage = 'Internal server error'
): NextResponse<ApiResponse<null>> {
  const { statusCode, errorDetail } = formatErrorDetail(error);
  const finalStatus = statusCode === 500 && fallbackStatus !== 500 ? fallbackStatus : statusCode;

  return NextResponse.json(
    {
      data: null,
      error: {
        code: errorDetail.code,
        message: errorDetail.message || fallbackMessage,
        details: errorDetail.details,
      },
    },
    {
      status: finalStatus,
    }
  );
}
