import { DashboardPage } from './components/dashboard-page.js';
import { HistoryPage } from './components/history-page.js';
import { MediaAnalysisPage } from './components/media-analysis-page.js';
import { AnalyticsPage } from './components/analytics-page.js';
import { UploadPage } from './components/upload-page.js';
import { ReanalysePage } from './components/reanalyse-page.js';
import { SettingsPage } from './components/settings-page.js';
import { getContentAreaMarkup } from './components/page-markup/index.js';

import { capturePostHogError, capturePostHogEvent, initPostHog, setPostHogConsent } from '../posthog.js';
import { initSentry } from '../sentry.js';

class FullAnalysisPlatform {
    static MEDIA_DB_NAME = 'deepfake-media-store';

    static MEDIA_STORE_NAME = 'analysis-media';

    constructor() {
        this.analysisHistory = [];
        this.filteredHistory = [];
        this.currentAnalysisIndex = 0;
        this.currentPage = 'dashboard';
        this.requestedAnalysisId = null;
        this.mediaDbPromise = null;
        this.mediaRenderToken = 0;
        this.statistics = {
            totalAnalysed: 0,
            highRiskCount: 0,
            lowRiskCount: 0,
            avgProcessingTime: 0,
            avgRiskScore: 0
        };
        this.settings = {
            detectionEnabled: false,
            sensitivity: 50,
            detectionMode: 'manual',
            modelKey: 'ensemble',
            detailLevel: 10,
            anonymousAnalytics: false
        };
        this.pageHeaders = {
            dashboard: {
                title: 'Dashboard',
                showAction: true,
                actionLabel: 'Export',
                action: () => this.exportResults()
            },
            'media-analysis': {
                title: 'Media Analysis',
                showAction: true,
                actionLabel: 'Export',
                action: () => this.exportResults()
            },
            history: {
                title: 'History',
                showAction: false
            },
            analytics: {
                title: 'Analytics',
                showAction: false
            },
            upload: {
                title: 'Upload Media',
                showAction: false
            },
            reanalyse: {
                title: 'Re-analyse',
                showAction: false
            },
            settings: {
                title: 'Settings',
                showAction: false
            }
        };
        this.pageComponents = {
            dashboard: new DashboardPage(this),
            'media-analysis': new MediaAnalysisPage(this),
            history: new HistoryPage(this),
            analytics: new AnalyticsPage(this),
            upload: new UploadPage(this),
            reanalyse: new ReanalysePage(this),
            settings: new SettingsPage(this)
        };

        initSentry('newtab');
        void initPostHog('newtab');

        this.initialisePageMarkup();
        this.initialiseElements();
        this.attachEventListeners();
        this.requestedAnalysisId = this.getRequestedAnalysisId();
        this.loadStoredData();
        this.initialiseNavigation();
    }

    initialiseElements() {
        this.navItems = document.querySelectorAll('.nav-item');
        this.pages = document.querySelectorAll('.page');
        this.pageTitle = document.getElementById('pageTitle');
        this.pageContext = document.querySelector('.page-context');
        this.currentContextLabel = document.getElementById('currentContextLabel');
        this.currentWebsite = document.getElementById('currentWebsite');
        this.headerActionBtn = document.getElementById('headerActionBtn');
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');

        this.uploadAreaLarge = document.getElementById('uploadAreaLarge');
        this.fileInputLarge = document.getElementById('fileInputLarge');
        this.batchFileInput = document.getElementById('batchFileInput');

        this.totalAnalysed = document.getElementById('totalAnalyzed');
        this.highRiskCount = document.getElementById('highRiskCount');
        this.avgRiskScore = document.getElementById('avgRiskScore');
        this.avgProcessingTime = document.getElementById('avgProcessingTime');

        this.recentActivityGrid = document.getElementById('recentActivityGrid');
        this.flagRateChart = document.getElementById('flagRateChart');
        this.confidenceChart = document.getElementById('confidenceChart');
        this.flagRateInsight = document.getElementById('flagRateInsight');
        this.confidenceInsight = document.getElementById('confidenceInsight');
        this.flagRateLegend = document.getElementById('flagRateLegend');
        this.confidenceLegend = document.getElementById('confidenceLegend');
        this.riskBreakdown = document.getElementById('riskBreakdown');

        this.historyList = document.getElementById('historyList');
        this.historySearchInput = document.getElementById('historySearchInput');
        this.historySortSelect = document.getElementById('historySortSelect');
        this.historyFilterSelect = document.getElementById('historyFilterSelect');
        this.exportBtn = document.getElementById('exportBtn');
        this.clearBtn = document.getElementById('clearBtn');

        this.analysisCanvas = document.getElementById('analysisCanvas');
        this.analysisResultLabel = document.getElementById('analysisResultLabel');
        this.analysisModelLabel = document.getElementById('analysisModelLabel');
        this.analysisExplanation = document.getElementById('analysisExplanation');
        this.analysisBreakdown = document.getElementById('analysisBreakdown');
        this.analysisConfidenceGraph = document.getElementById('analysisConfidenceGraph');
        this.analysisHistoryList = document.getElementById('analysisHistoryList');
        this.prevAnalysisBtn = document.getElementById('prevAnalysisBtn');
        this.analysisReanalyseBtn = document.getElementById('analysisReanalyseBtn');
        this.nextAnalysisBtn = document.getElementById('nextAnalysisBtn');
        this.feedbackMaybeBtn = document.getElementById('feedbackMaybeBtn');
        this.feedbackYesBtn = document.getElementById('feedbackYesBtn');
        this.feedbackNoBtn = document.getElementById('feedbackNoBtn');
        this.feedbackButtons = [this.feedbackMaybeBtn, this.feedbackYesBtn, this.feedbackNoBtn].filter(Boolean);

        this.analyticsAccuracy = document.getElementById('analyticsAccuracy');
        this.analyticsProcessing = document.getElementById('analyticsProcessing');
        this.analyticsFlagRate = document.getElementById('analyticsFlagRate');
        this.analyticsFlaggedCount = document.getElementById('analyticsFlaggedCount');
        this.analyticsRiskBreakdown = document.getElementById('analyticsRiskBreakdown');
        this.trendChart = document.getElementById('trendChart');
        this.confidenceTrendChart = document.getElementById('confidenceTrendChart');
        this.distLow = document.getElementById('distLow');
        this.distMedium = document.getElementById('distMedium');
        this.distHigh = document.getElementById('distHigh');
        this.feedbackAgree = document.getElementById('feedbackAgree');
        this.feedbackDisagree = document.getElementById('feedbackDisagree');
        this.feedbackUnsure = document.getElementById('feedbackUnsure');

        this.reanalyseList = document.getElementById('reanalyseList');
        this.reanalyseLatestBtn = document.getElementById('reanalyseLatestBtn');

        this.btnToggle = document.getElementById('btnToggle');
        this.detectionToggleLabel = document.getElementById('detectionToggleLabel');
        this.sensitivitySlider = document.getElementById('sensitivitySlider');
        this.customSlider = document.getElementById('customSlider');
        this.sliderTrack = document.getElementById('sliderTrack');
        this.sliderThumb = document.getElementById('sliderThumb');
        this.detailLevelRadios = document.querySelectorAll('input[name="detailLevelPreset"]');
        this.manualMode = document.getElementById('manualMode');
        this.automaticMode = document.getElementById('automaticMode');
        this.modelSelect = document.getElementById('modelSelect');
        this.modelHelpText = document.getElementById('modelHelpText');
        this.anonymousAnalytics = document.getElementById('anonymousAnalytics');
        this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
        this.resetSettingsBtn = document.getElementById('resetSettingsBtn');
    }

    initialisePageMarkup() {
        const contentArea = document.querySelector('.content-area');
        if (!contentArea) {
            return;
        }

        contentArea.innerHTML = getContentAreaMarkup();
    }

    attachEventListeners() {
        this.navItems.forEach((item) => {
            item.addEventListener('click', () => this.handleNavigation(item));
        });

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local') {
                this.handleStorageChanges(changes);
            }
        });

        this.headerActionBtn?.addEventListener('click', () => this.handleHeaderAction());

        this.uploadAreaLarge?.addEventListener('click', () => this.fileInputLarge.click());
        this.uploadAreaLarge?.addEventListener('dragover', this.handleDragOver.bind(this));
        this.uploadAreaLarge?.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.uploadAreaLarge?.addEventListener('drop', this.handleDrop.bind(this));
        this.fileInputLarge?.addEventListener('change', this.handleFileSelect.bind(this));

        this.exportBtn?.addEventListener('click', this.exportResults.bind(this));
        this.clearBtn?.addEventListener('click', this.clearResults.bind(this));
        this.historySearchInput?.addEventListener('input', () => this.renderHistory());
        this.historySortSelect?.addEventListener('change', () => this.renderHistory());
        this.historyFilterSelect?.addEventListener('change', () => this.renderHistory());

        this.prevAnalysisBtn?.addEventListener('click', () => this.shiftAnalysis(-1));
        this.analysisReanalyseBtn?.addEventListener('click', () => this.reanalyseLatest());
        this.nextAnalysisBtn?.addEventListener('click', () => this.shiftAnalysis(1));
        this.reanalyseLatestBtn?.addEventListener('click', () => this.reanalyseLatest());
        this.feedbackButtons.forEach((button) => {
            button.addEventListener('click', () => this.submitAnalysisFeedback(button.dataset.feedbackValue));
        });

        this.customSlider?.addEventListener('click', (event) => this.handleSliderPointer(event, 'sensitivity'));
        this.sensitivitySlider?.addEventListener('input', (event) => this.updateSensitivity(event.target.value));
        this.detailLevelRadios?.forEach((radio) => {
            radio.addEventListener('change', (event) => this.updateDetailLevel(event.target.value));
        });
        this.btnToggle?.addEventListener('change', () => {
            this.settings.detectionEnabled = this.btnToggle.checked;
            this.updateDetectionToggleLabel();
            this.updateDetectorAvailabilityStatus();
        });
        this.manualMode?.addEventListener('change', () => this.updateDetectionMode());
        this.automaticMode?.addEventListener('change', () => this.updateDetectionMode());
        this.modelSelect?.addEventListener('change', () => this.updateModelSelection(this.modelSelect.value));
        this.anonymousAnalytics?.addEventListener('change', () => {
            this.settings.anonymousAnalytics = this.anonymousAnalytics.checked;
        });
        this.saveSettingsBtn?.addEventListener('click', () => this.saveSettings());
        this.resetSettingsBtn?.addEventListener('click', () => this.applySettingsToControls());
    }

    initialiseNavigation() {
        this.showPage(this.getRequestedPage());
    }

    getRequestedPage() {
        const validPages = new Set(Object.keys(this.pageHeaders));
        const params = new URLSearchParams(window.location.search);
        const hashPage = window.location.hash.replace('#', '').trim();
        const requestedPage = (params.get('page') || hashPage || 'dashboard').trim();

        return validPages.has(requestedPage) ? requestedPage : 'dashboard';
    }

    getRequestedAnalysisId() {
        const params = new URLSearchParams(window.location.search);
        const value = params.get('analysisId');
        return value ? String(value) : null;
    }

    handleNavigation(navItem) {
        const page = navItem.dataset.page;
        this.navigateToPage(page);
    }

    navigateToPage(page) {
        this.navItems.forEach((item) => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        this.showPage(page);
    }

    showPage(pageName) {
        this.updatePageUrl(pageName);
        this.navItems.forEach((item) => {
            item.classList.toggle('active', item.dataset.page === pageName);
        });

        this.pages.forEach((page) => {
            page.style.display = 'none';
        });

        const targetPage = document.getElementById(`${pageName}-page`);
        if (targetPage) {
            targetPage.style.display = 'block';
        }

        this.currentPage = pageName;
        this.updatePageHeader(pageName);
        this.renderPage(pageName);
        capturePostHogEvent('newtab_tab_viewed', {
            newtab_tab: pageName
        });
    }

    renderPage(pageName) {
        const component = this.pageComponents?.[pageName];
        if (!component || typeof component.render !== 'function') {
            return;
        }

        component.render();
    }

    renderCurrentPage() {
        this.renderPage(this.currentPage || 'dashboard');
    }

    updatePageUrl(pageName) {
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('page', pageName);
            window.history.replaceState({}, '', url);
        } catch (error) {
            console.warn('Deepfake Detection: Could not update page URL.', error);
        }
    }

    applyRequestedAnalysisSelection() {
        if (!this.requestedAnalysisId || this.analysisHistory.length === 0) {
            return false;
        }

        const targetIndex = this.analysisHistory.findIndex(
            (entry) => String(entry.id) === String(this.requestedAnalysisId)
        );

        if (targetIndex === -1) {
            return false;
        }

        this.currentAnalysisIndex = targetIndex;
        return true;
    }

    updatePageHeader(pageName) {
        const header = this.pageHeaders[pageName] || this.pageHeaders.dashboard;
        this.pageTitle.textContent = header.title;
        this.headerActionBtn.hidden = !header.showAction;
        this.headerActionBtn.textContent = header.actionLabel || '';
        this.updateCurrentWebsite();
    }

    getInlineIcon(name) {
        const icons = {
            'move-horizontal': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-move-horizontal"><path d="m18 8 4 4-4 4"></path><path d="M2 12h20"></path><path d="m6 16-4-4 4-4"></path></svg>'
        };

        return icons[name] || '';
    }

    handleHeaderAction() {
        const header = this.pageHeaders[this.currentPage] || this.pageHeaders.dashboard;
        if (header.showAction && header.action) {
            header.action();
        }
    }

    handleDragOver(event) {
        event.preventDefault();
        this.uploadAreaLarge.classList.add('dragover');
    }

    handleDragLeave(event) {
        event.preventDefault();
        this.uploadAreaLarge.classList.remove('dragover');
    }

    handleDrop(event) {
        event.preventDefault();
        this.uploadAreaLarge.classList.remove('dragover');
        const files = Array.from(event.dataTransfer.files);
        this.processMultipleFiles(files);
    }

    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.processMultipleFiles(files);
        event.target.value = '';
    }

    async processMultipleFiles(files) {
        const validFiles = files.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));

        if (validFiles.length === 0) {
            this.showError('Please select valid image or video files');
            return;
        }

        capturePostHogEvent('newtab_upload_batch_started', {
            file_count: validFiles.length,
            contains_video: validFiles.some((file) => file.type.startsWith('video/'))
        });
        const batchStartedAt = performance.now();
        let successCount = 0;
        let failureCount = 0;
        this.updateStatus('processing', 'Processing files...');

        for (const file of validFiles) {
            const success = await this.analyseFile(file);
            if (success) {
                successCount += 1;
            } else {
                failureCount += 1;
            }
        }

        capturePostHogEvent('analysis_batch_completed', {
            flow: 'upload',
            file_count: validFiles.length,
            success_count: successCount,
            failure_count: failureCount,
            duration_ms: Math.round(performance.now() - batchStartedAt),
            model_key: this.settings.modelKey
        });

        this.updateStatistics();
        this.currentAnalysisIndex = 0;
        this.saveData();
        this.updateDetectorAvailabilityStatus();
        this.navigateToPage('history');
    }

    async analyseFile(file) {
        try {
            const analysisResult = await this.runUploadAnalysis(file);
            this.analysisHistory.unshift(analysisResult);
            this.captureAnalysisCompletedEvent(analysisResult, {
                flow: 'upload',
                filename: file.name,
                mime_type: file.type
            });
            return true;
        } catch (error) {
            console.error('Analysis error:', error);
            this.captureAnalysisFailedEvent(error, {
                flow: 'upload',
                filename: file.name,
                mime_type: file.type
            });
            this.showError(`Failed to analyse ${file.name}`);
            return false;
        }
    }

    async runUploadAnalysis(file) {
        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
            throw new Error('Chrome APIs not available. Please refresh and try again.');
        }

        const payload = await this.createUploadedMediaPayload(file);
        const response = await chrome.runtime.sendMessage({
            action: 'analyzeUploadedMedia',
            data: payload
        });

        if (!response?.success) {
            throw new Error(response?.error?.userMessage || response?.error?.message || 'Upload analysis failed.');
        }

        return response.result;
    }

    getRiskLevel(score) {
        if (score < 33) {
            return { label: 'Likely Authentic', class: 'low' };
        }

        if (score < 66) {
            return { label: 'Unsure', class: 'medium' };
        }

        return { label: 'Likely Synthetic', class: 'high' };
    }

    getCurrentAnalysis() {
        if (this.analysisHistory.length === 0) {
            return null;
        }

        const index = Math.min(Math.max(this.currentAnalysisIndex, 0), this.analysisHistory.length - 1);
        this.currentAnalysisIndex = index;
        return this.analysisHistory[index];
    }

    shiftAnalysis(direction) {
        if (this.analysisHistory.length === 0) {
            return;
        }

        this.currentAnalysisIndex = (this.currentAnalysisIndex + direction + this.analysisHistory.length) % this.analysisHistory.length;
        this.renderMediaAnalysis();
        this.updateCurrentWebsite();
    }

    viewAnalysisById(resultId) {
        const index = this.analysisHistory.findIndex((entry) => String(entry.id) === String(resultId));
        if (index === -1) {
            return;
        }

        this.currentAnalysisIndex = index;
        this.navigateToPage('media-analysis');
    }

    async reanalyseLatest() {
        const target = this.getCurrentAnalysis();
        if (!target) {
            this.showError('No previous analyses available');
            return;
        }

        if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
            this.showError('Chrome APIs not available. Please refresh and try again.');
            return;
        }

        this.updateStatus('processing', 'Re-analysing media...');

        try {
            const reanalysisData = {
                existingResult: target,
                sensitivity: this.settings.sensitivity,
                detailLevel: this.settings.detailLevel
            };

            if (target.sourceType === 'upload') {
                const previewRecord = await this.getMediaPreview(target.mediaPreviewId || target.id);
                if (previewRecord?.previewDataUrl) {
                    reanalysisData.uploadPreviewDataUrl = previewRecord.previewDataUrl;
                    reanalysisData.uploadPreviewMimeType = 'image/png';
                }
            }

            const response = await chrome.runtime.sendMessage({
                action: 'reanalyzeStoredMedia',
                data: reanalysisData
            });

            if (!response?.success) {
                throw new Error(response?.error?.userMessage || response?.error?.message || 'Re-analysis failed.');
            }

            const updatedResult = response.result;
            const index = this.analysisHistory.findIndex((entry) => String(entry.id) === String(updatedResult.id));
            if (index !== -1) {
                this.analysisHistory[index] = updatedResult;
                this.currentAnalysisIndex = index;
            }

            this.captureAnalysisCompletedEvent(updatedResult, {
                flow: 'reanalyse',
                source_type: target.sourceType || 'unknown'
            });

            this.updateStatistics();
            this.saveData();
            this.renderAll();
            this.navigateToPage('media-analysis');
        } catch (error) {
            console.error('Re-analysis error:', error);
            this.captureAnalysisFailedEvent(error, {
                flow: 'reanalyse',
                source_type: target?.sourceType || 'unknown'
            });
            this.showError(error.message || 'Re-analysis failed.');
        } finally {
            this.updateDetectorAvailabilityStatus();
        }
    }

    captureAnalysisCompletedEvent(result, details = {}) {
        if (!result) {
            return;
        }

        capturePostHogEvent('analysis_completed', {
            flow: details.flow || 'unknown',
            source_type: result.sourceType || details.source_type || 'unknown',
            model: result.technicalDetails?.model || 'unknown',
            model_key: this.settings.modelKey,
            processing_time_ms: Number(result.processingTime) || 0,
            confidence: Number(result.confidence) || 0,
            risk_score: Number(result.riskScore) || 0,
            filename: details.filename || result.filename || '',
            mime_type: details.mime_type || result.type || result.originalType || ''
        });
    }

    captureAnalysisFailedEvent(error, details = {}) {
        capturePostHogError('analysis_failed', error, {
            flow: details.flow || 'unknown',
            source_type: details.source_type || 'unknown',
            model_key: this.settings.modelKey,
            filename: details.filename || '',
            mime_type: details.mime_type || ''
        }, { immediate: true, preferBeacon: true });
    }

    updateStatistics() {
        const total = this.analysisHistory.length;
        const totalTime = this.analysisHistory.reduce((sum, result) => sum + (result.processingTime || 0), 0);
        const totalRisk = this.analysisHistory.reduce((sum, result) => sum + (result.riskScore || 0), 0);

        this.statistics.totalAnalysed = total;
        this.statistics.highRiskCount = this.analysisHistory.filter((result) => result.riskScore >= 66).length;
        this.statistics.lowRiskCount = this.analysisHistory.filter((result) => result.riskScore < 33).length;
        this.statistics.avgProcessingTime = total > 0 ? Math.round(totalTime / total) : 0;
        this.statistics.avgRiskScore = total > 0 ? Math.round(totalRisk / total) : 0;

        this.totalAnalysed.textContent = String(this.statistics.totalAnalysed);
        this.highRiskCount.textContent = String(this.statistics.highRiskCount);
        this.avgRiskScore.textContent = `${this.statistics.avgRiskScore}%`;
        this.avgProcessingTime.textContent = `${this.statistics.avgProcessingTime}ms`;
    }

    renderAll() {
        this.renderCurrentPage();
    }

    renderDashboard() {
        this.pageComponents.dashboard.render();
    }

    renderChartInsights(recentItems, flagRateSeries, confidenceDistributionSeries) {
        if (this.flagRateLegend) {
            this.flagRateLegend.innerHTML = '';
        }

        if (this.flagRateInsight) {
            if (!recentItems.length || !flagRateSeries.length) {
                this.flagRateInsight.textContent = 'No analysis history yet.';
            } else {
                const flaggedCount = recentItems.filter((item) => (Number(item.riskScore) || 0) >= 66).length;
                const latestRate = flagRateSeries[flagRateSeries.length - 1] || 0;
                this.flagRateInsight.textContent = `${flaggedCount} of ${recentItems.length} recent items were flagged (${latestRate}%).`;
                if (this.flagRateLegend) {
                    this.flagRateLegend.innerHTML = `
                        <span class="chart-key"><strong>${recentItems.length}</strong> samples</span>
                        <span class="chart-key"><strong>${latestRate}%</strong> current</span>
                    `;
                }
            }
        }

        if (this.confidenceLegend) {
            this.confidenceLegend.innerHTML = '';
        }

        if (this.confidenceInsight) {
            if (!recentItems.length || !confidenceDistributionSeries.length) {
                this.confidenceInsight.textContent = 'No analysis history yet.';
            } else {
                const [low, medium, high] = confidenceDistributionSeries;
                const dominantBand = high >= medium && high >= low
                    ? 'High'
                    : (medium >= low ? 'Medium' : 'Low');
                this.confidenceInsight.textContent = `Most recent analyses skew ${dominantBand.toLowerCase()} confidence.`;
                if (this.confidenceLegend) {
                    this.confidenceLegend.innerHTML = `
                        <span class="chart-key"><strong>${low}%</strong> low</span>
                        <span class="chart-key"><strong>${medium}%</strong> medium</span>
                        <span class="chart-key"><strong>${high}%</strong> high</span>
                    `;
                }
            }
        }
    }

    renderRecentActivity() {
        if (!this.recentActivityGrid) {
            return;
        }

        this.recentActivityGrid.innerHTML = '';

        const recent = this.analysisHistory.slice(0, 4);
        if (recent.length === 0) {
            this.recentActivityGrid.innerHTML = '<div class="empty-state-card">No recent activity yet. Upload media to start populating the dashboard.</div>';
            return;
        }

        recent.forEach((result) => {
            const riskLevel = this.getRiskLevel(result.riskScore);
            const sourceContext = this.getSourceContext(result);
            const modelLabel = result.technicalDetails?.model || 'Unknown model';
            const card = document.createElement('article');
            card.className = `activity-card activity-${riskLevel.class}`;
            card.innerHTML = `
                <div class="activity-meta">${this.formatDateTime(result.timestamp)}</div>
                <div class="activity-score">${Math.round(result.riskScore)}% ${riskLevel.label}</div>
                <div class="activity-source">${sourceContext.value}</div>
                <div class="activity-model">Model: ${modelLabel}</div>
                ${this.getConfidenceGraphMarkup(result.confidence, { compact: true })}
                <div class="activity-actions">
                    <button class="activity-link" type="button">More Info</button>
                </div>
            `;
            card.querySelector('.activity-link').addEventListener('click', () => this.viewAnalysisById(result.id));
            this.recentActivityGrid.appendChild(card);
        });

        const cta = document.createElement('button');
        cta.type = 'button';
        cta.className = 'recent-cta';
        cta.textContent = 'View more recent analysis...';
        cta.addEventListener('click', () => this.navigateToPage('history'));
        this.recentActivityGrid.appendChild(cta);
    }

    renderMiniChart(target, values, variant, options = {}) {
        if (!target) {
            return;
        }

        target.innerHTML = '';
        const data = Array.isArray(values) ? values : [];
        if (data.length === 0) {
            if (options.emptyMessage) {
                target.innerHTML = `<span class="mini-chart-empty">${options.emptyMessage}</span>`;
            }
            return;
        }

        const normalisedData = data.map((value) => this.normalisePercent(value));
        const maxValue = Math.max(...normalisedData, 0);

        normalisedData.forEach((normalisedValue, index) => {
            const bar = document.createElement('span');
            const segmentLabel = Array.isArray(options.segmentLabels) ? options.segmentLabels[index] : null;
            const valueLabelPrefix = options.valueLabelPrefix || 'Value';
            const tooltipText = `${segmentLabel || valueLabelPrefix}: ${normalisedValue}%`;
            const proportionalHeight = maxValue > 0
                ? Math.round((normalisedValue / maxValue) * 100)
                : 1;
            const segmentHeight = Math.max(1, proportionalHeight);
            bar.className = variant === 'wave' ? 'chart-wave-segment' : 'chart-bar-segment';
            bar.style.setProperty('--segment-height', `${segmentHeight}%`);
            bar.setAttribute('aria-label', tooltipText);
            bar.setAttribute('data-tooltip', tooltipText);
            bar.title = tooltipText;
            bar.tabIndex = 0;
            target.appendChild(bar);
        });
    }

    getFlagRateSeries(items = []) {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }

        const chronological = [...items].reverse();
        let flaggedCount = 0;

        return chronological.map((item, index) => {
            if ((Number(item.riskScore) || 0) >= 66) {
                flaggedCount += 1;
            }

            const runningRate = (flaggedCount / (index + 1)) * 100;
            return this.normalisePercent(runningRate);
        });
    }

    getConfidenceDistributionSeries(items = []) {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }

        const total = Math.max(items.length, 1);
        const lowConfidence = items.filter((item) => (Number(item.confidence) || 0) < 50).length;
        const mediumConfidence = items.filter((item) => {
            const confidence = Number(item.confidence) || 0;
            return confidence >= 50 && confidence < 75;
        }).length;
        const highConfidence = items.filter((item) => (Number(item.confidence) || 0) >= 75).length;

        return [
            this.normalisePercent((lowConfidence / total) * 100),
            this.normalisePercent((mediumConfidence / total) * 100),
            this.normalisePercent((highConfidence / total) * 100)
        ];
    }

    getConfidenceGraphMarkup(confidence, options = {}) {
        const normalised = this.normalisePercent(confidence);
        const sizeClass = options.compact ? ' confidence-spark-compact' : '';

        return `
            <div class="confidence-spark${sizeClass}" role="img" aria-label="Confidence ${normalised}%">
                <div class="confidence-spark-head">
                    <span>Confidence</span>
                    <strong>${normalised}%</strong>
                </div>
            </div>
        `;
    }

    getAnalysisRuns(result) {
        if (!result) {
            return [];
        }

        if (Array.isArray(result.analysisRuns) && result.analysisRuns.length > 0) {
            return [...result.analysisRuns].sort(
                (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
            );
        }

        return [{
            timestamp: result.timestamp,
            riskScore: result.riskScore,
            confidence: result.confidence,
            model: result.technicalDetails?.model || 'Unknown model',
            processingTime: result.processingTime
        }].filter((run) => run.timestamp || Number.isFinite(run.riskScore));
    }

    renderRiskBreakdown() {
        if (!this.riskBreakdown) {
            return;
        }

        const total = Math.max(this.analysisHistory.length, 1);
        const mediumCount = this.analysisHistory.filter((result) => result.riskScore >= 33 && result.riskScore < 66).length;
        const breakdown = [
            { label: 'Low', value: Math.round((this.statistics.lowRiskCount / total) * 100), className: 'low' },
            { label: 'Medium', value: Math.round((mediumCount / total) * 100), className: 'medium' },
            { label: 'High', value: Math.round((this.statistics.highRiskCount / total) * 100), className: 'high' }
        ];

        this.riskBreakdown.innerHTML = '';
        breakdown.forEach((item) => {
            const pill = document.createElement('div');
            pill.className = `risk-pill risk-pill-${item.className}`;
            pill.innerHTML = `<span>${item.value}%</span><span>${item.label}</span>`;
            this.riskBreakdown.appendChild(pill);
        });
    }

    updateCurrentWebsite() {
        if (!this.pageContext || !this.currentContextLabel || !this.currentWebsite) {
            return;
        }

        if (this.currentPage !== 'dashboard' && this.currentPage !== 'media-analysis') {
            this.pageContext.hidden = true;
            return;
        }

        const context = this.currentPage === 'dashboard'
            ? this.getDashboardContext()
            : this.getSourceContext(this.getCurrentAnalysis());

        this.pageContext.hidden = false;
        this.currentContextLabel.textContent = context.label;
        this.currentWebsite.textContent = context.value;
    }

    getDashboardContext() {
        const latestWebsiteResult = this.analysisHistory.find((entry) => {
            const sourceContext = this.getSourceContext(entry);
            return sourceContext.label === 'Selected Website';
        });

        if (latestWebsiteResult) {
            return {
                label: 'Current Website',
                value: this.getSourceContext(latestWebsiteResult).value
            };
        }

        return {
            label: 'Current Website',
            value: 'No website analysis available yet'
        };
    }

    getSourceContext(result) {
        if (!result) {
            return {
                label: 'Current Source',
                value: 'Waiting for analysis context...'
            };
        }

        const legacyMediaUrl = result.debug?.capture?.mediaUrl || '';
        const legacyMediaHostname = legacyMediaUrl ? this.getHostname(legacyMediaUrl) : '';

        if (result.sourceType === 'upload' || result.filename) {
            return {
                label: 'Selected File',
                value: result.filename || result.source || 'Uploaded media'
            };
        }

        if (result.pageHostname || result.pageUrl || result.mediaHostname || legacyMediaHostname) {
            return {
                label: 'Selected Website',
                value:
                    result.pageHostname ||
                    result.pageUrl ||
                    result.mediaHostname ||
                    legacyMediaHostname ||
                    result.mediaUrl ||
                    legacyMediaUrl ||
                    result.source ||
                    'Website media'
            };
        }

        if (result.mediaUrl || legacyMediaUrl) {
            return {
                label: 'Selected Media Source',
                value: result.mediaUrl || legacyMediaUrl
            };
        }

        return {
            label: 'Selected Source',
            value: result.source || result.filename || 'Scanned media item'
        };
    }

    getFilteredHistory() {
        return this.pageComponents.history.getFilteredHistory();
    }

    renderHistory() {
        this.pageComponents.history.render();
    }

    renderMediaAnalysis() {
        const current = this.getCurrentAnalysis();
        this.updateCurrentWebsite();

        if (!current) {
            this.analysisCanvas.innerHTML = `
                <div class="analysis-placeholder">
                    <div class="placeholder-symbol" aria-hidden="true">${this.getInlineIcon('move-horizontal')}</div>
                    <div class="placeholder-title">Select a result to inspect</div>
                    <div class="placeholder-copy">Use Recent Activity, History, Upload, or Re-analyse to populate this panel.</div>
                </div>
            `;
            this.analysisResultLabel.textContent = 'No result selected';
            this.analysisModelLabel.textContent = 'Awaiting data';
            this.analysisExplanation.textContent = 'Choose a result to view its explanation.';
            this.analysisBreakdown.innerHTML = '<li>Visual: Awaiting data</li><li>Temporal: Awaiting data</li><li>Compression: Awaiting data</li>';
            this.renderMiniChart(this.analysisConfidenceGraph, [], 'bars');
            this.renderAnalysisHistory(null);
            this.updateFeedbackButtons(null);
            return;
        }

        const riskLevel = this.getRiskLevel(current.riskScore);
        this.renderMediaPreview(current, riskLevel);
        this.analysisResultLabel.textContent = `${Math.round(current.riskScore)}% ${riskLevel.label.toLowerCase()}`;
        this.analysisModelLabel.textContent = current.technicalDetails?.model || 'Unknown model';
        this.analysisExplanation.textContent = current.explanation;
        this.analysisBreakdown.innerHTML = `
            <li>Visual: ${current.breakdown?.visual || 'Low'}</li>
            <li>Temporal: ${current.breakdown?.temporal || 'Low'}</li>
            <li>Compression: ${current.breakdown?.compression || 'Low'}</li>
        `;
        this.renderMiniChart(this.analysisConfidenceGraph, [current.confidence, current.riskScore, 100 - current.riskScore], 'bars');
        this.renderAnalysisHistory(current);
        this.updateFeedbackButtons(current);
    }

    submitAnalysisFeedback(value) {
        const feedbackValue = String(value || '').toLowerCase();
        if (!['yes', 'no', 'maybe'].includes(feedbackValue)) {
            return;
        }

        const current = this.getCurrentAnalysis();
        if (!current?.id) {
            this.showError('No analysis selected for feedback.');
            return;
        }

        const currentRunKey = this.getCurrentAnalysisRunKey(current);
        if (this.hasFeedbackForCurrentRun(current, currentRunKey)) {
            this.showToast('Feedback already recorded for this analysis run');
            return;
        }

        const feedback = {
            value: feedbackValue,
            timestamp: new Date().toISOString(),
            analysisRunKey: currentRunKey,
            analysisTimestamp: current.timestamp || ''
        };
        const feedbackHistoryEntry = {
            ...feedback,
            analysisId: String(current.id),
            mediaPreviewId: current.mediaPreviewId || null
        };

        const index = this.analysisHistory.findIndex((entry) => String(entry.id) === String(current.id));
        if (index === -1) {
            this.showError('Could not link feedback to this analysis item.');
            return;
        }

        const existing = this.analysisHistory[index];
        this.analysisHistory[index] = {
            ...existing,
            feedback,
            feedbackHistory: [...(Array.isArray(existing.feedbackHistory) ? existing.feedbackHistory : []), feedbackHistoryEntry]
        };

        this.saveData();
        this.renderMediaAnalysis();
        this.renderAnalytics();

        capturePostHogEvent('analysis_feedback_submitted', {
            feedback: feedbackValue,
            analysis_id: String(current.id),
            analysis_run_key: currentRunKey,
            media_preview_id: current.mediaPreviewId || '',
            filename: current.filename || '',
            source_type: current.sourceType || 'unknown',
            model_key: this.settings.modelKey,
            risk_score: Number(current.riskScore) || 0,
            confidence: Number(current.confidence) || 0
        }, { immediate: true, preferBeacon: true });

        this.showToast('Feedback recorded');
    }

    updateFeedbackButtons(result) {
        if (!this.feedbackButtons.length) {
            return;
        }

        const selected = result?.feedback?.value || '';
        const currentRunKey = this.getCurrentAnalysisRunKey(result);
        const alreadyReviewedCurrentRun = this.hasFeedbackForCurrentRun(result, currentRunKey);
        this.feedbackButtons.forEach((button) => {
            const matches = button.dataset.feedbackValue === selected;
            button.classList.toggle('is-selected', matches);
            button.setAttribute('aria-pressed', matches ? 'true' : 'false');
            button.disabled = !result || alreadyReviewedCurrentRun;
        });
    }

    getCurrentAnalysisRunKey(result) {
        if (!result) {
            return '';
        }

        const runs = this.getAnalysisRuns(result);
        if (!runs.length) {
            return String(result.timestamp || result.id || '');
        }

        const latestRun = runs[0];
        return String(latestRun.timestamp || result.timestamp || result.id || '');
    }

    hasFeedbackForCurrentRun(result, runKey = this.getCurrentAnalysisRunKey(result)) {
        if (!result?.feedback?.value) {
            return false;
        }

        const feedbackRunKey = result.feedback.analysisRunKey;
        if (feedbackRunKey) {
            return String(feedbackRunKey) === String(runKey);
        }

        if (result.feedback.analysisTimestamp) {
            return String(result.feedback.analysisTimestamp) === String(result.timestamp || '');
        }

        return false;
    }

    renderAnalysisHistory(result) {
        if (!this.analysisHistoryList) {
            return;
        }

        if (!result) {
            this.analysisHistoryList.innerHTML = '<div class="analytics-empty-state">No analysis history available for this item yet.</div>';
            return;
        }

        const runs = this.getAnalysisRuns(result);
        if (!runs.length) {
            this.analysisHistoryList.innerHTML = '<div class="analytics-empty-state">No analysis history available for this item yet.</div>';
            return;
        }

        this.analysisHistoryList.innerHTML = runs.map((run, index) => {
            const riskScore = this.normalisePercent(run.riskScore || 0);
            const confidence = this.normalisePercent(run.confidence || 0);
            const riskLevel = this.getRiskLevel(riskScore);
            return `
                <article class="analysis-history-row">
                    <div class="analysis-history-row-top">
                        <span class="analysis-history-badge">${index === 0 ? 'Latest' : `Run ${runs.length - index}`}</span>
                        <span class="analysis-history-time">${this.formatDateTime(run.timestamp)}</span>
                    </div>
                    <div class="analysis-history-stats">
                        <div class="analysis-history-visual">
                            <span class="analysis-score">${riskScore}% score</span>
                            <div class="analysis-score-ring risk-${riskLevel.class}" style="--ring-progress: ${riskScore};" role="img" aria-label="Risk score ${riskScore}%"></div>
                            <div class="analysis-caption">${riskLevel.label} with ${confidence}% confidence</div>
                        </div>
                        <div class="analysis-history-stats-row">
                            <span>${Number(run.processingTime) || 0}ms</span>
                            <span class="analysis-model">${run.model || 'Unknown model'}</span>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    }

    async renderMediaPreview(result, riskLevel) {
        const token = ++this.mediaRenderToken;
        this.analysisCanvas.innerHTML = `
            <div class="analysis-placeholder">
                <div class="placeholder-symbol" aria-hidden="true">${this.getInlineIcon('move-horizontal')}</div>
                <div class="placeholder-title">Loading analysed media</div>
                <div class="placeholder-copy">Retrieving the saved preview for this analysis item.</div>
            </div>
        `;

        const previewRecord = await this.getMediaPreview(result.mediaPreviewId || result.id);
        if (token !== this.mediaRenderToken) {
            return;
        }

        if (previewRecord?.previewDataUrl) {
            const score = this.normalisePercent(result.riskScore);
            const mediaTag = previewRecord.mediaType === 'video'
                ? `<img class="analysis-preview-image" src="${previewRecord.previewDataUrl}" alt="Stored video preview">`
                : `<img class="analysis-preview-image" src="${previewRecord.previewDataUrl}" alt="Stored media preview">`;

            this.analysisCanvas.innerHTML = `
                <div class="analysis-preview-card risk-${riskLevel.class}">
                    <div class="analysis-file-badge">${result.filename || result.source || 'Media item'}</div>
                    <div class="analysis-preview-frame">
                        ${mediaTag}
                    </div>
                    <div class="analysis-preview-footer">
                        <span class="analysis-score">${score}%</span>
                        <div class="analysis-score-ring risk-${riskLevel.class}" style="--ring-progress: ${score};" role="img" aria-label="Risk score ${score}%"></div>
                        
                        <div class="analysis-caption">${riskLevel.label} with ${Math.round(result.confidence)}% confidence</div>
                    </div>
                </div>
            `;
            return;
        }

        const score = this.normalisePercent(result.riskScore);
        this.analysisCanvas.innerHTML = `
            <div class="analysis-media-card risk-${riskLevel.class}">
                <div class="analysis-file-badge">${result.filename || result.source || 'Media item'}</div>
                
                <span class="analysis-score">${score}%</span>
                <div class="analysis-score-ring risk-${riskLevel.class}" style="--ring-progress: ${score};" role="img" aria-label="Risk score ${score}%"></div>

                <div class="analysis-caption">${riskLevel.label} with ${Math.round(result.confidence)}% confidence</div>
            </div>
        `;
    }

    renderAnalytics() {
        if (!this.analysisHistory.length) {
            this.analyticsAccuracy.textContent = '0%';
            this.analyticsProcessing.textContent = '0ms';
            if (this.analyticsFlagRate) {
                this.analyticsFlagRate.textContent = '0%';
            }
            if (this.analyticsFlaggedCount) {
                this.analyticsFlaggedCount.textContent = '0';
            }
            if (this.analyticsRiskBreakdown) {
                this.analyticsRiskBreakdown.innerHTML = '';
            }
            this.trendChart.innerHTML = '<div class="analytics-empty-state">No analysis history yet.</div>';
            if (this.confidenceTrendChart) {
                this.confidenceTrendChart.innerHTML = '<div class="analytics-empty-state">No analysis history yet.</div>';
            }
            this.distLow.style.width = '5%';
            this.distMedium.style.width = '5%';
            this.distHigh.style.width = '5%';
            this.distLow.removeAttribute('data-tooltip');
            this.distMedium.removeAttribute('data-tooltip');
            this.distHigh.removeAttribute('data-tooltip');
            this.distLow.title = '';
            this.distMedium.title = '';
            this.distHigh.title = '';
            this.feedbackAgree.textContent = '0%';
            this.feedbackDisagree.textContent = '0%';
            this.feedbackUnsure.textContent = '0%';
            return;
        }

        this.analyticsAccuracy.textContent = `${Math.max(0, 100 - this.statistics.avgRiskScore)}%`;
        this.analyticsProcessing.textContent = `${this.statistics.avgProcessingTime}ms`;
        const total = Math.max(this.analysisHistory.length, 1);
        const flaggedCount = this.statistics.highRiskCount;
        const mediumCount = this.analysisHistory.filter((item) => item.riskScore >= 33 && item.riskScore < 66).length;

        if (this.analyticsFlagRate) {
            this.analyticsFlagRate.textContent = `${Math.round((flaggedCount / total) * 100)}%`;
        }
        if (this.analyticsFlaggedCount) {
            this.analyticsFlaggedCount.textContent = `${flaggedCount} of ${this.analysisHistory.length}`;
        }
        if (this.analyticsRiskBreakdown) {
            const breakdown = [
                { label: 'Low', value: Math.round((this.statistics.lowRiskCount / total) * 100), className: 'low' },
                { label: 'Medium', value: Math.round((mediumCount / total) * 100), className: 'medium' },
                { label: 'High', value: Math.round((this.statistics.highRiskCount / total) * 100), className: 'high' }
            ];
            this.analyticsRiskBreakdown.innerHTML = '';
            breakdown.forEach((item) => {
                const pill = document.createElement('div');
                pill.className = `risk-pill risk-pill-${item.className}`;
                pill.innerHTML = `<span>${item.value}%</span><span>${item.label}</span>`;
                this.analyticsRiskBreakdown.appendChild(pill);
            });
        }

        this.renderMiniChart(this.trendChart, this.analysisHistory.slice(0, 18).map((item) => item.riskScore || 0), 'bars');
        if (this.confidenceTrendChart) {
            const confidenceTrendEntries = this.analysisHistory
                .slice(0, 18)
                .reverse();
            this.renderMiniChart(
                this.confidenceTrendChart,
                confidenceTrendEntries.map((item) => item.confidence || 0),
                'wave',
                {
                    segmentLabels: confidenceTrendEntries.map((item) => this.formatTime(item.timestamp)),
                    valueLabelPrefix: 'Confidence'
                }
            );
        }
        const lowConfidence = this.analysisHistory.filter((item) => item.confidence < 50).length;
        const mediumConfidence = this.analysisHistory.filter((item) => item.confidence >= 50 && item.confidence < 75).length;
        const highConfidence = this.analysisHistory.filter((item) => item.confidence >= 75).length;
        const lowPercent = Math.round((lowConfidence / total) * 100);
        const mediumPercent = Math.round((mediumConfidence / total) * 100);
        const highPercent = Math.round((highConfidence / total) * 100);

        this.distLow.style.width = `${lowPercent === 0 ? 5 : lowPercent}%`;
        this.distMedium.style.width = `${mediumPercent === 0 ? 5 : mediumPercent}%`;
        this.distHigh.style.width = `${highPercent === 0 ? 5 : highPercent}%`;
        this.distLow.setAttribute('data-tooltip', `Low: ${lowPercent}% (${lowConfidence}/${this.analysisHistory.length})`);
        this.distMedium.setAttribute('data-tooltip', `Medium: ${mediumPercent}% (${mediumConfidence}/${this.analysisHistory.length})`);
        this.distHigh.setAttribute('data-tooltip', `High: ${highPercent}% (${highConfidence}/${this.analysisHistory.length})`);
        this.distLow.setAttribute('aria-label', `Low confidence ${lowPercent}%`);
        this.distMedium.setAttribute('aria-label', `Medium confidence ${mediumPercent}%`);
        this.distHigh.setAttribute('aria-label', `High confidence ${highPercent}%`);
        this.distLow.title = this.distLow.getAttribute('data-tooltip');
        this.distMedium.title = this.distMedium.getAttribute('data-tooltip');
        this.distHigh.title = this.distHigh.getAttribute('data-tooltip');
        this.distLow.tabIndex = 0;
        this.distMedium.tabIndex = 0;
        this.distHigh.tabIndex = 0;
        const feedbackTotal = this.analysisHistory.filter((item) => item?.feedback?.value).length;
        const feedbackAgreeCount = this.analysisHistory.filter((item) => item?.feedback?.value === 'yes').length;
        const feedbackDisagreeCount = this.analysisHistory.filter((item) => item?.feedback?.value === 'no').length;
        const feedbackUnsureCount = this.analysisHistory.filter((item) => item?.feedback?.value === 'maybe').length;
        const feedbackDenominator = Math.max(feedbackTotal, 1);
        this.feedbackAgree.textContent = `${Math.round((feedbackAgreeCount / feedbackDenominator) * 100)}%`;
        this.feedbackDisagree.textContent = `${Math.round((feedbackDisagreeCount / feedbackDenominator) * 100)}%`;
        this.feedbackUnsure.textContent = `${Math.round((feedbackUnsureCount / feedbackDenominator) * 100)}%`;
    }

    renderReanalyse() {
        if (!this.reanalyseList) {
            return;
        }

        this.reanalyseList.innerHTML = '';

        if (this.analysisHistory.length === 0) {
            this.reanalyseList.innerHTML = '<div class="empty-state-card">Re-analysis becomes available after your first uploaded result.</div>';
            return;
        }

        this.analysisHistory.slice(0, 5).forEach((result) => {
            const row = document.createElement('article');
            row.className = 'reanalyse-row';
            row.innerHTML = `
                <div class="reanalyse-row-main">
                    <div class="reanalyse-title">${result.filename || result.source || 'Media item'}</div>
                    ${this.getConfidenceGraphMarkup(result.confidence)}
                    <div class="reanalyse-meta">${this.formatTime(result.timestamp)} • ${Math.round(result.riskScore)}% score</div>
                </div>
                <button class="btn btn-secondary" type="button">Re-analyse</button>
            `;
            row.querySelector('button').addEventListener('click', () => {
                this.currentAnalysisIndex = this.analysisHistory.findIndex((entry) => entry.id === result.id);
                this.reanalyseLatest();
            });
            this.reanalyseList.appendChild(row);
        });
    }

    updateStatus(status, text) {
        this.statusText.textContent = text;
        this.statusDot.className = 'status-dot';

        if (status === 'processing') {
            this.statusDot.classList.add('processing');
        } else if (status === 'inactive') {
            this.statusDot.classList.add('inactive');
        }
    }

    updateSensitivity(value) {
        this.settings.sensitivity = this.normalisePercent(value);
        this.updateSliderVisual(this.sensitivitySlider, this.sliderTrack, this.sliderThumb, this.settings.sensitivity);
    }

    updateDetailLevel(value) {
        this.settings.detailLevel = this.normaliseDetailLevel(value);
    }

    handleSliderPointer(event, sliderType) {
        const slider = this.customSlider;
        const input = this.sensitivitySlider;
        if (!slider || !input) {
            return;
        }

        const rect = slider.getBoundingClientRect();
        const ratio = (event.clientX - rect.left) / rect.width;
        const nextValue = this.normalisePercent(Math.round(ratio * 100));
        input.value = String(nextValue);
        this.updateSensitivity(nextValue);
    }

    updateSliderVisual(input, track, thumb, value) {
        if (!input || !track || !thumb) {
            return;
        }

        input.value = String(value);
        track.style.width = `${value}%`;
        thumb.style.left = `${value}%`;
    }

    updateDetectionMode() {
        this.settings.detectionMode = 'manual';
        if (this.manualMode) {
            this.manualMode.checked = true;
        }
        if (this.automaticMode) {
            this.automaticMode.checked = false;
        }
    }

    normaliseDetailLevel(value) {
        if (value === 'basic') {
            return 10;
        }

        if (value === 'context') {
            return 50;
        }

        if (value === 'full') {
            return 100;
        }

        return this.normalisePercent(value);
    }

    getDetailPreset(detailLevel = 10) {
        const normalised = this.normalisePercent(detailLevel);
        if (normalised <= 20) {
            return 'basic';
        }

        if (normalised <= 70) {
            return 'context';
        }

        return 'full';
    }

    updateDetectionToggleLabel() {
        if (!this.detectionToggleLabel || !this.btnToggle) {
            return;
        }

        this.detectionToggleLabel.textContent = this.btnToggle.checked
            ? 'Detection enabled'
            : 'Detection disabled';
    }

    updateDetectorAvailabilityStatus() {
        if (this.settings.detectionEnabled) {
            this.updateStatus('', 'Ready');
            return;
        }

        this.updateStatus('inactive', 'Offline');
    }

    updateModelSelection(value) {
        const allowedModelKeys = ['lightweight', 'mesonet', 'ensemble'];
        this.settings.modelKey = allowedModelKeys.includes(value) ? value : 'ensemble';

        if (!this.modelHelpText) {
            return;
        }

        if (this.settings.modelKey === 'ensemble') {
            this.modelHelpText.textContent = 'Ensemble combines MesoNet and LightweightNet for stronger reliability at a small speed cost.';
            return;
        }

        this.modelHelpText.textContent = this.settings.modelKey === 'mesonet'
            ? 'MesoNet is heavier and slower, but it offers a stronger research-oriented path.'
            : 'Lightweight is faster. MesoNet is heavier but intended to be more capable.';
    }

    applySettingsToControls() {
        if (!this.btnToggle) {
            return;
        }

        this.btnToggle.checked = this.settings.detectionEnabled;
        this.updateDetectionToggleLabel();
        this.updateDetectorAvailabilityStatus();
        this.updateSliderVisual(this.sensitivitySlider, this.sliderTrack, this.sliderThumb, this.settings.sensitivity);
        const detailPreset = this.getDetailPreset(this.settings.detailLevel);
        this.detailLevelRadios?.forEach((radio) => {
            radio.checked = radio.value === detailPreset;
        });
        this.manualMode.checked = true;
        this.automaticMode.checked = false;
        this.automaticMode.disabled = true;
        this.modelSelect.value = this.settings.modelKey;
        this.anonymousAnalytics.checked = this.settings.anonymousAnalytics;
        this.updateModelSelection(this.settings.modelKey);
    }

    handleStorageChanges(changes) {
        let shouldRefreshControls = false;

        if (changes.detectionEnabled) {
            this.settings.detectionEnabled = Boolean(changes.detectionEnabled.newValue);
            shouldRefreshControls = true;
        }

        if (changes.sensitivity) {
            this.settings.sensitivity = this.normalisePercent(changes.sensitivity.newValue);
            shouldRefreshControls = true;
        }

        if (changes.detectionMode) {
            this.settings.detectionMode = changes.detectionMode.newValue === 'automatic' ? 'automatic' : 'manual';
            shouldRefreshControls = true;
        }

        if (changes.modelKey) {
            this.settings.modelKey = ['lightweight', 'mesonet', 'ensemble'].includes(changes.modelKey.newValue)
                ? changes.modelKey.newValue
                : 'ensemble';
            shouldRefreshControls = true;
        }

        if (changes.detailLevel) {
            this.settings.detailLevel = this.normaliseDetailLevel(changes.detailLevel.newValue);
            shouldRefreshControls = true;
        }

        if (changes.anonymousAnalytics) {
            this.settings.anonymousAnalytics = Boolean(changes.anonymousAnalytics.newValue);
            setPostHogConsent(this.settings.anonymousAnalytics, { source: 'storage_change' });
            shouldRefreshControls = true;
        }

        if (shouldRefreshControls) {
            this.applySettingsToControls();
        }
    }

    saveSettings() {
        chrome.storage.local.set({
            detectionEnabled: this.settings.detectionEnabled,
            sensitivity: this.settings.sensitivity,
            detectionMode: this.settings.detectionMode,
            modelKey: this.settings.modelKey,
            detailLevel: this.settings.detailLevel,
            anonymousAnalytics: this.settings.anonymousAnalytics
        });
        setPostHogConsent(this.settings.anonymousAnalytics, { source: 'user' });
        capturePostHogEvent('newtab_settings_saved', {
            detection_enabled: this.settings.detectionEnabled,
            sensitivity: this.settings.sensitivity,
            model_key: this.settings.modelKey,
            detail_level: this.settings.detailLevel,
            anonymous_analytics: this.settings.anonymousAnalytics
        });
        this.showToast('Settings saved');
    }

    clearResults() {
        if (!confirm('Are you sure you want to clear all analysis results?')) {
            return;
        }

        capturePostHogEvent('newtab_results_cleared');
        this.clearMediaPreviews().catch((error) => {
            console.warn('Deepfake Detection: Failed to clear IndexedDB previews.', error);
        });
        this.analysisHistory = [];
        this.currentAnalysisIndex = 0;
        this.updateStatistics();
        this.saveData();
        this.renderAll();
        this.navigateToPage('dashboard');
    }

    exportResults() {
        if (this.analysisHistory.length === 0) {
            this.showError('No results to export');
            return;
        }

        capturePostHogEvent('newtab_results_exported', { result_count: this.analysisHistory.length });
        const exportData = {
            timestamp: new Date().toISOString(),
            statistics: this.statistics,
            results: this.analysisHistory
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `deepfake-analysis-${Date.now()}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }

    saveData() {
        chrome.storage.local.set({
            analysisHistory: this.analysisHistory,
            statistics: this.statistics
        });
    }

    loadStoredData() {
        chrome.storage.local.get(
            ['analysisHistory', 'statistics', 'detectionEnabled', 'sensitivity', 'detectionMode', 'modelKey', 'detailLevel', 'anonymousAnalytics'],
            (result) => {
                this.analysisHistory = Array.isArray(result.analysisHistory)
                    ? [...result.analysisHistory].sort(
                        (left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
                    )
                    : [];
                this.statistics = result.statistics ? { ...this.statistics, ...result.statistics } : this.statistics;
                this.settings = {
                    detectionEnabled: Boolean(result.detectionEnabled),
                    sensitivity: typeof result.sensitivity === 'number' ? result.sensitivity : 50,
                    detectionMode: 'manual',
                    modelKey: ['lightweight', 'mesonet', 'ensemble'].includes(result.modelKey) ? result.modelKey : 'ensemble',
                    detailLevel: typeof result.detailLevel === 'number' ? result.detailLevel : 10,
                    anonymousAnalytics: typeof result.anonymousAnalytics === 'boolean' ? result.anonymousAnalytics : false
                };
                setPostHogConsent(this.settings.anonymousAnalytics, { source: 'load' });

                if (this.analysisHistory.length > 0 && !this.applyRequestedAnalysisSelection()) {
                    this.currentAnalysisIndex = 0;
                }
                this.updateStatistics();
                this.renderAll();
            }
        );
    }

    showError(message) {
        this.showToast(message, true);
    }

    showToast(message, isError = false) {
        const toast = document.createElement('div');
        toast.className = 'floating-toast';
        if (isError) {
            toast.classList.add('floating-toast-error');
        }
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatDateTime(timestamp) {
        if (!timestamp) {
            return 'Unknown time';
        }

        const date = new Date(timestamp);
        return date.toLocaleString([], {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    normalisePercent(value) {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return 50;
        }

        return Math.max(0, Math.min(100, Math.round(parsed)));
    }

    getHostname(value) {
        try {
            return new URL(value).hostname;
        } catch {
            return '';
        }
    }

    async openMediaStore() {
        if (this.mediaDbPromise) {
            return this.mediaDbPromise;
        }

        this.mediaDbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(FullAnalysisPlatform.MEDIA_DB_NAME, 1);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(FullAnalysisPlatform.MEDIA_STORE_NAME)) {
                    db.createObjectStore(FullAnalysisPlatform.MEDIA_STORE_NAME, { keyPath: 'id' });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        return this.mediaDbPromise;
    }

    async getMediaPreview(id) {
        if (!id) {
            return null;
        }

        const db = await this.openMediaStore();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(FullAnalysisPlatform.MEDIA_STORE_NAME, 'readonly');
            const store = transaction.objectStore(FullAnalysisPlatform.MEDIA_STORE_NAME);
            const request = store.get(String(id));
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async clearMediaPreviews() {
        const db = await this.openMediaStore();
        await new Promise((resolve, reject) => {
            const transaction = db.transaction(FullAnalysisPlatform.MEDIA_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(FullAnalysisPlatform.MEDIA_STORE_NAME);
            store.clear();
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    }

    readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    async createUploadedMediaPayload(file) {
        if (file.type.startsWith('image/')) {
            const [imageBuffer, imageDataUrl] = await Promise.all([
                this.readFileAsArrayBuffer(file),
                this.readFileAsDataUrl(file)
            ]);
            return {
                mediaKind: 'image-file',
                sourceType: 'upload',
                filename: file.name,
                originalType: file.type,
                mimeType: file.type,
                size: file.size,
                sensitivity: this.settings.sensitivity,
                detailLevel: this.settings.detailLevel,
                imageBytes: new Uint8Array(imageBuffer),
                imageDataUrl
            };
        }

        if (file.type.startsWith('video/')) {
            const imageDataUrl = await this.createVideoPreviewDataUrl(file, 960, 640);
            if (!imageDataUrl) {
                throw new Error('Could not extract a frame from this uploaded video.');
            }

            return {
                mediaKind: 'video-frame',
                sourceType: 'upload',
                filename: file.name,
                originalType: file.type,
                size: file.size,
                sensitivity: this.settings.sensitivity,
                detailLevel: this.settings.detailLevel,
                imageDataUrl
            };
        }

        throw new Error('Unsupported upload type.');
    }

    downscaleImageDataUrl(dataUrl, maxWidth, maxHeight) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                const ratio = Math.min(1, maxWidth / image.width, maxHeight / image.height);
                const width = Math.max(1, Math.round(image.width * ratio));
                const height = Math.max(1, Math.round(image.height * ratio));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext('2d');
                if (!context) {
                    resolve(dataUrl);
                    return;
                }

                context.drawImage(image, 0, 0, width, height);
                resolve(canvas.toDataURL('image/png'));
            };
            image.onerror = () => reject(new Error('Failed to load uploaded image for preview.'));
            image.src = dataUrl;
        });
    }

    createVideoPreviewDataUrl(file, maxWidth, maxHeight) {
        return new Promise((resolve) => {
            const objectUrl = URL.createObjectURL(file);
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;

            const cleanup = () => {
                URL.revokeObjectURL(objectUrl);
                video.remove();
            };

            video.onloadeddata = () => {
                const ratio = Math.min(1, maxWidth / video.videoWidth, maxHeight / video.videoHeight);
                const width = Math.max(1, Math.round(video.videoWidth * ratio));
                const height = Math.max(1, Math.round(video.videoHeight * ratio));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext('2d');
                if (!context) {
                    cleanup();
                    resolve(null);
                    return;
                }

                context.drawImage(video, 0, 0, width, height);
                const preview = canvas.toDataURL('image/png');
                cleanup();
                resolve(preview);
            };

            video.onerror = () => {
                cleanup();
                resolve(null);
            };

            video.src = objectUrl;
        });
    }

    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new FullAnalysisPlatform();
});
