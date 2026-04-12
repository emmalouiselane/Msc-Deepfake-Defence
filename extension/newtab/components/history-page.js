export class HistoryPage {
    constructor(platform) {
        this.platform = platform;
    }

    getFilteredHistory() {
        const search = this.platform.historySearchInput?.value.trim().toLowerCase() || '';
        const filter = this.platform.historyFilterSelect?.value || 'all';
        const sort = this.platform.historySortSelect?.value || 'newest';

        let items = [...this.platform.analysisHistory];

        if (search) {
            items = items.filter((item) =>
                [item.filename, item.source, item.explanation]
                    .filter(Boolean)
                    .some((value) => value.toLowerCase().includes(search))
            );
        }

        if (filter !== 'all') {
            items = items.filter((item) => {
                const riskLevel = this.platform.getRiskLevel(item.riskScore).class;
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

    render() {
        if (!this.platform.historyList) {
            return;
        }

        const items = this.getFilteredHistory();
        this.platform.filteredHistory = items;
        this.platform.historyList.innerHTML = '';

        if (items.length === 0) {
            this.platform.historyList.innerHTML = '<div class="empty-state-card">No matching history items yet.</div>';
            return;
        }

        items.forEach((result) => {
            const riskLevel = this.platform.getRiskLevel(result.riskScore);
            const sourceContext = this.platform.getSourceContext(result);
            const modelLabel = result.technicalDetails?.model || 'Unknown model';
            const processingTime = Number(result.processingTime);
            const speedLabel = Number.isFinite(processingTime) && processingTime >= 0
                ? `${Math.round(processingTime)}ms`
                : 'Unknown';
            const row = document.createElement('article');
            row.className = 'history-row';
            row.innerHTML = `
                <div class="history-row-main">
                    <div class="history-meta">${this.platform.formatDateTime(result.timestamp)}</div>
                    <div class="history-score">${Math.round(result.riskScore)}% ${riskLevel.label}</div>
                    <div class="history-source">${sourceContext.label}: ${sourceContext.value}</div>
                    <div class="history-model">Model: ${modelLabel}</div>
                    <div class="history-model">Speed: ${speedLabel}</div>
                    ${this.platform.getConfidenceGraphMarkup(result.confidence)}
                </div>
                <button class="history-more" type="button">More Info</button>
            `;
            row.querySelector('.history-more').addEventListener('click', () => this.platform.viewAnalysisById(result.id));
            this.platform.historyList.appendChild(row);
        });
    }
}
