// Deepfake Detection Extension - Content Script
console.log('Deepfake Detection: Content script file loaded');

class ContentScript {
    static ROOT_CLASS = 'deepfake-extension-root';

    constructor() {
        console.log('Deepfake Detection: Content script constructor called');
        this.initializeElements();
        this.floatingButton = null;
        this.overlays = new Map(); // Store overlay elements
        this.isEnabled = false;
        this.sensitivity = 50;
        this.detectionMode = 'manual'; // 'manual' or 'automatic'
        
        // Load settings first, then attach listeners
        this.loadInitialSettings().then(() => {
            this.attachEventListeners();
        });
    }

    initializeElements() {
        // Check if we're on a page with media content
        this.mediaElements = this.findMediaElements();
        console.log(`Deepfake Detection: Found ${this.mediaElements.length} media elements`);
    }

    async loadInitialSettings() {
        try {
            console.log('Deepfake Detection: Loading initial settings...');
            
            // First, check what's actually in storage
            const allStorage = await chrome.storage.local.get(null);
            console.log('Deepfake Detection: All storage contents:', allStorage);
            
            const result = await chrome.storage.local.get(['detectionEnabled', 'sensitivity', 'detectionMode']);
            console.log('Deepfake Detection: Initial settings loaded', result);
            
            // Set initial state
            this.isEnabled = result.detectionEnabled !== undefined ? result.detectionEnabled : false;
            this.sensitivity = result.sensitivity !== undefined ? result.sensitivity : 50;
            this.detectionMode = result.detectionMode !== undefined ? result.detectionMode : 'manual';
            
            console.log(`Deepfake Detection: Final state - enabled: ${this.isEnabled}, mode: ${this.detectionMode}`);
            
            // Apply settings immediately
            if (this.isEnabled) {
                console.log('Deepfake Detection: Applying enabled state');
                await this.toggleDetection(true);
            } else {
                console.log('Deepfake Detection: Detection is disabled, no button/overlays');
            }
            
            return Promise.resolve();
            
        } catch (error) {
            console.error('Deepfake Detection: Error loading settings', error);
            // Set defaults on error
            this.isEnabled = false;
            this.sensitivity = 50;
            this.detectionMode = 'manual';
            return Promise.resolve();
        }
    }

    attachEventListeners() {
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true;
        });

        // Monitor for new media elements
        this.observeMediaChanges();
    }

    findMediaElements() {
        const images = document.querySelectorAll('img[src]');
        const videoPosters = document.querySelectorAll('video[poster]');

        const mediaElements = [
            ...Array.from(images).map(img => ({ src: img.src, element: img, type: 'image' })),
            ...Array.from(videoPosters).map(video => ({
                src: video.poster,
                element: video,
                type: 'video-poster'
            }))
        ].filter(media => {
            // Check if media has valid source and element exists
            return (
                this.isValidMediaUrl(media.src) &&
                media.element &&
                document.contains(media.element) &&
                !this.isExtensionOwnedElement(media.element)
            );
        });

        const dedupedMediaElements = [];
        const seenElements = new WeakSet();
        const seenKeys = new Set();

        mediaElements.forEach((media) => {
            if (seenElements.has(media.element)) {
                return;
            }

            const key = `${media.type}:${media.src}`;
            if (seenKeys.has(key)) {
                return;
            }

            seenElements.add(media.element);
            seenKeys.add(key);
            dedupedMediaElements.push(media);
        });

        console.log(`Deepfake Detection: Found ${dedupedMediaElements.length} valid media elements`);
        return dedupedMediaElements;
    }

    isExtensionOwnedElement(element) {
        return Boolean(element.closest(`.${ContentScript.ROOT_CLASS}`));
    }

    markAsExtensionRoot(element) {
        if (element) {
            element.classList.add(ContentScript.ROOT_CLASS);
        }

        return element;
    }

    isValidMediaUrl(url) {
        if (!url) return false;
        
        // Skip data URLs, very small images, and common non-content images
        return !url.startsWith('data:') && 
               !url.includes('1x1') && 
               !url.includes('spacer') &&
               !url.includes('pixel') &&
               url.length > 20;
    }

    createFloatingButton() {
        console.log('Deepfake Detection: Creating floating button');
        
        // Create floating action button
        this.floatingButton = this.markAsExtensionRoot(document.createElement('div'));
        this.floatingButton.id = 'deepfake-detector-button';
        this.floatingButton.innerHTML = `
            <div class="detector-icon">🔍</div>
            <div class="detector-tooltip">Analyze for Deepfake</div>
        `;
        
        // Add styles
        this.floatingButton.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            cursor: pointer;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        // Add to page
        document.body.appendChild(this.floatingButton);
        console.log('Deepfake Detection: Floating button added to page');
        
        // Add event listeners
        this.floatingButton.addEventListener('click', () => {
            console.log('Deepfake Detection: Floating button clicked');
            this.showMediaSelector();
        });

        this.floatingButton.addEventListener('mouseenter', () => {
            this.floatingButton.querySelector('.detector-tooltip').style.display = 'block';
        });

        this.floatingButton.addEventListener('mouseleave', () => {
            this.floatingButton.querySelector('.detector-tooltip').style.display = 'none';
        });

        // Add internal styles
        this.addFloatingButtonStyles();
        
        console.log('Deepfake Detection: Floating button fully initialized');
    }

    createOverlay(element, result) {
        console.log('Deepfake Detection: Creating overlay for element', element);
        
        try {
            // Check if element exists and has a parent
            if (!element || !element.parentNode) {
                console.warn('Deepfake Detection: Cannot create overlay - element or parent is missing');
                return;
            }
            
            const container = this.markAsExtensionRoot(document.createElement('div'));
            container.className = `${ContentScript.ROOT_CLASS} deepfake-container`;
            
            // Wrap the original element
            element.parentNode.insertBefore(container, element);
            container.appendChild(element);
            
            // Create overlay
            const overlay = this.markAsExtensionRoot(document.createElement('div'));
            overlay.className = `${ContentScript.ROOT_CLASS} deepfake-overlay`;
            
            const riskLevel = this.getRiskLevel(result.riskScore);
            overlay.classList.add(riskLevel.class + '-risk');
            
            overlay.innerHTML = `
                <div class="deepfake-overlay-icon">${riskLevel.icon}</div>
                <div class="deepfake-overlay-text">${riskLevel.label}</div>
                <div class="deepfake-overlay-confidence">${result.confidence.toFixed(1)}% confidence</div>
            `;
            
            container.appendChild(overlay);
            
            // Store reference
            this.overlays.set(element, overlay);
            
            // Show overlay on hover
            container.addEventListener('mouseenter', () => {
                console.log('Deepfake Detection: Showing overlay');
                overlay.classList.add('visible');
            });
            
            container.addEventListener('mouseleave', () => {
                console.log('Deepfake Detection: Hiding overlay');
                overlay.classList.remove('visible');
            });
            
            console.log('Deepfake Detection: Overlay created successfully');
        } catch (error) {
            console.error('Deepfake Detection: Error creating overlay', error);
        }
    }

    removeOverlay(element) {
        const overlay = this.overlays.get(element);
        if (overlay) {
            const container = overlay.parentNode;
            const originalElement = container.querySelector('img, video');
            
            if (originalElement && originalElement.parentNode === container) {
                container.parentNode.insertBefore(originalElement, container);
            }
            
            container.remove();
            this.overlays.delete(element);
        }
    }

    addOverlaysToAllMedia() {
        this.mediaElements.forEach(media => {
            if (!this.overlays.has(media.element)) {
                // Simulate analysis result
                const mockResult = {
                    riskScore: Math.random() * 100,
                    confidence: 70 + Math.random() * 25
                };
                this.createOverlay(media.element, mockResult);
            }
        });
    }

    removeAllOverlays() {
        this.overlays.forEach((overlay, element) => {
            this.removeOverlay(element);
        });
    }

    getRiskLevel(score) {
        if (score < 33) {
            return { label: 'Low Risk', class: 'low', icon: '✅' };
        } else if (score < 66) {
            return { label: 'Medium Risk', class: 'medium', icon: '⚠️' };
        } else {
            return { label: 'High Risk', class: 'high', icon: '🚨' };
        }
    }

    addFloatingButtonStyles() {
        if (document.querySelector('#deepfake-ui-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'deepfake-ui-styles';
        style.textContent = `
            #deepfake-detector-button.deepfake-extension-root {
                background: linear-gradient(
                    135deg,
                    rgba(106, 20, 95, 0.8) 0%,
                    rgba(118, 75, 162, 0) 100%
                );
                border-radius: 50%;
                width: 56px;
                height: 56px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }

            #deepfake-detector-button.deepfake-extension-root:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
            }

            .deepfake-extension-root .detector-icon {
                font-size: 24px;
                color: white;
            }

            .deepfake-extension-root .detector-tooltip {
                position: absolute;
                top: 100%;
                right: 0;
                margin-top: 8px;
                background: #333;
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 12px;
                white-space: nowrap;
                display: none;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }

            .deepfake-extension-root .detector-tooltip::after {
                content: '';
                position: absolute;
                top: -4px;
                right: 20px;
                width: 0;
                height: 0;
                border-left: 4px solid transparent;
                border-right: 4px solid transparent;
                border-bottom: 4px solid #333;
            }

            .media-selector-overlay.deepfake-extension-root {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .deepfake-extension-root .media-selector-modal {
                background: white;
                border-radius: 4px;
                padding: 24px;
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            }

            .deepfake-extension-root .media-selector-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }

            .deepfake-extension-root .media-selector-title {
                font-size: 18px;
                font-weight: 600;
                color: #333;
            }

            .deepfake-extension-root .media-selector-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background 0.3s ease;
            }

            .deepfake-extension-root .media-selector-close:hover {
                background: #f1f3f4;
            }

            .deepfake-extension-root .media-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 16px;
                margin-bottom: 20px;
            }

            .deepfake-extension-root .media-item {
                border: 2px solid #e1e4e8;
                border-radius: 8px;
                padding: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                text-align: center;
            }

            .deepfake-extension-root .media-item:hover {
                border-color: #667eea;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
            }

            .deepfake-extension-root .media-item.selected {
                border-color: #667eea;
                background: #f8f9ff;
            }

            .deepfake-extension-root .media-thumbnail {
                width: 100%;
                height: 100px;
                object-fit: cover;
                border-radius: 4px;
                margin-bottom: 8px;
            }

            .deepfake-extension-root .media-info {
                font-size: 12px;
                color: #666;
                word-break: break-all;
            }

            .deepfake-extension-root .media-selector-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }

            .deepfake-extension-root .analyze-btn {
                background: #6a145f;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.3s ease;
            }

            .deepfake-extension-root .analyze-btn:hover {
                background: #4c104490;
            }

            .deepfake-extension-root .analyze-btn:disabled {
                background: #e1e4e8;
                color: #666;
                cursor: not-allowed;
            }
        `;
        document.head.appendChild(style);
    }

    showMediaSelector() {
        // Create modal overlay
        const overlay = this.markAsExtensionRoot(document.createElement('div'));
        overlay.className = `${ContentScript.ROOT_CLASS} media-selector-overlay`;
        
        const modal = document.createElement('div');
        modal.className = 'media-selector-modal';
        
        modal.innerHTML = `
            <div class="media-selector-header">
                <h3 class="media-selector-title">Select Media to Analyze</h3>
                <button class="media-selector-close">&times;</button>
            </div>
            <div class="media-grid">
                ${this.mediaElements.map((media, index) => `
                    <div class="media-item" data-index="${index}">
                        <img src="${media.src}" class="media-thumbnail" alt="Media ${index + 1}">
                        <div class="media-info">${this.getMediaDescription(media)}</div>
                    </div>
                `).join('')}
            </div>
            <div class="media-selector-actions">
                <button class="analyze-btn" id="analyzeSelectedBtn" disabled>Analyze Selected</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Add event listeners
        const closeBtn = modal.querySelector('.media-selector-close');
        const analyzeBtn = modal.querySelector('#analyzeSelectedBtn');
        const mediaItems = modal.querySelectorAll('.media-item');
        
        closeBtn.addEventListener('click', () => {
            overlay.remove();
        });
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
        
        mediaItems.forEach(item => {
            item.addEventListener('click', () => {
                mediaItems.forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                analyzeBtn.disabled = false;
            });
        });
        
        analyzeBtn.addEventListener('click', () => {
            const selectedItem = modal.querySelector('.media-item.selected');
            if (selectedItem) {
                const index = parseInt(selectedItem.dataset.index);
                const media = this.mediaElements[index];
                this.analyzeMedia(media);
                overlay.remove();
            }
        });
    }

    getMediaDescription(media) {
        if (media.type === 'video-poster') {
            return 'Video thumbnail';
        }
        
        const url = media.src;
        const filename = url.split('/').pop() || 'Unknown';
        return filename.length > 20 ? filename.substring(0, 20) + '...' : filename;
    }

    buildAnalysisRequest(media) {
        return {
            src: media.src,
            type: media.type || 'image',
            element: media.element?.tagName?.toLowerCase() || 'img',
            sensitivity: this.sensitivity,
            captureBounds: this.getCaptureBounds(media.element)
        };
    }

    getCaptureBounds(element) {
        if (!element || typeof element.getBoundingClientRect !== 'function') {
            return null;
        }

        const rect = element.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            return null;
        }

        return {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            devicePixelRatio: window.devicePixelRatio || 1
        };
    }

    async ensureMediaVisible(element) {
        if (!element || typeof element.scrollIntoView !== 'function') {
            return;
        }

        const rect = element.getBoundingClientRect();
        const isVisible =
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth;

        if (!isVisible) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });

            await new Promise((resolve) => setTimeout(resolve, 500));
        } else {
            await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        }
    }

    logAnalysisResult(media, result) {
        console.group('Deepfake Detection: Analysis Result');
        console.log('Source', media?.src || 'unknown');
        console.log('Type', media?.type || 'image');
        console.log('Risk Score', result?.riskScore);
        console.log('Confidence', result?.confidence);
        console.log('Explanation', result?.explanation);
        console.log('Technical Details', result?.technicalDetails || {});
        console.log('Capture Debug', result?.debug?.capture || {});
        console.log('Preprocess Debug', result?.debug?.preprocess || {});
        this.logPreviewImage('Captured crop', result?.debug?.preprocess?.preview?.original);
        this.logPreviewImage('Resized model input (128x128)', result?.debug?.preprocess?.preview?.resized);
        console.log('Full Result', result);
        console.groupEnd();
    }

    logPreviewImage(label, dataUrl) {
        if (!dataUrl) {
            return;
        }

        console.log(label);
        console.log('%c ', `
            font-size: 1px;
            padding: 96px 96px;
            background-image: url("${dataUrl}");
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            background-color: #f3f4f6;
            border: 1px solid #d1d5db;
            line-height: 1;
        `);
    }

    async analyzeMedia(media) {
        try {
            // Check if Chrome APIs are available
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                throw new Error('Chrome APIs not available. Please refresh the page and try again.');
            }

            await this.ensureMediaVisible(media.element);
            
            // Send analysis request to background script with current sensitivity
            const response = await chrome.runtime.sendMessage({
                action: 'analyzeMedia',
                data: this.buildAnalysisRequest(media)
            });
            
            if (response.success) {
                this.logAnalysisResult(media, response.result);
                this.showAnalysisResult(response.result);
            } else {
                // Show user-friendly error message
                this.showError(response.error?.userMessage || 'Analysis failed. Please try again.');
            }
        } catch (error) {
            console.error('Analysis error:', error);
            this.showError('Analysis failed. Please try again.');
        }
    }

    showAnalysisResult(result) {
        // Create result notification
        const notification = this.markAsExtensionRoot(document.createElement('div'));
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: white;
            border-radius: 8px;
            padding: 16px 24px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 10002;
            max-width: 400px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        // Handle both success and error cases
        const isError = !result || result.success === false;
        const riskScore = isError ? 0 : (result.riskScore || 0);
        const confidence = isError ? 0 : (result.confidence || 0);
        
        const riskLevel = this.getRiskLevel(riskScore);
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="font-size: 24px;">${isError ? '⚠️' : riskLevel.icon}</div>
                <div>
                    <div style="font-weight: 600; color: ${isError ? '#dc3545' : riskLevel.color}; margin-bottom: 4px;">
                        ${isError ? 'Analysis Failed' : riskLevel.label}
                    </div>
                    <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
                        ${isError ? (result.error?.userMessage || 'An error occurred during analysis') : `Confidence: ${confidence.toFixed(1)}%`}
                    </div>
                    ${!isError ? `
                    <div style="font-size: 14px; color: #333; line-height: 1.4;">
                        ${result.explanation || 'Analysis completed successfully.'}
                    </div>
                    ` : ''}
                </div>
            </div>
            <div style="margin-top: 12px; text-align: right;">
                <button class="deepfake-notification-close" style="background: #6a145f; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        const closeButton = notification.querySelector('.deepfake-notification-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                notification.remove();
            });
        }
        
        // Auto-remove after 10 seconds for errors, 15 seconds for success
        const timeout = isError ? 10000 : 15000;
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, timeout);
    }

    getRiskLevel(score) {
        if (score < 33) {
            return { label: 'Low Risk', class: 'low', color: '#28a745', icon: '✅' };
        } else if (score < 66) {
            return { label: 'Medium Risk', class: 'medium', color: '#ffc107', icon: '⚠️' };
        } else {
            return { label: 'High Risk', class: 'high', color: '#dc3545', icon: '🚨' };
        }
    }

    showError(message) {
        const errorDiv = this.markAsExtensionRoot(document.createElement('div'));
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #dc3545;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10002;
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 4000);
    }

    observeMediaChanges() {
        const observer = new MutationObserver((mutations) => {
            let hasNewMedia = false;
            
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'IMG' || node.tagName === 'VIDEO') {
                            hasNewMedia = true;
                        } else if (node.querySelectorAll) {
                            const images = node.querySelectorAll('img');
                            const videos = node.querySelectorAll('video');
                            if (images.length > 0 || videos.length > 0) {
                                hasNewMedia = true;
                            }
                        }
                    }
                });
            });
            
            if (hasNewMedia) {
                this.mediaElements = this.findMediaElements();
                
                // Only create floating button if detection is enabled AND in manual mode
                if (this.mediaElements.length > 0 && this.isEnabled && this.detectionMode === 'manual' && !this.floatingButton) {
                    this.createFloatingButton();
                }
                
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    handleMessage(message, sender, sendResponse) {
        // Handle messages from background script
        switch (message.action) {
            case 'highlightMedia':
                if (message.mediaSrc) {
                    this.highlightMediaElement(message.mediaSrc);
                }
                break;
            case 'getMediaElements':
                sendResponse({ mediaElements: this.mediaElements });
                break;
            case 'toggleDetection':
                if (message.enabled !== undefined) {
                    this.toggleDetection(message.enabled);
                }
                break;
            case 'updateSensitivity':
                if (message.sensitivity !== undefined) {
                    this.updateSensitivity(message.sensitivity);
                }
                break;
            case 'updateDetectionMode':
                if (message.mode !== undefined) {
                    this.updateDetectionMode(message.mode);
                }
                break;
        }
    }

    updateDetectionMode(mode) {
        console.log(`Deepfake Detection: Updating detection mode to ${mode} (automatic analysis temporarily disabled)`);
        this.detectionMode = 'manual';
        
        // Re-apply overlays based on new mode
        if (this.isEnabled) {
            this.removeAllOverlays();

            console.log('Deepfake Detection: Keeping manual mode active');
            if (!this.floatingButton && this.mediaElements.length > 0) {
                this.createFloatingButton();
            }
        }
    }

    toggleDetection(enabled) {
        console.log(`Deepfake Detection: toggleDetection called with enabled=${enabled}, current isEnabled=${this.isEnabled}, mode=${this.detectionMode}`);
        this.isEnabled = enabled;
        
        if (enabled && this.mediaElements.length > 0) {
            // Only create floating button in manual mode
            if (this.detectionMode === 'manual' && !this.floatingButton) {
                console.log('Deepfake Detection: Creating floating button for manual mode');
                this.createFloatingButton();
            }
        } else if (!enabled) {
            console.log('Deepfake Detection: Hiding floating button and removing overlays');
            if (this.floatingButton) {
                this.floatingButton.remove();
                this.floatingButton = null;
            }
            this.removeAllOverlays();
        } else {
            console.log('Deepfake Detection: No action needed - enabled=' + enabled + ', hasButton=' + !!this.floatingButton);
        }
    }

    async addOverlaysToAllMedia() {
        console.log(`Deepfake Detection: Adding overlays to ${this.mediaElements.length} media elements`);
        
        // Note: We no longer initialize model in content script since it's handled in background
        for (let index = 0; index < this.mediaElements.length; index++) {
            const media = this.mediaElements[index];
            
            // Check if element still exists in DOM
            if (!media.element || !document.contains(media.element)) {
                console.warn(`Deepfake Detection: Skipping element ${index} - no longer in DOM`);
                continue;
            }
            
            // Check if overlay already exists
            if (this.overlays.has(media.element)) {
                console.log(`Deepfake Detection: Overlay already exists for element ${index}`);
                continue;
            }
            
            try {
                // For automatic mode, we'll show a loading indicator first
                const loadingOverlay = this.createLoadingOverlay(media.element);
                
                try {
                // Check if Chrome APIs are available
                if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                    this.createErrorOverlay(media.element, 'Chrome APIs not available. Please refresh the page and try again.');
                    return;
                }
                
                // Send analysis request to background script
                const response = await chrome.runtime.sendMessage({
                    action: 'analyzeMedia',
                    data: this.buildAnalysisRequest(media)
                });
                
                // Remove loading overlay
                if (loadingOverlay && loadingOverlay.parentNode) {
                    loadingOverlay.remove();
                }
                
                if (response.success) {
                    console.log(`Deepfake Detection: Creating overlay for element ${index} with sensitivity ${this.sensitivity}`);
                    this.createOverlay(media.element, response.result);
                } else {
                    // Show user-friendly error on the media element itself
                    this.createErrorOverlay(media.element, response.error?.userMessage || 'Analysis failed');
                }
            } catch (error) {
                console.error(`Deepfake Detection: Failed to analyze element ${index}:`, error);
                
                // Remove loading overlay if it exists
                if (loadingOverlay && loadingOverlay.parentNode) {
                    loadingOverlay.remove();
                }
                
                // Show error on the media element itself
                this.createErrorOverlay(media.element, 'Analysis failed. Please try again.');
            }
        } catch (error) {
            console.error(`Deepfake Detection: Failed to analyze element ${index}:`, error);
            
            // Remove loading overlay if it exists
            if (loadingOverlay && loadingOverlay.parentNode) {
                loadingOverlay.remove();
            }
            
            // Show error on the media element itself
            this.createErrorOverlay(media.element, 'Analysis failed. Please try again.');
        }
        }
    }

    createLoadingOverlay(element) {
        const container = this.markAsExtensionRoot(document.createElement('div'));
        container.className = `${ContentScript.ROOT_CLASS} deepfake-loading-overlay`;
        container.innerHTML = `
            <div class="deepfake-loading-spinner"></div>
            <div class="deepfake-loading-text">Analyzing...</div>
        `;
        
        // Style the loading overlay
        container.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        // Wrap element and add overlay
        const wrapper = this.markAsExtensionRoot(document.createElement('div'));
        wrapper.className = `${ContentScript.ROOT_CLASS} deepfake-container`;
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        
        element.parentNode.insertBefore(wrapper, element);
        wrapper.appendChild(element);
        wrapper.appendChild(container);
        
        return container;
    }

    createErrorOverlay(element, errorMessage) {
        const errorContainer = this.markAsExtensionRoot(document.createElement('div'));
        errorContainer.className = `${ContentScript.ROOT_CLASS} deepfake-error-overlay`;
        errorContainer.innerHTML = `
            <div class="deepfake-error-icon">⚠️</div>
            <div class="deepfake-error-text">${errorMessage}</div>
        `;
        
        // Style the error overlay
        errorContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(220, 53, 69, 0.9);
            color: white;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        
        // Add error overlay styles
        if (!document.querySelector('#deepfake-error-styles')) {
            const style = document.createElement('style');
            style.id = 'deepfake-error-styles';
            style.textContent = `
                .deepfake-error-overlay.deepfake-extension-root {
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                .deepfake-container.deepfake-extension-root:hover .deepfake-error-overlay.deepfake-extension-root {
                    opacity: 1;
                }
                .deepfake-extension-root .deepfake-error-icon {
                    font-size: 24px;
                    margin-bottom: 8px;
                }
                .deepfake-extension-root .deepfake-error-text {
                    font-size: 14px;
                    font-weight: 600;
                    text-align: center;
                    max-width: 80%;
                    line-height: 1.4;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Find or create wrapper
        let parentContainer = element.parentNode;
        if (!parentContainer || !parentContainer.classList.contains('deepfake-container')) {
            const wrapper = this.markAsExtensionRoot(document.createElement('div'));
            wrapper.className = `${ContentScript.ROOT_CLASS} deepfake-container`;
            wrapper.style.position = 'relative';
            wrapper.style.display = 'inline-block';
            
            element.parentNode.insertBefore(wrapper, element);
            wrapper.appendChild(element);
            parentContainer = wrapper;
        }
        
        parentContainer.appendChild(errorContainer);
        
        // Show on hover
        parentContainer.addEventListener('mouseenter', () => {
            errorContainer.classList.add('visible');
        });
        
        parentContainer.addEventListener('mouseleave', () => {
            errorContainer.classList.remove('visible');
        });
    }

    async initializeModelInference() {
        try {
            console.log('Deepfake Detection: Initializing ONNX model inference...');
            
            // Load ONNX Runtime Web
            if (typeof ort === 'undefined') {
                await this.loadONNXRuntime();
            }
            
            // Load inference module
            const response = await fetch(chrome.runtime.getURL('models/onnx-inference.js'));
            const inferenceCode = await response.text();
            eval(inferenceCode);
            
            this.modelInference = new ONNXModelInference();
            await this.modelInference.loadModel();
            
            console.log('Deepfake Detection: Model inference initialized successfully');
        } catch (error) {
            console.error('Deepfake Detection: Failed to initialize model inference:', error);
            this.modelInference = null;
        }
    }

    async loadONNXRuntime() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async analyzeMediaWithModel(media) {
        if (!this.modelInference) {
            throw new Error('Model not initialized');
        }
        
        // Get image element from media
        let imageElement;
        if (media.type === 'image') {
            imageElement = media.element;
        } else if (media.type === 'video-poster') {
            // Use poster image for video
            imageElement = await this.loadImageFromUrl(media.src);
        } else {
            // For videos, extract current frame
            imageElement = await this.extractVideoFrame(media.element);
        }
        
        // Run inference with sensitivity
        const result = await this.modelInference.analyzeWithSensitivity(
            imageElement, 
            this.sensitivity
        );
        
        return {
            riskScore: result.riskScore,
            confidence: result.confidence
        };
    }

    async loadImageFromUrl(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = imageUrl;
        });
    }

    async extractVideoFrame(videoElement) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 128;
        canvas.height = 128;
        
        ctx.drawImage(videoElement, 0, 0, 128, 128);
        
        // Convert canvas to image element
        const img = new Image();
        img.src = canvas.toDataURL();
        
        return new Promise((resolve) => {
            img.onload = () => resolve(img);
        });
    }

    async generateMockAnalysis() {
        // Simulate model output with sensitivity adjustment
        const baseModelOutput = Math.random();
        const threshold = this.calculateSensitivityThreshold(this.sensitivity);
        const riskScore = this.applySensitivityToModelOutput(baseModelOutput, this.sensitivity);
        const confidence = this.calculateConfidence(baseModelOutput, threshold);
        
        return {
            riskScore: riskScore,
            confidence: confidence
        };
    }

    calculateSensitivityThreshold(sensitivity) {
        // Convert sensitivity (0-100) to threshold (0-1)
        // Higher sensitivity = lower threshold (easier to detect fakes)
        return 1 - (sensitivity / 100);
    }

    applySensitivityToModelOutput(baseOutput, sensitivity) {
        const threshold = this.calculateSensitivityThreshold(sensitivity);
        
        // Convert base output to risk score (0-100)
        let adjustedScore;
        if (baseOutput > threshold) {
            // Above threshold - scale up based on sensitivity
            const excess = baseOutput - threshold;
            const maxExcess = 1 - threshold;
            adjustedScore = 50 + (excess / maxExcess) * 50 * (sensitivity / 100);
        } else {
            // Below threshold - scale down based on sensitivity
            adjustedScore = (baseOutput / threshold) * 50 * (1 - sensitivity / 100);
        }
        
        return Math.max(0, Math.min(100, adjustedScore));
    }

    calculateConfidence(baseOutput, threshold) {
        // Calculate confidence based on distance from decision threshold
        const distance = Math.abs(baseOutput - threshold);
        const maxDistance = Math.max(threshold, 1 - threshold);
        
        // Convert distance to confidence (70-95%)
        const normalizedDistance = distance / maxDistance;
        const confidence = 70 + normalizedDistance * 25;
        
        return Math.max(70, Math.min(95, confidence));
    }

    updateSensitivity(sensitivity) {
        console.log(`Deepfake Detection: Updating sensitivity to ${sensitivity}`);
        this.sensitivity = sensitivity;
        // Sensitivity changes should only affect future manual analyses.
    }

    highlightMediaElement(src) {
        const element = this.mediaElements.find(media => media.src === src);
        if (element && element.element) {
            element.element.style.border = '3px solid #6a145f';
            element.element.style.boxShadow = '0 0 10px rgba(102, 126, 234, 0.5)';
            
            setTimeout(() => {
                element.element.style.border = '';
                element.element.style.boxShadow = '';
            }, 3000);
        }
    }
}

// Initialize content script
console.log('Deepfake Detection: About to create ContentScript instance');
try {
    const contentScript = new ContentScript();
    console.log('Deepfake Detection: ContentScript instance created successfully');
} catch (error) {
    console.error('Deepfake Detection: Error creating ContentScript:', error);
}
