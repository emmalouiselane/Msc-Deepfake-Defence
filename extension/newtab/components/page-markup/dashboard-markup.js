export const dashboardPageMarkup = `
    <div class="page" id="dashboard-page">
        <section class="stats-grid">
            <article class="stat-card">
                <div class="stat-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chart-bar"><path d="M3 3v18h18"></path><path d="M7 13v4"></path><path d="M12 9v8"></path><path d="M17 6v11"></path></svg></div>
                <div class="stat-content">
                    <div class="stat-value" id="totalAnalyzed">0</div>
                    <div class="stat-label">Analysed</div>
                </div>
            </article>
            <article class="stat-card">
                <div class="stat-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-flag"><path d="M4 22V4"></path><path d="M4 4h11l-1 4 1 4H4"></path></svg></div>
                <div class="stat-content">
                    <div class="stat-value" id="highRiskCount">0</div>
                    <div class="stat-label">Flagged</div>
                </div>
            </article>
            <article class="stat-card">
                <div class="stat-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-target"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="4"></circle><circle cx="12" cy="12" r="1"></circle></svg></div>
                <div class="stat-content">
                    <div class="stat-value" id="avgRiskScore">0%</div>
                    <div class="stat-label">Average Score</div>
                </div>
            </article>
            <article class="stat-card">
                <div class="stat-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock-3"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2 2"></path><path d="M12 5V3"></path></svg></div>
                <div class="stat-content">
                    <div class="stat-value" id="avgProcessingTime">0ms</div>
                    <div class="stat-label">Average Speed</div>
                </div>
            </article>
        </section>

        <section class="dashboard-section">
            <div class="section-heading">
                <h3>Recent Activity</h3>
            </div>
            <div class="recent-activity-grid" id="recentActivityGrid"></div>
        </section>

        <section class="dashboard-section">
            <div class="section-heading">
                <h3>Quick Insights</h3>
            </div>
            <div class="insight-grid">
                <article class="insight-card">
                    <div class="insight-card-title">Flag Rate</div>
                    <div class="mini-chart mini-chart-wave" id="flagRateChart"></div>
                    <div class="chart-legend" id="flagRateLegend"></div>
                    <div class="chart-insight" id="flagRateInsight">No analysis history yet.</div>
                    <p>Running percentage of flagged items across recent analyses.</p>
                </article>
                <article class="insight-card">
                    <div class="insight-card-title">Confidence Distribution</div>
                    <div class="mini-chart mini-chart-bars" id="confidenceChart"></div>
                    <div class="chart-legend" id="confidenceLegend"></div>
                    <div class="chart-insight" id="confidenceInsight">No analysis history yet.</div>
                    <p>Share of recent analyses in each confidence band.</p>
                </article>
                <article class="insight-card">
                    <div class="insight-card-title">Risk Breakdown</div>
                    <div class="risk-pill-row" id="riskBreakdown"></div>
                    <div class="chart-legend">
                        <span class="chart-key"><strong>All time</strong></span>
                    </div>
                    <p>Low, medium, and high risk snapshots.</p>
                </article>
            </div>
        </section>
    </div>
`;
