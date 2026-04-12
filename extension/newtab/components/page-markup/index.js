import { dashboardPageMarkup } from './dashboard-markup.js';
import { mediaAnalysisPageMarkup } from './media-analysis-markup.js';
import { historyPageMarkup } from './history-markup.js';
import { analyticsPageMarkup } from './analytics-markup.js';
import { uploadPageMarkup } from './upload-markup.js';
import { reanalysePageMarkup } from './reanalyse-markup.js';
import { settingsPageMarkup } from './settings-markup.js';

export function getContentAreaMarkup() {
    return [
        dashboardPageMarkup,
        mediaAnalysisPageMarkup,
        historyPageMarkup,
        analyticsPageMarkup,
        uploadPageMarkup,
        reanalysePageMarkup,
        settingsPageMarkup
    ].join('');
}
