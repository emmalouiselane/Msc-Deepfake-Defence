# Model Selection and Deployment Strategy for On-Device Deepfake Detection

**Document Version**: 1.0.0 | **Last Updated**: 2026-03-22 | **Status**: First Iteration Complete

## Introduction

The selection of an appropriate model architecture and deployment strategy is arguably the most critical component of this research, particularly given the project's objective of developing a privacy-preserving, client-side deepfake detection tool. Unlike current/conventional approaches that rely on cloud-based inference, this system is explicitly designed to operate entirely on-device, introducing significant computational and architectural constraints.

This document evaluates candidate model approaches and justifies the final design decision, with a particular emphasis on the trade-off between detection accuracy and computational efficiency, as well as any broader implications for usability, privacy, and real-world applicability.

## Evaluation of Candidate Models

### Lightweight Convolutional Neural Networks

Lightweight convolutional neural networks (CNNs), particularly those inspired by MesoNet (Afchar et al., 2018), represent the most viable approach for this solution with on-device deployment. These models are specifically designed to detect facial manipulation by analysing mesoscopic-level features, such as texture inconsistencies and compression artefacts, rather than relying on deep semantic representations.

The key advantage of utilising such models lies in their computational efficiency. With relatively shallow architectures and reduced parameter counts, lightweight CNNs can perform analysis in near real-time on standard CPU hardware, making them well-suited to browser-based environments like Chromium extensions. In addition to this, their smaller model size facilitates efficient loading and execution within JavaScript-based machine learning frameworks, including TensorFlow.js and ONNX Runtime Web.

However, this efficiency comes at the cost of reduced detection performance, particularly when compared to deeper architectures. These lightweight models tend to struggle with generalisation across diverse datasets and may display lower robustness when exposed to unseen manipulation techniques, heavily compressed media, or malicious manipulations. These limitations are especially relevant in real-world social media contexts, where content quality and manipulation methods vary significantly.

Despite these challenges, lightweight CNNs remain the only feasible option for a fully on-device system. As such, their limitations are not simply drawbacks but design constraints that must be mitigated through careful optimisation and system design.

### Pre-trained Deep Models and API-Based Solutions

Current and state-of-the-art deepfake detection systems often employ deep architectures such as XceptionNet or EfficientNet, that are trained on large-scale datasets like FaceForensics++. These models demonstrate significantly higher accuracy and improved generalisation, particularly when incorporating temporal features for video analysis.

However, these approaches are inherently unsuitable for on-device deployment. Their high computational requirements, including a dependence on GPU acceleration, render them impractical for execution within browser environments. In addition to this, API-based solutions introduce network latency, cost constraints, and significant privacy concerns, as user data must be transmitted to external servers for analysis.

Given the project's emphasis on data privacy and local processing, such approaches will be explicitly excluded from the deployment architecture. Instead, they are utilised solely during the development phase as benchmarking tools, providing an upper bound against which the performance of lightweight models can be evaluated.

## Trade-Off: Accuracy vs Computational Efficiency

The design of an on-device deepfake detection system necessitates a fundamental trade-off between accuracy and computational efficiency. While deep models offer superior detection capabilities, their resource requirements conflict directly with the constraints of the client-side environments.

In this context, the trade-off is not optional but deeply-rooted within the very nature of the system design. The objective is therefore reframed from maximising accuracy to optimising performance within strict computational limits. This includes maintaining acceptable levels of precision and recall while ensuring that interpretation is performed in real-time and with minimal resource consumption.

From a cybersecurity and HCI perspective, this trade-off can be justified as a deliberate deviation and prioritisation of privacy, autonomy, and usability. Users will benefit from immediate feedback and retain full control over their data, which may enhance trust in the system, even if detection accuracy is not state-of-the-art.

## Deployment Strategy: Fully On-Device Architecture

Based on the evaluation above, the system adopts a fully on-device deployment strategy, where all processing occurs locally within the user's browser.

This architecture removes the need for external communication, ensuring that no media content is transmitted or stored outside the user's device. This approach aligns with data protection principles and addresses many ethical concerns associated with cloud-based analysis.

The system will operate through a multi-stage pipeline. First, the media content is preprocessed, including resizing, normalisation, and (for video) frame extraction. The processed data is then passed to a lightweight CNN, which produces a probabilistic classification indicating the likelihood of manipulation. This output will then be translated into a user-facing risk indicator, accompanied by a confidence score and explanatory feedback.

To enhance efficiency, the system will incorporate several optimisation techniques. For video content, frame sampling is employed to reduce the number of frames analysed, therefore lowering computational overhead. In addition to this, model optimisation methods such as quantisation and pruning are used to minimise model size and improve inference speed without significantly degrading performance.

## System Implications and Limitations

The entirely on-device approach offers several key advantages. The principal of which, ensures maximum privacy, as user data remains entirely local. It will also enable low-latency interaction, which is essential for integration into social media environments where users will expect immediate feedback.

However, this approach will also introduce important limitations. Detection accuracy will be inherently constrained by the use of lightweight models, and the system may struggle with highly sophisticated or novel deepfake techniques. Furthermore, performance may vary depending on the hardware capabilities of the user's device.

To mitigate these risks, the system avoids presenting binary classifications and instead communicates results using graded confidence levels (e.g., low, medium, high likelihood). This approach will also support informed decision-making while acknowledging uncertainty, thereby reducing the risk of over-reliance on the system.

## Summary

In summary, the decision to adopt a fully on-device deepfake detection approach reflects a strategic prioritisation of privacy, efficiency, and usability over absolute accuracy. Lightweight CNNs serve as the core detection mechanism, supported by optimisation techniques that enhance their practical viability.

While this approach introduces certain limitations, it also aligns closely with the project's objectives and contributes to the development of a scalable, privacy-preserving tool for real-world social media environments.

## References

Afchar, D., Nozick, V., Yamagishi, J. & Echizen, I., (2018). MesoNet: a Compact Facial Video Forgery Detection Network. arXiv. Available at: https://arxiv.org/abs/1809.00888  (Accessed 22 March 2026).
