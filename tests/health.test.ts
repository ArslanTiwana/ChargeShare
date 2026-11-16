import { describe, it, expect } from 'vitest';
import { GET as healthCheck } from '@/app/api/v1/health/route';

describe('Health Check Probe', () => {
  it('returns ok and confirms live database connection', async () => {
    const res = await healthCheck();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.status).toBe('ok');
    expect(body.data.service).toBe('chargeshare-api');
    expect(body.data.database).toBe('connected');
    expect(typeof body.data.uptime).toBe('number');
  });
});
