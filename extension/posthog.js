const POSTHOG_PROJECT_API_KEY = 'phc_hDENoPr4V0Ic2hdeeMd48j62Y9s98h0U7ALbBWveiHy';
const POSTHOG_API_HOST = 'https://eu.i.posthog.com';
const POSTHOG_SDK_MODULE_PATH = './node_modules/posthog-js/dist/module.no-external.js';

const DISTINCT_ID_STORAGE_KEY = 'posthogDistinctId';
const SESSION_ID_STORAGE_KEY = 'posthogSessionId';
const EVENT_QUEUE_STORAGE_KEY = 'posthogEventQueue';
const FLUSH_INTERVAL_MS = 10000;
const MAX_QUEUE_SIZE = 200;
const MAX_RETRY_COUNT = 3;

let analyticsEnabled = false;
let posthogContext = 'extension';
let distinctIdPromise = null;
let sessionIdPromise = null;
let queuePromise = null;
let flushTimer = null;
let flushInFlight = false;
let consentListenerAttached = false;
let lifecycleListenersAttached = false;
let sdkInitAttempted = false;
let sdkClient = null;
let lastKnownConsent = false;

function getExtensionVersion() {
  try {
    return chrome?.runtime?.getManifest?.()?.version || 'unknown';
  } catch (_error) {
    return 'unknown';
  }
}

function getRuntimeContext() {
  try {
    if (chrome?.runtime?.id) {
      return 'extension_page';
    }
  } catch (_error) {
    // ignore
  }

  return 'unknown';
}

function getNowIso() {
  return new Date().toISOString();
}

async function loadAnonymousAnalyticsSetting() {
  try {
    const result = await chrome.storage.local.get(['anonymousAnalytics']);
    analyticsEnabled = typeof result.anonymousAnalytics === 'boolean' ? result.anonymousAnalytics : false;
  } catch (_error) {
    analyticsEnabled = false;
  }
  lastKnownConsent = analyticsEnabled;
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

async function getSessionId() {
  if (sessionIdPromise) {
    return sessionIdPromise;
  }

  sessionIdPromise = (async () => {
    try {
      const stored = await chrome.storage.session.get([SESSION_ID_STORAGE_KEY]);
      const existing = stored[SESSION_ID_STORAGE_KEY];
      if (existing) {
        return String(existing);
      }

      const nextId = crypto.randomUUID();
      await chrome.storage.session.set({ [SESSION_ID_STORAGE_KEY]: nextId });
      return nextId;
    } catch (_error) {
      return crypto.randomUUID();
    }
  })();

  return sessionIdPromise;
}

async function loadQueue() {
  if (queuePromise) {
    return queuePromise;
  }

  queuePromise = (async () => {
    try {
      const stored = await chrome.storage.local.get([EVENT_QUEUE_STORAGE_KEY]);
      const queue = stored[EVENT_QUEUE_STORAGE_KEY];
      return Array.isArray(queue) ? queue : [];
    } catch (_error) {
      return [];
    }
  })();

  return queuePromise;
}

async function saveQueue(queue) {
  queuePromise = Promise.resolve(queue);
  try {
    await chrome.storage.local.set({ [EVENT_QUEUE_STORAGE_KEY]: queue });
  } catch (_error) {
    // Analytics storage failures should never affect product behavior.
  }
}

function attachConsentListener() {
  if (consentListenerAttached || !chrome?.storage?.onChanged) {
    return;
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local' || !changes.anonymousAnalytics) {
      return;
    }

    setPostHogConsent(Boolean(changes.anonymousAnalytics.newValue), { source: 'user' });
  });

  consentListenerAttached = true;
}

function scheduleFlush(delayMs = FLUSH_INTERVAL_MS) {
  if (flushTimer) {
    return;
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPostHogQueue();
  }, delayMs);
}

function attachLifecycleListeners() {
  if (lifecycleListenersAttached || typeof self === 'undefined' || !self.addEventListener) {
    return;
  }

  self.addEventListener('online', () => {
    void flushPostHogQueue({ immediate: true });
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        void flushPostHogQueue({ immediate: true, preferBeacon: true });
      }
    });
  }

  self.addEventListener('pagehide', () => {
    void flushPostHogQueue({ immediate: true, preferBeacon: true });
  });

  lifecycleListenersAttached = true;
}

function buildEnvelope(eventName, properties = {}) {
  return {
    api_key: POSTHOG_PROJECT_API_KEY,
    event: eventName,
    properties
  };
}

async function sendEventViaFetch(eventPayload, keepAlive = false) {
  const response = await fetch(`${POSTHOG_API_HOST}/capture/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    keepalive: keepAlive,
    body: JSON.stringify(eventPayload)
  });

  if (!response.ok) {
    throw new Error(`PostHog request failed with status ${response.status}`);
  }
}

function sendEventViaBeacon(eventPayload) {
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
    return false;
  }

  try {
    const body = JSON.stringify(eventPayload);
    return navigator.sendBeacon(
      `${POSTHOG_API_HOST}/capture/`,
      new Blob([body], { type: 'application/json' })
    );
  } catch (_error) {
    return false;
  }
}

async function enqueueEvent(envelope) {
  const queue = await loadQueue();
  const nextQueue = [...queue, envelope];
  if (nextQueue.length > MAX_QUEUE_SIZE) {
    nextQueue.splice(0, nextQueue.length - MAX_QUEUE_SIZE);
  }
  await saveQueue(nextQueue);
}

function withDefaults(properties = {}) {
  return {
    ...properties,
    extension_context: posthogContext,
    extension_version: getExtensionVersion(),
    runtime_context: getRuntimeContext(),
    $lib: 'deepfake-detection-extension',
    $lib_version: 'custom-fetch-v2'
  };
}

async function initPostHogSdk(distinctId, sessionId) {
  if (sdkInitAttempted || !POSTHOG_PROJECT_API_KEY) {
    return;
  }

  sdkInitAttempted = true;

  try {
    const module = await import(POSTHOG_SDK_MODULE_PATH);
    const client = module?.default || module;
    if (!client || typeof client.init !== 'function') {
      return;
    }

    client.init(POSTHOG_PROJECT_API_KEY, {
      api_host: POSTHOG_API_HOST,
      persistence: 'localStorage',
      opt_out_capturing_by_default: true,
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: false,
      session_recording: {
        maskAllInputs: true,
        maskInputOptions: {
          password: true
        }
      }
    });

    sdkClient = client;
    sdkClient.register(
      withDefaults({
        distinct_id: distinctId,
        session_id: sessionId,
        $session_id: sessionId
      })
    );

    if (!analyticsEnabled && typeof sdkClient.opt_out_capturing === 'function') {
      sdkClient.opt_out_capturing();
    }
  } catch (_error) {
    // Fall back to custom capture transport if SDK cannot be loaded.
  }
}

export async function flushPostHogQueue(options = {}) {
  if (!POSTHOG_PROJECT_API_KEY || !analyticsEnabled || flushInFlight) {
    return;
  }

  flushInFlight = true;

  try {
    const queue = await loadQueue();
    if (!queue.length) {
      return;
    }

    const keepAlive = Boolean(options.immediate);
    const preferBeacon = Boolean(options.preferBeacon);
    const remaining = [];

    for (const envelope of queue) {
      const nextRetryCount = Number(envelope.retry_count || 0);
      const payload = buildEnvelope(envelope.event, envelope.properties);
      let delivered = false;

      if (preferBeacon) {
        delivered = sendEventViaBeacon(payload);
      }

      if (!delivered) {
        try {
          await sendEventViaFetch(payload, keepAlive);
          delivered = true;
        } catch (_error) {
          delivered = false;
        }
      }

      if (!delivered && nextRetryCount < MAX_RETRY_COUNT) {
        remaining.push({
          ...envelope,
          retry_count: nextRetryCount + 1
        });
      }
    }

    await saveQueue(remaining);
    if (remaining.length) {
      scheduleFlush(FLUSH_INTERVAL_MS);
    }
  } finally {
    flushInFlight = false;
  }
}

export async function initPostHog(context) {
  posthogContext = context || posthogContext;
  await loadAnonymousAnalyticsSetting();
  attachConsentListener();
  attachLifecycleListeners();
  const [distinctId, sessionId] = await Promise.all([getDistinctId(), getSessionId(), loadQueue()]);
  await initPostHogSdk(distinctId, sessionId);
  scheduleFlush(1500);
}

export function setPostHogConsent(enabled, options = {}) {
  const nextConsent = Boolean(enabled);
  const previousConsent = lastKnownConsent;

  analyticsEnabled = nextConsent;
  lastKnownConsent = nextConsent;

  if (sdkClient && typeof sdkClient.opt_in_capturing === 'function' && typeof sdkClient.opt_out_capturing === 'function') {
    if (!nextConsent) {
      sdkClient.opt_out_capturing();
    } else if (!previousConsent && options.source === 'user') {
      const alreadyOptedIn = typeof sdkClient.has_opted_in_capturing === 'function'
        ? sdkClient.has_opted_in_capturing()
        : false;
      if (!alreadyOptedIn) {
        sdkClient.opt_in_capturing();
      }
    }
  }

  if (analyticsEnabled) {
    scheduleFlush(500);
  }
}

export function capturePostHogEvent(eventName, properties = {}, options = {}) {
  if (!POSTHOG_PROJECT_API_KEY || !analyticsEnabled || !eventName) {
    return;
  }

  void (async () => {
    const [distinctId, sessionId] = await Promise.all([getDistinctId(), getSessionId()]);
    const enrichedProperties = withDefaults({
      ...properties,
      distinct_id: distinctId,
      session_id: sessionId,
      $session_id: sessionId,
      client_timestamp: getNowIso()
    });

    await initPostHogSdk(distinctId, sessionId);

    if (sdkClient && typeof sdkClient.capture === 'function') {
      try {
        sdkClient.capture(eventName, enrichedProperties);
        return;
      } catch (_error) {
        // If SDK capture fails, fall through to queued transport.
      }
    }

    const envelope = {
      event: eventName,
      properties: enrichedProperties,
      retry_count: 0
    };

    await enqueueEvent(envelope);
    if (options.immediate) {
      void flushPostHogQueue({ immediate: true, preferBeacon: Boolean(options.preferBeacon) });
      return;
    }

    scheduleFlush(500);
  })();
}

export function capturePostHogError(eventName, error, properties = {}, options = {}) {
  capturePostHogEvent(eventName, {
    ...properties,
    error_name: error?.name || 'Error',
    error_message: error?.message || 'Unknown error',
    error_stack: String(error?.stack || '').slice(0, 1500),
    level: 'error',
    event_category: 'error',
    $exception: true,
    $exception_type: error?.name || 'Error',
    $exception_message: error?.message || 'Unknown error'
  }, options);
}

export async function getPostHogDiagnostics() {
  const queue = await loadQueue();
  return {
    analytics_enabled: analyticsEnabled,
    queue_length: queue.length,
    context: posthogContext,
    api_host: POSTHOG_API_HOST
  };
}
