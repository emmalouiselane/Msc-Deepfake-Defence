# Deepfake Detection Browser Extension

> **Warning**: This work is part of an academic dissertation and should not be used without explicit permission from the author.

**Document Version**: 1.1.2 | **Last Updated**: 2026-04-02 | **Status**: Updated for ONNX Runtime Web

## Overview

The rise of generative AI has made it possible to create highly realistic synthetic media, commonly known as deepfakes. While these technologies offer opportunities in entertainment and education, they pose significant risks around misinformation, identity impersonation, and erosion of public trust. This project addresses the growing need for tools that help users evaluate content credibility.

## Project Objective

To design, develop, and evaluate a user-centered deepfake detection prototype that combines machine learning models for detecting synthetic media with an appropriate user interface designed to enhance user comprehension of detection results.

By integrating detailed explanatory feedback alongside probabilistic authenticity scores, the prototype provides users with both objective analysis and contextual understanding, enabling informed judgment rather than blind reliance on automated outputs.

## Research Methodology

This project adopts a practice-based research methodology, where knowledge is generated through iterative cycles of design, implementation, and evaluation. The functional prototype serves as both a technical tool and a research instrument, allowing technical development and empirical investigation to inform each other.

## Architecture

The system is built as a Chromium browser extension with a fully on-device architecture:

- **Lightweight CNN Model**: MesoNet-inspired architecture for efficient on-device inference
- **CPU-Based Processing**: WebAssembly execution for broad compatibility (no GPU dependency)
- **Privacy-First Design**: All processing occurs locally in the browser
- **Risk-Based Scoring**: Graded confidence levels rather than binary classifications
- **Optimised Pipeline**: Frame sampling for videos, quantisation for efficiency

## Key Features

- **Media Upload**: Simple drag-and-drop interface for images and videos
- **On-Device Detection**: Lightweight CNN processing using ONNX Runtime Web
- **Risk-Based Scoring**: Displays confidence levels (low/medium/high risk) instead of binary fake/real
- **Explanatory Feedback**: Provides detailed explanations of detection results
- **Privacy-First**: All processing occurs locally in the browser, no data leaves the device
- **Research Tools**: Includes automated logging and data export for evaluation
- **CPU Optimized**: Designed for broad device compatibility using WebAssembly

## Technical Stack

- **Browser Extension**: Chrome Manifest v3
- **Machine Learning**: PyTorch 2.11 with ONNX export for browser deployment
- **Model Architecture**: Lightweight CNN (MesoNet-inspired) - 2,377 parameters
- **Frontend**: HTML5, CSS3, JavaScript
- **Storage**: Chrome storage API with encryption
- **Security**: Content Security Policy (CSP) and minimal permissions
- **Runtime**: ONNX Runtime Web for client-side inference

## Framework Choice: PyTorch vs TensorFlow

**PyTorch was selected over TensorFlow for the following reasons:**

### Python 3.14 Compatibility
- **PyTorch**: Full support for Python 3.14 with latest optimizations
- **TensorFlow**: No support for Python 3.14 (limited to Python 3.11)

### Modern Development Features
- **PyTorch 2.11**: Latest version with improved performance and ONNX export
- **TensorFlow 2.13**: Older version with limited future updates

### Browser Deployment
- **PyTorch**: Seamless ONNX export for web deployment
- **TensorFlow**: Requires complex conversion process for browser compatibility

### Performance Benefits
- **PyTorch**: Faster training times and better memory efficiency
- **TensorFlow**: Heavier framework with slower inference on newer hardware

This project uses PyTorch exclusively for all model development and training, ensuring compatibility with modern Python versions and optimal browser deployment through ONNX Runtime Web.

## Documentation

- [Document Versions](docs/document-versions.md) - Track all document versions and changes
- [System Design](docs/system-design.md) - Detailed architecture and component design
- [Model Selection](docs/model-selection.md) - Research methodology and model evaluation
- [Requirements](docs/requirements.md) - Functional and non-functional requirements
- [Dataset Structure](DATA_STRUCTURE.md) - Dataset organization and access guide
- [User Guide]() - Installation and usage instructions - To be added
- [Developer Guide]() - Extension development and customization - To be added

## Getting Started

### Prerequisites

- Python 3.14+ (recommended) or Python 3.11+
- Chromium-based browser (Chrome, Edge, Opera)
- ONNX Runtime Web support (built into modern browsers)
- JavaScript enabled

### Installation

1. Clone this repository
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Set up dataset (see [Dataset Structure](DATA_STRUCTURE.md)):
   - **For testing**: Use synthetic data (auto-generated)
   - **For production**: Download DFDC from Kaggle or await FaceForensics++ approval
4. Train the model:
   ```bash
   # Quick test with synthetic data
   python src/train_pytorch.py test
   
   # Full training with real dataset
   python src/train_pytorch.py
   ```
5. Open Chrome and navigate to `chrome://extensions/`
6. Enable "Developer mode"
7. Click "Load unpacked" and select the extension directory
8. The extension icon will appear in your browser toolbar

### Usage

1. Click the extension icon to open the interface
2. Upload an image or video using drag-and-drop
3. Wait for the detection process to complete
4. Review the authenticity score and explanatory feedback
5. Export results if needed for research purposes

## Research Evaluation

The prototype includes built-in research tools for evaluation:

- **User Interaction Logging**: Timestamped, anonymized interaction data for studying user behavior
- **Performance Metrics**: Detection accuracy and processing time measurements
- **User Studies**: Support for A/B testing different explanation formats
- **Data Export**: CSV/JSON export functionality for statistical analysis

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
- Firefox (with ONNX Runtime Web support)
- Requires ONNX Runtime Web support for model execution
- CPU-based processing for broad device compatibility

## Performance Targets

- **Model Architecture**: Lightweight CNN (MesoNet-inspired) - 2,377 parameters
- **Model Size**: ~0.01 MB (ONNX format for web deployment)
- **Inference Time**: <100ms per image (CPU-based)
- **Memory Usage**: Efficient model lifecycle management
- **Compatibility**: ONNX Runtime Web execution (no GPU dependency)
- **Accuracy**: Optimised for real-world media detection with graded confidence

## Contributing

This project is part of academic research. For research collaboration or technical contributions, please refer to the research protocols and documentation.

## License

This project is developed for academic research purposes. Usage should comply with research ethics guidelines and institutional policies.

## Research Impact

This prototype contributes to several important areas:

- **Digital Literacy**: Provides tools for evaluating media authenticity in an AI-driven world
- **Misinformation Mitigation**: Helps users make informed decisions about potentially fake content
- **Human-AI Interaction**: Advances research on explainable AI systems and user trust
- **Privacy-Preserving ML**: Demonstrates client-side machine learning approaches that protect user data
