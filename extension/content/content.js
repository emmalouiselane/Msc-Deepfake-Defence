// Deepfake Detection Extension - Content Script
console.log('Deepfake Detection: Content script file loaded');

class ContentScript {
    static ROOT_CLASS = 'deepfake-extension-root';

    constructor() {
        console.log('Deepfake Detection: Content script constructor called');
        this.initialiseElements();
        this.floatingButton = null;
        this.overlays = new Map(); // Store overlay elements
        this.overlayResults = new WeakMap();
        this.viewportObserver = null;
        this.analysedElements = new WeakSet();
        this.processingElements = new WeakSet();
        this.videoReadinessListeners = new WeakSet();
        this.isEnabled = false;
        this.sensitivity = 50;
        this.detailLevel = 100;
        this.detectionMode = 'manual'; // 'manual' or 'automatic'
        
        // Load settings first, then attach listeners
        this.loadInitialSettings().then(() => {
            this.attachEventListeners();
        });
    }

    initialiseElements() {
        // Check if we're on a page with media content
        this.mediaElements = this.findMediaElements();
        console.log(`Deepfake Detection: Found ${this.mediaElements.length} media elements`);
    }

    async loadInitialSettings() {
        try {
            if (!this.isExtensionContextAvailable()) {
                this.handleInvalidatedContext();
                return Promise.resolve();
            }

            console.log('Deepfake Detection: Loading initial settings...');
            
            // First, check what's actually in storage
            const allStorage = await chrome.storage.local.get(null);
            console.log('Deepfake Detection: All storage contents:', allStorage);
            
            const result = await chrome.storage.local.get(['detectionEnabled', 'sensitivity', 'detailLevel', 'detectionMode']);
            console.log('Deepfake Detection: Initial settings loaded', result);
            
            // Set initial state
            this.isEnabled = result.detectionEnabled !== undefined ? result.detectionEnabled : false;
            this.sensitivity = result.sensitivity !== undefined ? result.sensitivity : 50;
            this.detailLevel = result.detailLevel !== undefined ? result.detailLevel : 100;
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
            if (this.isContextInvalidationError(error)) {
                this.handleInvalidatedContext();
                return Promise.resolve();
            }
            // Set defaults on error
            this.isEnabled = false;
            this.sensitivity = 50;
            this.detailLevel = 100;
            this.detectionMode = 'manual';
            return Promise.resolve();
        }
    }

    attachEventListeners() {
        if (!this.isExtensionContextAvailable()) {
            this.handleInvalidatedContext();
            return;
        }

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
        const videos = document.querySelectorAll('video');

        const mediaElements = [
            ...Array.from(images).map(img => ({ src: img.src, element: img, type: 'image' })),
            ...Array.from(videos).map(video => ({
                src: video.currentSrc || video.src || video.poster || '',
                element: video,
                type: 'video'
            })),
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

    getIconMarkup(icon, size = 20) {
        const icons = {
            search: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>`,
            checkCircle: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="m9 12 2 2 4-4"></path></svg>`,
            alertTriangle: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.29 3.86-7.4 12.8A2 2 0 0 0 4.62 20h14.76a2 2 0 0 0 1.73-3.34l-7.4-12.8a2 2 0 0 0-3.42 0Z"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg>`,
            shieldAlert: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6l8-4 8 4z"></path><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>`,
        };

        return icons[icon] || icons.alertTriangle;
    }

    getRiskIconMarkup(level, size = 20) {
        const iconByLevel = {
            low: 'checkCircle',
            medium: 'alertTriangle',
            high: 'shieldAlert'
        };

        return this.getIconMarkup(iconByLevel[level] || 'alertTriangle', size);
    }

    createFloatingButton() {
        console.log('Deepfake Detection: Creating floating button');
        
        // Create floating action button
        this.floatingButton = this.markAsExtensionRoot(document.createElement('div'));
        this.floatingButton.id = 'deepfake-detector-button';
        this.floatingButton.innerHTML = `
            <div class="detector-icon">${this.getIconMarkup('search', 24)}</div>
            <div class="detector-tooltip">Analyze for Deepfake</div>
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

            const container = this.ensureMediaContainer(element);
            
            // Create overlay
            const overlay = this.markAsExtensionRoot(document.createElement('div'));
            overlay.className = `${ContentScript.ROOT_CLASS} deepfake-overlay`;
            
            const riskLevel = this.getRiskLevel(result.riskScore);
            overlay.classList.add(riskLevel.class + '-risk');
            this.applyContainerRiskState(container, riskLevel.class);
            this.applyMediaRiskState(element, riskLevel.class);
            
            overlay.innerHTML = `
                <div class="deepfake-overlay-icon">${riskLevel.iconMarkup}</div>
                <div class="deepfake-overlay-content">
                    <div class="deepfake-overlay-text">${riskLevel.label}</div>
                    <div class="deepfake-overlay-confidence">${result.confidence.toFixed(1)}% confidence</div>
                </div>
                <div class="deepfake-overlay-actions">
                    ${result?.id ? '<button type="button" class="deepfake-overlay-more">More info</button>' : ''}
                </div>
            `;
            
            container.appendChild(overlay);
            overlay.dataset.mediaSrc = element?.src || result?.mediaUrl || result?.debug?.capture?.mediaUrl || '';
            overlay.dataset.analysisId = result?.id ? String(result.id) : '';

            const moreInfoButton = overlay.querySelector('.deepfake-overlay-more');

            if (moreInfoButton && result?.id) {
                moreInfoButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.openAnalysisDetails(result.id);
                });
            }
            
            // Store reference
            this.overlays.set(element, overlay);
            this.overlayResults.set(element, result);
            
            console.log('Deepfake Detection: Overlay created successfully');
        } catch (error) {
            console.error('Deepfake Detection: Error creating overlay', error);
        }
    }

    removeOverlay(element) {
        const overlay = this.overlays.get(element);
        if (overlay) {
            const container = overlay.parentNode;
            overlay.remove();
            this.overlays.delete(element);
            this.overlayResults.delete(element);
            this.teardownMediaContainer(container, element);
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
        const containers = document.querySelectorAll(`.deepfake-container.${ContentScript.ROOT_CLASS}`);
        containers.forEach((container) => {
            container.querySelectorAll('.deepfake-overlay, .deepfake-loading-overlay, .deepfake-error-overlay').forEach((node) => {
                node.remove();
            });
            const media = container.querySelector('img, video');
            this.teardownMediaContainer(container, media);
        });

        this.overlays.clear();
        this.overlayResults = new WeakMap();
        this.analysedElements = new WeakSet();
        this.processingElements = new WeakSet();
    }

    applyContainerRiskState(container, riskClass) {
        if (!container) {
            return;
        }

        container.classList.remove('risk-low', 'risk-medium', 'risk-high');
        if (riskClass) {
            container.classList.add(`risk-${riskClass}`);
        }
    }

    applyMediaRiskState(element, riskClass) {
        if (!element?.classList) {
            return;
        }

        element.classList.remove('deepfake-risk-frame', 'risk-low', 'risk-medium', 'risk-high');
        if (riskClass) {
            element.classList.add('deepfake-risk-frame', `risk-${riskClass}`);
        }
    }

    findMediaByElement(element) {
        if (!element) {
            return null;
        }

        return this.mediaElements.find((media) => media.element === element)
            || this.findMediaElements().find((media) => media.element === element)
            || null;
    }

    findMediaBySource(src) {
        if (!src) {
            return null;
        }

        return this.mediaElements.find((media) => media.src === src)
            || this.findMediaElements().find((media) => media.src === src)
            || null;
    }

    async findStoredResultForMedia(media) {
        const mediaUrl = media?.src;
        if (!mediaUrl || typeof chrome === 'undefined' || !chrome.storage?.local?.get) {
            return null;
        }

        const result = await chrome.storage.local.get(['analysisHistory']);
        const history = Array.isArray(result.analysisHistory) ? result.analysisHistory : [];
        return history.find((entry) => {
            const candidateUrl = entry?.mediaUrl || entry?.debug?.capture?.mediaUrl || '';
            return candidateUrl === mediaUrl;
        }) || null;
    }

    async findStoredResultById(resultId) {
        if (!resultId || typeof chrome === 'undefined' || !chrome.storage?.local?.get) {
            return null;
        }

        const result = await chrome.storage.local.get(['analysisHistory']);
        const history = Array.isArray(result.analysisHistory) ? result.analysisHistory : [];
        return history.find((entry) => String(entry?.id) === String(resultId)) || null;
    }

    async handleOverlayReanalysis(element, overlay, triggerButton) {
        const media = this.findMediaByElement(element) || this.findMediaBySource(overlay?.dataset?.mediaSrc || '');
        const storedById = await this.findStoredResultById(overlay?.dataset?.analysisId || '');
        const existingResult = storedById || this.overlayResults.get(element) || await this.findStoredResultForMedia(media);

        if (!media) {
            this.showError('Could not find this image to re-analyse. Try refreshing the page.');
            return;
        }
        if (triggerButton) {
            triggerButton.disabled = true;
        }

        this.showStatus('Re-analysing...', 2000);

        try {
            if (existingResult?.id) {
                await this.reanalyseOverlayMedia(media, existingResult);
                return;
            }

            await this.analyseMediaForOverlay(media, { force: true });
        } finally {
            if (triggerButton?.isConnected) {
                triggerButton.disabled = false;
            }
        }
    }

    getRiskLevel(score) {
        if (score < 33) {
            return { label: 'Low Risk', class: 'low', iconMarkup: this.getRiskIconMarkup('low', 20) };
        } else if (score < 66) {
            return { label: 'Medium Risk', class: 'medium', iconMarkup: this.getRiskIconMarkup('medium', 20) };
        } else {
            return { label: 'High Risk', class: 'high', iconMarkup: this.getRiskIconMarkup('high', 20) };
        }
    }

    showMediaSelector() {
        const availableMedia = this.findMediaElements();
        this.mediaElements = availableMedia;

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
                ${availableMedia.map((media, index) => `
                    <div class="media-item" data-index="${index}" data-src="${media.src}" data-type="${media.type || 'image'}">
                        <img src="${media.src}" class="media-thumbnail" alt="Media ${index + 1}">
                    </div>
                `).join('')}
            </div>
            <div class="media-selector-actions">
                <button class="analyze-btn" id="analyseSelectedBtn" disabled>Analyse Selected</button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Add event listeners
        const closeBtn = modal.querySelector('.media-selector-close');
        const analyseBtn = modal.querySelector('#analyseSelectedBtn');
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
                analyseBtn.disabled = false;
            });
        });
        
        analyseBtn.addEventListener('click', () => {
            const selectedItem = modal.querySelector('.media-item.selected');
            if (selectedItem) {
                const index = Number.parseInt(selectedItem.dataset.index, 10);
                const selectedSrc = selectedItem.dataset.src;
                const selectedType = selectedItem.dataset.type;
                const media = availableMedia[index]
                    || this.findMediaElements().find((item) => item.src === selectedSrc && item.type === selectedType)
                    || this.findMediaElements().find((item) => item.src === selectedSrc);
                this.analyseMedia(media);
                overlay.remove();
            }
        });
    }

    async buildAnalysisRequest(media) {
        const request = {
            src: media.src,
            type: media.type || 'image',
            element: media.element?.tagName?.toLowerCase() || 'img',
            sensitivity: this.sensitivity,
            detailLevel: this.detailLevel,
            captureBounds: this.getCaptureBounds(media.element)
        };

        if (media?.type === 'video') {
            request.imageDataUrl = await this.captureVideoFrameDataUrl(media.element);
            request.snapshotSource = 'video-frame';
        }

        return request;
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

    isEligibleForAutomaticAnalysis(media) {
        const bounds = this.getCaptureBounds(media?.element);
        if (!bounds) {
            return false;
        }

        if (media?.type === 'video' && !this.canCaptureVideoFrame(media.element)) {
            return false;
        }

        const minWidth = 180;
        const minHeight = 150;
        const minArea = 60000;

        return bounds.width >= minWidth
            && bounds.height >= minHeight
            && (bounds.width * bounds.height) >= minArea;
    }

    canCaptureVideoFrame(videoElement) {
        if (!videoElement) {
            return false;
        }

        return videoElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
            && (videoElement.videoWidth || 0) > 0
            && (videoElement.videoHeight || 0) > 0;
    }

    attachVideoReadinessListener(videoElement) {
        if (!videoElement || this.videoReadinessListeners.has(videoElement)) {
            return;
        }

        const handleReady = () => {
            if (!this.isEnabled || this.detectionMode !== 'automatic') {
                return;
            }

            this.syncAutomaticAnalysisTargets();
        };

        videoElement.addEventListener('loadedmetadata', handleReady);
        videoElement.addEventListener('loadeddata', handleReady);
        videoElement.addEventListener('canplay', handleReady);
        this.videoReadinessListeners.add(videoElement);
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

    shouldSuppressAnalysisError(error) {
        if (!error) {
            return false;
        }

        return error.type === 'network_error'
            || error.userMessage === 'The extension could not download this media for analysis.';
    }

    async analyseMedia(media) {
        try {
            // Check if Chrome APIs are available
            if (!this.isExtensionContextAvailable()) {
                this.handleInvalidatedContext();
                return;
            }

            if (!media?.element || !media?.src) {
                this.showError('The selected media is no longer available. Please reopen the detector and try again.');
                return;
            }

            await this.ensureMediaVisible(media.element);
            
            // Send analysis request to background script with current sensitivity
            const request = await this.buildAnalysisRequest(media);
            const response = await chrome.runtime.sendMessage({
                action: 'analyzeMedia',
                data: request
            });
            
            if (response.success) {
                this.logAnalysisResult(media, response.result);
                this.showAnalysisResult(response.result);
            } else {
                if (this.shouldSuppressAnalysisError(response.error)) {
                    return;
                }

                // Show user-friendly error message
                this.showError(response.error?.userMessage || 'Analysis failed. Please try again.');
            }
        } catch (error) {
            console.error('Analysis error:', error);
            if (this.isContextInvalidationError(error)) {
                this.handleInvalidatedContext();
                return;
            }
            this.showError('Analysis failed. Please try again.');
        }
    }

    isExtensionContextAvailable() {
        try {
            return Boolean(typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime?.sendMessage);
        } catch {
            return false;
        }
    }

    isContextInvalidationError(error) {
        const message = error?.message || '';
        return /Extension context invalidated/i.test(message);
    }

    handleInvalidatedContext() {
        this.showError('Extension updated. Refresh this page to reconnect the deepfake detector.');
    }

    async openAnalysisDetails(analysisId) {
        try {
            if (!this.isExtensionContextAvailable()) {
                this.handleInvalidatedContext();
                return;
            }

            const response = await chrome.runtime.sendMessage({
                action: 'openAnalysisPage',
                analysisId
            });

            if (!response?.success) {
                throw new Error(response?.error?.message || 'Failed to open analysis page');
            }
        } catch (error) {
            console.error('Deepfake Detection: Failed to open media analysis page.', error);
        }
    }

    showAnalysisResult(result) {
        // Create result notification
        const notification = this.markAsExtensionRoot(document.createElement('div'));
        
        // Handle both success and error cases
        const isError = !result || result.success === false;
        const riskScore = isError ? 0 : (result.riskScore || 0);
        const confidence = isError ? 0 : (result.confidence || 0);
        const canOpenDetails = !isError && Boolean(result?.id);
        
        const riskLevel = this.getRiskLevel(riskScore);
        notification.className = `${ContentScript.ROOT_CLASS} deepfake-analysis-toast ${isError ? 'is-error' : `is-${riskLevel.class}`}`;
        
        notification.innerHTML = `
            <div class="deepfake-analysis-toast-body">
                <div class="deepfake-analysis-toast-icon">${isError ? this.getIconMarkup('alertTriangle', 24) : riskLevel.iconMarkup}</div>
                <div class="deepfake-analysis-toast-content">
                    <div class="deepfake-analysis-toast-title">
                        ${isError ? 'Analysis Failed' : riskLevel.label}
                    </div>
                    <div class="deepfake-analysis-toast-meta">
                        ${isError ? (result.error?.userMessage || 'An error occurred during analysis') : `Confidence: ${confidence.toFixed(1)}%`}
                    </div>
                    ${!isError ? `
                    <div class="deepfake-analysis-toast-copy">
                        ${result.explanation || 'Analysis completed successfully.'}
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="deepfake-analysis-toast-actions">
                ${canOpenDetails ? '<button class="deepfake-notification-more" type="button">More Information</button>' : ''}
                <button class="deepfake-notification-close" type="button">Close</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        const closeButton = notification.querySelector('.deepfake-notification-close');
        const moreInfoButton = notification.querySelector('.deepfake-notification-more');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                notification.remove();
            });
        }
        if (moreInfoButton) {
            moreInfoButton.addEventListener('click', async () => {
                this.openAnalysisDetails(result.id);
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
            return { label: 'Low Risk', class: 'low', color: '#28a745', iconMarkup: this.getRiskIconMarkup('low', 20) };
        } else if (score < 66) {
            return { label: 'Medium Risk', class: 'medium', color: '#ffc107', iconMarkup: this.getRiskIconMarkup('medium', 20) };
        } else {
            return { label: 'High Risk', class: 'high', color: '#dc3545', iconMarkup: this.getRiskIconMarkup('high', 20) };
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

    showStatus(message, duration = 2000) {
        const statusDiv = this.markAsExtensionRoot(document.createElement('div'));
        statusDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 27, 20, 0.96);
            color: #f4fff7;
            padding: 12px 20px;
            border-radius: 999px;
            font-size: 14px;
            font-weight: 600;
            z-index: 10002;
            box-shadow: 0 10px 24px rgba(3, 13, 9, 0.35);
            border: 1px solid rgba(31, 138, 70, 0.35);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        statusDiv.textContent = message;
        document.body.appendChild(statusDiv);

        setTimeout(() => {
            statusDiv.remove();
        }, duration);
    }

    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    ensureMediaContainer(element) {
        if (!element?.parentNode) {
            return null;
        }

        const existingParent = element.parentNode;
        if (existingParent.classList?.contains('deepfake-container')) {
            return existingParent;
        }

        const adoptedContainer = this.findExistingOverlayHost(element);
        if (adoptedContainer) {
            return this.prepareExistingContainer(adoptedContainer);
        }

        const computedStyle = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const container = this.markAsExtensionRoot(document.createElement('div'));
        container.className = `${ContentScript.ROOT_CLASS} deepfake-container`;
        container.dataset.deepfakeOwnedWrapper = 'true';
        container.style.display = computedStyle.display === 'block' ? 'block' : 'inline-block';
        container.style.verticalAlign = computedStyle.verticalAlign || 'baseline';

        if (computedStyle.float && computedStyle.float !== 'none') {
            container.style.cssFloat = computedStyle.float;
        }

        if (computedStyle.margin && computedStyle.margin !== '0px') {
            element.dataset.deepfakeOriginalMargin = element.style.margin || '';
            container.style.margin = computedStyle.margin;
            element.style.margin = '0';
        }

        if (computedStyle.width && computedStyle.width !== 'auto') {
            container.style.width = computedStyle.width;
        } else if (rect.width > 0) {
            container.style.width = `${rect.width}px`;
        }

        if (computedStyle.maxWidth && computedStyle.maxWidth !== 'none') {
            container.style.maxWidth = computedStyle.maxWidth;
        } else {
            container.style.maxWidth = '100%';
        }

        existingParent.insertBefore(container, element);
        container.appendChild(element);
        return container;
    }

    findExistingOverlayHost(element) {
        const elementRect = element.getBoundingClientRect();
        let candidate = element.parentElement;
        let depth = 0;

        while (candidate && candidate !== document.body && depth < 4) {
            if (!candidate.classList?.contains(ContentScript.ROOT_CLASS)) {
                const style = window.getComputedStyle(candidate);
                const rect = candidate.getBoundingClientRect();
                const hasComparableBox = Math.abs(rect.width - elementRect.width) <= 2
                    && Math.abs(rect.height - elementRect.height) <= 2;
                const hasAspectRatioLayout = style.paddingBottom !== '0px'
                    || style.aspectRatio !== 'auto'
                    || style.position !== 'static';

                if (hasComparableBox && hasAspectRatioLayout) {
                    return candidate;
                }
            }

            candidate = candidate.parentElement;
            depth += 1;
        }

        return null;
    }

    prepareExistingContainer(container) {
        if (!container.classList.contains('deepfake-container')) {
            container.classList.add('deepfake-container');
        }

        this.markAsExtensionRoot(container);

        const currentPosition = container.style.position || '';
        if (!container.dataset.deepfakeOriginalPosition) {
            container.dataset.deepfakeOriginalPosition = currentPosition;
        }

        if (window.getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        return container;
    }

    teardownMediaContainer(container, mediaElement = null) {
        if (!container) {
            return;
        }

        this.applyContainerRiskState(container, null);
        this.applyMediaRiskState(mediaElement || container.querySelector('img, video'), null);

        if (container.dataset.deepfakeOwnedWrapper === 'true') {
            const media = mediaElement || container.querySelector('img, video');
            if (media && container.parentNode) {
                if (media.dataset.deepfakeOriginalMargin !== undefined) {
                    media.style.margin = media.dataset.deepfakeOriginalMargin;
                    delete media.dataset.deepfakeOriginalMargin;
                }
                container.parentNode.insertBefore(media, container);
            }
            container.remove();
            return;
        }

        if (!container.querySelector('.deepfake-overlay, .deepfake-loading-overlay, .deepfake-error-overlay')) {
            if (container.dataset.deepfakeOriginalPosition !== undefined) {
                container.style.position = container.dataset.deepfakeOriginalPosition;
                delete container.dataset.deepfakeOriginalPosition;
            }

            container.classList.remove('deepfake-container');
            container.classList.remove(ContentScript.ROOT_CLASS);
        }
    }

    setupViewportObserver() {
        if (this.viewportObserver) {
            return;
        }

        this.viewportObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                const media = this.mediaElements.find((item) => item.element === entry.target);
                if (!media) {
                    return;
                }

                void this.analyseMediaForOverlay(media);
            });
        }, {
            root: null,
            rootMargin: '120px 0px',
            threshold: 0.25
        });
    }

    stopAutomaticAnalysis() {
        if (this.viewportObserver) {
            this.viewportObserver.disconnect();
            this.viewportObserver = null;
        }
    }

    syncAutomaticAnalysisTargets() {
        if (!this.isEnabled || this.detectionMode !== 'automatic') {
            return;
        }

        this.mediaElements = this.findMediaElements();
        this.setupViewportObserver();
        this.mediaElements.forEach((media) => {
            if (media?.type === 'video' && media?.element) {
                this.attachVideoReadinessListener(media.element);
            }

            if (media?.element && document.contains(media.element) && this.isEligibleForAutomaticAnalysis(media)) {
                this.viewportObserver.observe(media.element);
            }
        });
    }

    async analyseMediaForOverlay(media, options = {}) {
        const element = media?.element;
        const force = Boolean(options.force);
        if (!element || !media?.src || !document.contains(element)) {
            return;
        }

        if (!force && !this.isEligibleForAutomaticAnalysis(media)) {
            return;
        }

        if (!force && (this.processingElements.has(element) || this.analysedElements.has(element) || this.overlays.has(element))) {
            return;
        }

        if (force) {
            this.removeOverlay(element);
            const container = this.ensureMediaContainer(element);
            if (container) {
                container.querySelectorAll('.deepfake-loading-overlay, .deepfake-error-overlay').forEach((node) => node.remove());
            }
        }

        this.processingElements.add(element);
        const loadingOverlay = this.createLoadingOverlay(element);

        try {
            if (!this.isExtensionContextAvailable()) {
                this.handleInvalidatedContext();
                return;
            }

            const request = await this.buildAnalysisRequest(media);
            const response = await chrome.runtime.sendMessage({
                action: 'analyzeMedia',
                data: request
            });

            if (loadingOverlay?.parentNode) {
                loadingOverlay.remove();
            }

            if (response?.success) {
                this.createOverlay(element, response.result);
            } else {
                if (!this.shouldSuppressAnalysisError(response?.error)) {
                    this.createErrorOverlay(element, response?.error?.userMessage || 'Analysis failed');
                }
            }

            this.analysedElements.add(element);
        } catch (error) {
            console.error('Deepfake Detection: Automatic analysis failed:', error);
            if (loadingOverlay?.parentNode) {
                loadingOverlay.remove();
            }
            this.createErrorOverlay(element, 'Analysis failed. Please try again.');
            this.analysedElements.add(element);
        } finally {
            this.processingElements.delete(element);
            if (this.viewportObserver && document.contains(element)) {
                this.viewportObserver.unobserve(element);
            }
        }
    }

    async reanalyseOverlayMedia(media, existingResult) {
        const element = media?.element;
        if (!element || !existingResult?.id) {
            return;
        }

        if (this.processingElements.has(element)) {
            return;
        }

        this.removeOverlay(element);
        const container = this.ensureMediaContainer(element);
        if (container) {
            container.querySelectorAll('.deepfake-loading-overlay, .deepfake-error-overlay').forEach((node) => node.remove());
        }

        this.processingElements.add(element);
        const loadingOverlay = this.createLoadingOverlay(element);

        try {
            if (!this.isExtensionContextAvailable()) {
                this.handleInvalidatedContext();
                return;
            }

            const responsePromise = chrome.runtime.sendMessage({
                action: 'reanalyzeStoredMedia',
                data: {
                    existingResult,
                    sensitivity: this.sensitivity,
                    detailLevel: this.detailLevel
                }
            });
            const [response] = await Promise.all([responsePromise, this.delay(2000)]);

            if (loadingOverlay?.parentNode) {
                loadingOverlay.remove();
            }

            if (response?.success) {
                this.createOverlay(element, response.result);
                this.analysedElements.add(element);
            } else {
                if (!this.shouldSuppressAnalysisError(response?.error)) {
                    this.showError(response?.error?.userMessage || 'Re-analysis failed');
                    this.createErrorOverlay(element, response?.error?.userMessage || 'Re-analysis failed');
                }
            }
        } catch (error) {
            console.error('Deepfake Detection: Overlay re-analysis failed:', error);
            if (loadingOverlay?.parentNode) {
                loadingOverlay.remove();
            }
            this.showError('Re-analysis failed. Please try again.');
            this.createErrorOverlay(element, 'Re-analysis failed. Please try again.');
        } finally {
            this.processingElements.delete(element);
            if (this.viewportObserver && document.contains(element)) {
                this.viewportObserver.unobserve(element);
            }
        }
    }

    observeMediaChanges() {
        const observer = new MutationObserver((mutations) => {
            let hasNewMedia = false;
            
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'IMG' || node.tagName === 'VIDEO') {
                            hasNewMedia = true;
                            if (node.tagName === 'VIDEO') {
                                this.attachVideoReadinessListener(node);
                            }
                        } else if (node.querySelectorAll) {
                            const images = node.querySelectorAll('img');
                            const videos = node.querySelectorAll('video');
                            if (images.length > 0 || videos.length > 0) {
                                hasNewMedia = true;
                                videos.forEach((video) => this.attachVideoReadinessListener(video));
                            }
                        }
                    }
                });
            });
            
            if (hasNewMedia) {
                this.mediaElements = this.findMediaElements();

                if (this.isEnabled && this.detectionMode === 'automatic') {
                    this.syncAutomaticAnalysisTargets();
                }

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
        console.log(`Deepfake Detection: Updating detection mode to ${mode}`);
        this.detectionMode = mode === 'automatic' ? 'automatic' : 'manual';

        this.stopAutomaticAnalysis();
        this.removeAllOverlays();
        this.mediaElements = this.findMediaElements();

        if (!this.isEnabled) {
            return;
        }

        if (this.detectionMode === 'automatic') {
            if (this.floatingButton) {
                this.floatingButton.remove();
                this.floatingButton = null;
            }
            this.syncAutomaticAnalysisTargets();
            return;
        }

        if (!this.floatingButton && this.mediaElements.length > 0) {
            this.createFloatingButton();
        }
    }

    toggleDetection(enabled) {
        console.log(`Deepfake Detection: toggleDetection called with enabled=${enabled}, current isEnabled=${this.isEnabled}, mode=${this.detectionMode}`);
        this.isEnabled = enabled;
        this.mediaElements = this.findMediaElements();
        
        if (enabled && this.mediaElements.length > 0) {
            if (this.detectionMode === 'automatic') {
                if (this.floatingButton) {
                    this.floatingButton.remove();
                    this.floatingButton = null;
                }
                this.syncAutomaticAnalysisTargets();
            } else if (!this.floatingButton) {
                console.log('Deepfake Detection: Creating floating button for manual mode');
                this.createFloatingButton();
            }
        } else if (!enabled) {
            console.log('Deepfake Detection: Hiding floating button and removing overlays');
            this.stopAutomaticAnalysis();
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
                const request = await this.buildAnalysisRequest(media);
                const response = await chrome.runtime.sendMessage({
                    action: 'analyzeMedia',
                    data: request
                });
                
                // Remove loading overlay
                if (loadingOverlay && loadingOverlay.parentNode) {
                    loadingOverlay.remove();
                }
                
                if (response.success) {
                    console.log(`Deepfake Detection: Creating overlay for element ${index} with sensitivity ${this.sensitivity}`);
                    this.createOverlay(media.element, response.result);
                } else {
                    if (!this.shouldSuppressAnalysisError(response.error)) {
                        // Show user-friendly error on the media element itself
                        this.createErrorOverlay(media.element, response.error?.userMessage || 'Analysis failed');
                    }
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
        const wrapper = this.ensureMediaContainer(element);
        if (!wrapper) {
            return null;
        }

        const existingLoadingOverlay = wrapper.querySelector('.deepfake-loading-overlay');
        if (existingLoadingOverlay) {
            return existingLoadingOverlay;
        }

        const container = this.markAsExtensionRoot(document.createElement('div'));
        container.className = `${ContentScript.ROOT_CLASS} deepfake-loading-overlay`;
        container.innerHTML = `
            <div class="deepfake-loading-spinner"></div>
            <div class="deepfake-loading-text">Analyzing...</div>
        `;

        wrapper.appendChild(container);
        
        return container;
    }

    createErrorOverlay(element, errorMessage) {
        const parentContainer = this.ensureMediaContainer(element);
        if (!parentContainer) {
            return;
        }

        const existingError = parentContainer.querySelector('.deepfake-error-overlay');
        if (existingError) {
            existingError.querySelector('.deepfake-error-text').textContent = errorMessage;
            return;
        }

        const errorContainer = this.markAsExtensionRoot(document.createElement('div'));
        errorContainer.className = `${ContentScript.ROOT_CLASS} deepfake-error-overlay`;
        errorContainer.innerHTML = `
            <div class="deepfake-error-icon">${this.getIconMarkup('alertTriangle', 24)}</div>
            <div class="deepfake-error-text">${errorMessage}</div>
        `;

        parentContainer.appendChild(errorContainer);
        
        // Show on hover
        parentContainer.addEventListener('mouseenter', () => {
            errorContainer.classList.add('visible');
        });
        
        parentContainer.addEventListener('mouseleave', () => {
            errorContainer.classList.remove('visible');
        });
    }

    async initialiseModelInference() {
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

    async analyseMediaWithModel(media) {
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

    async captureVideoFrameDataUrl(videoElement) {
        if (!videoElement) {
            throw new Error('No video element was provided for frame capture.');
        }

        const width = videoElement.videoWidth || videoElement.clientWidth || 0;
        const height = videoElement.videoHeight || videoElement.clientHeight || 0;
        if (width <= 0 || height <= 0) {
            throw new Error('Video metadata is not ready for frame capture yet.');
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Canvas context is unavailable for video frame capture.');
        }

        ctx.drawImage(videoElement, 0, 0, width, height);
        return canvas.toDataURL('image/png');
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
        const normalisedDistance = distance / maxDistance;
        const confidence = 70 + normalisedDistance * 25;
        
        return Math.max(70, Math.min(95, confidence));
    }

    updateSensitivity(sensitivity) {
        console.log(`Deepfake Detection: Updating sensitivity to ${sensitivity}`);
        this.sensitivity = sensitivity;
        if (this.isEnabled && this.detectionMode === 'automatic') {
            this.stopAutomaticAnalysis();
            this.removeAllOverlays();
            this.syncAutomaticAnalysisTargets();
        }
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
