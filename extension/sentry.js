const SENTRY_DSN =
  'https://a272d9342edacdf0db2f0803a5631b81@o4511248127950848.ingest.de.sentry.io/4511248135290960';

let sentryInitialised = false;
let sentryContext = 'extension';

function getExtensionVersion() {
  try {
    return chrome?.runtime?.getManifest?.()?.version || 'unknown';
  } catch (_error) {
    return 'unknown';
  }
}

function parseDsn(dsn) {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const host = url.host;
    const pathParts = url.pathname.split('/').filter(Boolean);
    const projectId = pathParts[pathParts.length - 1];

    if (!publicKey || !host || !projectId) {
      return null;
    }

    return {
      dsn,
      publicKey,
      host,
      projectId,
      endpoint: `https://${host}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`
    };
  } catch (_error) {
    return null;
  }
}

function toSentryStackFrames(stackText) {
  if (!stackText) {
    return [];
  }

  const lines = String(stackText).split('\n').slice(0, 20);
  return lines.map((line) => ({
    function: line.trim()
  }));
}

function createEventPayload(message, level, extra = {}) {
  const eventId = crypto.randomUUID().replace(/-/g, '');
  const timestamp = new Date().toISOString();
  const extensionVersion = getExtensionVersion();

  return {
    eventId,
    envelopeHeader: {
      event_id: eventId,
      sent_at: timestamp,
      dsn: SENTRY_DSN
    },
    event: {
      event_id: eventId,
      timestamp,
      level,
      platform: 'javascript',
      release: `deepfake-detection-extension@${extensionVersion}`,
      environment: 'extension',
      tags: {
        context: sentryContext
      },
      extra,
      exception: {
        values: [
          {
            type: extra.errorType || 'Error',
            value: message || 'Unknown error',
            stacktrace: {
              frames: toSentryStackFrames(extra.stack)
            }
          }
        ]
      }
    }
  };
}

async function sendEnvelope(payload) {
  const dsnInfo = parseDsn(SENTRY_DSN);
  if (!dsnInfo) {
    return;
  }

  const envelope = `${JSON.stringify(payload.envelopeHeader)}\n${JSON.stringify({
    type: 'event'
  })}\n${JSON.stringify(payload.event)}`;

  try {
    await fetch(dsnInfo.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8'
      },
      body: envelope
    });
  } catch (_error) {
    // Sentry must never break extension behavior.
  }
}

function setupGlobalErrorHandlers() {
  self.addEventListener('error', (event) => {
    const error = event?.error;
    const payload = createEventPayload(
      error?.message || event?.message || 'Unhandled error',
      'error',
      {
        errorType: error?.name || 'Error',
        stack: error?.stack || '',
        source: event?.filename || '',
        line: event?.lineno || 0,
        column: event?.colno || 0
      }
    );
    void sendEnvelope(payload);
  });

  self.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const message =
      reason?.message || (typeof reason === 'string' ? reason : 'Unhandled promise rejection');
    const payload = createEventPayload(message, 'error', {
      errorType: reason?.name || 'UnhandledRejection',
      stack: reason?.stack || ''
    });
    void sendEnvelope(payload);
  });
}

export function captureSentryException(error, extra = {}) {
  if (!sentryInitialised) {
    return;
  }

  const payload = createEventPayload(error?.message || 'Captured exception', 'error', {
    errorType: error?.name || 'Error',
    stack: error?.stack || '',
    ...extra
  });
  void sendEnvelope(payload);
}

export function initSentry(context) {
  sentryContext = context || sentryContext;

  if (sentryInitialised || !SENTRY_DSN) {
    return;
  }

  sentryInitialised = true;
  setupGlobalErrorHandlers();
}
