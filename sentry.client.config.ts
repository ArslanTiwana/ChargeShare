import * as Sentry from '@sentry/nextjs';

function scrubEvent(event: Sentry.ErrorEvent) {
  if (!event) return event;
  if (event.user) {
    event.user = {
      id: event.user.id,
    };
  }

  if (event.request) {
    if (event.request.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }
    if (event.request.data && typeof event.request.data === 'object') {
      const data = { ...(event.request.data as Record<string, unknown>) };
      const sensitivePatterns = [
        'password',
        'token',
        'phone',
        'address',
        'email',
        'meterstartphoto',
        'meterendphoto',
        'screenshot',
        'key',
      ];
      for (const key of Object.keys(data)) {
        if (sensitivePatterns.some((pattern) => key.toLowerCase().includes(pattern))) {
          data[key] = '[REDACTED]';
        }
      }
      event.request.data = data;
    }
  }

  if (event.breadcrumbs) {
    for (const b of event.breadcrumbs) {
      if (b.data && typeof b.data === 'object') {
        const bData = b.data as Record<string, unknown>;
        for (const k of Object.keys(bData)) {
          if (['password', 'token', 'phone', 'email', 'address', 'auth'].some((s) => k.toLowerCase().includes(s))) {
            bData[k] = '[REDACTED]';
          }
        }
      }
    }
  }

  return event;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  beforeSend(event) {
    return scrubEvent(event);
  },
});
