# What are RuView's core concepts — CSI (Channel State Information), ESP32 sensors, WiFi-DensePose pose estimation, and RVF cognitive containers?

<!-- L2 synthesis · ACCEPTED · 4 verified source refs: plugins/ruview/skills/ruview-applications/SKILL.md, plugins/ruview/codex/prompts/ruview-start.md, ui/pose-fusion.html, docs/adr/ADR-002-ruvector-rvf-integration-strategy.md -->

RuView's core concepts encompass several advanced technologies and methodologies that enable its sensing capabilities. Here’s a detailed breakdown of each core concept:

1. **Channel State Information (CSI)**:
   - RuView utilizes CSI to estimate human body poses by analyzing the variations in WiFi signals as they interact with the human body. This is achieved through the processing of CSI data, which is captured from WiFi signals transmitted and received by devices like the ESP32. The system processes CSI to perform tasks such as activity recognition and pose estimation, leveraging the unique patterns that emerge from these signals (`plugins/ruview/skills/ruview-applications/SKILL.md`).

2. **ESP32 Sensors**:
   - The ESP32 microcontroller is a critical component of RuView's hardware setup. It supports the capture of CSI data, which is essential for the system's operation. The ESP32-S3 and ESP32-C6 models are specifically mentioned as compatible, while older models like the ESP32-C3 are unsupported due to their single-core architecture. The setup involves flashing the ESP32 with the necessary firmware and provisioning it to consume the CSI stream (`plugins/ruview/codex/prompts/ruview-start.md`).

3. **WiFi-DensePose Pose Estimation**:
   - WiFi-DensePose is a specific application within RuView that combines WiFi CSI data with video input to perform pose estimation. It employs a dual-modal approach, integrating data from both a webcam and WiFi signals to enhance the accuracy of pose detection. The system can estimate 17 keypoints of the human body using this fusion of modalities, which is facilitated by the `wifi-densepose-sensing-server` (`plugins/ruview/skills/ruview-applications/SKILL.md`, `ui/pose-fusion.html`).

4. **RVF Cognitive Containers**:
   - RuView incorporates RVF (RuVector Framework) cognitive containers, which are self-contained files that package various types of data and models necessary for cognitive computing tasks. These containers include different segment types such as vectors, models, and other resources that facilitate the processing and storage of CSI data and learned representations. This architecture allows for more efficient data handling and model deployment within the RuView ecosystem (`docs/adr/ADR-002-ruvector-rvf-integration-strategy.md`).

In summary, RuView integrates CSI for pose estimation, utilizes ESP32 sensors for data capture, employs WiFi-DensePose for enhanced pose detection through dual-modal sensing, and leverages RVF cognitive containers for efficient data management and processing. Each of these components plays a vital role in the overall functionality and effectiveness of the RuView system.
