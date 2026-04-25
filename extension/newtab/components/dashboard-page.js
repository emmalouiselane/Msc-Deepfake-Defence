export class DashboardPage {
    constructor(platform) {
        this.platform = platform;
    }

    render() {
        const recent = this.platform.analysisHistory.slice(0, 12);
        const recentChronological = [...recent].reverse();
        const confidenceTrendSeries = recentChronological.map((item) => this.platform.normalisePercent(item.confidence));
        const confidenceDistributionSeries = this.platform.getConfidenceDistributionSeries(recent);
        this.renderRecentActivity();
        this.platform.renderMiniChart(
            this.platform.flagRateChart,
            confidenceTrendSeries,
            'wave',
            {
                emptyMessage: 'No analysis history yet.',
                valueLabelPrefix: 'Confidence',
                segmentLabels: recentChronological.map((item) => this.platform.formatTime(item.timestamp)),
                segmentClasses: recentChronological.map((item) => {
                    const confidence = Number(item.confidence) || 0;
                    if (confidence < 50) {
                        return 'confidence-low';
                    }

                    if (confidence < 75) {
                        return 'confidence-medium';
                    }

                    return 'confidence-high';
                })
            }
        );
        this.platform.renderMiniChart(
            this.platform.confidenceChart,
            confidenceDistributionSeries.length > 0
                ? confidenceDistributionSeries
                : recent.map((item) => this.platform.normalisePercent(item.confidence)),
            'bars',
            {
                emptyMessage: 'No analysis history yet.',
                segmentLabels: ['Low confidence', 'Medium confidence', 'High confidence'],
                valueLabelPrefix: 'Confidence share'
            }
        );
        this.renderChartInsights(recent, confidenceTrendSeries, confidenceDistributionSeries);
        this.renderRiskBreakdown();
    }

    renderChartInsights(recentItems, confidenceTrendSeries, confidenceDistributionSeries) {
        if (this.platform.flagRateLegend) {
            this.platform.flagRateLegend.innerHTML = '';
        }

        if (this.platform.flagRateInsight) {
            if (!recentItems.length || !confidenceTrendSeries.length) {
                this.platform.flagRateInsight.textContent = 'No analysis history yet.';
            } else {
                const averageConfidence = Math.round(
                    recentItems.reduce((sum, item) => sum + (Number(item.confidence) || 0), 0) / recentItems.length
                );
                const latestConfidence = confidenceTrendSeries[confidenceTrendSeries.length - 1] || 0;
                this.platform.flagRateInsight.textContent = `Recent analyses averaged ${averageConfidence}% confidence (${latestConfidence}% latest).`;
                if (this.platform.flagRateLegend) {
                    this.platform.flagRateLegend.innerHTML = `
                        <span class="chart-key"><strong>${recentItems.length}</strong> samples</span>
                        <span class="chart-key"><strong>${latestConfidence}%</strong> latest</span>
                    `;
                }
            }
        }

        if (this.platform.confidenceLegend) {
            this.platform.confidenceLegend.innerHTML = '';
        }

        if (this.platform.confidenceInsight) {
            if (!recentItems.length || !confidenceDistributionSeries.length) {
                this.platform.confidenceInsight.textContent = 'No analysis history yet.';
            } else {
                const [low, medium, high] = confidenceDistributionSeries;
                const dominantBand = high >= medium && high >= low
                    ? 'High'
                    : (medium >= low ? 'Medium' : 'Low');
                this.platform.confidenceInsight.textContent = `Most recent analyses skew ${dominantBand.toLowerCase()} confidence.`;
                if (this.platform.confidenceLegend) {
                    this.platform.confidenceLegend.innerHTML = `
                        <span class="chart-key"><strong>${low}%</strong> low</span>
                        <span class="chart-key"><strong>${medium}%</strong> medium</span>
                        <span class="chart-key"><strong>${high}%</strong> high</span>
                    `;
                }
            }
        }
    }

    renderRecentActivity() {
        if (!this.platform.recentActivityGrid) {
            return;
        }

        this.platform.recentActivityGrid.innerHTML = '';

        const recent = this.platform.analysisHistory.slice(0, 4);
        if (recent.length === 0) {
            this.platform.recentActivityGrid.innerHTML = '<div class="empty-state-card">No recent activity yet. Upload media to start populating the dashboard.</div>';
            return;
        }

        recent.forEach((result) => {
            const riskLevel = this.platform.getResultRiskLevel(result);
            const sourceContext = this.platform.getSourceContext(result);
            const modelLabel = result.technicalDetails?.model || 'Unknown model';
            const card = document.createElement('article');
            card.className = `activity-card activity-${riskLevel.class}`;
            card.innerHTML = `
                <div class="activity-meta">${this.platform.formatDateTime(result.timestamp)}</div>
                <div class="activity-score">${Math.round(result.riskScore)}% ${riskLevel.label}</div>
                <div class="activity-source">${sourceContext.value}</div>
                <div class="activity-model">Model: ${modelLabel}</div>
                ${this.platform.getConfidenceGraphMarkup(result.confidence, { compact: true })}
                <div class="activity-actions">
                    <button class="activity-link" type="button">More Info</button>
                </div>
            `;
            card.querySelector('.activity-link').addEventListener('click', () => this.platform.viewAnalysisById(result.id));
            this.platform.recentActivityGrid.appendChild(card);
        });

        const cta = document.createElement('button');
        cta.type = 'button';
        cta.className = 'recent-cta';
        cta.textContent = 'View more recent analysis...';
        cta.addEventListener('click', () => this.platform.navigateToPage('history'));
        this.platform.recentActivityGrid.appendChild(cta);
    }

    renderRiskBreakdown() {
        if (!this.platform.riskBreakdown) {
            return;
        }

        const total = Math.max(this.platform.analysisHistory.length, 1);
        const mediumCount = this.platform.getMediumRiskCount(this.platform.analysisHistory);
        const breakdown = [
            { label: 'Low', value: Math.round((this.platform.statistics.lowRiskCount / total) * 100), className: 'low' },
            { label: 'Medium', value: Math.round((mediumCount / total) * 100), className: 'medium' },
            { label: 'High', value: Math.round((this.platform.statistics.highRiskCount / total) * 100), className: 'high' }
        ];

        this.platform.riskBreakdown.innerHTML = '';
        breakdown.forEach((item) => {
            const pill = document.createElement('div');
            pill.className = `risk-pill risk-pill-${item.className}`;
            pill.innerHTML = `<span>${item.value}%</span><span>${item.label}</span>`;
            this.platform.riskBreakdown.appendChild(pill);
        });
    }
}
