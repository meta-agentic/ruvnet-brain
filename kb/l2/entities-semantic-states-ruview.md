# What entities and semantic states does RuView publish per node to Home Assistant?

<!-- L2 synthesis · ACCEPTED · 4 verified source refs: docs/adr/ADR-122-bfld-ruview-ha-matter-exposure.md, tools/ruview-mcp/src/schemas/tools.ts, tools/ruview-mcp/src/index.ts, docs/adr/ADR-068-per-node-state-pipeline.md -->

RuView publishes several entities and semantic states per node to Home Assistant, primarily through its integration with the MQTT protocol and the Model Context Protocol (MCP). The key entities and states published include:

1. **Availability State**: Each node publishes its online/offline status through the topic `ruview/<node_id>/bfld/availability`. This serves as a marker to indicate whether the node is currently active or not (`docs/adr/ADR-122-bfld-ruview-ha-matter-exposure.md`).

2. **Occupancy and Motion States**: The following entities are exposed via Matter clusters:
   - `binary_sensor.<node>_bfld_presence`: This entity reports binary occupancy status along with uncertainty, derived from the occupancy sensing cluster (0x0406).
   - `sensor.<node>_bfld_motion`: This entity indicates motion detection, thresholded to a value of 0.3.
   - `sensor.<node>_bfld_person_count`: This entity provides a count of detected persons, utilizing data from the occupancy sensor (`docs/adr/ADR-122-bfld-ruview-ha-matter-exposure.md`).

3. **Vital Signs**: RuView also publishes vital sign data, including:
   - Breathing rate (6–30 BPM)
   - Heart rate (40–120 BPM)
   These metrics are available through the `ruview.vitals.get_breathing` tool, which can be accessed via the MCP (`tools/ruview-mcp/src/schemas/tools.ts`).

4. **Pose Estimation**: The system can estimate human poses using 17 keypoints, which can be accessed through the `ruview_pose_infer` tool. This is part of the broader sensing capabilities of RuView, which includes applications for activity recognition and environmental mapping (`tools/ruview-mcp/src/index.ts`).

5. **Aggregated States**: The per-node state tracking allows for independent sensing pipelines for each node, ensuring that the data reported (such as person count and motion) is specific to that node rather than aggregated across multiple nodes. This is crucial for accurate monitoring in environments with multiple nodes (`docs/adr/ADR-068-per-node-state-pipeline.md`).

In summary, RuView publishes a variety of entities related to presence, motion, vital signs, and pose estimation to Home Assistant, enabling detailed monitoring and control of the environment. For further details, refer to the specific paths: `docs/adr/ADR-122-bfld-ruview-ha-matter-exposure.md`, `tools/ruview-mcp/src/schemas/tools.ts`, and `docs/adr/ADR-068-per-node-state-pipeline.md`.
