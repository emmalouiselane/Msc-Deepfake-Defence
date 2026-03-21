# System Design Document

**Document Version**: 1.0.1 | **Last Updated**: 2026-03-21 | **Status**: Initial Draft

## System Architecture

### Objective
Client-side Deepfake detection browser-based prototype that balances performance, privacy, and usability.

## High-Level Components

### 1. Browser Extension / Frontend
- **Chrome Extension Architecture**:
  - Manifest v3 configuration
  - Content scripts for page integration
  - Background service worker for processing
  - Popup UI for quick access
- **Media upload interface** (images/videos)
- **Result display** (authenticity score + explanatory feedback)
- **User interaction logging**
- **Lightweight data visualization**

### 2. Client-Side Detection Engine
- **TensorFlow.js runtime** for model execution
- **Pre-trained deep learning model** (lightweight CNN/RNN/TCN)
- **Model optimization** (quantization, WebGL acceleration)
- **Media preprocessing** (frame extraction for videos, normalization)
- **Scoring engine** (probabilistic detection)
- **Explanation generation** (highlight key features that influence decision)
- **Memory management** for model lifecycle

### 3. Data Management Layer
- **Local storage** of interaction logs (anonymized)
- **Export functionality** for evaluation
- **Secure handling** of user media (no cloud upload)

### 4. Evaluation & Analytics Tools
- **Automated performance logging** (accuracy, latency)
- **User metrics** (task completion, comprehension scores)
- **Optional researcher dashboard** for review

## System Architecture Diagram

```
+---------------------------------------------------+
|                   Browser Frontend                 |
|  - Media Upload                                    |
|  - Detection Results Display                       |
|  - Explanatory Feedback                            |
|  - Interaction Logging                             |
+-------------------------+-------------------------+
                          |
                          v
+---------------------------------------------------+
|               Client-Side Detection Engine         |
|  - Preprocessing Media                             |
|  - Deepfake Detection Model                        |
|  - Probabilistic Scoring                           |
|  - Explanatory Feedback Generation                 |
+-------------------------+-------------------------+
                          |
                          v
+---------------------------------------------------+
|                  Local Data Management             |
|  - Anonymized Logs                                 |
|  - Export to CSV/JSON                              |
|  - Secure Storage                                  |
+---------------------------------------------------+
```

## Chrome Extension Architecture

### Extension Components
```
+---------------------------------------------------+
|                 Extension Structure                |
|                                                    |
|  manifest.json (v3)                                |
|  ├── background.js (Service Worker)                |
|  ├── content.js (Page Integration)                 |
|  ├── popup.html/js (Quick Access UI)               |
|  ├── models/ (TensorFlow.js models)                |
|  └── utils/ (Helper functions)                     |
+---------------------------------------------------+
```

### Security Considerations
- **Content Security Policy (CSP)**: Strict CSP to prevent XSS
- **Permissions**: Minimal required permissions only
- **Model Integrity**: Hash verification for loaded models
- **Data Sanitization**: Input validation and sanitization
- **Secure Storage**: Use chrome.storage.local with encryption
- **No Remote Code**: All logic contained within extension

## Key Design Principles

1. **Privacy-First**: All processing happens client-side, no data leaves the user's browser
2. **Performance**: TensorFlow.js optimized models with WebGL acceleration
3. **Usability**: Intuitive interface with clear, explainable results
4. **Extensibility**: Modular architecture for easy updates and improvements
5. **Security**: Browser extension security best practices and minimal permissions

## Logical Data Flow

### Data Flow Sequence
User uploads media → Media preprocessing → Detection model evaluation → Score + explanation generated → Displayed to user → Logs saved locally → Optionally exported for analysis

### Data Flow Diagram
```
[User Uploads Media]
          |
          v
[Preprocessing Module] ---> [Frames / Normalized Data]
          |
          v
[Detection Model] ---> [Authenticity Score + Feature Highlights]
          |
          v
[Feedback Module] ---> [User Interface Display]
          |
          v
[Logging & Storage] ---> [Local Storage / Export CSV]
```

### Key Considerations
- **All processing occurs client-side** to ensure privacy (no cloud dependency)
- **Probabilistic scores** are used to provide nuanced user guidance
- **Explanatory highlights** improve comprehension and trust
- **Logging ensures reproducibility** and supports evaluation without compromising user privacy

## Interface Mockups (Low-Fidelity)

### a) Upload Screen
- **Drag-and-drop or file selection button**
- **Brief instructions** on supported media types
- **Progress bar** during preprocessing

### b) Detection Result Screen
- **Authenticity Score** (0–100%)
- **Simple color-coded indicators** (Green = Likely Authentic, Red = Likely Deepfake)
- **Explanatory highlights** (e.g., areas of face inconsistencies)
- **"More Info" collapsible section** with simplified explanation

### c) Interaction Feedback / Logging
- **Timestamped activity log** (local, anonymized)
- **Button to export results** (CSV/JSON)
- **Optional survey prompt** for user trust/comprehension

### Wireframe Example (Text-Based Low-Fidelity Mockup)
```
+-------------------------------------------------+
| Upload Media                                     |
| [Drag and Drop / Browse Files]                   |
+-------------------------------------------------+
             |
             v
+-------------------------------------------------+
| Detection Result                                |
| Authenticity Score: 78% (Likely Authentic)      |
| Highlighted Issues: Slight facial asymmetry     |
| [More Info ▼]                                   |
| - Explanation: Detection algorithm observed...  |
+-------------------------------------------------+
             |
             v
+-------------------------------------------------+
| Interaction Log                                  |
| - 12:02 Upload completed                         |
| - 12:03 Detection score generated                |
| [Export CSV]                                     |
+-------------------------------------------------+
```

## Design Rationale

- **Client-side computation**: Ensures privacy, reduces latency
- **Probabilistic scoring**: Avoids false binary judgements, supports informed decision-making
- **Explainable feedback**: Builds user trust, aligns with ethical considerations
- **Iterative interface design**: Low-fidelity prototypes allow rapid validation with users
- **Logging & evaluation**: Supports reproducibility and research objectives

## Additional Technical Considerations

### Model Performance & Optimization
- **Model size limits**: Chrome extensions have size restrictions (~128MB unpacked)
- **Inference time**: Target <3 seconds for user experience
- **Memory constraints**: Browser memory limits for model loading
- **Fallback handling**: What happens if TensorFlow.js fails to load

### User Experience Enhancements
- **Batch processing**: Allow multiple files at once
- **Real-time detection**: For video frames during playback
- **Confidence thresholds**: User-adjustable sensitivity settings
- **Error handling**: Clear messages for unsupported formats

### Browser Compatibility
- **WebGL requirements**: Some older browsers may not support GPU acceleration
- **Feature detection**: Check for required APIs before processing
- **Progressive enhancement**: Graceful degradation for limited environments

### Research & Evaluation Framework
- **A/B testing**: Different explanation formats
- **User study protocols**: IRB considerations for human subjects
- **Metrics collection**: Accuracy, false positive/negative rates
- **Dataset diversity**: Ensure model works across demographics

### Deployment & Maintenance
- **Model updates**: Over-the-air model versioning
- **Telemetry**: Anonymous usage statistics for improvement
- **Documentation**: API documentation for researchers
- **Testing suite**: Unit tests, integration tests, browser testing
