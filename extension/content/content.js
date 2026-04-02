// Deepfake Detection Extension - Content Script
console.log('Deepfake Detection: Content script file loaded');

class ContentScript {
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
        const videos = document.querySelectorAll('video[src]');
        const videoPosters = document.querySelectorAll('video[poster]');
        
        const mediaElements = [
            ...Array.from(images).map(img => ({ src: img.src, element: img, type: 'image' })),
            ...Array.from(videos).map(video => ({ src: video.src, element: video, type: 'video' })),
            ...Array.from(videoPosters).map(video => ({
                src: video.poster,
                element: video,
                type: 'video-poster'
            }))
        ].filter(media => {
            // Check if media has valid source and element exists
            return this.isValidMediaUrl(media.src) && media.element && document.contains(media.element);
        });
        
        console.log(`Deepfake Detection: Found ${mediaElements.length} valid media elements`);
        return mediaElements;
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
        this.floatingButton = document.createElement('div');
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

    addFloatingButtonStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #deepfake-detector-button {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 50%;
                width: 56px;
                height: 56px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                transition: all 0.3s ease;
            }

            #deepfake-detector-button:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
            }

            .detector-icon {
                font-size: 24px;
                color: white;
            }

            .detector-tooltip {
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

            .detector-tooltip::after {
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

            .media-selector-overlay {
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

            .media-selector-modal {
                background: white;
                border-radius: 12px;
                padding: 24px;
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            }

            .media-selector-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }

            .media-selector-title {
                font-size: 18px;
                font-weight: 600;
                color: #333;
            }

            .media-selector-close {
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

            .media-selector-close:hover {
                background: #f1f3f4;
            }

            .media-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 16px;
                margin-bottom: 20px;
            }

            .media-item {
                border: 2px solid #e1e4e8;
                border-radius: 8px;
                padding: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                text-align: center;
            }

            .media-item:hover {
                border-color: #667eea;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
            }

            .media-item.selected {
                border-color: #667eea;
                background: #f8f9ff;
            }

            .media-thumbnail {
                width: 100%;
                height: 100px;
                object-fit: cover;
                border-radius: 4px;
                margin-bottom: 8px;
            }

            .media-info {
                font-size: 12px;
                color: #666;
                word-break: break-all;
            }

            .media-selector-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }

            .analyze-btn {
                background: #667eea;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.3s ease;
            }

            .analyze-btn:hover {
                background: #5a6fd8;
            }

            .analyze-btn:disabled {
                background: #e1e4e8;
                color: #666;
                cursor: not-allowed;
            }

            /* Deepfake Overlay Styles */
            .deepfake-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.3s ease;
                pointer-events: none;
            }

            .deepfake-overlay.visible {
                opacity: 1;
            }

            .deepfake-overlay-icon {
                font-size: 32px;
                margin-bottom: 8px;
            }

            .deepfake-overlay-text {
                font-size: 14px;
                font-weight: 600;
                text-align: center;
                margin-bottom: 4px;
            }

            .deepfake-overlay-confidence {
                font-size: 12px;
                opacity: 0.8;
            }

            .deepfake-overlay.low-risk {
                background: rgba(40, 167, 69, 0.8);
            }

            .deepfake-overlay.medium-risk {
                background: rgba(255, 193, 7, 0.8);
            }

            .deepfake-overlay.high-risk {
                background: rgba(220, 53, 69, 0.8);
            }

            .deepfake-container {
                position: relative;
                display: inline-block;
            }
        `;
        document.head.appendChild(style);
    }

    createOverlay(element, result) {
        console.log('Deepfake Detection: Creating overlay for element', element);
        
        try {
            // Check if element exists and has a parent
            if (!element || !element.parentNode) {
                console.warn('Deepfake Detection: Cannot create overlay - element or parent is missing');
                return;
            }
            
            const container = document.createElement('div');
            container.className = 'deepfake-container';
            
            // Wrap the original element
            element.parentNode.insertBefore(container, element);
            container.appendChild(element);
            
            // Create overlay
            const overlay = document.createElement('div');
            overlay.className = 'deepfake-overlay';
            
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
        const style = document.createElement('style');
        style.textContent = `
            #deepfake-detector-button {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 50%;
                width: 56px;
                height: 56px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                transition: all 0.3s ease;
            }

            #deepfake-detector-button:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
            }

            .detector-icon {
                font-size: 24px;
                color: white;
            }

            .detector-tooltip {
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

            .detector-tooltip::after {
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

            .media-selector-overlay {
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

            .media-selector-modal {
                background: white;
                border-radius: 12px;
                padding: 24px;
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
            }

            .media-selector-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }

            .media-selector-title {
                font-size: 18px;
                font-weight: 600;
                color: #333;
            }

            .media-selector-close {
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

            .media-selector-close:hover {
                background: #f1f3f4;
            }

            .media-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 16px;
                margin-bottom: 20px;
            }

            .media-item {
                border: 2px solid #e1e4e8;
                border-radius: 8px;
                padding: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
                text-align: center;
            }

            .media-item:hover {
                border-color: #667eea;
                box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
            }

            .media-item.selected {
                border-color: #667eea;
                background: #f8f9ff;
            }

            .media-thumbnail {
                width: 100%;
                height: 100px;
                object-fit: cover;
                border-radius: 4px;
                margin-bottom: 8px;
            }

            .media-info {
                font-size: 12px;
                color: #666;
                word-break: break-all;
            }

            .media-selector-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }

            .analyze-btn {
                background: #667eea;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background 0.3s ease;
            }

            .analyze-btn:hover {
                background: #5a6fd8;
            }

            .analyze-btn:disabled {
                background: #e1e4e8;
                color: #666;
                cursor: not-allowed;
            }
        `;
        document.head.appendChild(style);
    }

    showMediaSelector() {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'media-selector-overlay';
        
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

    async analyzeMedia(media) {
        try {
            // Send analysis request to background script
            const response = await chrome.runtime.sendMessage({
                action: 'analyzeMedia',
                data: {
                    src: media.src,
                    type: media.type || 'image',
                    element: media.element?.tagName?.toLowerCase() || 'img'
                }
            });
            
            if (response.success) {
                this.showAnalysisResult(response.result);
            } else {
                this.showError('Analysis failed: ' + response.error);
            }
        } catch (error) {
            console.error('Analysis error:', error);
            this.showError('Analysis failed. Please try again.');
        }
    }

    showAnalysisResult(result) {
        // Create result notification
        const notification = document.createElement('div');
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
        
        const riskLevel = this.getRiskLevel(result.riskScore);
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <div style="font-size: 24px;">${riskLevel.icon}</div>
                <div>
                    <div style="font-weight: 600; color: ${riskLevel.color};">
                        ${riskLevel.label}
                    </div>
                    <div style="font-size: 12px; color: #666;">
                        Confidence: ${result.confidence.toFixed(1)}%
                    </div>
                </div>
            </div>
            <div style="font-size: 14px; color: #333; line-height: 1.4;">
                ${result.explanation}
            </div>
            <div style="margin-top: 12px; text-align: right;">
                <button onclick="this.parentElement.parentElement.remove()" style="background: #667eea; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;">
                    Close
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
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
        const errorDiv = document.createElement('div');
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
                
                // Add overlays if in automatic mode
                if (this.isEnabled && this.detectionMode === 'automatic') {
                    this.addOverlaysToAllMedia();
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
        this.detectionMode = mode;
        
        // Re-apply overlays based on new mode
        if (this.isEnabled) {
            this.removeAllOverlays();
            
            if (mode === 'automatic') {
                console.log('Deepfake Detection: Switching to automatic mode - removing floating button and adding overlays');
                // Remove floating button for automatic mode
                if (this.floatingButton) {
                    this.floatingButton.remove();
                    this.floatingButton = null;
                }
                // Add automatic overlays
                this.addOverlaysToAllMedia();
            } else {
                console.log('Deepfake Detection: Switching to manual mode - creating floating button and removing overlays');
                // Remove overlays for manual mode
                this.removeAllOverlays();
                // Create floating button for manual mode
                if (!this.floatingButton && this.mediaElements.length > 0) {
                    this.createFloatingButton();
                }
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
            } else if (this.detectionMode === 'automatic' && this.floatingButton) {
                console.log('Deepfake Detection: Removing floating button for automatic mode');
                this.floatingButton.remove();
                this.floatingButton = null;
            }
            
            // Add overlays based on detection mode
            if (this.detectionMode === 'automatic') {
                console.log('Deepfake Detection: Adding automatic overlays');
                this.addOverlaysToAllMedia();
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

    addOverlaysToAllMedia() {
        console.log(`Deepfake Detection: Adding overlays to ${this.mediaElements.length} media elements`);
        this.mediaElements.forEach((media, index) => {
            // Check if element still exists in DOM
            if (!media.element || !document.contains(media.element)) {
                console.warn(`Deepfake Detection: Skipping element ${index} - no longer in DOM`);
                return;
            }
            
            // Check if overlay already exists
            if (this.overlays.has(media.element)) {
                console.log(`Deepfake Detection: Overlay already exists for element ${index}`);
                return;
            }
            
            // Simulate analysis result
            const mockResult = {
                riskScore: Math.random() * 100,
                confidence: 70 + Math.random() * 25
            };
            console.log(`Deepfake Detection: Creating overlay for element ${index}`);
            this.createOverlay(media.element, mockResult);
        });
    }

    updateSensitivity(sensitivity) {
        console.log(`Deepfake Detection: Updating sensitivity to ${sensitivity}`);
        this.sensitivity = sensitivity;
        // Re-analyze with new sensitivity
        if (this.isEnabled) {
            this.removeAllOverlays();
            this.addOverlaysToAllMedia();
        }
    }

    highlightMediaElement(src) {
        const element = this.mediaElements.find(media => media.src === src);
        if (element && element.element) {
            element.element.style.border = '3px solid #667eea';
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
