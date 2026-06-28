# How does RuView integrate with smart-home ecosystems (Home Assistant MQTT, Matter, Apple Home)?

<!-- L2 synthesis · ACCEPTED · 3 verified source refs: docs/benchmarks/homecore-vs-home-assistant.md, plugins/ruview/commands/ruview-app.md, plugins/ruview/skills/ruview-applications/SKILL.md -->

RuView integrates with smart-home ecosystems through its wire-compatible Rust port of Home Assistant, known as HOMECORE, and supports various applications that can be utilized within these ecosystems. Here’s how RuView connects with specific smart-home technologies:

1. **Home Assistant MQTT**: RuView's HOMECORE is designed to be wire-compatible with Home Assistant, meaning it can utilize the same REST and WebSocket APIs. This compatibility allows RuView to communicate effectively with Home Assistant, enabling the integration of RuView's sensing capabilities (like presence and vital signs detection) into Home Assistant's ecosystem. The performance benchmarks indicate that HOMECORE can operate with significantly lower memory usage and faster startup times compared to traditional Home Assistant setups (`docs/benchmarks/homecore-vs-home-assistant.md`).

2. **Matter**: The sources do not provide specific details on RuView's integration with the Matter protocol. Therefore, it is unclear how RuView directly supports Matter at this time.

3. **Apple Home**: Similar to Matter, the sources do not mention any direct integration with Apple Home. Thus, there is no available information on how RuView interacts with Apple Home.

In summary, RuView integrates primarily with Home Assistant through its HOMECORE implementation, allowing for efficient communication and control within that ecosystem. However, there is no information available regarding its integration with Matter or Apple Home. For further details on how to set up and utilize RuView applications, refer to the relevant sections in the documentation, such as `plugins/ruview/commands/ruview-app.md` and `plugins/ruview/skills/ruview-applications/SKILL.md`.
