# How do I run RuView and publish its sensing to Home Assistant end-to-end?

<!-- L2 synthesis · ACCEPTED · 2 verified source refs: docs/benchmarks/homecore-vs-home-assistant.md, plugins/ruview/commands/ruview-app.md -->

To run RuView and publish its sensing data to Home Assistant, follow these steps:

### Step 1: Set Up RuView

1. **Choose Your Setup Path**: You can choose between three options based on your hardware availability:
   - **Docker Demo**: If you have no hardware, run the Docker demo to simulate sensing. Use the command:
     ```bash
     docker run -p 8000:8000 ruvnet/wifi-densepose
     ```
     Then, open your browser and navigate to `http://localhost:8000` to view the dashboard.
   - **Repo Build**: For developers wanting to build from source, navigate to the RuView directory and run:
     ```bash
     cd v2 && cargo test --workspace --no-default-features
     ```
   - **Live ESP32**: If you have an ESP32 device, flash the firmware using the following commands:
     - First, invoke the `ruview-hardware-setup` skill to prepare your device.
     - Then, build and flash the firmware:
       ```bash
       python -m esptool --port <COM port> write_flash ...
       ```
     - Confirm the CSI stream by running:
       ```bash
       cd v2 && cargo run -p wifi-densepose-sensing-server
       ```

2. **Provision and Calibrate**: If using the ESP32, after flashing, run the `provision-node` skill and then `calibrate-room` to set up your sensing environment.

### Step 2: Run a RuView Application

1. **Invoke the RuView Application**: Use the `ruview-applications` skill to run a specific sensing application. For example, to run presence detection, execute:
   ```bash
   ruview-applications presence
   ```
   This will start the sensing server for the specified application.

### Step 3: Publish to Home Assistant

1. **Run HomeCore**: To publish the sensing data to Home Assistant, you need to run the HomeCore service, which is wire-compatible with Home Assistant. Execute the following command:
   ```bash
   python aether-arena/staging/run_homecore_bench.py
   ```
   This will start the HomeCore service, which can communicate with Home Assistant.

2. **Run Home Assistant**: Similarly, start Home Assistant using:
   ```bash
   python aether-arena/staging/run_ha_bench.py
   ```

3. **Integration**: Since HomeCore is wire-compatible with Home Assistant, it will automatically publish the sensing data to Home Assistant's API. Ensure that both services are running on the same network and can communicate with each other.

### Step 4: Verify and Monitor

1. **Verify Data**: Use the `ruview.claim_check` tool to verify the accuracy of the sensing data before presenting it. This ensures that any reported metrics are validated and reliable.

2. **Monitor**: You can monitor the performance and data flow between RuView and Home Assistant through their respective dashboards.

By following these steps, you will successfully run RuView, publish its sensing data to Home Assistant, and ensure the integrity of the data being reported. For further details, refer to the specific commands and paths mentioned in the sources, such as `plugins/ruview/commands/ruview-app.md` and `docs/benchmarks/homecore-vs-home-assistant.md`.
