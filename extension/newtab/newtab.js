class FullAnalysisPlatform {
    static MEDIA_DB_NAME = 'deepfake-media-store';

    static MEDIA_STORE_NAME = 'analysis-media';

    constructor() {
        this.analysisHistory = [];
        this.filteredHistory = [];
        this.currentAnalysisIndex = 0;
        this.currentPage = 'dashboard';
        this.mediaDbPromise = null;
        this.mediaRenderToken = 0;
        this.statistics = {
            totalAnalyzed: 0,
            highRiskCount: 0,
            lowRiskCount: 0,
            avgProcessingTime: 0,
            avgRiskScore: 0
        };
        this.settings = {
            detectionEnabled: false,
            sensitivity: 50,
            detectionMode: 'manual',
            modelKey: 'lightweight',
            detailLevel: 50,
            anonymousAnalytics: true
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

        this.initializeElements();
        this.attachEventListeners();
        this.loadStoredData();
        this.initializeNavigation();
    }

    initializeElements() {
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

        this.totalAnalyzed = document.getElementById('totalAnalyzed');
        this.highRiskCount = document.getElementById('highRiskCount');
        this.avgRiskScore = document.getElementById('avgRiskScore');
        this.avgProcessingTime = document.getElementById('avgProcessingTime');

        this.recentActivityGrid = document.getElementById('recentActivityGrid');
        this.flagRateChart = document.getElementById('flagRateChart');
        this.confidenceChart = document.getElementById('confidenceChart');
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

        this.analyticsAccuracy = document.getElementById('analyticsAccuracy');
        this.analyticsProcessing = document.getElementById('analyticsProcessing');
        this.trendChart = document.getElementById('trendChart');
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
        this.detailLevelSlider = document.getElementById('detailLevelSlider');
        this.detailSlider = document.getElementById('detailSlider');
        this.detailSliderTrack = document.getElementById('detailSliderTrack');
        this.detailSliderThumb = document.getElementById('detailSliderThumb');
        this.manualMode = document.getElementById('manualMode');
        this.automaticMode = document.getElementById('automaticMode');
        this.modelSelect = document.getElementById('modelSelect');
        this.modelHelpText = document.getElementById('modelHelpText');
        this.anonymousAnalytics = document.getElementById('anonymousAnalytics');
        this.saveSettingsBtn = document.getElementById('saveSettingsBtn');
        this.resetSettingsBtn = document.getElementById('resetSettingsBtn');
    }

    attachEventListeners() {
        this.navItems.forEach((item) => {
            item.addEventListener('click', () => this.handleNavigation(item));
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

        this.customSlider?.addEventListener('click', (event) => this.handleSliderPointer(event, 'sensitivity'));
        this.sensitivitySlider?.addEventListener('input', (event) => this.updateSensitivity(event.target.value));
        this.detailSlider?.addEventListener('click', (event) => this.handleSliderPointer(event, 'detailLevel'));
        this.detailLevelSlider?.addEventListener('input', (event) => this.updateDetailLevel(event.target.value));
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

    initializeNavigation() {
        this.showPage(this.getRequestedPage());
    }

    getRequestedPage() {
        const validPages = new Set(Object.keys(this.pageHeaders));
        const params = new URLSearchParams(window.location.search);
        const hashPage = window.location.hash.replace('#', '').trim();
        const requestedPage = (params.get('page') || hashPage || 'dashboard').trim();

        return validPages.has(requestedPage) ? requestedPage : 'dashboard';
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
        this.renderAll();
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

        this.updateStatus('processing', 'Processing files...');

        for (const file of validFiles) {
            await this.analyzeFile(file);
        }

        this.updateStatistics();
        this.currentAnalysisIndex = 0;
        this.saveData();
        this.updateDetectorAvailabilityStatus();
        this.navigateToPage('history');
    }

    async analyzeFile(file) {
        try {
            const analysisResult = await this.runUploadAnalysis(file);
            this.analysisHistory.unshift(analysisResult);
        } catch (error) {
            console.error('Analysis error:', error);
            this.showError(`Failed to analyze ${file.name}`);
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
            return { label: 'Authentic', class: 'low' };
        }

        if (score < 66) {
            return { label: 'Review', class: 'medium' };
        }

        return { label: 'Synthetic', class: 'high' };
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
                sensitivity: this.settings.sensitivity
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

            this.updateStatistics();
            this.saveData();
            this.renderAll();
            this.navigateToPage('media-analysis');
        } catch (error) {
            console.error('Re-analysis error:', error);
            this.showError(error.message || 'Re-analysis failed.');
        } finally {
            this.updateDetectorAvailabilityStatus();
        }
    }

    updateStatistics() {
        const total = this.analysisHistory.length;
        const totalTime = this.analysisHistory.reduce((sum, result) => sum + (result.processingTime || 0), 0);
        const totalRisk = this.analysisHistory.reduce((sum, result) => sum + (result.riskScore || 0), 0);

        this.statistics.totalAnalyzed = total;
        this.statistics.highRiskCount = this.analysisHistory.filter((result) => result.riskScore >= 66).length;
        this.statistics.lowRiskCount = this.analysisHistory.filter((result) => result.riskScore < 33).length;
        this.statistics.avgProcessingTime = total > 0 ? Math.round(totalTime / total) : 0;
        this.statistics.avgRiskScore = total > 0 ? Math.round(totalRisk / total) : 0;

        this.totalAnalyzed.textContent = String(this.statistics.totalAnalyzed);
        this.highRiskCount.textContent = String(this.statistics.highRiskCount);
        this.avgRiskScore.textContent = `${this.statistics.avgRiskScore}%`;
        this.avgProcessingTime.textContent = `${this.statistics.avgProcessingTime}ms`;
    }

    renderAll() {
        this.renderDashboard();
        this.renderHistory();
        this.renderMediaAnalysis();
        this.renderAnalytics();
        this.renderReanalyse();
        this.applySettingsToControls();
    }

    renderDashboard() {
        this.renderRecentActivity();
        this.renderMiniChart(this.flagRateChart, this.analysisHistory.slice(0, 12).map((item) => item.riskScore || 0), 'wave');
        this.renderMiniChart(this.confidenceChart, this.analysisHistory.slice(0, 12).map((item) => item.confidence || 0), 'bars');
        this.renderRiskBreakdown();
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
            const card = document.createElement('article');
            card.className = `activity-card activity-${riskLevel.class}`;
            card.innerHTML = `
                <div class="activity-score">${Math.round(result.riskScore)}%</div>
                <div class="activity-label">${riskLevel.label}</div>
                ${this.getConfidenceGraphMarkup(result.confidence, { compact: true })}
                <button class="activity-link" type="button">More Info</button>
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

    renderMiniChart(target, values, variant) {
        if (!target) {
            return;
        }

        target.innerHTML = '';
        const data = values.length > 0 ? values : [20, 35, 50, 45, 60, 72];

        data.forEach((value) => {
            const bar = document.createElement('span');
            bar.className = variant === 'wave' ? 'chart-wave-segment' : 'chart-bar-segment';
            bar.style.setProperty('--segment-height', `${Math.max(16, Math.round(value))}%`);
            target.appendChild(bar);
        });
    }

    getConfidenceGraphMarkup(confidence, options = {}) {
        const normalized = this.normalizePercent(confidence);
        const sizeClass = options.compact ? ' confidence-spark-compact' : '';

        return `
            <div class="confidence-spark${sizeClass}" role="img" aria-label="Confidence ${normalized}%">
                <div class="confidence-spark-head">
                    <span>Confidence</span>
                    <strong>${normalized}%</strong>
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
        const search = this.historySearchInput?.value.trim().toLowerCase() || '';
        const filter = this.historyFilterSelect?.value || 'all';
        const sort = this.historySortSelect?.value || 'newest';

        let items = [...this.analysisHistory];

        if (search) {
            items = items.filter((item) =>
                [item.filename, item.source, item.explanation]
                    .filter(Boolean)
                    .some((value) => value.toLowerCase().includes(search))
            );
        }

        if (filter !== 'all') {
            items = items.filter((item) => {
                const riskLevel = this.getRiskLevel(item.riskScore).class;
                return riskLevel === filter;
            });
        }

        items.sort((left, right) => {
            if (sort === 'highest-risk') {
                return right.riskScore - left.riskScore;
            }

            if (sort === 'fastest') {
                return left.processingTime - right.processingTime;
            }

            return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
        });

        return items;
    }

    renderHistory() {
        if (!this.historyList) {
            return;
        }

        const items = this.getFilteredHistory();
        this.filteredHistory = items;
        this.historyList.innerHTML = '';

        if (items.length === 0) {
            this.historyList.innerHTML = '<div class="empty-state-card">No matching history items yet.</div>';
            return;
        }

        items.forEach((result) => {
            const riskLevel = this.getRiskLevel(result.riskScore);
            const sourceContext = this.getSourceContext(result);
            const modelLabel = result.technicalDetails?.model || 'Unknown model';
            const row = document.createElement('article');
            row.className = 'history-row';
            row.innerHTML = `
                <div class="history-row-main">
                    <div class="history-meta">${this.formatDateTime(result.timestamp)}</div>
                    <div class="history-score">${Math.round(result.riskScore)}% ${riskLevel.label}</div>
                    <div class="history-source">${sourceContext.label}: ${sourceContext.value}</div>
                    <div class="history-model">Model: ${modelLabel}</div>
                    ${this.getConfidenceGraphMarkup(result.confidence)}
                </div>
                <button class="history-more" type="button">More Info</button>
            `;
            row.querySelector('.history-more').addEventListener('click', () => this.viewAnalysisById(result.id));
            this.historyList.appendChild(row);
        });
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

        this.analysisHistoryList.innerHTML = runs.map((run, index) => `
            <article class="analysis-history-row">
                <div class="analysis-history-row-top">
                    <span class="analysis-history-badge">${index === 0 ? 'Latest' : `Run ${runs.length - index}`}</span>
                    <span class="analysis-history-time">${this.formatDateTime(run.timestamp)}</span>
                </div>
                <div class="analysis-history-stats">
                    <div class="analysis-history-stats-row">
                        <span>${Math.round(run.riskScore || 0)}% score</span>
                        <span>${Math.round(run.confidence || 0)}% confidence</span>
                        <span>${Number(run.processingTime) || 0}ms</span>
                    </div>
                    <span class="analysis-model">${run.model || 'Unknown model'}</span>
                </div>
            </article>
        `).join('');
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
                        <div class="analysis-score-ring">
                            <span>${Math.round(result.riskScore)}%</span>
                        </div>
                        <div class="analysis-caption">${riskLevel.label} signal with ${Math.round(result.confidence)}% confidence</div>
                    </div>
                </div>
            `;
            return;
        }

        this.analysisCanvas.innerHTML = `
            <div class="analysis-media-card risk-${riskLevel.class}">
                <div class="analysis-file-badge">${result.filename || result.source || 'Media item'}</div>
                <div class="analysis-score-ring">
                    <span>${Math.round(result.riskScore)}%</span>
                </div>
                <div class="analysis-caption">${riskLevel.label} signal with ${Math.round(result.confidence)}% confidence</div>
            </div>
        `;
    }

    renderAnalytics() {
        if (!this.analysisHistory.length) {
            this.analyticsAccuracy.textContent = '0%';
            this.analyticsProcessing.textContent = '0ms';
            this.trendChart.innerHTML = '<div class="analytics-empty-state">No analysis history yet.</div>';
            this.distLow.style.width = '0%';
            this.distMedium.style.width = '0%';
            this.distHigh.style.width = '0%';
            this.feedbackAgree.textContent = '0%';
            this.feedbackDisagree.textContent = '0%';
            this.feedbackUnsure.textContent = '0%';
            return;
        }

        this.analyticsAccuracy.textContent = `${Math.max(0, 100 - this.statistics.avgRiskScore)}%`;
        this.analyticsProcessing.textContent = `${this.statistics.avgProcessingTime}ms`;

        this.renderMiniChart(this.trendChart, this.analysisHistory.slice(0, 18).map((item) => item.riskScore || 0), 'bars');

        const total = Math.max(this.analysisHistory.length, 1);
        const lowConfidence = this.analysisHistory.filter((item) => item.confidence < 75).length;
        const mediumConfidence = this.analysisHistory.filter((item) => item.confidence >= 75 && item.confidence < 85).length;
        const highConfidence = this.analysisHistory.filter((item) => item.confidence >= 85).length;

        this.distLow.style.width = `${Math.round((lowConfidence / total) * 100)}%`;
        this.distMedium.style.width = `${Math.round((mediumConfidence / total) * 100)}%`;
        this.distHigh.style.width = `${Math.round((highConfidence / total) * 100)}%`;
        this.feedbackAgree.textContent = '0%';
        this.feedbackDisagree.textContent = '0%';
        this.feedbackUnsure.textContent = '0%';
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
        this.settings.sensitivity = this.normalizePercent(value);
        this.updateSliderVisual(this.sensitivitySlider, this.sliderTrack, this.sliderThumb, this.settings.sensitivity);
    }

    updateDetailLevel(value) {
        this.settings.detailLevel = this.normalizePercent(value);
        this.updateSliderVisual(this.detailLevelSlider, this.detailSliderTrack, this.detailSliderThumb, this.settings.detailLevel);
    }

    handleSliderPointer(event, sliderType) {
        const slider = sliderType === 'detailLevel' ? this.detailSlider : this.customSlider;
        const input = sliderType === 'detailLevel' ? this.detailLevelSlider : this.sensitivitySlider;
        if (!slider || !input) {
            return;
        }

        const rect = slider.getBoundingClientRect();
        const ratio = (event.clientX - rect.left) / rect.width;
        const nextValue = this.normalizePercent(Math.round(ratio * 100));
        input.value = String(nextValue);

        if (sliderType === 'detailLevel') {
            this.updateDetailLevel(nextValue);
        } else {
            this.updateSensitivity(nextValue);
        }
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
        this.settings.detectionMode = this.automaticMode.checked ? 'automatic' : 'manual';
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
        this.settings.modelKey = value === 'mesonet' ? 'mesonet' : 'lightweight';
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
        this.updateSliderVisual(this.detailLevelSlider, this.detailSliderTrack, this.detailSliderThumb, this.settings.detailLevel);
        this.manualMode.checked = this.settings.detectionMode !== 'automatic';
        this.automaticMode.checked = this.settings.detectionMode === 'automatic';
        this.modelSelect.value = this.settings.modelKey;
        this.anonymousAnalytics.checked = this.settings.anonymousAnalytics;
        this.updateModelSelection(this.settings.modelKey);
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
        this.showToast('Settings saved');
    }

    clearResults() {
        if (!confirm('Are you sure you want to clear all analysis results?')) {
            return;
        }

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
                    detectionMode: result.detectionMode === 'automatic' ? 'automatic' : 'manual',
                    modelKey: result.modelKey === 'mesonet' ? 'mesonet' : 'lightweight',
                    detailLevel: typeof result.detailLevel === 'number' ? result.detailLevel : 50,
                    anonymousAnalytics: Boolean(result.anonymousAnalytics)
                };

                if (this.analysisHistory.length > 0) {
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

    normalizePercent(value) {
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
            return {
                mediaKind: 'image-file',
                sourceType: 'upload',
                filename: file.name,
                originalType: file.type,
                mimeType: file.type,
                size: file.size,
                sensitivity: this.settings.sensitivity,
                imageBytes: await this.readFileAsArrayBuffer(file)
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
