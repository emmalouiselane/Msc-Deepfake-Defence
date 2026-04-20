# Deepfake Detection Chrome Extension

## Overview

A Chrome Manifest V3 extension for deepfake-risk analysis with on-device ONNX inference, a quick popup control surface, and a full new-tab dashboard for deeper workflows.

The extension is designed for research and prototyping, with local-first analysis and optional telemetry for reliability and product insight.

## Extension Structure

```text
extension/
|-- manifest.json              # Extension configuration
|-- popup/                     # Popup interface
|   |-- popup.html
|   |-- popup.css
|   `-- popup.js
|-- newtab/                    # Full analysis interface
|   |-- newtab.html
|   |-- newtab.css
|   |-- newtab.js
|   `-- components/
|-- background/                # MV3 service worker
|   `-- background.js
|-- content/                   # Content script integration
|   |-- content.js
|   `-- content.css
|-- models/                    # ONNX models and data files
|-- dist/                      # Runtime assets copied/bundled for inference
|-- sentry.js                  # Sentry integration (custom fetch transport)
|-- posthog.js                 # PostHog integration (queued custom transport)
|-- vite.config.js
`-- icons/
```

## Features

### Popup Interface
- Detection enable/disable toggle
- Sensitivity adjustment
- Detection mode UI (manual currently enforced in popup flow)
- Quick navigation to full analysis pages in new tab
- Telemetry test trigger (via DevTools helper)

### New Tab Interface
- Dashboard and analytics views
- Upload flow for image/video analysis and batch processing
- Analysis history and result browsing
- Re-analysis flow for existing results
- Export functionality (JSON)
- Settings management including `anonymousAnalytics`

### Background Service Worker
- ONNX runtime/model orchestration
- Media analysis request handling
- Model selection and initialization logic
- History/statistics persistence coordination

### Content Script Integration
- In-page media discovery and interaction support
- Messaging bridge to background and UI surfaces

## Technical Implementation

### Core Stack
- Chrome Extension Manifest V3
- JavaScript (ES modules)
- ONNX Runtime Web + ONNX model artifacts
- Vite build pipeline

### Runtime Architecture
- `background/background.js` is the central inference and orchestration layer.
- `popup/popup.js` is optimized for quick controls and status.
- `newtab/newtab.js` provides the full operational interface.
- Shared telemetry helpers (`sentry.js`, `posthog.js`) are imported by popup/newtab.

## Telemetry and Observability

### Included Integrations
- Sentry error tracking
- PostHog product analytics

### Consent and Privacy Control
- Telemetry is gated by `anonymousAnalytics` in extension settings/storage.
- If disabled, PostHog capture is suppressed.

### Network Destinations
- Sentry ingest endpoint (from configured DSN host)
- PostHog ingest endpoint (`https://eu.i.posthog.com`)

These are explicitly allowed in `manifest.json` CSP `connect-src`.

## Telemetry Test Harness

Use the popup harness to simulate a problem expected in both systems.

### Trigger
Open popup DevTools and run:

```js
window.__simulateTelemetryIssue()
```

### Expected Results
- PostHog event: `simulated_problem_triggered`
- Sentry error issue with message: `Simulated telemetry issue from popup`

### Troubleshooting
- Confirm `anonymousAnalytics` is enabled.
- Run from popup DevTools (not webpage DevTools).
- Reload extension in `chrome://extensions` and retry.

## Installation

### Development Setup
1. Clone repository
2. Open `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the `extension/` directory

### Local Build Workflow

```bash
cd extension
npm install
npm run build
```

Build uses Vite and updates extension assets, including runtime/bundled files in `dist/`.

## Configuration

### User-Facing Settings (Current)
- Detection enabled/disabled
- Sensitivity
- Model selection (`mesonet` or `lightweight`, where exposed in UI)
- Detail level
- Anonymous analytics preference

### Stored Data
- Analysis history
- Aggregated statistics
- Settings/preferences
- IndexedDB media preview records (for some analysis flows)

## Security and Privacy

### Current Behavior
- Core media analysis is local/on-device.
- Extension data is stored via Chrome extension storage and IndexedDB.
- Optional telemetry sends event/error metadata to configured PostHog/Sentry endpoints.

### Permissions
- `activeTab`
- `storage`
- `scripting`
- Host permissions for content-script/media workflows

### CSP
- Uses strict extension-page CSP with explicit `connect-src` allowlist.

## Browser Compatibility

- Chrome/Chromium (primary target, MV3)
- Edge (Chromium-based) expected compatible
- Firefox/Safari require separate adaptation

## Performance Notes

### Practical Targets
- Responsive popup interactions
- Fast local analysis pipeline for supported media
- Stable background worker lifecycle and model reuse

### Optimization Patterns in Project
- Background worker centralizes model session management
- Runtime assets pre-copied for inference environment
- UI flows avoid blocking where possible

## Development Notes

### Key Classes/Modules
- `DeepfakeDetector` (popup)
- `FullAnalysisPlatform` (new tab)
- `BackgroundService` (service worker)

### Build and Runtime
- Source files are ES modules.
- Extension should be reloaded in `chrome://extensions` after code changes.

## Future Enhancements

### Model and Analysis
- Broader model support and version controls
- Additional calibration and explainability outputs
- Improved video-specific workflows

### Product and UX
- Expanded analytics dashboards
- Better filtering/searching in history
- Accessibility and keyboard navigation improvements

### Reliability and Ops
- Additional telemetry dashboards and alerts
- Stronger end-to-end testing for popup/newtab/background messaging
