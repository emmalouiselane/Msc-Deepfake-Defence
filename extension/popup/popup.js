// Deepfake Detection Extension - Popup Script
class DeepfakeDetector {
    constructor() {
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.openNewTabBtn = document.getElementById('openNewTabBtn');
        this.btnToggle = document.getElementById('btnToggle');
        this.sensitivitySlider = document.getElementById('sensitivitySlider');
        this.customSlider = document.getElementById('customSlider');
        this.sliderTrack = document.getElementById('sliderTrack');
        this.sliderThumb = document.getElementById('sliderThumb');
        this.statusSection = document.getElementById('statusText');
        
        // Detection mode elements
        this.manualMode = document.getElementById('manualMode');
        this.automaticMode = document.getElementById('automaticMode');
        this.modeSection = document.querySelector('.mode-section');
    }

    attachEventListeners() {
        // Button events
        this.openNewTabBtn.addEventListener('click', this.openNewTab.bind(this));
        this.btnToggle.addEventListener('change', this.handleToggle.bind(this));
        this.sensitivitySlider.addEventListener('input', this.handleSensitivity.bind(this));
        
        // Detection mode events
        this.manualMode.addEventListener('change', this.handleDetectionMode.bind(this));
        this.automaticMode.addEventListener('change', this.handleDetectionMode.bind(this));
        
        // Custom slider events
        this.customSlider.addEventListener('click', this.handleSliderClick.bind(this));
        this.sliderThumb.addEventListener('mousedown', this.handleThumbMouseDown.bind(this));
    }

    handleDetectionMode() {
        const mode = this.manualMode.checked ? 'manual' : 'automatic';
        
        // Save detection mode to storage
        chrome.storage.local.set({ detectionMode: mode });
        
        // Send message to content script to update mode
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'updateDetectionMode',
                    mode: mode
                });
            }
        });
        
        console.log(`Deepfake Detection: Detection mode changed to ${mode}`);
    }

    handleSliderClick(e) {
        if (this.btnToggle.checked) {
            const rect = this.customSlider.getBoundingClientRect();
            const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            this.updateSlider(percent);
            this.sensitivitySlider.value = percent;
            this.handleSensitivity();
        }
    }

    handleThumbMouseDown(e) {
        if (!this.btnToggle.checked) {
            e.preventDefault();
            return;
        }
        
        e.preventDefault();
        const handleMouseMove = (e) => {
            const rect = this.customSlider.getBoundingClientRect();
            const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            this.updateSlider(percent);
            this.sensitivitySlider.value = percent;
            this.handleSensitivity();
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    updateSlider(percent) {
        this.sliderTrack.style.width = `${percent}%`;
        this.sliderThumb.style.left = `${percent}%`;
    }

    setSliderState(enabled) {
        if (enabled) {
            this.customSlider.classList.remove('disabled');
            this.sliderThumb.style.cursor = 'pointer';
            this.customSlider.style.cursor = 'pointer';
        } else {
            this.customSlider.classList.add('disabled');
            this.sliderThumb.style.cursor = 'not-allowed';
            this.customSlider.style.cursor = 'not-allowed';
        }
    }

    setDetectionModeState(enabled) {
        if (enabled) {
            this.manualMode.disabled = false;
            this.automaticMode.disabled = false;
            this.manualMode.parentElement.style.cursor = 'pointer';
            this.automaticMode.parentElement.style.cursor = 'pointer';
            this.modeSection.classList.remove('disabled');
        } else {
            this.manualMode.disabled = true;
            this.automaticMode.disabled = true;
            this.manualMode.parentElement.style.cursor = 'not-allowed';
            this.automaticMode.parentElement.style.cursor = 'not-allowed';
            this.modeSection.classList.add('disabled');
        }
    }

    openNewTab() {
        // Open the new tab analysis page
        chrome.tabs.create({ url: chrome.runtime.getURL('newtab/newtab.html') });
    }

    handleToggle() {
        const isEnabled = this.btnToggle.checked;
        // Save toggle state to storage
        chrome.storage.local.set({ detectionEnabled: isEnabled });
        
        // Update slider state
        this.setSliderState(isEnabled);
        
        // Update detection mode state
        this.setDetectionModeState(isEnabled);
        
        // Update status display
        this.updateStatus(isEnabled);
        
        // Send message to content script to enable/disable detection
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'toggleDetection',
                    enabled: isEnabled
                });
            }
        });
    }

    handleSensitivity() {
        const sensitivity = this.sensitivitySlider.value;
        this.updateSlider(sensitivity);
        
        // Save sensitivity to storage
        chrome.storage.local.set({ sensitivity: sensitivity });
        
        // Send message to update sensitivity
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'updateSensitivity',
                    sensitivity: sensitivity
                });
            }
        });
    }

    updateStatus(isEnabled) {
        if (isEnabled) {
            this.statusSection.textContent = 'Actively monitoring media';
            this.statusSection.style.color = '#66005f';
        } else {
            this.statusSection.textContent = 'Disabled';
            this.statusSection.style.color = '#666';
        }
    }

    async loadSettings() {
        try {
            // Load saved settings
            const result = await chrome.storage.local.get(['detectionEnabled', 'sensitivity', 'detectionMode']);
            
            // Set defaults if no saved settings exist
            const isEnabled = result.detectionEnabled !== undefined ? result.detectionEnabled : false;
            const sensitivity = result.sensitivity !== undefined ? result.sensitivity : 50;
            const detectionMode = result.detectionMode !== undefined ? result.detectionMode : 'manual';
            
            // Initialize toggle state
            this.btnToggle.checked = isEnabled;
            
            // Initialize slider state
            this.sensitivitySlider.value = sensitivity;
            this.updateSlider(sensitivity);
            
            // Initialize detection mode
            if (detectionMode === 'manual') {
                this.manualMode.checked = true;
            } else {
                this.automaticMode.checked = true;
            }
            
            // Set slider state based on toggle
            this.setSliderState(isEnabled);
            
            // Set detection mode state based on toggle
            this.setDetectionModeState(isEnabled);
            
            // Update status display
            this.updateStatus(isEnabled);
            
            console.log('Settings loaded:', { detectionEnabled: isEnabled, sensitivity, detectionMode });
            
        } catch (error) {
            console.error('Error loading settings:', error);
            // Set defaults on error
            this.btnToggle.checked = false;
            this.sensitivitySlider.value = 50;
            this.updateSlider(50);
            this.manualMode.checked = true;
            this.setSliderState(false);
            this.setDetectionModeState(false);
            this.updateStatus(false);
        }
    }
}

// Initialize the detector when popup is loaded
document.addEventListener('DOMContentLoaded', () => {
    const detector = new DeepfakeDetector();
    detector.loadSettings();
});
