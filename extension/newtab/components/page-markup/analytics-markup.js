export const analyticsPageMarkup = `
    <div class="page" id="analytics-page" style="display: none;">
        <section class="analytics-shell">
            <section class="analytics-section">
                <h4>Performance</h4>
                <div class="analytics-metrics">
                    <div class="metric-line">Average Accuracy: <span id="analyticsAccuracy">0%</span></div>
                    <div class="metric-line">Average Processing Time: <span id="analyticsProcessing">0ms</span></div>
                </div>
            </section>

            <section class="analytics-section">
                <h4>Flag Rate</h4>
                <div class="analytics-metrics">
                    <div class="metric-line">All-time Flag Rate: <span id="analyticsFlagRate">0%</span></div>
                    <div class="metric-line">Flagged Analyses: <span id="analyticsFlaggedCount">0</span></div>
                </div>
            </section>

            <section class="analytics-section">
                <h4>Detection Trends</h4>
                <div class="trend-panel">
                    <span class="trend-label">Flag Rate Over Time</span>
                    <div class="trend-chart" id="trendChart"></div>
                </div>
            </section>

            <section class="analytics-section-grid-2">
                <div>
                    <h4>Confidence Distribution</h4>
                    <div class="distribution-list">
                        <div class="distribution-row">
                            <span>Low</span>
                            <div class="distribution-bar"><div id="distLow"></div></div>
                        </div>
                        <div class="distribution-row">
                            <span>Medium</span>
                            <div class="distribution-bar"><div id="distMedium"></div></div>
                        </div>
                        <div class="distribution-row">
                            <span>High</span>
                            <div class="distribution-bar"><div id="distHigh"></div></div>
                        </div>
                    </div>
                </div>
                <div>
                    <h4>Confidence Trends</h4>
                    <div class="confidence-trend-panel">
                        <div class="trend-chart" id="confidenceTrendChart"></div>
                    </div>                    
                </div>
            </section>

            <section class="analytics-section">
                <h4>Risk Breakdown</h4>
                <div class="risk-pill-row analytics-risk-pill-row" id="analyticsRiskBreakdown"></div>
            </section>

            <section class="analytics-section">
                <h4>Feedback Distribution</h4>
                <div class="feedback-metrics">
                    <div>Agree: <span id="feedbackAgree">0%</span></div>
                    <div>Disagree: <span id="feedbackDisagree">0%</span></div>
                    <div>Unsure: <span id="feedbackUnsure">0%</span></div>
                </div>
            </section>
        </section>
    </div>
`;
