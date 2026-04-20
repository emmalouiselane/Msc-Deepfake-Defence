import { captureSentryException, initSentry } from '../sentry.js';
import { capturePostHogError, capturePostHogEvent, flushPostHogQueue, initPostHog } from '../posthog.js';

// Deepfake Detection Extension - Popup Script
class DeepfakeDetector {
    constructor() {
        this.isExtensionReady = false;
        this.maxRetries = 3;
        this.draggingSlider = false;

        initSentry('popup');
        void initPostHog('popup');

        this.initialiseElements();
        this.attachEventListeners();
        this.registerTelemetrySimulator();
    }

    initialiseElements() {
        this.openNewTabBtn = document.getElementById('openNewTabBtn');
        this.moreSettingsBtn = document.getElementById('moreSettingsBtn');
        this.btnToggle = document.getElementById('btnToggle');
        this.sensitivitySlider = document.getElementById('sensitivitySlider');
        this.customSlider = document.getElementById('customSlider');
        this.sliderTrack = document.getElementById('sliderTrack');
        this.sliderThumb = document.getElementById('sliderThumb');
        this.statusSection = document.getElementById('statusText');
        this.manualMode = document.getElementById('manualMode');
        this.automaticMode = document.getElementById('automaticMode');
        this.modeSection = document.querySelector('.mode-section');
    }

    attachEventListeners() {
        this.openNewTabBtn.addEventListener('click', () => this.openNewTab('dashboard'));
        this.moreSettingsBtn.addEventListener('click', () => this.openNewTab('settings'));
        this.btnToggle.addEventListener('change', () => this.handleToggle());
        this.sensitivitySlider.addEventListener('input', (event) => this.handleSensitivity(event.target.value));
        this.manualMode.addEventListener('change', () => this.handleDetectionMode());
        this.automaticMode.addEventListener('change', () => this.handleDetectionMode());

        this.customSlider.addEventListener('click', (event) => this.handleSliderPointer(event));
        this.sliderThumb.addEventListener('mousedown', () => {
            this.draggingSlider = true;
        });

        document.addEventListener('mousemove', (event) => {
            if (this.draggingSlider) {
                this.handleSliderPointer(event);
            }
        });

        document.addEventListener('mouseup', () => {
            this.draggingSlider = false;
        });

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local') {
                this.handleStorageChanges(changes);
            }
        });
    }

    async checkExtensionReady() {
        if (this.isExtensionReady) {
            return true;
        }

        try {
            const response = await chrome.runtime.sendMessage({ action: 'ping' });
            this.isExtensionReady = Boolean(response?.success);
            return this.isExtensionReady;
        } catch (error) {
            console.error('Deepfake Detection: Failed to ping background:', error);
            return false;
        }
    }

    async sendMessageWithRetry(action, payload = {}) {
        const startedAt = performance.now();
        for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
            try {
                const isReady = await this.checkExtensionReady();
                if (!isReady) {
                    throw new Error('Background worker is not ready');
                }

                const response = await chrome.runtime.sendMessage({
                    action,
                    ...payload
                });

                if (!response?.success) {
                    throw new Error(response?.error?.message || 'Request failed');
                }

                capturePostHogEvent('popup_message_succeeded', {
                    action,
                    attempt,
                    duration_ms: Math.round(performance.now() - startedAt)
                });
                return response;
            } catch (error) {
                console.error(`Deepfake Detection: Popup message failed (attempt ${attempt}):`, error);
                capturePostHogError('popup_message_attempt_failed', error, {
                    action,
                    attempt
                });
                if (attempt === this.maxRetries) {
                    this.showError('Extension not responding. Reload the extension.');
                    capturePostHogError('popup_message_failed', error, {
                        action,
                        attempts: attempt,
                        duration_ms: Math.round(performance.now() - startedAt)
                    }, { immediate: true, preferBeacon: true });
                    return null;
                }

                await new Promise((resolve) => setTimeout(resolve, 250));
            }
        }

        return null;
    }

    async handleToggle() {
        const isEnabled = this.btnToggle.checked;

        await chrome.storage.local.set({ detectionEnabled: isEnabled });
        this.setSliderState(isEnabled);
        this.setDetectionModeState(isEnabled);
        this.updateStatus(isEnabled);
        capturePostHogEvent('popup_detection_toggled', { enabled: isEnabled });
        await this.sendMessageWithRetry('toggleDetection', { enabled: isEnabled });
    }

    async handleSensitivity(value) {
        const sensitivity = this.normaliseSensitivity(value);
        this.updateSlider(sensitivity);
        await chrome.storage.local.set({ sensitivity });
        capturePostHogEvent('popup_sensitivity_updated', { sensitivity });
        await this.sendMessageWithRetry('updateSensitivity', { sensitivity });
    }

    async handleDetectionMode() {
        const mode = 'manual';
        this.manualMode.checked = true;
        this.automaticMode.checked = false;
        await chrome.storage.local.set({ detectionMode: mode });
        this.updateStatus(this.btnToggle.checked);
        capturePostHogEvent('popup_detection_mode_changed', { mode });
        await this.sendMessageWithRetry('updateDetectionMode', { mode });
    }

    handleSliderPointer(event) {
        if (!this.btnToggle.checked) {
            return;
        }

        const rect = this.customSlider.getBoundingClientRect();
        const ratio = (event.clientX - rect.left) / rect.width;
        const sensitivity = this.normaliseSensitivity(Math.round(ratio * 100));
        this.handleSensitivity(sensitivity);
    }

    normaliseSensitivity(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return 50;
        }

        return Math.max(0, Math.min(100, Math.round(parsed)));
    }

    updateSlider(percent) {
        this.sliderTrack.style.width = `${percent}%`;
        this.sliderThumb.style.left = `${percent}%`;
        this.sensitivitySlider.value = String(percent);
    }

    setSliderState(enabled) {
        this.customSlider.classList.toggle('disabled', !enabled);
        this.sliderThumb.style.cursor = enabled ? 'pointer' : 'not-allowed';
        this.customSlider.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }

    setDetectionModeState(enabled) {
        this.manualMode.disabled = !enabled;
        this.automaticMode.disabled = true;
        this.modeSection.classList.toggle('disabled', !enabled);
        this.manualMode.parentElement.style.cursor = enabled ? 'pointer' : 'not-allowed';
        this.automaticMode.parentElement.style.cursor = 'not-allowed';
    }

    updateStatus(isEnabled) {
        if (!isEnabled) {
            this.statusSection.textContent = 'Detection disabled';
            this.statusSection.style.color = '#dc3545';
            return;
        }

        const mode = 'manual';
        this.statusSection.textContent = `Detection enabled (${mode} mode)`;
        this.statusSection.style.color = '#28a745';
    }

    showError(message) {
        this.statusSection.textContent = `Error: ${message}`;
        this.statusSection.style.color = '#dc3545';
    }

    handleStorageChanges(changes) {
        if (changes.detectionEnabled) {
            const enabled = Boolean(changes.detectionEnabled.newValue);
            this.btnToggle.checked = enabled;
            this.setSliderState(enabled);
            this.setDetectionModeState(enabled);
            this.updateStatus(enabled);
        }

        if (changes.sensitivity) {
            this.updateSlider(this.normaliseSensitivity(changes.sensitivity.newValue));
        }

        if (changes.detectionMode) {
            this.manualMode.checked = true;
            this.automaticMode.checked = false;
            this.updateStatus(this.btnToggle.checked);
        }

    }

    openNewTab(page = 'dashboard') {
        capturePostHogEvent('popup_open_newtab', { page });
        const url = chrome.runtime.getURL(`newtab/newtab.html?page=${encodeURIComponent(page)}`);
        chrome.tabs.create({ url });
    }

    registerTelemetrySimulator() {
        window.__simulateTelemetryIssue = () => {
            const error = new Error('Simulated telemetry issue from popup');

            capturePostHogError('simulated_problem_triggered', error, {
                source: 'popup',
                simulated: true
            }, { immediate: true, preferBeacon: true });
            captureSentryException(error, {
                source: 'popup',
                simulated: true
            });

            setTimeout(() => {
                throw error;
            }, 0);
        };
    }

    async loadSettings() {
        try {
            const startedAt = performance.now();
            const defaults = {
                detectionEnabled: false,
                sensitivity: 50,
                detectionMode: 'manual'
            };
            const result = await chrome.storage.local.get(Object.keys(defaults));
            const settings = { ...defaults, ...result };

            this.btnToggle.checked = Boolean(settings.detectionEnabled);
            this.manualMode.checked = true;
            this.automaticMode.checked = false;
            this.updateSlider(this.normaliseSensitivity(settings.sensitivity));
            this.setSliderState(this.btnToggle.checked);
            this.setDetectionModeState(this.btnToggle.checked);
            this.updateStatus(this.btnToggle.checked);
            capturePostHogEvent('popup_settings_loaded', {
                duration_ms: Math.round(performance.now() - startedAt),
                detection_enabled: this.btnToggle.checked,
                sensitivity: this.normaliseSensitivity(settings.sensitivity)
            });
        } catch (error) {
            console.error('Deepfake Detection: Failed to load settings:', error);
            capturePostHogError('popup_settings_load_failed', error, {}, { immediate: true, preferBeacon: true });
            this.showError('Could not load settings');
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const detector = new DeepfakeDetector();
    await detector.loadSettings();
    capturePostHogEvent('popup_opened');
});

window.addEventListener('beforeunload', () => {
    void flushPostHogQueue({ immediate: true, preferBeacon: true });
});
