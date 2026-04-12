export class SettingsPage {
    constructor(platform) {
        this.platform = platform;
    }

    render() {
        this.platform.applySettingsToControls();
    }
}
