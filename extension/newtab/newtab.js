// Deepfake Detection Extension - New Tab Script
class FullAnalysisPlatform {
    constructor() {
        this.initializeElements();
        this.attachEventListeners();
        this.analysisHistory = [];
        this.statistics = {
            totalAnalyzed: 0,
            highRiskCount: 0,
            lowRiskCount: 0,
            avgProcessingTime: 0
        };
        this.currentPage = 'dashboard';
        this.loadStoredData();
        this.initializeNavigation();
    }

    initializeElements() {
        // Navigation elements
        this.navItems = document.querySelectorAll('.nav-item');
        this.pageTitle = document.getElementById('pageTitle');
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        
        // Page elements
        this.pages = document.querySelectorAll('.page');
        
        // Upload elements
        this.uploadAreaLarge = document.getElementById('uploadAreaLarge');
        this.fileInputLarge = document.getElementById('fileInputLarge');
        this.batchFileInput = document.getElementById('batchFileInput');
        this.resultsSection = document.getElementById('resultsSection');
        this.resultsGrid = document.getElementById('resultsGrid');
        this.uploadSection = document.getElementById('uploadSection');
        
        // Statistics elements
        this.totalAnalyzed = document.getElementById('totalAnalyzed');
        this.highRiskCount = document.getElementById('highRiskCount');
        this.lowRiskCount = document.getElementById('lowRiskCount');
        this.avgProcessingTime = document.getElementById('avgProcessingTime');
        
        // Buttons
        //this.uploadBtn = document.getElementById('uploadBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.clearBtn = document.getElementById('clearBtn');
    }

    attachEventListeners() {
        // Navigation events
        this.navItems.forEach(item => {
            item.addEventListener('click', () => this.handleNavigation(item));
        });
        
        // Upload events
        this.uploadAreaLarge.addEventListener('click', () => this.fileInputLarge.click());
        this.uploadAreaLarge.addEventListener('dragover', this.handleDragOver.bind(this));
        this.uploadAreaLarge.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.uploadAreaLarge.addEventListener('drop', this.handleDrop.bind(this));
        this.fileInputLarge.addEventListener('change', this.handleFileSelect.bind(this));
        
        // Button events
        //this.uploadBtn.addEventListener('click', () => this.navigateToPage('media-analysis'));
        this.exportBtn.addEventListener('click', this.exportResults.bind(this));
        this.clearBtn.addEventListener('click', this.clearResults.bind(this));
    }

    initializeNavigation() {
        // Set initial page
        this.showPage('dashboard');
    }

    handleNavigation(navItem) {
        const page = navItem.dataset.page;
        this.navigateToPage(page);
    }

    navigateToPage(page) {
        // Update active nav item
        this.navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });

        // Show corresponding page
        this.showPage(page);
    }

    showPage(pageName) {
        // Hide all pages
        this.pages.forEach(page => {
            page.style.display = 'none';
        });

        // Show selected page
        const targetPage = document.getElementById(`${pageName}-page`);
        if (targetPage) {
            targetPage.style.display = 'block';
        }

        // Update header
        this.updatePageHeader(pageName);
        this.currentPage = pageName;
    }

    updatePageHeader(pageName) {
        const pageHeaders = {
            dashboard: {
                title: 'Dashboard',
                subtitle: 'Advanced Media Analysis Platform'
            },
            'media-analysis': {
                title: 'Media Analysis',
                subtitle: 'Analyze images and videos for deepfake detection'
            },
            history: {
                title: 'Analysis History',
                subtitle: 'View detailed analysis outcomes'
            },
            analytics: {
                title: 'Analytics',
                subtitle: 'Detailed performance metrics and insights'
            },
            upload: {
                title: 'Upload Media',
                subtitle: 'Upload new files for deepfake analysis'
            },
            reanalyse: {
                title: 'Re-analyse',
                subtitle: 'Re-process previously analyzed media'
            }
        };

        const header = pageHeaders[pageName];
        if (header) {
            this.pageTitle.textContent = header.title;
        }
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

    showError(message) {
        // Create Chrome-style error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-toast';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ea4335;
            color: white;
            padding: 16px 24px;
            border-radius: 4px;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(234,67,53,0.3);
            font-family: 'Google Sans', Roboto, Arial, sans-serif;
            font-weight: 500;
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 4000);
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadAreaLarge.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadAreaLarge.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadAreaLarge.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        this.processMultipleFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processMultipleFiles(files);
    }

    async processMultipleFiles(files) {
        const validFiles = files.filter(file => 
            file.type.startsWith('image/') || file.type.startsWith('video/')
        );

        if (validFiles.length === 0) {
            this.showError('Please select valid image or video files');
            return;
        }

        // Update status to processing
        this.updateStatus('processing', 'Processing files...');

        // Process each file
        for (const file of validFiles) {
            await this.analyzeFile(file);
        }

        // Navigate to history page
        this.navigateToPage('history');
        
        // Update statistics
        this.updateStatistics();
        this.saveData();
        
        // Update status back to ready
        this.updateStatus('', 'Ready');
    }

    async analyzeFile(file) {
        const startTime = Date.now();
        
        try {
            // Simulate analysis
            const result = await this.runAnalysis(file);
            const processingTime = Date.now() - startTime;
            
            // Add to history
            const analysisResult = {
                id: Date.now() + Math.random(),
                filename: file.name,
                size: file.size,
                type: file.type,
                ...result,
                processingTime,
                timestamp: new Date().toISOString()
            };

            this.analysisHistory.push(analysisResult);
            this.addResultCard(analysisResult);
            
        } catch (error) {
            console.error('Analysis error:', error);
            this.showError(`Failed to analyze ${file.name}`);
        }
    }

    async runAnalysis(file) {
        // Simulate processing time based on file size
        const processingDelay = Math.min(3000, Math.max(1000, file.size / 10000));
        await this.delay(processingDelay);

        // Mock analysis results
        const riskScore = Math.random() * 100;
        const confidence = 70 + Math.random() * 25;

        return {
            riskScore,
            confidence,
            explanation: this.generateExplanation(riskScore),
            technicalDetails: {
                model: 'MesoNet v2.11',
                parameters: '28,009',
                inferenceTime: `${Math.floor(100 + Math.random() * 200)}ms`
            }
        };
    }

    generateExplanation(riskScore) {
        const explanations = {
            low: [
                "No significant artifacts detected. Media appears to be authentic.",
                "Facial features and background show natural patterns consistent with genuine content.",
                "Analysis indicates low probability of synthetic manipulation."
            ],
            medium: [
                "Some inconsistencies detected in facial regions or background elements.",
                "Minor artifacts suggest possible digital manipulation or compression issues.",
                "Mixed indicators - further analysis recommended for definitive assessment."
            ],
            high: [
                "Strong evidence of synthetic generation detected in multiple regions.",
                "Significant artifacts and inconsistencies characteristic of deepfake content.",
                "High probability of AI-generated or heavily manipulated media."
            ]
        };

        let category = 'low';
        if (riskScore >= 66) category = 'high';
        else if (riskScore >= 33) category = 'medium';

        const categoryExplanations = explanations[category];
        return categoryExplanations[Math.floor(Math.random() * categoryExplanations.length)];
    }

    addResultCard(result) {
        const riskLevel = this.getRiskLevel(result.riskScore);
        
        const card = document.createElement('div');
        card.className = `result-card ${riskLevel.class}-risk`;

        const header = `
            <div class="result-header">
                <div class="result-filename">${result.filename ?? 'Scanned from the internet'}</div>
                <div class="result-risk risk-${riskLevel.class}">${riskLevel.label}</div>
            </div>
        `;
        const details_StartWrapper = `<div class="result-details">`;
        const details_RiskScore = `
            <div class="detail-item">
                <span class="detail-label">Risk Score:</span>
                <span class="detail-value">${result.riskScore.toFixed(1)}%</span>
            </div>
        `;
        const details_Confidence = `
            <div class="detail-item">
                <span class="detail-label">Confidence:</span>
                <span class="detail-value">${result.confidence.toFixed(1)}%</span>
            </div>
        `;
        const details_ProcessingTime = `
            <div class="detail-item">
                <span class="detail-label">Processing Time:</span>
                <span class="detail-value">${result.processingTime}ms</span>
            </div>
        `;
        const details_FileSize = `
            <div class="detail-item">
                <span class="detail-label">File Size:</span>
                <span class="detail-value">${this.formatFileSize(result.size)}</span>
            </div>
        `;
        const details_Analysis = `
            <div class="detail-item">
                <span class="detail-label">Analysis:</span>
                <span class="detail-value">${result.explanation}</span>
            </div>
        `;
        const details_EndWrapper = `</div>`;

        card.innerHTML = header;
        card.innerHTML += details_StartWrapper;
        card.innerHTML += details_RiskScore;
        card.innerHTML += details_Confidence;
        card.innerHTML += details_ProcessingTime;
        if (result.size) {
            card.innerHTML += details_FileSize;
        }
        card.innerHTML += details_Analysis;
        card.innerHTML += details_EndWrapper;


        this.resultsGrid.appendChild(card);
    }

    getRiskLevel(score) {
        if (score < 33) {
            return { label: 'Low Risk', class: 'low' };
        } else if (score < 66) {
            return { label: 'Medium Risk', class: 'medium' };
        } else {
            return { label: 'High Risk', class: 'high' };
        }
    }

    updateStatistics() {
        this.statistics.totalAnalyzed = this.analysisHistory.length;
        this.statistics.highRiskCount = this.analysisHistory.filter(r => r.riskScore >= 66).length;
        this.statistics.lowRiskCount = this.analysisHistory.filter(r => r.riskScore < 33).length;
        
        if (this.analysisHistory.length > 0) {
            const totalTime = this.analysisHistory.reduce((sum, r) => sum + r.processingTime, 0);
            this.statistics.avgProcessingTime = Math.round(totalTime / this.analysisHistory.length);
        }

        // Update UI
        this.totalAnalyzed.textContent = this.statistics.totalAnalyzed;
        this.highRiskCount.textContent = this.statistics.highRiskCount;
        this.lowRiskCount.textContent = this.statistics.lowRiskCount;
        this.avgProcessingTime.textContent = `${this.statistics.avgProcessingTime}ms`;
    }

    clearResults() {
        if (confirm('Are you sure you want to clear all analysis results?')) {
            this.analysisHistory = [];
            this.resultsGrid.innerHTML = '';
            this.statistics = {
                totalAnalyzed: 0,
                highRiskCount: 0,
                lowRiskCount: 0,
                avgProcessingTime: 0
            };
            this.updateStatistics();
            this.saveData();
            
            // Navigate back to dashboard
            this.navigateToPage('dashboard');
        }
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
        const a = document.createElement('a');
        a.href = url;
        a.download = `deepfake-analysis-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    saveData() {
        chrome.storage.local.set({
            analysisHistory: this.analysisHistory,
            statistics: this.statistics
        });
    }

    loadStoredData() {
        chrome.storage.local.get(['analysisHistory', 'statistics'], (result) => {
            if (result.analysisHistory) {
                this.analysisHistory = result.analysisHistory;
                this.analysisHistory.forEach(result => this.addResultCard(result));
            }
            
            if (result.statistics) {
                this.statistics = result.statistics;
                this.updateStatistics();
            }
            
            // If there are results, show them in the results grid
            if (this.analysisHistory.length > 0) {
                this.resultsGrid.style.display = 'grid';
            }
        });
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-toast';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 4000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the platform when new tab is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FullAnalysisPlatform();
});
