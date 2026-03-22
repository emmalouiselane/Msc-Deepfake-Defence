# System Design Document

**Document Version**: 1.2.0 | **Last Updated**: 2026-03-22 | **Status**:  First Iteration Complete

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
- **Lightweight CNN model** (MesoNet-inspired architecture)
- **Model optimization** (quantisation, WebAssembly acceleration)
- **Media preprocessing** (frame extraction for videos, normalisation)
- **Scoring engine** (probabilistic detection with risk levels)
- **Explanation generation** (highlight key features that influence decision)
- **Memory management** for model lifecycle
- **Frame sampling** for video processing efficiency

### 3. Data Management Layer
- **Local storage** of interaction logs (anonymized)
- **Export functionality** for evaluation
- **Secure handling** of user media (no cloud upload)

### 4. Evaluation & Analytics Tools
- **Automated performance logging** (accuracy, latency)
- **User metrics** (task completion, comprehension scores)
- **Optional researcher dashboard** for review

## System Architecture Diagram

### High-Level System Architecture
```
+------------------------------------------------------+
|                User Device (Browser)                  |
|-------------------------------------------------------|
|                                                       |
|  +-------------------+       +---------------------+  |
|  |  UI Layer         |       |  Processing Engine  |  |
|  |-------------------|       |---------------------|  |
|  | - Media Viewer    |       | - Preprocessing     |  |
|  | - Risk Indicator  | <---> | - Frame Sampling    |  |
|  | - Confidence UI   |       | - Normalisation     |  |
|  | - Feedback Panel  |       +----------+----------+  |
|  |                                  |                 |
|  +----------------------------------|----------------+
|                                     v
|                         +-------------------------+
|                         | Lightweight CNN Model   |
|                         | (On-device inference)   |
|                         +-----------+-------------+
|                                     |
|                                     v
|                         +-------------------------+
|                         | Decision & Scoring      |
|                         | - Probability Output    |
|                         | - Threshold Logic       |
|                         +-----------+-------------+
|                                     |
|                                     v
|                         +-------------------------+
|                         | UI Output Layer         |
|                         | - Risk Level            |
|                         | - Confidence Score      |
|                         +-------------------------+
|                                                      
+------------------------------------------------------+
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
### 2. Performance**: TensorFlow.js optimized models with WebAssembly acceleration
3. **Usability**: Intuitive interface with clear, explainable results
4. **Extensibility**: Modular architecture for easy updates and improvements
5. **Security**: Browser extension security best practices and minimal permissions

## Logical Data Flow

### Data Flow Sequence
User uploads media → Media preprocessing → Detection model evaluation → Score + explanation generated → Displayed to user → Logs saved locally → Optionally exported for analysis

### Data Flow Diagram (DFD Level 1)
```
[User]
   |
   v
[Media Input (Image/Video)]
   |
   v
[Preprocessing Module]
   - Resize
   - Normalise
   - Frame Extraction (video)
   |
   v
[Lightweight CNN Model]
   |
   v
[Scoring & Interpretation]
   - Confidence calculation
   - Threshold mapping to risk levels
   |
   v
[User Interface]
   - Risk indicator (low/medium/high)
   - Visual feedback
   - Explanatory highlights
   |
   v
[User Decision-Making]
   |
   v
[Logging & Storage]
   - Local anonymized logs
   - Export functionality
```

### Sequence Flow
```
User uploads/views media
        ↓
Extension intercepts media
        ↓
Preprocessing runs locally
        ↓
Model inference executes (CPU/WebAssembly)
        ↓
Prediction generated (probability score)
        ↓
System maps score → risk level
        ↓
UI displays result instantly
        ↓
User interprets and decides action
        ↓
Interaction logged locally
```

### Key Considerations
- **All processing occurs client-side** to ensure privacy (no cloud dependency)
- **Risk-based scoring** provides nuanced user guidance rather than binary classification
- **Explanatory highlights** improve comprehension and trust
- **Logging ensures reproducibility** and supports evaluation without compromising user privacy

## Interface Mockups (Low-Fidelity)

### a) Upload Screen
- **Drag-and-drop or file selection button**
- **Brief instructions** on supported media types
- **Progress bar** during preprocessing

### b) Detection Result Screen
- **Risk-based confidence levels** (low/medium/high likelihood)
- **Color-coded indicators** based on risk levels
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
| Risk Level: Medium (65% confidence)                |
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
- **Inference time**: Target <3 seconds for optimal user experience
- **Memory constraints**: Browser memory limits for model loading
- **Fallback handling**: Graceful degradation when TensorFlow.js fails
- **CPU-based execution**: WebAssembly support for broad compatibility

### User Experience Enhancements
- **Batch processing**: Allow multiple files at once
- **Real-time detection**: For video frames during playback
- **Confidence thresholds**: User-adjustable sensitivity settings
- **Error handling**: Clear messages for unsupported formats

### Browser Compatibility
- **WebAssembly requirements**: Modern browsers support WebAssembly execution
- **Feature detection**: Check for required APIs before processing
- **Progressive enhancement**: Graceful degradation for limited environments
- **CPU-based processing**: No GPU dependency for broader device support

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
