import * as ort from '../dist/ort.wasm.bundle.min.mjs';
import { initSentry } from '../sentry.js';

// Deepfake Detection Extension - Background Service Worker
class BackgroundService {
    static MEDIA_DB_NAME = 'deepfake-media-store';

    static MEDIA_STORE_NAME = 'analysis-media';

    constructor() {
        this.modelSession = null;
        this.modelInitialized = false;
        this.modelSessions = new Map();
        this.ort = null;
        this.mediaDbPromise = null;
        this.ensembleModelKeys = ['mesonet', 'lightweight'];
        this.ensembleWeights = {
            mesonet: 0.7,
            lightweight: 0.3
        };
        this.calibrationProfiles = {
            mesonet: { type: 'logit', scale: 1, bias: 0 },
            lightweight: { type: 'logit', scale: 1, bias: 0 },
            ensemble: { type: 'logit', scale: 1, bias: 0 }
        };
        this.modelRegistry = {
            lightweight: {
                key: 'lightweight',
                name: 'LightweightNet',
                version: '2.11',
                architecture: 'CNN',
                parameters: 2377,
                size: '0.03 MB',
                framework: 'PyTorch + ONNX',
                accuracy: 'Prototype',
                lastUpdated: '2026-04-03',
                modelPath: 'models/lightweight_model.onnx',
                externalDataPath: 'models/lightweight_model.onnx.data'
            },
            mesonet: {
                key: 'mesonet',
                name: 'MesoNet',
                version: '2.11',
                architecture: 'MesoNet-inspired CNN',
                parameters: 28009,
                size: '0.11 MB',
                framework: 'PyTorch + ONNX',
                accuracy: 'Research candidate',
                lastUpdated: '2026-04-03',
                modelPath: 'models/mesonet_model.onnx',
                externalDataPath: 'models/mesonet_model.onnx.data'
            },
            ensemble: {
                key: 'ensemble',
                name: 'Ensemble (MesoNet + LightweightNet)',
                version: '2.11',
                architecture: 'Weighted probability ensemble',
                parameters: 30386,
                size: '0.14 MB',
                framework: 'PyTorch + ONNX',
                accuracy: 'Research candidate+',
                lastUpdated: '2026-04-20'
            }
        };
        this.selectedModelKey = 'ensemble';
        this.modelInfo = this.modelRegistry[this.selectedModelKey];

        initSentry('background');

        this.initialiseEventListeners();
    }

    initialiseEventListeners() {
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                this.handleInstall();
                return;
            }

            this.handleUpdate();
        });

        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true;
        });

        chrome.storage.onChanged.addListener((changes, namespace) => {
            this.handleStorageChange(changes, namespace);
        });
    }

    async handleInstall() {
        const defaults = this.getDefaultSettings();
        await chrome.storage.local.set({
            ...defaults,
            settings: {
                autoAnalyze: false,
                confidenceThreshold: 70,
                enableNotifications: true,
                modelVersion: this.modelInfo.version,
                modelKey: defaults.modelKey,
                detectionEnabled: defaults.detectionEnabled,
                sensitivity: defaults.sensitivity,
                detectionMode: defaults.detectionMode,
                detailLevel: defaults.detailLevel,
                anonymousAnalytics: defaults.anonymousAnalytics
            },
            statistics: this.getEmptyStatistics(),
            analysisHistory: [],
            whitelistedDomains: []
        });
    }

    handleUpdate() {
        console.log('Deepfake Detection Extension updated');
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'ping':
                    sendResponse({ success: true });
                    return;

                case 'analyzeMedia': {
                    const result = await this.analyseMedia(message.data || {}, sender);
                    if (result.success === false) {
                        sendResponse({ success: false, error: result.error });
                    } else {
                        sendResponse({ success: true, result });
                    }
                    return;
                }

                case 'analyzeUploadedMedia': {
                    const result = await this.analyseUploadedMedia(message.data || {}, sender);
                    if (result.success === false) {
                        sendResponse({ success: false, error: result.error });
                    } else {
                        sendResponse({ success: true, result });
                    }
                    return;
                }

                case 'reanalyzeStoredMedia': {
                    const result = await this.reanalyseStoredMedia(message.data || {}, sender);
                    if (result.success === false) {
                        sendResponse({ success: false, error: result.error });
                    } else {
                        sendResponse({ success: true, result });
                    }
                    return;
                }

                case 'toggleDetection': {
                    const enabled = Boolean(message.enabled);
                    await chrome.storage.local.set({ detectionEnabled: enabled });
                    sendResponse({ success: true });
                    return;
                }

                case 'updateSensitivity': {
                    const sensitivity = this.normaliseSensitivity(message.sensitivity);
                    await chrome.storage.local.set({ sensitivity });
                    sendResponse({ success: true, sensitivity });
                    return;
                }

                case 'updateDetectionMode': {
                    const mode = message.mode === 'automatic' ? 'automatic' : 'manual';
                    await chrome.storage.local.set({ detectionMode: mode });
                    sendResponse({ success: true, mode });
                    return;
                }

                case 'updateModelType': {
                    const modelKey = await this.setSelectedModel(message.modelKey);
                    sendResponse({
                        success: true,
                        modelKey,
                        modelInfo: this.getSelectedModelInfo()
                    });
                    return;
                }

                case 'openAnalysisPage': {
                    const params = new URLSearchParams({ page: 'media-analysis' });
                    if (message.analysisId !== undefined && message.analysisId !== null && message.analysisId !== '') {
                        params.set('analysisId', String(message.analysisId));
                    }

                    const url = chrome.runtime.getURL(`newtab/newtab.html?${params.toString()}`);
                    await chrome.tabs.create({ url });
                    sendResponse({ success: true, url });
                    return;
                }

                case 'getModelInfo':
                    sendResponse({
                        success: true,
                        modelInfo: await this.getModelInfo(),
                        availableModels: this.getAvailableModels()
                    });
                    return;

                case 'getStatistics':
                    sendResponse({ success: true, statistics: await this.getStatistics() });
                    return;

                case 'exportData':
                    sendResponse({ success: true, data: await this.exportAnalysisData() });
                    return;

                case 'clearData':
                    await this.clearAnalysisData();
                    sendResponse({ success: true });
                    return;

                case 'addDomainToWhitelist':
                    await this.addDomainToWhitelist(message.domain);
                    sendResponse({ success: true });
                    return;

                case 'removeDomainFromWhitelist':
                    await this.removeDomainFromWhitelist(message.domain);
                    sendResponse({ success: true });
                    return;

                case 'getWhitelistedDomains':
                    sendResponse({ success: true, domains: await this.getWhitelistedDomains() });
                    return;

                case 'isDomainWhitelisted':
                    sendResponse({
                        success: true,
                        whitelisted: await this.isDomainWhitelisted(message.domain)
                    });
                    return;

                default:
                    sendResponse({
                        success: false,
                        error: {
                            message: `Unknown action: ${message.action}`,
                            userMessage: 'The extension received an unsupported request.'
                        }
                    });
            }
        } catch (error) {
            console.error('Background service error:', error);
            sendResponse({
                success: false,
                error: {
                    message: error.message || 'Unexpected background error',
                    userMessage: 'The extension hit an internal error. Reload the extension and try again.'
                }
            });
        }
    }

    getDefaultSettings() {
        return {
            detectionEnabled: false,
            sensitivity: 50,
            detectionMode: 'manual',
            modelKey: 'ensemble',
            detailLevel: 10,
            anonymousAnalytics: false
        };
    }

    getAvailableModels() {
        return Object.values(this.modelRegistry).map((model) => ({
            key: model.key,
            name: model.name,
            architecture: model.architecture,
            parameters: model.parameters,
            size: model.size,
            accuracy: model.accuracy
        }));
    }

    normaliseModelKey(value) {
        return Object.prototype.hasOwnProperty.call(this.modelRegistry, value) ? value : 'ensemble';
    }

    getSelectedModelInfo() {
        return this.modelRegistry[this.selectedModelKey] || this.modelRegistry.mesonet;
    }

    async setSelectedModel(value) {
        const modelKey = this.normaliseModelKey(value);
        if (this.selectedModelKey !== modelKey) {
            this.selectedModelKey = modelKey;
            this.modelInfo = this.getSelectedModelInfo();
            await this.resetModelSession();
        }

        await chrome.storage.local.set({
            modelKey,
            settings: {
                autoAnalyze: false,
                confidenceThreshold: 70,
                enableNotifications: true,
                modelVersion: this.modelInfo.version,
                modelKey,
                detectionEnabled: (await chrome.storage.local.get(['detectionEnabled'])).detectionEnabled ?? false,
                sensitivity: this.normaliseSensitivity((await chrome.storage.local.get(['sensitivity'])).sensitivity),
                detectionMode: (await chrome.storage.local.get(['detectionMode'])).detectionMode || 'manual'
            }
        });

        return modelKey;
    }

    async resetModelSession() {
        this.modelSession = null;
        this.modelInitialized = false;
        this.modelSessions.clear();
    }

    getEmptyStatistics() {
        return {
            totalAnalysed: 0,
            highRiskCount: 0,
            lowRiskCount: 0,
            avgProcessingTime: 0
        };
    }

    normaliseSensitivity(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return 50;
        }

        return Math.max(0, Math.min(100, Math.round(parsed)));
    }

    validateServiceContext() {
        return Boolean(
            typeof self !== 'undefined' &&
            typeof chrome !== 'undefined' &&
            chrome.runtime &&
            chrome.storage
        );
    }

    async ensureModelInitialized() {
        const storedModelKey = this.normaliseModelKey((await chrome.storage.local.get(['modelKey'])).modelKey);
        if (this.selectedModelKey !== storedModelKey) {
            this.selectedModelKey = storedModelKey;
            this.modelInfo = this.getSelectedModelInfo();
            await this.resetModelSession();
        }

        if (this.isSelectedModelReady()) {
            return;
        }

        if (!this.validateServiceContext()) {
            throw new Error('Service worker context is unavailable');
        }

        await this.initialiseONNXModel();
    }

    async analyseMedia(mediaData, sender) {
        let imageBitmap;
        let imageDebug = {};

        try {
            const imageUrl = mediaData?.src;
            if (!imageUrl && !mediaData?.imageDataUrl && !mediaData?.imageBytes) {
                throw new Error('No media source was provided for analysis.');
            }

            this.validateMediaRequest(mediaData);

            const sensitivity = mediaData?.sensitivity !== undefined
                ? this.normaliseSensitivity(mediaData.sensitivity)
                : this.normaliseSensitivity((await chrome.storage.local.get(['sensitivity'])).sensitivity);
            const detailLevel = mediaData?.detailLevel !== undefined
                ? this.normaliseSensitivity(mediaData.detailLevel)
                : this.normaliseSensitivity((await chrome.storage.local.get(['detailLevel'])).detailLevel);

            await this.ensureModelInitialized();

            const imageSource = await this.loadImageForAnalysis(mediaData, sender);
            imageBitmap = imageSource.imageBitmap;
            imageDebug = imageSource.debugInfo || {};
            const startedAt = Date.now();
            const result = await this.runDirectInference(imageBitmap, sensitivity, imageDebug);
            const processingTime = Date.now() - startedAt;
            const existingResult = await this.findExistingResultForMedia(mediaData, sender);
            const analysisId = existingResult?.id || crypto.randomUUID();
            const mediaPreviewId = existingResult?.mediaPreviewId || analysisId;
            const previewDataUrl = await this.createDebugPreviewDataUrl(imageBitmap, 480, 320);

            const analysisResult = {
                id: analysisId,
                riskScore: result.riskScore,
                confidence: result.confidence,
                processingTime,
                explanation: this.generateExplanation(result.riskScore, sensitivity, detailLevel, result),
                technicalDetails: {
                    ...result.technicalDetails,
                    detailLevel,
                    inferenceTime: `${processingTime}ms`
                },
                debug: result.debug,
                timestamp: new Date().toISOString()
            };

            await this.saveMediaPreview({
                id: mediaPreviewId,
                previewDataUrl,
                mediaType: mediaData?.type || 'image',
                mediaUrl: mediaData?.src || '',
                pageUrl: sender?.tab?.url || '',
                storedAt: analysisResult.timestamp
            });
            const persistableResult = this.createPersistableResult(analysisResult, mediaData, sender);
            persistableResult.mediaPreviewId = mediaPreviewId;
            const mergedResult = this.mergeWithExistingResult(existingResult, persistableResult);
            await this.persistMergedResult(existingResult, mergedResult);
            return mergedResult;
        } catch (error) {
            console.error('Deepfake Detection: Model analysis failed:', {
                name: error?.name,
                message: error?.message,
                stack: error?.stack,
                mediaType: mediaData?.type,
                mediaUrl: mediaData?.src
            });
            return this.createErrorResult(error);
        } finally {
            if (imageBitmap && typeof imageBitmap.close === 'function') {
                imageBitmap.close();
            }
        }
    }

    async analyseUploadedMedia(mediaData, sender) {
        let imageBitmap;

        try {
            const sensitivity = mediaData?.sensitivity !== undefined
                ? this.normaliseSensitivity(mediaData.sensitivity)
                : this.normaliseSensitivity((await chrome.storage.local.get(['sensitivity'])).sensitivity);
            const detailLevel = mediaData?.detailLevel !== undefined
                ? this.normaliseSensitivity(mediaData.detailLevel)
                : this.normaliseSensitivity((await chrome.storage.local.get(['detailLevel'])).detailLevel);

            await this.ensureModelInitialized();

            imageBitmap = await this.loadUploadedImageBitmap(mediaData);
            const startedAt = Date.now();
            const result = await this.runDirectInference(imageBitmap, sensitivity, {
                strategy: 'uploaded-media',
                filename: mediaData?.filename || '',
                mediaKind: mediaData?.mediaKind || 'image-file'
            });
            const processingTime = Date.now() - startedAt;
            const existingResult = await this.findExistingResultForMedia(mediaData, sender);
            const analysisId = existingResult?.id || crypto.randomUUID();
            const mediaPreviewId = existingResult?.mediaPreviewId || analysisId;
            const previewDataUrl = await this.createDebugPreviewDataUrl(imageBitmap, 480, 320);

            const analysisResult = {
                id: analysisId,
                filename: mediaData?.filename || 'Uploaded media',
                size: Number(mediaData?.size) || 0,
                type: mediaData?.originalType || mediaData?.mimeType || 'image/*',
                source: mediaData?.originalType?.startsWith('video/') ? 'Uploaded video' : 'Uploaded image',
                sourceType: 'upload',
                riskScore: result.riskScore,
                confidence: result.confidence,
                processingTime,
                explanation: this.generateExplanation(result.riskScore, sensitivity, detailLevel, result),
                technicalDetails: {
                    ...result.technicalDetails,
                    detailLevel,
                    inferenceTime: `${processingTime}ms`
                },
                debug: result.debug,
                timestamp: new Date().toISOString()
            };

            await this.saveMediaPreview({
                id: mediaPreviewId,
                previewDataUrl,
                mediaType: mediaData?.originalType?.startsWith('video/') ? 'video' : 'image',
                fileName: mediaData?.filename || 'Uploaded media',
                storedAt: analysisResult.timestamp
            });

            const persistableResult = this.createPersistableResult(analysisResult, mediaData, sender);
            persistableResult.mediaPreviewId = mediaPreviewId;
            const mergedResult = this.mergeWithExistingResult(existingResult, persistableResult);
            await this.persistMergedResult(existingResult, mergedResult);
            return mergedResult;
        } catch (error) {
            console.error('Deepfake Detection: Uploaded media analysis failed:', {
                name: error?.name,
                message: error?.message,
                filename: mediaData?.filename,
                mediaKind: mediaData?.mediaKind
            });
            return this.createErrorResult(error);
        } finally {
            if (imageBitmap && typeof imageBitmap.close === 'function') {
                imageBitmap.close();
            }
        }
    }

    async reanalyseStoredMedia(mediaData, sender) {
        let imageBitmap;

        try {
            const existingResult = mediaData?.existingResult;
            if (!existingResult?.id) {
                throw new Error('No stored analysis result was provided for re-analysis.');
            }

            const sensitivity = mediaData?.sensitivity !== undefined
                ? this.normaliseSensitivity(mediaData.sensitivity)
                : this.normaliseSensitivity((await chrome.storage.local.get(['sensitivity'])).sensitivity);
            const detailLevel = mediaData?.detailLevel !== undefined
                ? this.normaliseSensitivity(mediaData.detailLevel)
                : this.normaliseSensitivity((await chrome.storage.local.get(['detailLevel'])).detailLevel);

            await this.ensureModelInitialized();

            if (existingResult.sourceType === 'upload') {
                const previewDataUrl = mediaData?.uploadPreviewDataUrl
                    || (await this.getMediaPreview(existingResult.mediaPreviewId || existingResult.id))?.previewDataUrl;

                if (!previewDataUrl) {
                    throw new Error('No stored preview is available for this uploaded media.');
                }

                imageBitmap = await this.loadUploadedImageBitmap({
                    imageDataUrl: previewDataUrl,
                    originalType: existingResult.originalType || existingResult.type,
                    mimeType: mediaData?.uploadPreviewMimeType || 'image/png'
                });
            } else {
                const mediaUrl = existingResult.mediaUrl || existingResult.debug?.capture?.mediaUrl;
                if (mediaUrl) {
                    imageBitmap = await this.loadImageBitmapFromUrl(mediaUrl);
                } else {
                    const previewRecord = await this.getMediaPreview(existingResult.mediaPreviewId || existingResult.id);
                    if (!previewRecord?.previewDataUrl) {
                        throw new Error('No media URL is available for this stored website analysis.');
                    }

                    imageBitmap = await this.loadUploadedImageBitmap({
                        imageDataUrl: previewRecord.previewDataUrl,
                        originalType: existingResult.originalType || existingResult.type,
                        mimeType: 'image/png'
                    });
                }
            }

            const startedAt = Date.now();
            const result = await this.runDirectInference(imageBitmap, sensitivity, {
                strategy: existingResult.sourceType === 'upload' ? 'reanalyse-uploaded-preview' : 'reanalyse-web-media',
                filename: existingResult.filename || '',
                mediaUrl: existingResult.mediaUrl || existingResult.debug?.capture?.mediaUrl || ''
            });
            const processingTime = Date.now() - startedAt;
            const previewDataUrl = await this.createDebugPreviewDataUrl(imageBitmap, 480, 320);
            const timestamp = new Date().toISOString();

            if (previewDataUrl) {
                await this.saveMediaPreview({
                    id: existingResult.mediaPreviewId || existingResult.id,
                    previewDataUrl,
                    mediaType: existingResult.originalType?.startsWith('video/') ? 'video' : 'image',
                    mediaUrl: existingResult.mediaUrl || '',
                    pageUrl: existingResult.pageUrl || '',
                    fileName: existingResult.filename || '',
                    storedAt: timestamp
                });
            }

            const updatedResult = {
                ...existingResult,
                riskScore: result.riskScore,
                confidence: result.confidence,
                processingTime,
                explanation: this.generateExplanation(result.riskScore, sensitivity, detailLevel, result),
                technicalDetails: {
                    ...result.technicalDetails,
                    detailLevel,
                    inferenceTime: `${processingTime}ms`
                },
                debug: this.createPersistableResult({ debug: result.debug }, {}, {}).debug,
                analysisRuns: [
                    ...this.getAnalysisRuns(existingResult),
                    this.createAnalysisRun({
                        timestamp,
                        riskScore: result.riskScore,
                        confidence: result.confidence,
                        processingTime,
                        technicalDetails: result.technicalDetails
                    })
                ],
                timestamp
            };

            await this.updateAnalysisResult(updatedResult.id, updatedResult);
            return updatedResult;
        } catch (error) {
            console.error('Deepfake Detection: Re-analysis failed:', {
                name: error?.name,
                message: error?.message,
                analysisId: mediaData?.existingResult?.id
            });
            return this.createErrorResult(error);
        } finally {
            if (imageBitmap && typeof imageBitmap.close === 'function') {
                imageBitmap.close();
            }
        }
    }

    validateMediaRequest(mediaData) {
        const mediaType = mediaData?.type || 'image';

        if (mediaType === 'video' && !mediaData?.imageDataUrl && !mediaData?.imageBytes) {
            throw new Error('Direct video analysis is not supported yet. Use a video poster image instead.');
        }
    }

    async loadImageForAnalysis(mediaData, sender) {
        if (mediaData?.imageDataUrl || mediaData?.imageBytes) {
            const imageBitmap = await this.loadUploadedImageBitmap(mediaData);
            return {
                imageBitmap,
                debugInfo: {
                    strategy: mediaData?.snapshotSource || 'captured-image',
                    mediaUrl: mediaData?.src || '',
                    requestedBounds: mediaData?.captureBounds || null
                }
            };
        }

        if (this.shouldPreferCapturedImage(mediaData)) {
            return this.captureElementImageBitmap(sender, mediaData.captureBounds);
        }

        try {
            const imageBitmap = await this.loadImageBitmapFromUrl(mediaData.src);
            return {
                imageBitmap,
                debugInfo: {
                    strategy: 'direct-fetch',
                    mediaUrl: mediaData.src,
                    requestedBounds: mediaData.captureBounds || null
                }
            };
        } catch (error) {
            if (this.shouldFallbackToCapturedImage(mediaData, error)) {
                console.warn('Deepfake Detection: Falling back to tab capture for media analysis.', {
                    message: error?.message,
                    mediaUrl: mediaData?.src
                });
                return this.captureElementImageBitmap(sender, mediaData.captureBounds);
            }

            throw error;
        }
    }

    shouldPreferCapturedImage(mediaData) {
        return false;
    }

    shouldFallbackToCapturedImage(mediaData, error) {
        if (!mediaData?.captureBounds) {
            return false;
        }

        const message = error?.message || '';
        if (/activeTab|captureVisibleTab|permission is required/i.test(message)) {
            return false;
        }

        return (
            /fetch|network|http|content security policy|unsupported media type|decode/i.test(message) ||
            this.shouldPreferCapturedImage(mediaData)
        );
    }

    getHostname(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return '';
        }
    }

    async captureElementImageBitmap(sender, captureBounds) {
        if (!sender?.tab?.windowId) {
            throw new Error('Cannot capture the current tab for analysis.');
        }

        if (!captureBounds) {
            throw new Error('No capture bounds were provided for the selected media.');
        }

        const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const screenshotBitmap = await createImageBitmap(blob);

        try {
            const crop = this.normaliseCaptureBounds(captureBounds, screenshotBitmap.width, screenshotBitmap.height);
            const imageBitmap = await createImageBitmap(
                screenshotBitmap,
                crop.x,
                crop.y,
                crop.width,
                crop.height
            );
            return {
                imageBitmap,
                debugInfo: {
                    strategy: 'visible-tab-crop',
                    screenshotDimensions: {
                        width: screenshotBitmap.width,
                        height: screenshotBitmap.height
                    },
                    requestedBounds: this.sanitizeBounds(captureBounds),
                    normalisedBounds: crop
                }
            };
        } finally {
            if (typeof screenshotBitmap.close === 'function') {
                screenshotBitmap.close();
            }
        }
    }

    normaliseCaptureBounds(captureBounds, screenshotWidth, screenshotHeight) {
        const scale = Math.max(1, Number(captureBounds.devicePixelRatio) || 1);
        const x = Math.max(0, Math.floor((captureBounds.x || 0) * scale));
        const y = Math.max(0, Math.floor((captureBounds.y || 0) * scale));
        const maxWidth = Math.max(1, screenshotWidth - x);
        const maxHeight = Math.max(1, screenshotHeight - y);
        const width = Math.max(1, Math.min(Math.floor((captureBounds.width || 1) * scale), maxWidth));
        const height = Math.max(1, Math.min(Math.floor((captureBounds.height || 1) * scale), maxHeight));

        return { x, y, width, height };
    }

    sanitizeBounds(bounds) {
        if (!bounds) {
            return null;
        }

        return {
            x: Number(bounds.x ?? 0),
            y: Number(bounds.y ?? 0),
            width: Number(bounds.width ?? 0),
            height: Number(bounds.height ?? 0),
            devicePixelRatio: Number(bounds.devicePixelRatio ?? 1)
        };
    }

    async loadONNXRuntime() {
        if (this.ort) {
            return;
        }

        if (!ort) {
            throw new Error('ONNX Runtime did not attach to the service worker context.');
        }

        this.ort = ort;
    }

    async initialiseONNXModel() {
        await this.loadONNXRuntime();

        this.ort.env.wasm.wasmPaths = {
            'ort-wasm-simd-threaded.wasm': chrome.runtime.getURL('dist/ort-wasm-simd-threaded.wasm')
        };
        this.ort.env.wasm.numThreads = 1;
        this.ort.env.wasm.simd = false;
        this.ort.env.wasm.proxy = false;

        const requiredModelKeys = this.getRequiredModelKeysForSelection();
        await Promise.all(requiredModelKeys.map((modelKey) => this.ensureModelSession(modelKey)));

        this.modelSession = this.modelSessions.get(requiredModelKeys[0]) || null;
        this.modelInitialized = this.isSelectedModelReady();
    }

    getRequiredModelKeysForSelection() {
        if (this.selectedModelKey === 'ensemble') {
            return this.ensembleModelKeys.filter((modelKey) => this.modelRegistry[modelKey]?.modelPath);
        }

        return [this.selectedModelKey];
    }

    isSelectedModelReady() {
        const requiredModelKeys = this.getRequiredModelKeysForSelection();
        if (!requiredModelKeys.length) {
            return false;
        }

        return requiredModelKeys.every((modelKey) => this.modelSessions.has(modelKey));
    }

    async ensureModelSession(modelKey) {
        if (this.modelSessions.has(modelKey)) {
            return this.modelSessions.get(modelKey);
        }

        const modelConfig = this.modelRegistry[modelKey];
        if (!modelConfig?.modelPath) {
            throw new Error(`Model "${modelKey}" is missing a runtime path.`);
        }

        const modelBytes = await this.fetchModelBytes(modelConfig.modelPath);
        const sessionOptions = {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'basic'
        };
        const externalData = await this.tryLoadExternalData(modelConfig.externalDataPath);
        if (externalData) {
            sessionOptions.externalData = [
                {
                    path: modelConfig.externalDataPath.split('/').pop(),
                    data: externalData
                }
            ];
        }

        const session = await this.ort.InferenceSession.create(modelBytes, sessionOptions);
        this.modelSessions.set(modelKey, session);
        return session;
    }

    async fetchModelBytes(modelPath) {
        const response = await fetch(chrome.runtime.getURL(modelPath));
        if (!response.ok) {
            throw new Error(`Selected model is unavailable: ${modelPath} (HTTP ${response.status})`);
        }

        return new Uint8Array(await response.arrayBuffer());
    }

    async tryLoadExternalData(dataPath) {
        if (!dataPath) {
            return null;
        }

        const response = await fetch(chrome.runtime.getURL(dataPath));
        if (!response.ok) {
            return null;
        }

        return new Uint8Array(await response.arrayBuffer());
    }

    async loadImageBitmapFromUrl(imageUrl) {
        let response;

        try {
            response = await fetch(imageUrl, { cache: 'no-store' });
        } catch (error) {
            throw new Error(`Failed to fetch image: ${error.message}`);
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch image: HTTP ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) {
            throw new Error(`Unsupported media type returned by source: ${contentType || 'unknown'}`);
        }

        const blob = await response.blob();

        try {
            return await createImageBitmap(blob);
        } catch (error) {
            throw new Error(
                `Failed to decode image data${error?.message ? `: ${error.message}` : '.'}`
            );
        }
    }

    async loadUploadedImageBitmap(mediaData) {
        let firstDecodeError = null;

        if (mediaData?.imageBytes) {
            try {
                const buffer = this.normaliseBinaryPayload(mediaData.imageBytes);
                const blob = new Blob([buffer], { type: mediaData?.mimeType || 'image/png' });
                return await this.decodeImageBlob(blob);
            } catch (error) {
                firstDecodeError = error;
                console.warn('Deepfake Detection: Uploaded byte payload failed to decode, falling back to data URL when available.', {
                    name: error?.name,
                    message: error?.message,
                    filename: mediaData?.filename
                });
            }
        }

        if (mediaData?.imageDataUrl) {
            try {
                const blob = this.dataUrlToBlob(mediaData.imageDataUrl);
                return await this.decodeImageBlob(blob);
            } catch (error) {
                if (firstDecodeError) {
                    throw new Error(
                        `Unable to decode uploaded image from both byte payload and data URL. ` +
                        `Bytes error: ${firstDecodeError.message}. Data URL error: ${error.message}.`
                    );
                }

                throw error;
            }
        }

        if (firstDecodeError) {
            throw firstDecodeError;
        }

        throw new Error('No uploaded image payload was provided for analysis.');
    }

    dataUrlToBlob(dataUrl) {
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
            throw new Error('Invalid data URL payload.');
        }

        const commaIndex = dataUrl.indexOf(',');
        if (commaIndex === -1) {
            throw new Error('Malformed data URL payload.');
        }

        const header = dataUrl.slice(5, commaIndex);
        const body = dataUrl.slice(commaIndex + 1);
        const isBase64 = /;base64/i.test(header);
        const mimeType = (header.split(';')[0] || 'application/octet-stream').trim() || 'application/octet-stream';

        if (isBase64) {
            const binary = atob(body);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) {
                bytes[index] = binary.charCodeAt(index);
            }
            return new Blob([bytes], { type: mimeType });
        }

        const decoded = decodeURIComponent(body);
        return new Blob([decoded], { type: mimeType });
    }

    normaliseBinaryPayload(payload) {
        if (payload instanceof ArrayBuffer) {
            return payload;
        }

        if (ArrayBuffer.isView(payload)) {
            const view = payload;
            if (view.byteOffset === 0 && view.byteLength === view.buffer.byteLength) {
                return view.buffer;
            }

            return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
        }

        if (Array.isArray(payload)) {
            return Uint8Array.from(payload).buffer;
        }

        if (payload && typeof payload === 'object') {
            if (payload.type === 'Buffer' && Array.isArray(payload.data)) {
                return Uint8Array.from(payload.data).buffer;
            }

            if (Array.isArray(payload.data)) {
                return Uint8Array.from(payload.data).buffer;
            }

            if (typeof payload.base64 === 'string') {
                const binary = atob(payload.base64);
                const bytes = new Uint8Array(binary.length);
                for (let index = 0; index < binary.length; index += 1) {
                    bytes[index] = binary.charCodeAt(index);
                }
                return bytes.buffer;
            }

            if (typeof payload.byteLength === 'number' && Number.isFinite(payload.byteLength)) {
                const byteLength = Math.max(0, Math.floor(payload.byteLength));
                const bytes = new Uint8Array(byteLength);
                let hasNumericData = false;

                for (let index = 0; index < byteLength; index += 1) {
                    const value = payload[index];
                    if (typeof value === 'number' && Number.isFinite(value)) {
                        bytes[index] = value & 0xff;
                        hasNumericData = true;
                    }
                }

                if (hasNumericData) {
                    return bytes.buffer;
                }
            }

            if (typeof payload.length === 'number' && Number.isFinite(payload.length)) {
                const length = Math.max(0, Math.floor(payload.length));
                const bytes = new Uint8Array(length);
                let hasNumericData = false;

                for (let index = 0; index < length; index += 1) {
                    const value = payload[index];
                    if (typeof value === 'number' && Number.isFinite(value)) {
                        bytes[index] = value & 0xff;
                        hasNumericData = true;
                    }
                }

                if (hasNumericData) {
                    return bytes.buffer;
                }
            }
        }

        throw new Error('Unsupported uploaded binary payload format.');
    }

    async decodeImageBlob(blob) {
        try {
            return await createImageBitmap(blob);
        } catch (error) {
            if (typeof ImageDecoder === 'undefined') {
                throw error;
            }

            const buffer = await blob.arrayBuffer();
            const decoder = new ImageDecoder({
                data: buffer,
                type: blob.type || 'image/png'
            });

            let frame;
            try {
                const { image } = await decoder.decode({ frameIndex: 0 });
                frame = image;
                const canvas = new OffscreenCanvas(frame.displayWidth || frame.codedWidth, frame.displayHeight || frame.codedHeight);
                const context = canvas.getContext('2d');
                if (!context) {
                    throw error;
                }

                context.drawImage(frame, 0, 0);
                return canvas.transferToImageBitmap();
            } finally {
                frame?.close?.();
                decoder.close?.();
            }
        }
    }

    async runDirectInference(imageBitmap, sensitivity, imageDebug = {}) {
        const preprocessing = await this.preprocessImage(imageBitmap);
        const inputTensor = preprocessing.inputTensor;
        const inferenceSummary = await this.runSelectedInference(inputTensor);
        const rawOutput = inferenceSummary.rawOutput;
        const calibratedOutput = inferenceSummary.calibratedOutput;
        const threshold = this.calculateSensitivityThreshold(sensitivity);
        const confidence = this.calculateConfidence(calibratedOutput, threshold);
        const riskScore = this.applySensitivityToModelOutput(calibratedOutput, sensitivity);
        const margin = calibratedOutput - threshold;

        console.log('Deepfake Detection: Inference summary', {
            rawOutput: rawOutput.toFixed(6),
            calibratedOutput: calibratedOutput.toFixed(6),
            threshold: threshold.toFixed(6),
            margin: margin.toFixed(6),
            riskScore: riskScore.toFixed(2),
            confidence: confidence.toFixed(2),
            outputName: inferenceSummary.outputName,
            tensorShape: inputTensor.dims,
            inputSize: preprocessing.debug?.sourceDimensions,
            strategy: imageDebug.strategy || 'unknown',
            modelKey: this.selectedModelKey
        });

        return {
            riskScore,
            confidence,
            rawOutput,
            calibratedOutput,
            threshold,
            technicalDetails: {
                model: this.getActiveModelLabel(),
                parameters: this.modelInfo.parameters.toLocaleString(),
                sensitivity,
                threshold: threshold.toFixed(3),
                rawOutput: rawOutput.toFixed(6),
                calibratedOutput: calibratedOutput.toFixed(6),
                margin: margin.toFixed(6),
                outputName: inferenceSummary.outputName,
                confidenceBasis: 'distance-from-threshold-calibrated',
                captureStrategy: imageDebug.strategy || 'unknown',
                sourceDimensions: preprocessing.debug?.sourceDimensions || null,
                resizedDimensions: preprocessing.debug?.resizedDimensions || null,
                modelKey: this.selectedModelKey,
                ensembleComponents: inferenceSummary.components,
                calibration: inferenceSummary.calibration
            },
            debug: {
                capture: imageDebug,
                preprocess: preprocessing.debug
            }
        };
    }

    async runSelectedInference(inputTensor) {
        if (this.selectedModelKey !== 'ensemble') {
            const singleResult = await this.runSingleModelInference(this.selectedModelKey, inputTensor);
            return {
                rawOutput: singleResult.rawOutput,
                calibratedOutput: singleResult.calibratedOutput,
                outputName: singleResult.outputName,
                components: [singleResult.component],
                calibration: singleResult.calibration
            };
        }

        const modelKeys = this.getRequiredModelKeysForSelection();
        const weights = this.getNormalisedEnsembleWeights(modelKeys);
        const componentResults = await Promise.all(
            modelKeys.map((modelKey) => this.runSingleModelInference(modelKey, inputTensor))
        );

        const weightedRaw = componentResults.reduce(
            (sum, result) => sum + (result.rawOutput * (weights[result.modelKey] || 0)),
            0
        );
        const weightedCalibrated = componentResults.reduce(
            (sum, result) => sum + (result.calibratedOutput * (weights[result.modelKey] || 0)),
            0
        );

        const calibration = this.applyCalibration(weightedCalibrated, 'ensemble');
        return {
            rawOutput: this.clampProbability(weightedRaw),
            calibratedOutput: calibration.calibratedOutput,
            outputName: 'ensemble:weighted',
            components: componentResults.map((result) => ({
                ...result.component,
                weight: weights[result.modelKey] || 0
            })),
            calibration: calibration.details
        };
    }

    async runSingleModelInference(modelKey, inputTensor) {
        const session = this.modelSessions.get(modelKey);
        if (!session) {
            throw new Error(`Model session not initialised for "${modelKey}".`);
        }

        const results = await session.run({ input: inputTensor });
        const outputName = Object.keys(results)[0];
        if (!outputName || !results[outputName]?.data?.length) {
            throw new Error(`Model "${modelKey}" returned an empty output tensor.`);
        }

        const rawOutput = this.clampProbability(Number(results[outputName].data[0]));
        const calibration = this.applyCalibration(rawOutput, modelKey);
        const modelConfig = this.modelRegistry[modelKey];
        return {
            modelKey,
            outputName,
            rawOutput,
            calibratedOutput: calibration.calibratedOutput,
            calibration: calibration.details,
            component: {
                modelKey,
                model: `${modelConfig?.name || modelKey} v${modelConfig?.version || 'unknown'}`,
                rawOutput: Number(rawOutput.toFixed(6)),
                calibratedOutput: Number(calibration.calibratedOutput.toFixed(6))
            }
        };
    }

    getNormalisedEnsembleWeights(modelKeys) {
        const normalisedWeights = {};
        let totalWeight = 0;

        modelKeys.forEach((modelKey) => {
            const weight = Math.max(0, Number(this.ensembleWeights[modelKey]) || 0);
            normalisedWeights[modelKey] = weight;
            totalWeight += weight;
        });

        if (totalWeight <= 0) {
            const equalWeight = 1 / Math.max(1, modelKeys.length);
            modelKeys.forEach((modelKey) => {
                normalisedWeights[modelKey] = equalWeight;
            });
            return normalisedWeights;
        }

        modelKeys.forEach((modelKey) => {
            normalisedWeights[modelKey] = normalisedWeights[modelKey] / totalWeight;
        });

        return normalisedWeights;
    }

    getActiveModelLabel() {
        if (this.selectedModelKey === 'ensemble') {
            const members = this.getRequiredModelKeysForSelection()
                .map((modelKey) => this.modelRegistry[modelKey]?.name || modelKey)
                .join(' + ');
            return `Ensemble (${members}) v${this.modelInfo.version}`;
        }

        return `${this.modelInfo.name} v${this.modelInfo.version}`;
    }

    clampProbability(value) {
        if (!Number.isFinite(value)) {
            return 0;
        }

        return Math.max(0, Math.min(1, value));
    }

    applyCalibration(rawOutput, modelKey) {
        const profile = this.calibrationProfiles[modelKey] || { type: 'logit', scale: 1, bias: 0 };
        const clampedRaw = this.clampProbability(rawOutput);
        let calibratedOutput = clampedRaw;

        if (profile.type === 'linear') {
            calibratedOutput = this.clampProbability((clampedRaw * (profile.scale ?? 1)) + (profile.bias ?? 0));
        } else {
            const epsilon = 1e-6;
            const safeRaw = Math.max(epsilon, Math.min(1 - epsilon, clampedRaw));
            const logit = Math.log(safeRaw / (1 - safeRaw));
            const adjusted = (logit * (profile.scale ?? 1)) + (profile.bias ?? 0);
            calibratedOutput = 1 / (1 + Math.exp(-adjusted));
        }

        return {
            calibratedOutput: this.clampProbability(calibratedOutput),
            details: {
                modelKey,
                type: profile.type || 'logit',
                scale: Number(profile.scale ?? 1),
                bias: Number(profile.bias ?? 0)
            }
        };
    }

    async preprocessImage(imageBitmap) {
        const targetSize = 128;
        const canvas = new OffscreenCanvas(targetSize, targetSize);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Unable to create an OffscreenCanvas rendering context.');
        }

        const fit = this.calculateContainFit(imageBitmap.width, imageBitmap.height, targetSize, targetSize);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, targetSize, targetSize);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(imageBitmap, fit.x, fit.y, fit.width, fit.height);

        const pixels = ctx.getImageData(0, 0, targetSize, targetSize).data;
        const input = new Float32Array(3 * targetSize * targetSize);

        for (let c = 0; c < 3; c += 1) {
            for (let h = 0; h < targetSize; h += 1) {
                for (let w = 0; w < targetSize; w += 1) {
                    const pixelIndex = (h * targetSize + w) * 4;
                    const tensorIndex = c * targetSize * targetSize + h * targetSize + w;
                    input[tensorIndex] = pixels[pixelIndex + c] / 255;
                }
            }
        }

        return {
            inputTensor: new this.ort.Tensor('float32', input, [1, 3, targetSize, targetSize]),
            debug: {
                sourceDimensions: {
                    width: imageBitmap.width,
                    height: imageBitmap.height
                },
                resizedDimensions: {
                    width: targetSize,
                    height: targetSize
                },
                fit,
                channelMeans: this.calculateChannelMeans(input),
                preview: {
                    original: await this.createDebugPreviewDataUrl(imageBitmap, 240, 240),
                    resized: await this.createCanvasPreviewDataUrl(canvas)
                }
            }
        };
    }

    calculateContainFit(sourceWidth, sourceHeight, targetWidth, targetHeight) {
        const safeSourceWidth = Math.max(1, sourceWidth);
        const safeSourceHeight = Math.max(1, sourceHeight);
        const scale = Math.min(targetWidth / safeSourceWidth, targetHeight / safeSourceHeight);
        const width = Math.max(1, Math.round(safeSourceWidth * scale));
        const height = Math.max(1, Math.round(safeSourceHeight * scale));
        const x = Math.floor((targetWidth - width) / 2);
        const y = Math.floor((targetHeight - height) / 2);

        return {
            mode: 'contain-pad',
            scale: Number(scale.toFixed(6)),
            x,
            y,
            width,
            height,
            padding: {
                left: x,
                top: y,
                right: Math.max(0, targetWidth - x - width),
                bottom: Math.max(0, targetHeight - y - height)
            }
        };
    }

    calculateChannelMeans(input) {
        const planeSize = 128 * 128;
        const channels = ['r', 'g', 'b'];
        const result = {};

        channels.forEach((channel, index) => {
            let sum = 0;
            const offset = index * planeSize;
            for (let i = 0; i < planeSize; i += 1) {
                sum += input[offset + i];
            }
            result[channel] = Number((sum / planeSize).toFixed(6));
        });

        return result;
    }

    async createDebugPreviewDataUrl(imageBitmap, maxWidth, maxHeight) {
        const scale = Math.min(
            1,
            maxWidth / Math.max(1, imageBitmap.width),
            maxHeight / Math.max(1, imageBitmap.height)
        );
        const width = Math.max(1, Math.round(imageBitmap.width * scale));
        const height = Math.max(1, Math.round(imageBitmap.height * scale));
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            return null;
        }

        ctx.drawImage(imageBitmap, 0, 0, width, height);
        return this.createCanvasPreviewDataUrl(canvas);
    }

    async createCanvasPreviewDataUrl(canvas) {
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        const buffer = await blob.arrayBuffer();
        return `data:image/png;base64,${this.arrayBufferToBase64(buffer)}`;
    }

    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const chunkSize = 0x8000;

        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode(...chunk);
        }

        return btoa(binary);
    }

    createPersistableResult(result, mediaData = {}, sender = {}) {
        if (!result?.debug) {
            return {
                ...result,
                ...this.buildSourceMetadata(mediaData, sender),
                mediaPreviewId: result?.id || null,
                analysisRuns: Array.isArray(result?.analysisRuns) && result.analysisRuns.length
                    ? result.analysisRuns
                    : [this.createAnalysisRun(result)]
            };
        }

        return {
            ...result,
            ...this.buildSourceMetadata(mediaData, sender),
            mediaPreviewId: result?.id || null,
            analysisRuns: Array.isArray(result?.analysisRuns) && result.analysisRuns.length
                ? result.analysisRuns
                : [this.createAnalysisRun(result)],
            debug: {
                capture: result.debug.capture || null,
                preprocess: result.debug.preprocess
                    ? {
                        ...result.debug.preprocess,
                        preview: undefined
                    }
                    : null
            }
        };
    }

    createAnalysisRun(result = {}) {
        return {
            timestamp: result.timestamp || new Date().toISOString(),
            riskScore: Number(result.riskScore) || 0,
            confidence: Number(result.confidence) || 0,
            model: result.technicalDetails?.model || 'Unknown model',
            processingTime: Number(result.processingTime) || 0
        };
    }

    getAnalysisRuns(result = {}) {
        if (Array.isArray(result.analysisRuns) && result.analysisRuns.length > 0) {
            return result.analysisRuns;
        }

        return [this.createAnalysisRun(result)];
    }

    normaliseComparableUrl(value) {
        if (!value) {
            return '';
        }

        try {
            const url = new URL(value);
            url.hash = '';
            return url.toString();
        } catch {
            return String(value).trim();
        }
    }

    async findExistingResultForMedia(mediaData = {}, sender = {}) {
        const data = await chrome.storage.local.get(['analysisHistory']);
        const history = Array.isArray(data.analysisHistory) ? data.analysisHistory : [];
        if (!history.length) {
            return null;
        }

        const incomingSourceType = mediaData?.sourceType || (/^https?:/i.test(mediaData?.src || '') ? 'web' : 'unknown');
        const incomingMediaUrl = this.normaliseComparableUrl(mediaData?.src || '');
        const incomingPageUrl = this.normaliseComparableUrl(sender?.tab?.url || '');
        const incomingFilename = mediaData?.filename || '';
        const incomingSize = Number(mediaData?.size) || 0;
        const incomingType = mediaData?.originalType || mediaData?.mimeType || '';

        return history.find((entry) => {
            if (!entry || (entry.sourceType || 'unknown') !== incomingSourceType) {
                return false;
            }

            if (incomingSourceType === 'upload' || incomingFilename) {
                if (!incomingFilename || !entry.filename || entry.filename !== incomingFilename) {
                    return false;
                }

                const entrySize = Number(entry.size) || 0;
                if (incomingSize && entrySize && incomingSize !== entrySize) {
                    return false;
                }

                if (incomingType && entry.originalType && incomingType !== entry.originalType) {
                    return false;
                }

                return true;
            }

            const entryMediaUrl = this.normaliseComparableUrl(entry.mediaUrl || entry.debug?.capture?.mediaUrl || '');
            return Boolean(incomingMediaUrl && entryMediaUrl && incomingMediaUrl === entryMediaUrl);
        }) || null;
    }

    mergeWithExistingResult(existingResult, nextResult) {
        if (!existingResult) {
            return nextResult;
        }

        return {
            ...existingResult,
            ...nextResult,
            id: existingResult.id,
            mediaPreviewId: existingResult.mediaPreviewId || nextResult.mediaPreviewId || existingResult.id,
            analysisRuns: [
                ...this.getAnalysisRuns(existingResult),
                this.createAnalysisRun(nextResult)
            ]
        };
    }

    async persistMergedResult(existingResult, mergedResult) {
        if (existingResult?.id) {
            await this.updateAnalysisResult(existingResult.id, mergedResult);
            return;
        }

        await this.saveAnalysisResult(mergedResult);
    }

    buildSourceMetadata(mediaData = {}, sender = {}) {
        const mediaUrl = mediaData?.src || '';
        const pageUrl = sender?.tab?.url || '';
        const pageTitle = sender?.tab?.title || '';
        const sourceType = mediaData?.sourceType || (/^https?:/i.test(mediaUrl) ? 'web' : 'unknown');

        return {
            sourceType,
            mediaUrl,
            mediaHostname: this.getHostname(mediaUrl),
            pageUrl,
            pageHostname: this.getHostname(pageUrl),
            pageTitle,
            filename: mediaData?.filename || undefined,
            originalType: mediaData?.originalType || undefined
        };
    }

    async openMediaStore() {
        if (this.mediaDbPromise) {
            return this.mediaDbPromise;
        }

        this.mediaDbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(BackgroundService.MEDIA_DB_NAME, 1);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(BackgroundService.MEDIA_STORE_NAME)) {
                    db.createObjectStore(BackgroundService.MEDIA_STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        return this.mediaDbPromise;
    }

    async saveMediaPreview(record) {
        if (!record?.id || !record.previewDataUrl) {
            return;
        }

        try {
            const db = await this.openMediaStore();
            await new Promise((resolve, reject) => {
                const transaction = db.transaction(BackgroundService.MEDIA_STORE_NAME, 'readwrite');
                const store = transaction.objectStore(BackgroundService.MEDIA_STORE_NAME);
                store.put(record);
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
                transaction.onabort = () => reject(transaction.error);
            });
        } catch (error) {
            console.warn('Deepfake Detection: Failed to store media preview in IndexedDB.', error);
        }
    }

    async getMediaPreview(id) {
        if (!id) {
            return null;
        }

        const db = await this.openMediaStore();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(BackgroundService.MEDIA_STORE_NAME, 'readonly');
            const store = transaction.objectStore(BackgroundService.MEDIA_STORE_NAME);
            const request = store.get(String(id));
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    createErrorResult(error) {
        const message = error?.message || 'Unexpected analysis failure';
        let type = 'unknown_error';
        let userMessage = 'Analysis failed. Please try again with another image.';

        if (/fetch|network|http/i.test(message)) {
            type = 'network_error';
            userMessage = 'The extension could not download this media for analysis.';
        } else if (/video analysis is not supported/i.test(message)) {
            type = 'unsupported_media_type';
            userMessage = 'Video files are not supported yet. Try analyzing a thumbnail, poster frame, or image instead.';
        } else if (/unsupported media type/i.test(message)) {
            type = 'unsupported_media_type';
            userMessage = 'This media source did not return an image that the extension can analyze.';
        } else if (/wasm|onnx|model|runtime/i.test(message)) {
            type = 'model_load_failed';
            userMessage = 'The AI model could not be loaded. Reload the extension and try again.';
        } else if (/canvas|image|bitmap|decode/i.test(message)) {
            type = 'image_load_failed';
            userMessage = 'This media could not be decoded for analysis.';
        }

        return {
            success: false,
            error: {
                type,
                message,
                userMessage,
                timestamp: new Date().toISOString()
            }
        };
    }

    async notifyAllTabs(message) {
        const tabs = await chrome.tabs.query({});

        await Promise.allSettled(
            tabs
                .filter((tab) => Number.isInteger(tab.id))
                .map(async (tab) => {
                    try {
                        await chrome.tabs.sendMessage(tab.id, message);
                    } catch (error) {
                        console.debug(`No content script response for tab ${tab.id}:`, error);
                    }
                })
        );
    }

    async getModelInfo() {
        return {
            ...this.getSelectedModelInfo(),
            modelKey: this.selectedModelKey,
            requiredModelKeys: this.getRequiredModelKeysForSelection(),
            ensembleWeights: this.selectedModelKey === 'ensemble'
                ? this.getNormalisedEnsembleWeights(this.getRequiredModelKeysForSelection())
                : null,
            calibrationProfile: this.calibrationProfiles[this.selectedModelKey] || null
        };
    }

    async getStatistics() {
        const result = await chrome.storage.local.get(['statistics']);
        return result.statistics || this.getEmptyStatistics();
    }

    async saveAnalysisResult(result) {
        const data = await chrome.storage.local.get(['analysisHistory', 'statistics']);
        const history = Array.isArray(data.analysisHistory) ? data.analysisHistory : [];
        const updatedHistory = [...history, result];
        const statistics = this.buildStatistics(updatedHistory);

        await chrome.storage.local.set({
            analysisHistory: updatedHistory,
            statistics
        });
    }

    async updateAnalysisResult(resultId, updatedResult) {
        const data = await chrome.storage.local.get(['analysisHistory', 'statistics']);
        const history = Array.isArray(data.analysisHistory) ? data.analysisHistory : [];
        const updatedHistory = history.map((entry) =>
            String(entry.id) === String(resultId) ? updatedResult : entry
        );
        const statistics = this.buildStatistics(updatedHistory);

        await chrome.storage.local.set({
            analysisHistory: updatedHistory,
            statistics
        });
    }

    buildStatistics(history) {
        const successfulResults = history.filter((entry) => Number.isFinite(entry.riskScore));
        const totalProcessingTime = successfulResults.reduce(
            (sum, entry) => sum + (Number(entry.processingTime) || 0),
            0
        );

        return {
            totalAnalysed: history.length,
            highRiskCount: successfulResults.filter((entry) => entry.riskScore >= 66).length,
            lowRiskCount: successfulResults.filter((entry) => entry.riskScore < 33).length,
            avgProcessingTime: successfulResults.length
                ? Math.round(totalProcessingTime / successfulResults.length)
                : 0
        };
    }

    async exportAnalysisData() {
        const data = await chrome.storage.local.get(['analysisHistory', 'statistics']);
        return {
            timestamp: new Date().toISOString(),
            statistics: data.statistics || this.getEmptyStatistics(),
            results: data.analysisHistory || []
        };
    }

    async clearAnalysisData() {
        await chrome.storage.local.set({
            analysisHistory: [],
            statistics: this.getEmptyStatistics()
        });
    }

    handleStorageChange(changes, namespace) {
        if (namespace === 'local') {
            if (changes.modelKey) {
                const nextModelKey = this.normaliseModelKey(changes.modelKey.newValue);
                if (this.selectedModelKey !== nextModelKey) {
                    this.selectedModelKey = nextModelKey;
                    this.modelInfo = this.getSelectedModelInfo();
                    this.resetModelSession();
                }
            }

            if (changes.detectionEnabled) {
                void this.notifyAllTabs({
                    action: 'toggleDetection',
                    enabled: Boolean(changes.detectionEnabled.newValue)
                });
            }

            if (changes.sensitivity) {
                void this.notifyAllTabs({
                    action: 'updateSensitivity',
                    sensitivity: this.normaliseSensitivity(changes.sensitivity.newValue)
                });
            }

            if (changes.detectionMode) {
                void this.notifyAllTabs({
                    action: 'updateDetectionMode',
                    mode: changes.detectionMode.newValue === 'automatic' ? 'automatic' : 'manual'
                });
            }

            console.log('Storage changed:', changes);
        }
    }

    async getWhitelistedDomains() {
        const { whitelistedDomains = [] } = await chrome.storage.local.get(['whitelistedDomains']);
        return whitelistedDomains;
    }

    async addDomainToWhitelist(domain) {
        if (!domain) {
            return;
        }

        const domains = await this.getWhitelistedDomains();
        if (domains.includes(domain)) {
            return;
        }

        await chrome.storage.local.set({
            whitelistedDomains: [...domains, domain]
        });
    }

    async removeDomainFromWhitelist(domain) {
        const domains = await this.getWhitelistedDomains();
        await chrome.storage.local.set({
            whitelistedDomains: domains.filter((entry) => entry !== domain)
        });
    }

    async isDomainWhitelisted(domain) {
        if (!domain) {
            return false;
        }

        const domains = await this.getWhitelistedDomains();
        return domains.includes(domain);
    }

    generateExplanation(riskScore, sensitivity, detailLevel = 50, inferenceResult = null) {
        let group = 'low';
        if (riskScore >= 66) {
            group = 'high';
        } else if (riskScore >= 33) {
            group = 'medium';
        }

        const summaryByGroup = {
            low: 'This result suggests the media is likely authentic, with only weak signs of manipulation.',
            medium: 'This result is inconclusive: the model noticed some suspicious patterns, but not enough to confidently call the media manipulated.',
            high: 'This result suggests the media is likely manipulated, because the model found strong synthetic patterns.'
        };
        const detailByGroup = {
            low: 'You can usually treat this as a low-risk result, though it is still a model estimate rather than proof.',
            medium: 'Treat this as a caution flag and review it more closely, especially if the source is unknown or the content matters.',
            high: 'Treat this as a strong warning sign and verify the media with additional evidence before trusting it.'
        };

        const baseExplanation = `${summaryByGroup[group]} ${detailByGroup[group]}`;

        if (detailLevel <= 20) {
            return baseExplanation;
        }

        const confidence = Number(inferenceResult?.confidence);
        const threshold = Number(inferenceResult?.threshold);
        const rawOutput = Number(inferenceResult?.rawOutput);
        const confidenceText = Number.isFinite(confidence)
            ? ` Confidence in this assessment is ${confidence.toFixed(1)}%.`
            : '';
        const thresholdText = Number.isFinite(threshold)
            ? ` The current decision cutoff is ${threshold.toFixed(3)} at sensitivity ${sensitivity}%.`
            : ` Sensitivity is set to ${sensitivity}%.`;

        if (detailLevel <= 70) {
            return `${baseExplanation}${confidenceText}${thresholdText}`;
        }

        const confidenceMargin = Number.isFinite(rawOutput) && Number.isFinite(threshold)
            ? ` The model output is ${(rawOutput - threshold).toFixed(6)} above the cutoff.`
            : '';
        const rawOutputText = Number.isFinite(rawOutput)
            ? ` Raw model output is ${rawOutput.toFixed(6)}.`
            : '';
        const captureStrategy = inferenceResult?.technicalDetails?.captureStrategy
            ? ` Capture strategy: ${inferenceResult.technicalDetails.captureStrategy}.`
            : '';
        const technicalContextFallback = ' Full detail includes model-level context for auditability.';
        const technicalContext = `${rawOutputText}${confidenceMargin}${captureStrategy}`.trim();

        return `${baseExplanation}${confidenceText}${thresholdText}${technicalContext ? ` ${technicalContext}` : technicalContextFallback}`.trim();
    }

    calculateSensitivityThreshold(sensitivity) {
        return 1 - (sensitivity / 100);
    }

    applySensitivityToModelOutput(baseOutput, sensitivity) {
        const threshold = this.calculateSensitivityThreshold(sensitivity);

        if (baseOutput > threshold) {
            const excess = baseOutput - threshold;
            const maxExcess = Math.max(0.0001, 1 - threshold);
            return Math.max(0, Math.min(100, 50 + (excess / maxExcess) * 50));
        }

        const normalised = threshold <= 0 ? 1 : baseOutput / threshold;
        return Math.max(0, Math.min(100, normalised * 50));
    }

    calculateConfidence(baseOutput, threshold) {
        const distance = Math.abs(baseOutput - threshold);
        const maxDistance = Math.max(threshold, 1 - threshold, 0.0001);
        const normalisedDistance = distance / maxDistance;

        // Give clearer separation between borderline and decisive results.
        const curvedDistance = Math.pow(normalisedDistance, 0.7);
        return Math.max(50, Math.min(99, 50 + curvedDistance * 49));
    }
}

new BackgroundService();
