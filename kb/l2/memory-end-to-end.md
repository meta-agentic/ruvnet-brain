# How do I initialize and use ruflo's memory in a project end-to-end?

<!-- L2 synthesis · ACCEPTED · 5 verified source refs: ruflo/src/ruvocal/mcp-bridge/index.js, ruflo/src/mcp-bridge/index.js, v3/@claude-flow/memory/src/rvf-learning-store.ts, v3/@claude-flow/cli/src/commands/memory.ts, v3/@claude-flow/cli/src/mcp-tools/system-tools.ts -->

To initialize and use Ruflo's memory in your project end-to-end, follow these steps:

### Step 1: Configure Environment Variables
Ensure that the necessary environment variables are set to enable the memory tool group. You can do this by adding the following lines to your environment configuration (e.g., `.env` file):

```plaintext
MCP_GROUP_MEMORY=true
```

This setting enables the memory functionalities, which include vector memory, AgentDB, embeddings, and semantic search. The relevant configuration can be found in `ruflo/src/ruvocal/mcp-bridge/index.js` where the memory tool group is defined:

```javascript
memory: {
  enabled: process.env.MCP_GROUP_MEMORY !== "false",
  description: "Vector memory, AgentDB, embeddings, semantic search (ruflo)",
  source: "ruflo",
  prefixes: ["memory_", "agentdb_", "embeddings_"],
}
```
(SOURCE 1)

### Step 2: Initialize the Memory Store
You need to initialize the memory store in your application. This is typically done by calling the `initialize` method on the memory store instance. The initialization process will load any existing data from disk and set up the necessary configurations.

Here’s an example of how to do this:

```javascript
import { MemoryStore } from 'path-to-memory-store'; // Adjust the import based on your project structure

const memoryStore = new MemoryStore({
  storePath: './path/to/store', // Specify your store path
  autoPersistInterval: 60000, // Optional: Set auto-persist interval
});

await memoryStore.initialize();
```

The `initialize` method ensures that the store is ready for use and will create the necessary directories if they do not exist. This is detailed in the `initialize` method of the memory store implementation (found in `v3/@claude-flow/memory/src/rvf-learning-store.ts`):

```javascript
async initialize(): Promise<void> {
  if (this.initialized) return;

  ensureDirectory(this.config.storePath);

  if (fs.existsSync(this.config.storePath)) {
    await this.loadFromDisk();
  }
  // Additional setup...
}
```
(SOURCE 6)

### Step 3: Store Data in Memory
Once the memory store is initialized, you can store data using the `store` command provided by the CLI. Here’s how to use it programmatically:

```javascript
const key = "api/auth"; // Your storage key
const value = "JWT implementation"; // Your value to store

await memoryStore.store({ key, value });
```

You can also specify additional options such as `namespace`, `ttl`, and `tags`. The command structure is defined in `v3/@claude-flow/cli/src/commands/memory.ts`:

```javascript
const storeCommand: Command = {
  name: 'store',
  description: 'Store data in memory',
  options: [
    {
      name: 'key',
      short: 'k',
      description: 'Storage key/namespace',
      type: 'string',
      required: true
    },
    {
      name: 'value',
      description: 'Value to store',
      type: 'string'
    },
    // Additional options...
  ],
};
```
(SOURCE 7)

### Step 4: Retrieve Data from Memory
To retrieve data, you can use the `loadPatterns` or similar methods provided by the memory store:

```javascript
const patterns = await memoryStore.loadPatterns();
console.log(patterns);
```

### Step 5: Monitor Memory Usage
You can monitor the memory usage of your application using the system tools provided. The memory usage can be checked using the `process.memoryUsage()` method, which is part of the system monitoring tools in `v3/@claude-flow/cli/src/mcp-tools/system-tools.ts`.

### Conclusion
By following these steps, you can successfully initialize and use Ruflo's memory in your project. Make sure to refer to the specific file paths for any additional configurations or commands as needed.
