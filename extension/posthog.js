const POSTHOG_PROJECT_API_KEY = 'phc_hDENoPr4V0Ic2hdeeMd48j62Y9s98h0U7ALbBWveiHy';
const POSTHOG_API_HOST = 'https://eu.i.posthog.com';
const DISTINCT_ID_STORAGE_KEY = 'posthogDistinctId';

let analyticsEnabled = true;
let posthogContext = 'extension';
let distinctIdPromise = null;
let consentListenerAttached = false;

function getExtensionVersion() {
  try {
    return chrome?.runtime?.getManifest?.()?.version || 'unknown';
  } catch (_error) {
    return 'unknown';
  }
}

async function loadAnonymousAnalyticsSetting() {
  try {
    const result = await chrome.storage.local.get(['anonymousAnalytics']);
    analyticsEnabled = typeof result.anonymousAnalytics === 'boolean' ? result.anonymousAnalytics : true;
  } catch (_error) {
    analyticsEnabled = true;
  }
}

async function getDistinctId() {
  if (distinctIdPromise) {
    return distinctIdPromise;
  }

  distinctIdPromise = (async () => {
    try {
      const stored = await chrome.storage.local.get([DISTINCT_ID_STORAGE_KEY]);
      const existing = stored[DISTINCT_ID_STORAGE_KEY];
      if (existing) {
        return String(existing);
      }

      const nextId = crypto.randomUUID();
      await chrome.storage.local.set({ [DISTINCT_ID_STORAGE_KEY]: nextId });
      return nextId;
    } catch (_error) {
      return crypto.randomUUID();
    }
  })();

  return distinctIdPromise;
}

function attachConsentListener() {
  if (consentListenerAttached || !chrome?.storage?.onChanged) {
    return;
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local' || !changes.anonymousAnalytics) {
      return;
    }

    analyticsEnabled = Boolean(changes.anonymousAnalytics.newValue);
  });

  consentListenerAttached = true;
}

export async function initPostHog(context) {
  posthogContext = context || posthogContext;
  await loadAnonymousAnalyticsSetting();
  attachConsentListener();
  await getDistinctId();
}

export function setPostHogConsent(enabled) {
  analyticsEnabled = Boolean(enabled);
}

export function capturePostHogEvent(eventName, properties = {}) {
  if (!POSTHOG_PROJECT_API_KEY || !analyticsEnabled || !eventName) {
    return;
  }

  void (async () => {
    const distinctId = await getDistinctId();

    try {
      await fetch(`${POSTHOG_API_HOST}/capture/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          api_key: POSTHOG_PROJECT_API_KEY,
          event: eventName,
          properties: {
            ...properties,
            distinct_id: distinctId,
            extension_context: posthogContext,
            extension_version: getExtensionVersion(),
            $lib: 'deepfake-detection-extension'
          }
        })
      });
    } catch (_error) {
      // Analytics must not affect product behavior.
    }
  })();
}
