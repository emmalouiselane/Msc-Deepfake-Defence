export class AnalyticsPage {
    constructor(platform) {
        this.platform = platform;
    }

    render() {
        this.platform.renderAnalytics();
    }
}
