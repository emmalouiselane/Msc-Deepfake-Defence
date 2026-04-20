export const mediaAnalysisPageMarkup = `
    <div class="page" id="media-analysis-page" style="display: none;">
        <section class="media-analysis-layout">
            <div class="media-stage">
                <div class="analysis-canvas" id="analysisCanvas">
                    <div class="analysis-placeholder">
                        <div class="placeholder-symbol" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-move-horizontal"><path d="m18 8 4 4-4 4"></path><path d="M2 12h20"></path><path d="m6 16-4-4 4-4"></path></svg></div>
                        <div class="placeholder-title">Select a result to inspect</div>
                        <div class="placeholder-copy">Use Recent Activity, History, Upload, or Re-analyse to populate this panel.</div>
                    </div>
                </div>
                <div class="analysis-controls">
                    <button class="icon-btn" id="prevAnalysisBtn" type="button" aria-label="Previous analysis"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left"><path d="m15 18-6-6 6-6"></path></svg></button>
                    <button class="btn btn-secondary" id="analysisReanalyseBtn" type="button">Re-analyse this media</button>
                    <button class="icon-btn" id="nextAnalysisBtn" type="button" aria-label="Next analysis"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6"></path></svg></button>
                </div>
            </div>
            <aside class="analysis-sidebar">
                <section class="analysis-panel">
                    <h3>Explanation Panel</h3>
                    <div class="analysis-summary" id="analysisSummary">
                        <div class="summary-metric">
                            <span class="summary-label">Result</span>
                            <span class="summary-value" id="analysisResultLabel">No result selected</span>
                        </div>
                        <div class="summary-metric">
                            <span class="summary-label">Model</span>
                            <span class="summary-value" id="analysisModelLabel">Awaiting data</span>
                        </div>
                        <div class="summary-block">
                            <span class="summary-label">Summary</span>
                            <p id="analysisExplanation">Choose a result to view its explanation.</p>
                        </div>
                        <div class="summary-block">
                            <span class="summary-label">Breakdown</span>
                            <ul class="breakdown-list" id="analysisBreakdown">
                                <li>Visual: Awaiting data</li>
                                <li>Temporal: Awaiting data</li>
                                <li>Compression: Awaiting data</li>
                            </ul>
                        </div>
                    </div>
                </section>
                <section class="feedback-panel">
                    <h4>Feedback</h4>
                    <p>Do you agree with this analysis?</p>
                    <div class="feedback-actions">
                        <button class="btn btn-secondary feedback-btn" id="feedbackMaybeBtn" data-feedback-value="maybe" type="button">Maybe</button>
                        <button class="btn btn-secondary feedback-btn" id="feedbackYesBtn" data-feedback-value="yes" type="button">Yes</button>
                        <button class="btn btn-secondary feedback-btn" id="feedbackNoBtn" data-feedback-value="no" type="button">No</button>
                    </div>
                </section>
                <section class="analysis-panel">
                    <h4>Analysis History</h4>
                    <div class="analysis-history-list" id="analysisHistoryList">
                        <div class="analytics-empty-state">No analysis history available for this item yet.</div>
                    </div>
                </section>
            </aside>
        </section>
    </div>
`;
