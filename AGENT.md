# AI AGENT MANUAL (AGENT.md)
## Collaboration Guidelines & Skills for Vibe Coding

This repository is optimized for **Vibe Coding** under the orchestration of multiple AI Agents (Google Antigravity, Claude Code, etc.) and human developers. This manual defines the specific roles, skills, and expectations for each agent to ensure a seamless, high-quality development lifecycle.

---

## 1. Agent Roles & Specializations

To maximize productivity, each agent should act within its specific domain of strength:

| Agent | Core Specialization | Primary Activities |
| :--- | :--- | :--- |
| **Google Antigravity** | **System Architect & Orchestrator** | High-level planning, backend compilation checks, framework-level changes (Tauri state, traits mapping), verification, and workspace integrity checks. |
| **Claude Code** | **Feature Developer & Refactorer** | High-fidelity frontend coding, custom hook state orchestration, complex DSP algorithm implementation, styling polish, and thorough JSDoc/doc-comments writing. |
| **Copilot / Codex** | **Micro-Assistant (Inline)** | Real-time code autocompletion, boilerplate generation, and local variable/import adjustments. |

---

## 2. Mandatory Agent Skills

Every AI agent interacting with this repository must possess and exhibit the following skills:

### A. Strict Architecture Compliance (Clean Architecture)
- **Interface Segregation**: Never implement concrete details in the Core layer. All low-level hardware or filesystem APIs (e.g. `cpal`, `hound`) must be completely isolated under the Infrastructure layer via Traits.
- **IPC Decoupling**: Frontend components must never call Tauri command invocations directly. Every IPC call must be wrapped inside a typed TypeScript service in `src/services/` and consumed via React hooks.

### B. Safe and Explicit Code Execution
- **Error Mapping**: Rust code must never panic (`unwrap`/`expect`). Agents must map hardware/DSP/storage errors into a serialized `AppError` type.
- **Type Safety**: Absolutely no use of the `any` keyword in TypeScript. All payload interfaces passed between the Frontend and Backend must align 1-1.

### C. Continuous Verification & Clean Up
- **Build Checks**: Before ending any turn, the agent must ensure that TypeScript types validate perfectly (`npx tsc --noEmit`) and Cargo checks pass successfully (`cargo check`).
- **No Residual Drafts**: No unused mock files, commented-out dead code, or placeholders (`// TODO: implement later`) may be left behind in production files.

---

## 3. Standard Collaboration Workflow

Agents must execute tasks using the **Research -> Plan -> Execute -> Verify -> Document** framework:

1. **Research**: Scan `PROJECT_CONSTITUTION.md` and read active code components.
2. **Plan**: Write or update `implementation_plan.md` and request human approval for any complex architectural or logic additions.
3. **Execute**: Create and track step-by-step TODO lists in `task.md`. Implement changes in logically separate, incremental commits.
4. **Verify**: Run compilers and linters. Perform type checks.
5. **Document**: Write a clear `walkthrough.md` summarizing the technical changes and testing results.
