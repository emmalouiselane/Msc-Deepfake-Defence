export const historyPageMarkup = `
    <div class="page" id="history-page" style="display: none;">
        <section class="results-section">
            <div class="section-heading section-heading-spread">
                <div class="history-toolbar">
                    <label class="history-search">
                        <input type="search" id="historySearchInput" placeholder="Hinted search text">
                        <span class="history-search-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg></span>
                    </label>
                    <select class="history-select" id="historySortSelect">
                        <option value="newest">Sort: Newest</option>
                        <option value="highest-risk">Sort: Highest Risk</option>
                        <option value="fastest">Sort: Fastest</option>
                    </select>
                    <select class="history-select" id="historyFilterSelect">
                        <option value="all">Filter: All</option>
                        <option value="high">High Risk</option>
                        <option value="medium">Medium Risk</option>
                        <option value="low">Low Risk</option>
                    </select>
                    <button class="btn btn-secondary" id="exportBtn" type="button">Export Results</button>
                    <button class="btn btn-secondary" id="clearBtn" type="button">Clear All</button>
                </div>
            </div>
            <div class="history-list" id="historyList"></div>
        </section>
    </div>
`;
