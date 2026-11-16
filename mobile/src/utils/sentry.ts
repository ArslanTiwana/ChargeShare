import * as Sentry from '@sentry/react-native';

export function initMobileSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    debug: false,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Strict PII scrubber: keep user ID only
      if (event.user) {
        event.user = {
          id: event.user.id,
        };
      }

      if (event.breadcrumbs) {
        for (const b of event.breadcrumbs) {
          if (b.data && typeof b.data === 'object') {
            const bData = b.data as Record<string, unknown>;
            for (const k of Object.keys(bData)) {
              if (
                ['password', 'token', 'phone', 'email', 'address', 'auth'].some((s) =>
                  k.toLowerCase().includes(s)
                )
              ) {
                bData[k] = '[REDACTED]';
              }
            }
          }
        }
      }

      return event;
    },
  });
}
