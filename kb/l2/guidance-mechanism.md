# How does the guidance system produce a recommendation (guidance_recommend) — what is the mechanism?

<!-- L2 synthesis · ACCEPTED · 4 verified source refs: v3/@claude-flow/hooks/src/reasoningbank/guidance-provider.ts, v3/@claude-flow/hooks/src/cli/guidance-cli.ts, v3/@claude-flow/guidance/wasm-pkg/guidance_kernel.js, v3/@claude-flow/guidance/src/hooks.ts -->

The guidance system produces a recommendation (referred to as `guidance_recommend`) through a structured process that involves several components and mechanisms. Here’s a detailed breakdown of how this works:

1. **Guidance Provider Initialization**: The `GuidanceProvider` class is responsible for generating guidance output. It initializes with a `ReasoningBank`, which contains patterns that inform the guidance system. This initialization is done via the `initialize` method, which prepares the provider for generating recommendations (`v3/@claude-flow/hooks/src/reasoningbank/guidance-provider.ts`).

2. **Command Handling**: The guidance system can be accessed through a command-line interface (CLI). Commands such as `user-prompt` and `route` are used to generate specific guidance outputs based on user input. For example, the command `npx @claude-flow/hooks user-prompt "Fix authentication bug"` would invoke the `generatePromptContext` method of the `GuidanceProvider`, which processes the input and generates a relevant recommendation (`v3/@claude-flow/hooks/src/cli/guidance-cli.ts`).

3. **Batch Processing**: The system can handle multiple operations in a single call through a batch processing function. This function accepts a JSON array of operations and returns a JSON array of results, which is crucial for high-throughput scenarios. This is particularly relevant when the system needs to process multiple recommendations efficiently (`v3/@claude-flow/guidance/wasm-pkg/guidance_kernel.js`).

4. **Guidance Hooks**: The `GuidanceHookProvider` registers various hooks that are triggered during different lifecycle events (e.g., PreCommand, PreToolUse). These hooks evaluate commands and tool usage against predefined criteria, such as checking for destructive operations or sensitive information. This enforcement mechanism ensures that recommendations are not only relevant but also safe and compliant with established guidelines (`v3/@claude-flow/guidance/src/hooks.ts`).

5. **Recommendation Generation**: The actual recommendation is generated based on the context provided by the user and the patterns stored in the `ReasoningBank`. The system evaluates the input against these patterns and produces a recommendation that is then formatted for output, either as plain text or JSON, depending on the command used (`v3/@claude-flow/hooks/src/reasoningbank/guidance-provider.ts`).

In summary, the guidance system's recommendation mechanism involves initializing a guidance provider, processing user commands through a CLI, utilizing batch processing for efficiency, enforcing safety through hooks, and generating contextually relevant recommendations based on established patterns. Each of these components plays a critical role in ensuring that the recommendations are accurate, safe, and useful.
