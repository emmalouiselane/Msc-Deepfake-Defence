# Requirements Document

**Document Version**: 1.1.1 | **Last Updated**: 2026-03-21 | **Status**:  First Iteration Complete

## Functional Requirements

The functional requirements for this project define the core capabilities that the prototype must provide:

- **Media Upload**: The system must allow users to upload images and videos through a web-based interface
- **Deepfake Detection**: The system must process uploaded media using a deepfake detection model and generate an authenticity score
- **Explanatory Feedback**: The system must provide informative guidance, highlighting details that influence the result to support user comprehension
- **Data Export**: The system must allow export of logged data in formats suitable for statistical analysis
- **Interaction Logging**: The project must record all analyses with timestamps and anonymised identifiers to support evaluation
- **Complete Analysis Cycle**: The system must allow users to complete a full analysis cycle independently, from media upload to review of results

## Non-Functional Requirements

The non-functional requirements must ensure the system is practical and accessible for user testing:

- **Intuitive Interface**: The system's interface must be intuitive, allowing non-experts to navigate and interpret results without technical guidance
- **System Reliability**: The system must operate consistently to prevent technical failures from affecting research outcomes
- **Accessibility**: The system interface must meet basic accessibility standards (up to WCAG level A), including readable text, contrast, and support for users with limited digital experience
- **Data Privacy**: The project must ensure that participant data is anonymised and securely stored, with access restricted to the individual performing the research
- **Performance**: The system's media analysis should be completed within a reasonable timeframe (e.g., less than 10 seconds per sample) to maintain user confidence

## User-Centred Design Considerations

### User Stories

Participant user stories have been developed to reflect research and evaluation priorities:

- **As a participant**, I want to upload media easily so I can evaluate its authenticity without technical difficulty
- **As a participant**, I want an explanation of the detection score so I understand why the system flagged media as authentic or synthetic
- **As a researcher**, I want automated logging of interactions so I can analyse user comprehension and trust

### PACT Analysis

A PACT analysis has been conducted to ensure realistic interaction design:

- **People**: Adult participants with varying technical expertise and backgrounds
- **Activities**: Ability to upload media, review results, interpret scores, and provide feedback
- **Context**: Online/Remote environment under controlled conditions
- **Technologies**: Chromium-based prototype with integrated deepfake detection model

## Technical Requirements

### Browser Extension Architecture
- **Manifest v3** compliance for Chrome extension
- **TensorFlow.js** runtime for client-side ML inference
- **Service Worker** for background processing
- **Content Scripts** for page integration
- **Popup UI** for quick access interface

### Model & Performance Requirements
- **Model Architecture**: Lightweight CNN (MesoNet-inspired) for on-device deployment
- **Model Size**: Must fit within Chrome extension limits (~128MB unpacked)
- **Inference Time**: Target < 3 seconds per media file (CPU-based) for optimal user experience
- **Memory Management**: Efficient model loading and unloading
- **WebAssembly Support**: CPU/WebAssembly execution (no GPU dependency) for broad device compatibility
- **Fallback Handling**: Graceful degradation when TensorFlow.js fails
- **Model Optimisation**: Quantisation and pruning for efficiency
- **Frame Sampling**: Video processing with selective frame analysis

### Security & Privacy Requirements
- **Content Security Policy (CSP)**: Strict CSP to prevent XSS attacks
- **Minimal Permissions**: Request only necessary browser permissions
- **Model Integrity**: Hash verification for loaded models
- **Data Sanitization**: Input validation and sanitization
- **Secure Storage**: Encrypted local storage using chrome.storage.local
- **No Remote Code**: All processing contained within extension

### Data Management Requirements
- **Local Storage**: Anonymized interaction logs stored locally
- **Export Formats**: CSV and JSON export capabilities
- **Timestamp Logging**: All interactions recorded with timestamps
- **User Anonymization**: No personal identifiers in logged data
- **Research Data**: Structured format for statistical analysis

### User Interface Requirements
- **Drag-and-Drop**: Intuitive file upload interface
- **Progress Indicators**: Visual feedback during processing
- **Risk-Based Results**: Graded confidence levels (low/medium/high) rather than binary
- **Color-Coded Indicators**: Clear visual indicators based on risk levels
- **Explanatory Feedback**: Detailed explanations of detection results
- **Collapsible Sections**: Expandable information for advanced users
- **Accessibility**: WCAG Level A compliance
- **Real-Time Feedback**: Instant display of results after processing

### Browser Compatibility Requirements
- **Chromium-Based**: Primary target for Chrome, Edge, Opera
- **CPU-Based Processing**: No GPU dependency for wider compatibility
- **WebAssembly Support**: Required for efficient model execution
- **Feature Detection**: Graceful fallback for unsupported features
- **Progressive Enhancement**: Core functionality without advanced features

### Testing & Quality Assurance Requirements
- **Unit Tests**: Model inference and utility functions
- **Integration Tests**: Extension component interactions
- **Browser Testing**: Cross-browser compatibility validation
- **Performance Testing**: Inference time and memory usage
- **Security Testing**: CSP and permission validation

### Research & Evaluation Requirements
- **A/B Testing Framework**: Support for different explanation formats
- **User Study Protocols**: IRB-compliant data collection
- **Metrics Collection**: Accuracy, false positive/negative rates
- **Dataset Diversity**: Model performance across demographics
- **Telemetry**: Anonymous usage statistics for improvement

### Deployment & Maintenance Requirements
- **Model Updates**: Over-the-air model versioning capability
- **Documentation**: Complete API and user documentation
- **Version Control**: Proper model versioning and rollback
- **Monitoring**: Performance and error tracking
- **Update Mechanism**: Seamless model and feature updates
