export const settingsPageMarkup = `
    <div class="page" id="settings-page" style="display: none;">
        <section class="settings-shell">
            <div class="section-heading">
                <h3>Settings</h3>
            </div>

            <section class="settings-group">
                <h4>Model Settings</h4>
                <div class="row settings-toggle-row">
                    <p id="detectionToggleLabel">Detection disabled</p>
                    <label class="toggle">
                        <input type="checkbox" id="btnToggle" name="btnToggle" aria-label="Detection enabled">
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="row settings-inline-row">
                    <p>Model</p>
                    <select id="modelSelect" class="model-select">
                        <option value="ensemble">Ensemble (Recommended)</option>
                        <option value="lightweight">Lightweight CNN v1</option>
                        <option value="mesonet">MesoNet</option>
                    </select>
                </div>
                <p class="model-help" id="modelHelpText">Ensemble combines MesoNet and LightweightNet for stronger reliability at a small speed cost.</p>
            </section>

            <section class="settings-group">
                <h4>Detection Sensitivity</h4>
                <div class="settings-slider-row">
                    <span>Conservative</span>
                    <div class="custom-slider large-slider" id="customSlider">
                        <div class="custom-slider-track" id="sliderTrack"></div>
                        <div class="custom-slider-thumb" id="sliderThumb"></div>
                        <input type="range" id="sensitivitySlider" name="sensitivitySlider" min="0" max="100" value="50" class="hidden-slider">
                    </div>
                    <span>Strict</span>
                </div>
            </section>

            <section class="settings-group">
                <h4>Detection Mode</h4>
                <div class="mode-toggle">
                    <label class="mode-option">
                        <input type="radio" name="detectionMode" value="manual" id="manualMode" checked>
                        <span class="mode-label">Manual</span>
                    </label>
                    <label class="mode-option">
                        <input type="radio" name="detectionMode" value="automatic" id="automaticMode">
                        <span class="mode-label">Automatic</span>
                    </label>
                </div>
            </section>

            <section class="settings-group">
                <h4>Explanation Detail Level</h4>
                <div class="mode-toggle detail-level-toggle">
                    <label class="mode-option">
                        <input type="radio" name="detailLevelPreset" value="basic" id="detailBasic" checked>
                        <span class="mode-label">Basic</span>
                    </label>
                    <label class="mode-option">
                        <input type="radio" name="detailLevelPreset" value="context" id="detailContext">
                        <span class="mode-label">Additional Context</span>
                    </label>
                    <label class="mode-option">
                        <input type="radio" name="detailLevelPreset" value="full" id="detailFull">
                        <span class="mode-label">Full Detail</span>
                    </label>
                </div>
            </section>

            <section class="settings-group">
                <h4>Privacy Settings</h4>
                <label class="check-row">
                    <input type="checkbox" id="anonymousAnalytics">
                    <span>Allow anonymous analytics (no personal details will be shared)</span>
                </label>
            </section>

            <div class="settings-actions">
                <button class="btn btn-primary" id="saveSettingsBtn" type="button">Save</button>
                <button class="btn btn-secondary" id="resetSettingsBtn" type="button">Cancel</button>
            </div>
        </section>
    </div>
`;
