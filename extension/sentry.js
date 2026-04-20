const SENTRY_DSN =
  'https://a272d9342edacdf0db2f0803a5631b81@o4511248127950848.ingest.de.sentry.io/4511248135290960';

let hasInitialised = false;
let sentryModulePromise = null;

async function loadSentryModule() {
  if (!sentryModulePromise) {
    sentryModulePromise = import('@sentry/browser').catch((error) => {
      console.warn('Sentry module could not be loaded:', error);
      return null;
    });
  }

  return sentryModulePromise;
}

function getExtensionVersion() {
  try {
    return chrome?.runtime?.getManifest?.()?.version || 'unknown';
  } catch (_error) {
    return 'unknown';
  }
}

export function initSentry(context) {
  void (async () => {
    if (!SENTRY_DSN) {
      return;
    }

    const Sentry = await loadSentryModule();
    if (!Sentry) {
      return;
    }

    if (hasInitialised) {
      Sentry.setTag('context', context);
      return;
    }

    try {
      Sentry.init({
        dsn: SENTRY_DSN,
        tracesSampleRate: 0.2,
        environment: 'extension',
        release: `deepfake-detection-extension@${getExtensionVersion()}`,
        initialScope: {
          tags: {
            context
          }
        }
      });

      hasInitialised = true;
    } catch (error) {
      // Sentry should never prevent the extension from loading.
      console.warn('Sentry initialisation failed:', error);
    }
  })();
}
