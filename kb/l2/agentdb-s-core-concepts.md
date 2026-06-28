# What are AgentDB's core concepts — the .rvf cognitive container, Reflexion episodic memory, causal graph, skill library, ReasoningBank, and the self-learning bandit?

<!-- L2 synthesis · ACCEPTED · 7 verified source refs: plugins/agentdb-core/skills/agentdb-status/SKILL.md, plugins/agentdb-causal/skills/agentdb-causal-explain/SKILL.md, simulation/scenarios/README-basic/reflexion-learning.md, plugins/agentdb-graph/skills/agentdb-traverse/SKILL.md, ui/.claude/skills/agentdb-memory-patterns/SKILL.md -->

AgentDB's core concepts encompass several key components that work together to facilitate cognitive processing, memory management, and learning. Below is a detailed explanation of each core concept based on the provided sources.

### 1. .rvf Cognitive Container
The `.rvf` cognitive container is a persistent storage format used by AgentDB to manage memory patterns. It allows for the storage of various types of data, including episodes and patterns, which are essential for the functioning of AI agents. The `.rvf` format is integrated with the ReasoningBank, enabling agents to remember conversations and learn from interactions. The storage size for the cognitive container is typically around 38 MB, as indicated in the status report (`plugins/agentdb-core/skills/agentdb-status/SKILL.md`).

### 2. Reflexion Episodic Memory
Reflexion is a multi-agent episodic memory system that implements self-reflection and critique-based learning. It allows agents to learn from past experiences by storing episodes along with critiques for continuous improvement. The Reflexion algorithm enables agents to generate critiques for each episode, facilitating a learning process that can yield a success rate of 100% and a learning curve improvement of 15-25% over multiple iterations (`simulation/scenarios/README-basic/reflexion-learning.md`).

### 3. Causal Graph
The causal graph in AgentDB is a structured representation of relationships between memories, allowing for the tracing of dependencies and causal links. This graph can be traversed to explain why certain events occurred or to analyze the sequence of actions leading to a specific outcome. The causal graph is utilized in various skills, such as `agentdb-causal-explain`, which helps in understanding the connections between different memories (`plugins/agentdb-causal/skills/agentdb-causal-explain/SKILL.md`).

### 4. Skill Library
AgentDB includes a skill library that provides various functionalities for managing memory and interactions. Skills such as `agentdb-status`, `agentdb-causal-explain`, and `agentdb-traverse` allow users to query the state of AgentDB, explore causal relationships, and visualize memory contexts. This library is essential for building stateful agents and intelligent assistants, enabling them to perform complex tasks and maintain context across sessions (`ui/.claude/skills/agentdb-memory-patterns/SKILL.md`).

### 5. ReasoningBank
The ReasoningBank is a component of AgentDB that integrates with the cognitive container to enhance reasoning capabilities. It allows for the storage and retrieval of interaction memories, facilitating the learning process for agents. The ReasoningBank is designed to work with various learning plugins, enabling agents to adapt and improve their performance over time (`ui/.claude/skills/agentdb-memory-patterns/SKILL.md`).

### 6. Self-Learning Bandit
The self-learning bandit is a mechanism within AgentDB that utilizes reinforcement learning principles to optimize decision-making. It operates by evaluating the outcomes of different actions and adjusting strategies based on the rewards received. This component is part of the broader self-learning architecture, which includes various standalone components designed to enhance the learning capabilities of agents (`docs/adrs/ADR-006-unified-self-learning-rvf-integration.md`).

In summary, AgentDB's core concepts work synergistically to create a robust framework for cognitive processing, memory management, and adaptive learning, enabling the development of intelligent agents capable of self-improvement and contextual understanding.
