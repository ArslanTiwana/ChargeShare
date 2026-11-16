import * as Sentry from '@sentry/nextjs';

function scrubEvent(event: Sentry.ErrorEvent) {
  if (!event) return event;
  if (event.user) {
    event.user = {
      id: event.user.id,
    };
  }
  return event;
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: false,
  beforeSend(event) {
    return scrubEvent(event);
  },
});
