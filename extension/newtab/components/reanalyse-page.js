export class ReanalysePage {
    constructor(platform) {
        this.platform = platform;
    }

    render() {
        this.platform.renderReanalyse();
    }
}
