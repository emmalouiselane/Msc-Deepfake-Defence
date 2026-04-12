export class MediaAnalysisPage {
    constructor(platform) {
        this.platform = platform;
    }

    render() {
        this.platform.renderMediaAnalysis();
    }
}
