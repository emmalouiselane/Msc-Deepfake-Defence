export const uploadPageMarkup = `
    <div class="page" id="upload-page" style="display: none;">
        <section class="upload-section">
            <div class="upload-container">
                <div class="upload-area-large" id="uploadAreaLarge">
                    <div class="upload-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-folder-up">
                            <path d="m12 10 3-3 3 3"></path>
                            <path d="M15 13V7"></path>
                            <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.93l-.81-1.14A2 2 0 0 0 7.91 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path>
                        </svg>
                    </div>
                    <h2>Upload media for analysis</h2>
                    <p>Drag and drop images or videos here, or click to browse.</p>
                    <p class="upload-subtext">Supports JPG, PNG, GIF, MP4, and WebM up to 50MB.</p>
                    <input type="file" id="fileInputLarge" accept="image/*,video/*" multiple hidden>
                </div>
            </div>
        </section>
    </div>
`;
