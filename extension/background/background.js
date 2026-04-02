// Deepfake Detection Extension - Background Service Worker
class BackgroundService {
    constructor() {
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                this.handleInstall();
            } else if (details.reason === 'update') {
                this.handleUpdate();
            }
        });

        // Handle messages from popup and content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async response
        });

        // Handle storage changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            this.handleStorageChange(changes, namespace);
        });
    }

    handleInstall() {
        console.log('Deepfake Detection Extension installed');
        
        // Set default settings with detection disabled by default
        chrome.storage.local.set({
            settings: {
                autoAnalyze: false,
                confidenceThreshold: 70,
                enableNotifications: true,
                modelVersion: '2.11',
                detectionEnabled: false,  // Default to disabled
                sensitivity: 50,  // Default sensitivity
                detectionMode: 'manual'  // Default to manual mode
            },
            statistics: {
                totalAnalyzed: 0,
                highRiskCount: 0,
                lowRiskCount: 0,
                avgProcessingTime: 0
            },
            analysisHistory: []
        });

        // Don't automatically open new tab - user controls when to open
        console.log('Extension installed. Click the popup to get started.');
    }

    handleUpdate() {
        console.log('Deepfake Detection Extension updated');
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'analyzeMedia':
                    const result = await this.analyzeMedia(message.data);
                    sendResponse({ success: true, result });
                    break;

                case 'getModelInfo':
                    const modelInfo = await this.getModelInfo();
                    sendResponse({ success: true, modelInfo });
                    break;

                case 'getStatistics':
                    const stats = await this.getStatistics();
                    sendResponse({ success: true, statistics: stats });
                    break;

                case 'exportData':
                    const exportResult = await this.exportAnalysisData();
                    sendResponse({ success: true, data: exportResult });
                    break;

                case 'clearData':
                    await this.clearAnalysisData();
                    sendResponse({ success: true });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background service error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async analyzeMedia(mediaData) {
        // Simulate model loading and inference
        await this.delay(1500);

        // Mock analysis results
        const mockResults = {
            riskScore: Math.random() * 100,
            confidence: 70 + Math.random() * 25,
            processingTime: 150 + Math.random() * 100,
            explanation: this.generateExplanation(),
            technicalDetails: {
                model: 'MesoNet v2.11',
                parameters: '28,009',
                inferenceTime: `${Math.floor(100 + Math.random() * 200)}ms`
            },
            timestamp: new Date().toISOString()
        };

        // Save to storage
        await this.saveAnalysisResult(mockResults);

        return mockResults;
    }

    async getModelInfo() {
        return {
            name: 'MesoNet',
            version: '2.11',
            architecture: 'CNN',
            parameters: 28009,
            size: '0.1 MB',
            framework: 'PyTorch + ONNX',
            accuracy: '85-95%',
            lastUpdated: '2026-03-27'
        };
    }

    async getStatistics() {
        const result = await chrome.storage.local.get(['statistics']);
        return result.statistics || {
            totalAnalyzed: 0,
            highRiskCount: 0,
            lowRiskCount: 0,
            avgProcessingTime: 0
        };
    }

    async saveAnalysisResult(result) {
        const data = await chrome.storage.local.get(['analysisHistory', 'statistics']);
        
        // Add to history
        const history = data.analysisHistory || [];
        history.push(result);
        
        // Update statistics
        const stats = data.statistics || {
            totalAnalyzed: 0,
            highRiskCount: 0,
            lowRiskCount: 0,
            avgProcessingTime: 0
        };
        
        stats.totalAnalyzed = history.length;
        stats.highRiskCount = history.filter(r => r.riskScore >= 66).length;
        stats.lowRiskCount = history.filter(r => r.riskScore < 33).length;
        
        if (history.length > 0) {
            const totalTime = history.reduce((sum, r) => sum + r.processingTime, 0);
            stats.avgProcessingTime = Math.round(totalTime / history.length);
        }

        // Save updated data
        await chrome.storage.local.set({
            analysisHistory: history,
            statistics: stats
        });
    }

    async exportAnalysisData() {
        const data = await chrome.storage.local.get(['analysisHistory', 'statistics']);
        
        return {
            timestamp: new Date().toISOString(),
            statistics: data.statistics || {},
            results: data.analysisHistory || []
        };
    }

    async clearAnalysisData() {
        await chrome.storage.local.set({
            analysisHistory: [],
            statistics: {
                totalAnalyzed: 0,
                highRiskCount: 0,
                lowRiskCount: 0,
                avgProcessingTime: 0
            }
        });
    }

    handleStorageChange(changes, namespace) {
        if (namespace === 'local') {
            // React to storage changes if needed
            console.log('Storage changed:', changes);
        }
    }

    generateExplanation() {
        const explanations = [
            "The model detected subtle inconsistencies in facial features that are characteristic of synthetic media generation.",
            "Analysis reveals unnatural lighting patterns and texture artifacts commonly found in AI-generated content.",
            "The media shows signs of digital manipulation, particularly around facial regions and background elements.",
            "Facial symmetry analysis and micro-expression patterns suggest potential synthetic origin.",
            "Technical artifacts in the compression and rendering pipeline indicate possible deepfake generation."
        ];
        
        return explanations[Math.floor(Math.random() * explanations.length)];
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize background service
new BackgroundService();
