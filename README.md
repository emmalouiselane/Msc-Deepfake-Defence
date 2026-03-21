# Deepfake Detection Browser Extension

> **⚠️ MSc Dissertation Project**: This work is part of an academic dissertation and should not be used without explicit permission from the author.

A user-centred deepfake detection prototype that combines machine learning models with an intuitive interface to help users evaluate the authenticity of digital media.

## Overview

The abundance of generative AI in recent years has enabled the creation of highly realistic synthetic media, also known as deepfakes. While these technologies offer opportunities in entertainment and education, they pose significant risks around misinformation, identity impersonation, and the erosion of public trust. This project addresses the growing need for tools that help users evaluate content credibility.

## Project Objective

To design, develop, and evaluate a user-centred deepfake detection prototype that combines machine learning models for detecting synthetic media with an appropriate user interface designed to enhance user comprehension of detection results.

By integrating detailed explanatory feedback alongside probabilistic authenticity scores, the prototype provides users with both objective analysis and contextual understanding, enabling informed judgement rather than blind reliance on automated outputs.

## Research Methodology

This project adopts a **practice-based research methodology**, where knowledge is generated through iterative cycles of design, implementation, and evaluation. The functional prototype serves as both a technical tool and a research instrument, allowing technical development and empirical investigation to inform each other.

## Architecture

The system is built as a Chromium browser extension with the following key components:

- **Client-Side Detection Engine**: TensorFlow.js runtime for deepfake detection
- **User Interface**: Intuitive media upload and result display
- **Explanatory Feedback**: Detailed explanations of detection results
- **Data Management**: Local storage and export capabilities
- **Security Framework**: Privacy-first design with no cloud dependencies

## Key Features

- **Media Upload**: Drag-and-drop interface for images and videos
- **Real-Time Detection**: Client-side processing with TensorFlow.js
- **Probabilistic Scoring**: Authenticity scores with confidence levels
- **Explanatory Feedback**: Detailed explanations of detection results
- **Privacy-First**: All processing occurs locally in the browser
- **Research Tools**: Automated logging and data export for evaluation

## Technical Stack

- **Browser Extension**: Chrome Manifest v3
- **Machine Learning**: TensorFlow.js with WebGL acceleration
- **Frontend**: HTML5, CSS3, JavaScript
- **Storage**: Chrome storage API with encryption
- **Security**: Content Security Policy (CSP) and minimal permissions

## Documentation

- [System Design](docs/system-design.md) - Detailed architecture and component design
- [Requirements](docs/requirements.md) - Functional and non-functional requirements
- [User Guide]() - Installation and usage instructions - To be added
- [API Documentation]() - Technical API reference - To be added

## Getting Started

### Prerequisites

- Chromium-based browser (Chrome, Edge, Opera)
- WebGL support for GPU acceleration
- JavaScript enabled

### Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the extension directory
5. The extension icon will appear in your browser toolbar

### Usage

1. Click the extension icon to open the interface
2. Upload an image or video using drag-and-drop
3. Wait for the detection process to complete
4. Review the authenticity score and explanatory feedback
5. Export results if needed for research purposes

## Research Evaluation

The prototype includes built-in research tools for:

- **User Interaction Logging**: Timestamped, anonymized interaction data
- **Performance Metrics**: Detection accuracy and processing time
- **User Studies**: A/B testing of different explanation formats
- **Data Export**: CSV/JSON export for statistical analysis

## Security & Privacy

- **Client-Side Processing**: No data leaves the user's browser
- **Anonymized Logging**: No personal identifiers in collected data
- **Secure Storage**: Encrypted local storage for interaction logs
- **Minimal Permissions**: Only requests necessary browser permissions
- **Content Security Policy**: Strict CSP prevents XSS attacks

## Browser Compatibility

- Chrome (latest versions)
- Microsoft Edge (Chromium-based)
- Opera (Chromium-based)
- Requires WebGL support for optimal performance

## Performance Targets

- **Model Size**: <128MB (Chrome extension limit)
- **Inference Time**: <3 seconds per media file
- **Memory Usage**: Efficient model lifecycle management
- **Accuracy**: Optimized for real-world media detection

## Contributing

This project is part of academic research. For research collaboration or technical contributions, please refer to the research protocols and documentation.

## License

This project is developed for academic research purposes. Usage should comply with research ethics guidelines and institutional policies.

## Research Impact

This prototype contributes to:
- **Digital Literacy**: Tools for evaluating media authenticity
- **Misinformation Mitigation**: User empowerment against fake content
- **Human-AI Interaction**: Research on explainable AI systems
- **Privacy-Preserving ML**: Client-side machine learning approaches
