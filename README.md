# Transformer for Z.ai

---

## Table of Contents

1. [Overview](#overview)
2. [Supported Models](#supported-models)
3. [Prerequisites](#prerequisites)
   - [Required Software](#required-software)
   - [API Key](#api-key)
4. [Installation Steps](#installation-steps)
5. [Configuration Files](#configuration-files)
   - [Claude Code Router Configuration](#claude-code-router-configuration)
   - [Advanced Configuration Options](#advanced-configuration-options)
   - [Claude Code Configuration](#claude-code-configuration)
6. [Transformer Files](#transformer-files)
   - [Production Transformer](#production-transformer)
   - [Debug Transformer](#debug-transformer)
7. [StatusLine Scripts](#statusline-scripts)
   - [PowerShell StatusLine (Windows)](#powershell-statusline-windows)
   - [Bash StatusLine (macOS/Linux)](#bash-statusline-macoslinux)
8. [Usage Instructions](#usage-instructions)
   - [Method 1: Using `ccr code`](#method-1-using-ccr-code)
   - [Method 2: Using `ccr start` + `claude`](#method-2-using-ccr-start--claude)
   - [Method 3: Using `ccr start` + Visual Studio Code Extension](#method-3-using-ccr-start--visual-studio-code-extension)
   - [Bonus: JetBrains IDEs Extension](#bonus-jetbrains-ides-extension)
   - [Understanding Reasoning Modes](#understanding-reasoning-modes)
   - [Sampling Control (Temperature & Top-P)](#sampling-control-temperature--top-p)
9. [Troubleshooting](#troubleshooting)
   - [CCR Won't Start](#ccr-wont-start)
   - [Z.ai API Key Invalid](#zai-api-key-invalid)
   - [Thinking Not Working](#thinking-not-working)
   - [Debug Logs Too Large](#debug-logs-too-large)
   - [Connection Fails with Specific IP](#connection-fails-with-specific-ip)
   - [Claude Code Not Displaying Thinking](#claude-code-not-displaying-thinking)
   - [Using CCR Built-in Transformers Only](#using-ccr-built-in-transformers-only)
10. [Additional Resources](#additional-resources)

---

## Overview

This guide explains how to configure **Claude Code** to work with **Z.ai's** OpenAI-Compatible Endpoint using **Claude Code Router (CCR)** with a custom transformer.

**Key Features:**

- ✓ **Resolves Claude Code's token limitations** - Automatically applies correct `max_tokens` for each model
  - Claude Code limits output to 32K/64K tokens
  - Transformer sends correct limits: GLM 4.6 (128K), GLM 4.5 (96K), GLM 4.5-air (96K), GLM 4.5v (16K)
- ✓ **Sampling control guaranteed** - Sets `do_sample=true` to ensure `temperature` and `top_p` always work
  - Applies model-specific temperature and top_p values
  - Guarantees consistent sampling behavior across all requests
- ✓ **Native reasoning control** - Model decides when to use reasoning (when enabled)
  - Can be toggled on/off via Claude Code CLI (Tab key or settings)
  - When enabled, model intelligently decides when reasoning is needed
- ✓ **Keyword detection for prompt enhancement** - Auto-detects keywords requiring analysis
  - Keywords: analyze, calculate, count, explain, solve, etc.
  - Adds reasoning instructions to prompt when keywords detected
- ✓ **"Ultrathink" mode** - User-triggered reasoning
  - Type "ultrathink" anywhere in your message (Claude Code highlights it with rainbow colors)
  - Activates thinking + adds reasoning instructions to prompt
  - Works independently of all configuration settings and global overrides
- ✓ **Global Configuration Overrides** - Apply settings across ALL models
  - Override max_tokens, temperature, top_p globally (replaces model defaults)
  - Override reasoning and keyword detection behavior for all models
  - Customize keyword list: add to defaults or replace entirely
  - Perfect for consistent behavior across different models
- ✓ **Cross-platform support** (Windows, macOS, Linux)
- ✓ **Enhanced StatusLine** with Git integration

---

## Supported Models

The transformer supports all Z.ai GLM models with optimized configurations:

| Model             | Max Output Tokens | Context Window | Temperature | Top-P | Reasoning |
|-------------------|-------------------|----------------|-------------|-------|-----------|
| **GLM 4.6**       | 128K (131,072)    | 200K (204,800) | 1.0         | 0.95  | ✓         |
| **GLM 4.5**       | 96K (98,304)      | 128K (131,072) | 0.6         | 0.95  | ✓         |
| **GLM 4.5-air**   | 96K (98,304)      | 128K (131,072) | 0.6         | 0.95  | ✓         |
| **GLM 4.5v**      | 16K (16,384)      | 128K (131,072) | 0.6         | 0.95  | ✓         |

**Notes:**
- **Max Output Tokens**: Maximum tokens the model can generate in a single response
- **Context Window**: Maximum tokens the model can process as input (prompt + history)
- **Temperature**: Controls randomness (higher = more creative, lower = more focused)
- **Top-P**: Nucleus sampling parameter (controls diversity)
- **Reasoning**: All models support native thinking/reasoning capabilities

---

## Prerequisites

### Required Software

1. **Node.js** (v18.0.0 or higher)
   - Download: https://nodejs.org/en/download
   - Verify installation: `node --version`

2. **Claude Code**
   - Official documentation: https://docs.claude.com/en/docs/claude-code/setup
   - Verify installation: `claude --version`

3. **Git** (for StatusLine git integration)
   - Download: https://git-scm.com/install
   - Verify installation: `git --version`

4. **PowerShell 7.0+** (for statusline.ps1)
   - Download: https://github.com/PowerShell/PowerShell/releases
   - Verify installation: `pwsh --version`

5. **jq** (macOS/Linux only, for statusline.sh)
   - macOS: `brew install jq`
   - Linux: `sudo apt install jq` or `sudo yum install jq`
   - Verify installation: `jq --version`

### API Key

- **Z.ai API Key**
  - Sign up for an account at https://z.ai
  - Navigate to API Management → API Keys (https://z.ai/manage-apikey/apikey-list)
  - Create a new API key
  - Copy and save it securely
---

## Installation Steps

### 1. Install Claude Code

**Standard installation (npm):**

```bash
npm install -g @anthropic-ai/claude-code
```

**Native binary installation (Recommended):**

**Windows (PowerShell):**

```powershell
irm https://claude.ai/install.ps1 | iex
```

**Windows (CMD):**

```cmd
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

**macOS/Linux:**

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Verify installation:

```bash
claude --version
```

### 2. Install Claude Code Router

```bash
npm install -g @musistudio/claude-code-router
```

Verify installation:

```bash
ccr version
```

## Configuration Files

### Claude Code Router Configuration

**File Location:**

- **Windows:** `%USERPROFILE%\.claude-code-router\config.json`
- **macOS:** `~/.claude-code-router/config.json`
- **Linux:** `~/.claude-code-router/config.json`

**Windows Example:**

```json
{
  "LOG": false,
  "LOG_LEVEL": "debug",
  "HOST": "127.0.0.1",
  "PORT": 3456,
  "APIKEY": "",
  "API_TIMEOUT_MS": "600000",
  "PROXY_URL": "",
  "CUSTOM_ROUTER_PATH": "",
  "transformers": [
    {
      "path": "C:\\Users\\<Your-Username>\\.claude-code-router\\plugins\\zai.js",
      "options": {}
    }
  ],
  "Providers": [
    {
      "name": "ZAI",
      "api_base_url": "https://api.z.ai/api/coding/paas/v4/chat/completions",
      "api_key": "YOUR_ZAI_API_KEY_HERE",
      "models": [
        "glm-4.6",
        "glm-4.5",
        "glm-4.5v",
        "glm-4.5-air"
      ],
      "transformer": {
        "use": [
          "zai",
          "reasoning" // ← Converts OpenAI's reasoning_content to Anthropic's thinking format
                      // ← Generates signatures to display thinking in Claude Code
        ]
      }
    }
  ],
  "Router": {
    "default": "ZAI,glm-4.6",
    "background": "ZAI,glm-4.6",
    "think": "ZAI,glm-4.6",
    "longContext": "ZAI,glm-4.6",
    "longContextThreshold": 204800,
    "webSearch": "ZAI,glm-4.6",
    "image": "ZAI,glm-4.5v"
  }
}
```
**macOS Path Example:**

```json
"transformers": [
  {
    "path": "/Users/<Your-Username>/.claude-code-router/plugins/zai-debug.js",
    "options": {}
  }
]
```

**Linux Path Example:**

```json
"transformers": [
  {
    "path": "/home/<Your-Username>/.claude-code-router/plugins/zai-debug.js",
    "options": {}
  }
]
```

**To use debug transformer (all platforms):**

- **Windows:** `"path": "C:\\Users\\<Your-Username>\\.claude-code-router\\plugins\\zai-debug.js"`
- **macOS:** `"path": "/Users/<Your-Username>/.claude-code-router/plugins/zai-debug.js"`
- **Linux:** `"path": "/home/<Your-Username>/.claude-code-router/plugins/zai-debug.js"`

**Important Notes:**

1. **Replace `YOUR_ZAI_API_KEY_HERE`** with your actual Z.ai API key

2. **Authentication & Network Access:**

   #### 2.1 For Local Access
   
   **Option A: Using `ccr code`**
   - No configuration needed - `APIKEY` can be empty
   - `ANTHROPIC_AUTH_TOKEN` is NOT needed (autoconfigured by `ccr code`)
   - CCR and Claude Code CLI run in a single process
   
   **Option B: Using `ccr start` + `claude`**

   **Option C: Using `ccr start` + VS Code Extension**   

   **Claude Code Router config (`~/.claude-code-router/config.json`):**
   ```json
   {
     "APIKEY": "",           // ← Empty = No authentication required
     "HOST": "127.0.0.1",    // ← Forced automatically when APIKEY is empty
     "PORT": 3456
   }
   ```
   
   **Claude Code config (`~/.claude/settings.json`) or `OS environment variables`:**
   ```json
   {
     "env": {
       "ANTHROPIC_BASE_URL": "http://127.0.0.1:3456",
       "ANTHROPIC_AUTH_TOKEN": "any-value"  // ← Can be ANY value when APIKEY is empty, needed for ccr start + claude and ccr start + VS Code Extension
     }
   }
   ```
   
   **Requirements:**
   - When `APIKEY` is empty, `ANTHROPIC_AUTH_TOKEN` can have ANY value (but MUST be present)
   - Claude Code Router only accepts connections from localhost (127.0.0.1)
   - Claude Code Router will display `⚠️ API key is not set. HOST is forced to 127.0.0.1.`
   
   #### 2.2 For Network Access (LAN or WAN)

   **Option A: Using `ccr start` + `claude`**

   **Option B: Using `ccr start` + VS Code Extension**

   **CCR config (`~/.claude-code-router/config.json`):**
   ```json
   {
     "APIKEY": "your-secret-key",  // ← REQUIRED for network exposure
     "HOST": "0.0.0.0",             // ← Listen on all network interfaces (or use your LAN IP instead of 0.0.0.0)
     "PORT": 3456
   }
   ```
   
   **Claude Code config (`~/.claude/settings.json`) or `OS environment variables`:**
   ```json
   {
     "env": {
      // https://domain.tld or https://subdomain.domain.tld
       "ANTHROPIC_BASE_URL": "http://<LAN-IP>:<CCR-PORT>", 
       "ANTHROPIC_AUTH_TOKEN": "your-secret-key"  // ← MUST match APIKEY in CCR config
     }
   }
   ```
   
   **Requirements:**
   - `APIKEY` in CCR config is mandatory when exposing to network
   - `ANTHROPIC_AUTH_TOKEN` in Claude Code or Environment Variable **MUST match** the `APIKEY` value
   - `HOST: "0.0.0.0"` listens on all network interfaces
   - Alternatively, use your specific LAN IP (e.g., `10.10.10.10` or `192.168.1.10`)
   
   **Use cases:**
   - Access CCR from other computers
   - Expose via reverse proxy (IIS, Nginx, etc.)

3. **Usage Scenarios:**
   
   | Scenario                                  | APIKEY in CCR    | ANTHROPIC_AUTH_TOKEN | Works?    |
   |-------------------------------------------|------------------|----------------------|-----------|
   | **Using `ccr code`**                      | Empty            | Not needed           | Yes       |
   | **Using `ccr code`**                      | Any              | Not needed           | Yes       |
   | **Using `ccr start` + `claude`**          | Empty            | Any value            | Yes       |
   | **Using `ccr start` + `claude`**          | Empty            | Not configured       | No        |
   | **Using `ccr start` + `claude`**          | Configured       | MUST match APIKEY    | Yes       |
   | **Using `ccr start` + `claude`**          | Configured       | Different value      | 401 Error |
   | **Using `ccr start` + VS Code Extension** | Configured       | Different value      | 401 Error |
   | **Using `ccr start` + VS Code Extension** | Empty            | Any value            | Yes       |
   | **Using `ccr start` + VS Code Extension** | Configured       | MUST match APIKEY    | Yes*      |
   
   *Note: VS Code Extension may show "How do you want to log in" screen when APIKEY is configured. Click **"Anthropic Console"** button to bypass.

4. **Connection Configuration:**
   - The `HOST` and `PORT` in CCR's `config.json` **must match EXACTLY** the `ANTHROPIC_BASE_URL` in Claude Code's `settings.json` or your OS environment variables.
   - **Important:** When CCR is configured with a specific IP in HOST (e.g., `"HOST": "10.10.10.10"`), the server will ONLY listen on that exact IP address.
     - **What this means:** CCR will NOT respond to requests sent to `127.0.0.1` or `localhost`, even if Claude Code is running on the same computer.
     - **Impact:** ALL connection methods will fail:
         - `ccr code` command → Will not work
         - `ccr start` + `claude` → Will not work
         - `ccr start` + VS Code Extension → Will not work

   
   **Examples:**
   
   | CCR (`"PORT": 3456`)    | Environment variable                              | Works?                                    |
   |-------------------------|---------------------------------------------------|-------------------------------------------|
   | `"HOST": "127.0.0.1"`   | `"ANTHROPIC_BASE_URL": "http://127.0.0.1:3456"`   | ✓ Yes                                     |
   | `"HOST": "0.0.0.0"`     | `"ANTHROPIC_BASE_URL": "http://127.0.0.1:3456"`   | ✓ Yes (0.0.0.0 listens on all interfaces) |
   | `"HOST": "0.0.0.0"`     | `"ANTHROPIC_BASE_URL": "http://10.10.10.10:3456"` | ✓ Yes (0.0.0.0 listens on all interfaces) |
   | `"HOST": "10.10.10.10"` | `"ANTHROPIC_BASE_URL": "http://10.10.10.10:3456"` | ✓ Yes                                     |
   | `"HOST": "10.10.10.10"` | `"ANTHROPIC_BASE_URL": "http://127.0.0.1:3456"`   | ✗ No (CCR not listening on 127.0.0.1)     |

5. **`"LOG": false`** - CCR's own logging is disabled by default
    - **Important:** The debug transformer (`zai-debug.js`) works independently and will still log to `~/.claude-code-router/logs/` even with `LOG: false`
    - CCR's logging is useful if you want to see raw response chunks from Z.ai, but it's separate from the transformer's debug logs
    - To enable CCR logs, set `"LOG": true` - logs will appear in CCR's console output

6. **Transformer name matching:**
    - The value in `"use": ["zai"]` **MUST** match the `name` property in the transformer class
    - Both transformer files define: `name = "zai"`
    - If you rename the transformer class's `name` property, you must update this value accordingly

#### Advanced Configuration Options

The transformer supports optional configuration parameters in the `"options"` object. These **global overrides** apply to ALL models and take the highest priority over model-specific settings.

**Basic configuration (default):**
```json
"transformers": [
  {
    "path": "C:\\Users\\<Your-Username>\\.claude-code-router\\plugins\\zai.js",
    "options": {}
  }
]
```

**Advanced configuration with global overrides:**
```json
"transformers": [
  {
    "path": "C:\\Users\\<Your-Username>\\.claude-code-router\\plugins\\zai.js",
    "options": {
      "overrideMaxTokens": 100000,
      "overrideTemperature": 0.7,
      "overrideTopP": 0.9,
      "overrideReasoning": true,
      "overrideKeywordDetection": true,
      "customKeywords": ["design", "plan", "architect"],
      "overrideKeywords": false
    }
  }
]
```

**Available Options:**

| Option                     | Type      | Default | Description                                                                                                              |
|----------------------------|-----------|---------|--------------------------------------------------------------------------------------------------------------------------|
| `overrideMaxTokens`        | `number`  | `null`  | Apply max_tokens for ALL models (replaces model defaults)                                                                |
| `overrideTemperature`      | `number`  | `null`  | Apply temperature for ALL models (replaces model defaults)                                                               |
| `overrideTopP`             | `number`  | `null`  | Apply top_p for ALL models (replaces model defaults)                                                                     |
| `overrideReasoning`        | `boolean` | `null`  | Enable reasoning on/off for ALL models (replaces model defaults)                                                         |
| `overrideKeywordDetection` | `boolean` | `null`  | Enable keyword detection on/off for ALL models (replaces model defaults)                                                 |
| `customKeywords`           | `array`   | `[]`    | Additional keywords to trigger automatic reasoning enhancement                                                           |
| `overrideKeywords`         | `boolean` | `false` | If `true`, ONLY `customKeywords` are used (default list ignored). If `false`, `customKeywords` are ADDED to default list |

**Important Notes:**

1. **Global Overrides Priority:** When set, these options override ALL model-specific configurations
2. **Custom Keywords Behavior:**
   - `overrideKeywords: false` (default) → Adds custom keywords to the default list (~40 keywords)
   - `overrideKeywords: true` → Replaces ALL default keywords with ONLY your custom keywords
3. **Keyword Detection Requirements:** Custom keywords only work when BOTH `reasoning=true` AND `keywordDetection=true`
4. **Null vs False:** Use `null` (omit the option) to use model defaults, use `false` to explicitly disable

**Examples:**

```json
// Example 1: Apply lower temperature for ALL models
"options": {
  "overrideTemperature": 0.5
}

// Example 2: Disable reasoning for ALL models
"options": {
  "overrideReasoning": false
}

// Example 3: Add custom keywords to default list
"options": {
  "customKeywords": ["blueprint", "strategy", "roadmap"]
}

// Example 4: Use ONLY custom keywords (ignore defaults)
"options": {
  "customKeywords": ["think", "analyze", "reason"],
  "overrideKeywords": true
}

// Example 5: Complete custom setup
"options": {
  "overrideMaxTokens": 90000,
  "overrideTemperature": 0.8,
  "overrideTopP": 0.95,
  "overrideReasoning": true,
  "overrideKeywordDetection": true,
  "customKeywords": ["design", "plan"],
  "overrideKeywords": false
}
```

---

### Claude Code Configuration

**File Location:**

- **Windows:** `%USERPROFILE%\.claude\settings.json`
- **macOS:** `~/.claude/settings.json`
- **Linux:** `~/.claude/settings.json`

**Example (Windows):**

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:3456",
    "ANTHROPIC_AUTH_TOKEN": "Dummy",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.6",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.6",
    "MAX_THINKING_TOKENS": "32768",
    "MAX_MCP_OUTPUT_TOKENS": "32768"
  },
  "model": "sonnet",
  "enableAllProjectMcpServers": true,
  "statusLine": {
    "type": "command",
    "command": "pwsh -NoProfile -ExecutionPolicy Bypass -Command \"& { . \\\"C:\\Users\\$env:USERNAME\\.claude\\statusline.ps1\\\" }\""
  },
  "alwaysThinkingEnabled": true
}
```

**StatusLine Example (macOS/Linux):**

```json
"statusLine": {
  "type": "command",
  "command": "~/.claude/statusline.sh",
}

```

**Don't forget to make the script executable:**

```bash
chmod +x ~/.claude/statusline.sh
```

---

## Transformer Files

### Production Transformer

**[→ View zai.js](zai.js)**

**Installation Location:**

- **Windows:** `%USERPROFILE%\.claude-code-router\plugins\zai.js`
- **macOS/Linux:** `~/.claude-code-router/plugins/zai.js`

---

### Debug Transformer

**[→ View zai-debug.js](zai-debug.js)**

**Installation Location:**

- **Windows:** `%USERPROFILE%\.claude-code-router\plugins\zai-debug.js`
- **macOS/Linux:** `~/.claude-code-router/plugins/zai-debug.js`

**Key Differences from Production:**

- ✓ Complete logging to `~/.claude-code-router/logs/zai-transformer-[timestamp].log`
- ✓ Automatic log rotation when file reaches 10 MB
- ✓ Records all decisions, transformations, and reasoning detection
- ✓ Shows request/response flow with detailed annotations
- ✓ Detailed request/response inspection with formatted JSON
- ✓ Tracking of keyword detection, ultrathink mode, and prompt enhancements

**Log Structure Example:**

```
❯ ccr start
Loaded JSON config from: C:\Users\Bedolla\.claude-code-router\config.json
[START] Z.ai Transformer (Debug) initialized
[CONFIG] ignoreSystemMessages: true
[CONFIG] Log file: C:\Users\Bedolla\.claude-code-router\logs\zai-transformer-2025-10-30T20-30-05.log
[CONFIG] Maximum size per file: 10.0 MB

╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
   [STAGE 1/3] INPUT: Claude Code CLI → CCR → transformRequestIn() [Request #1]
   Request RECEIVED from Claude Code, BEFORE sending to provider
╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

   [PROVIDER] LLM destination information:
   name: "ZAI"
   baseUrl: "https://api.z.ai/api/coding/paas/v4/chat/completions"
   models: [
     "glm-4.6",
     "glm-4.5",
     "glm-4.5v",
     "glm-4.5-air"
   ]
   transformer: [
     "zai"
   ]

   [CONTEXT] HTTP request from client:
   req: [_Request]

   [INPUT] Request received from Claude Code:
   model: "glm-4.6"
   max_tokens: 65537
   stream: true
   messages: 2 messages
    [0] system: 12395 chars - "You are Claude Code, Anthropic's official CLI for ..."
    [1] user: 650 chars - "<system-reminder> This is a reminder that your tod..."
   tools: 55 tools
    └─ [Task, Bash, Glob, Grep, ExitPlanMode, Read, Edit, Write, NotebookEdit, WebFetch, ... +45 more]
   tool_choice: undefined
   reasoning: {
     "effort": "high",
     "enabled": true
   }

   [OVERRIDE] Original max_tokens: 65537 → Override to 131072
   [TRANSLATION] Claude Code requests reasoning.enabled=true
   [APPLIED] Effective reasoning=true (model supports)
   [THINKING] Z.AI format applied
   [LAST USER MESSAGE] "<system-reminder>↕This is a reminder that your todo list is currently ..."
   [MESSAGE HASH] F60E417D (length: 509 chars)
   [REASONING] Effective: true | KeywordDetection: true | Keywords: true
   [ENHANCEMENT] ENHANCING PROMPT (effectiveReasoning + keywordDetection + keywords)
   [ENHANCEMENT] Reasoning instructions added to prompt
╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝


╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
   [STAGE 2/3] OUTPUT: transformRequestIn() → CCR → LLM Provider [Request #1]
   OPTIMIZED request to be sent to provider
╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

   [OUTPUT] Body to be sent to provider:
   model: "glm-4.6"
   max_tokens: 131072
   temperature: 1
   top_p: 0.95
   do_sample: true
   stream: true
   messages: 2 messages
    [0] system: 10667 chars - "You are Claude Code, Anthropic's official CLI for ..."
    [1] user: 763 chars - "<system-reminder> This is a reminder that your tod..."
   tools: 55 tools
    └─ [Task, Bash, Glob, Grep, ExitPlanMode, Read, Edit, Write, NotebookEdit, WebFetch, ... +45 more]
   tool_choice: undefined
   thinking: {
     "type": "enabled"
   }
   [EXTRAS]: reasoning
    └─ reasoning: {
         "effort": "high",
         "enabled": true
       }

   [ENHANCEMENT] Last user message was ENHANCED:
   Original: 509 chars → Enhanced: 763 chars (+254)
   [Reasoning instructions added to prompt]
╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝


╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
   [STAGE 3/3] LLM Provider → CCR → transformResponseOut() [Request #1]
   Response RECEIVED from provider, BEFORE sending to Claude Code
╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

   [RESPONSE OBJECT DETECTED]
   Response.ok: true
   Response.status: 200 OK
   Response.url: https://api.z.ai/api/coding/paas/v4/chat/completions
   Response.bodyUsed: false
   Content-Type: text/event-stream;charset=UTF-8

   NOTE: This is the original Response BEFORE CCR parsing.
   CCR will read the stream and convert it to Anthropic format for Claude Code.

╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝   

╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
   [STREAMING] Reading first chunks from Response
   RAW stream content BEFORE CCR parses it
╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

   [CHUNK 1] 177 bytes [THINKING] → {role:"assistant", content:"", reasoning_content:"↵"}
   [CHUNK 2] 165 bytes [THINKING] → {role:"assistant", reasoning_content:"The"}
   [CHUNK 3] 167 bytes [THINKING] → {role:"assistant", reasoning_content:" user"}
   [CHUNK 4] 168 bytes [THINKING] → {role:"assistant", reasoning_content:" wants"}
   [CHUNK 5] 165 bytes [THINKING] → {role:"assistant", reasoning_content:" me"}
   [CHUNK 6] 335 bytes [THINKING] → {role:"assistant", reasoning_content:" to"}
   [CHUNK 7] 173 bytes [THINKING] → {role:"assistant", reasoning_content:" JavaScript"}
   [CHUNK 8] 334 bytes [THINKING] → {role:"assistant", reasoning_content:" files"}
   [CHUNK 9] 167 bytes [THINKING] → {role:"assistant", reasoning_content:" find"}
   [CHUNK 10] 167 bytes [THINKING] → {role:"assistant", reasoning_content:" bugs"}
   [CHUNK 11] 163 bytes [THINKING] → {role:"assistant", reasoning_content:"."}
   [CHUNK 12] 332 bytes [THINKING] → {role:"assistant", reasoning_content:" They"}
   [CHUNK 13] 175 bytes [THINKING] → {role:"assistant", reasoning_content:" specifically"}
   [CHUNK 14] 172 bytes [THINKING] → {role:"assistant", reasoning_content:" mentioned"}
   [CHUNK 15] 165 bytes [THINKING] → {role:"assistant", reasoning_content:" ""}
   [CHUNK 16] 163 bytes [THINKING] → {role:"assistant", reasoning_content:"U"}
   [CHUNK 17] 165 bytes [THINKING] → {role:"assistant", reasoning_content:"ltr"}
   [CHUNK 18] 165 bytes [THINKING] → {role:"assistant", reasoning_content:"ath"}
   [CHUNK 19] 165 bytes [THINKING] → {role:"assistant", reasoning_content:"ink"}
   [CHUNK 20] 164 bytes [THINKING] → {role:"assistant", reasoning_content:"""}
   [STREAM] Limit of 20 chunks reached (more data exists)

   [SUCCESS] Reading completed - Original Response was NOT consumed

╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## StatusLine Scripts

### PowerShell StatusLine (Windows)

**File Location:** `%USERPROFILE%\.claude\statusline.ps1`

**Notes**:

- ✓ Compatible with PowerShell 7+
- ✓ Git status with detailed indicators (staged, modified, untracked, etc.)
- ✓ Branch tracking with ahead/behind commits
- ✓ Model name formatting (GLM 4.6, Claude, GPT, etc.)
- ✓ Cost tracking in USD
- ✓ Session duration formatting
- ✓ Code lines added/removed with net change
- ✓ Cross-platform emoji support


**Output Example:**

```
🗂️  ~/Projects/MyApp | 🍃 main ✅2 ✏️1 ⬆️1 | 🤖 GLM 4.6
💵 $0.15 USD | ⏱️ 5m 23s | ✏️ +127/-45 (Net: 82)
```

For the complete code, refer to [statusline.ps1](statusline.ps1) in the repository.

---

### Bash StatusLine (macOS/Linux)

**File Location:**

- **macOS/Linux:** `~/.claude/statusline.sh`

**Notes:**

- ✓ Same features as the PowerShell version
- ✓ Compatible with bash 4.0+ and zsh 5.0+

**Output Example:**

```
🗂️  ~/Projects/MyApp | 📦 No Git | 🤖 GLM 4.6
💵 $0.00 USD | ⏱️ 1s | ✏️ +0/-0 (Net: 0)
```

**Make script executable:**

```bash
chmod +x ~/.claude/statusline.sh
```

For the complete code, refer to [statusline.sh](statusline.sh) in the repository.

---

## Usage Instructions

There are **three ways** to use Claude Code with CCR. Choose the method that best fits your workflow:

### Method 1: Using `ccr code`

**Single command** - CCR handles everything automatically:

```bash
cd your-project-directory
ccr code
```

**Advantages:**
- No need to set `ANTHROPIC_AUTH_TOKEN`
- CCR automatically configures authentication
- Works immediately after installation
- Simplest method for local development
- No need to configure `APIKEY` in CCR config
- Can run multiple Claude Code CLI instances using `ccr code` command

**How it works:**
1. `ccr code` starts CCR server in the background
2. Automatically configures `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN`
3. Launches Claude Code CLI with correct settings
4. Everything runs in a single process

**Important:** This method **ONLY works with Claude Code CLI**. It does NOT work with the VS Code Extension. For VS Code Extension, use Method 3.

---

### Method 2: Using `ccr start` + `claude`

**Two separate processes** - More control and flexibility:

**Terminal 1 (Run CCR Server):**

```bash
ccr start
```

Expected output:

```
Loaded JSON config from: C:\Users\<Your-Username>\.claude-code-router\config.json
```

**Terminal 2 (Run Claude Code):**

```bash
cd your-project-directory
claude
```

**Requirements:**
- Must configure `ANTHROPIC_AUTH_TOKEN` in `~/.claude/settings.json` or `OS environment variables`
- If `APIKEY` is set, `ANTHROPIC_AUTH_TOKEN` must match `APIKEY` in CCR config
- If `APIKEY` is empty, `ANTHROPIC_AUTH_TOKEN` can be set to any value

**Advantages:**
- CCR runs independently (can restart Claude Code without restarting CCR)
- Better for debugging (separate logs)
- Can run multiple Claude Code CLI instances using `claude` command

**Configuration needed in `~/.claude/settings.json`  or `OS environment variables`:**
```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:3456",
    "ANTHROPIC_AUTH_TOKEN": "your-value-here"  // If APIKEY is set must match APIKEY in CCR config
  }
}
```

---

### Method 3: Using `ccr start` + Visual Studio Code Extension

**Important:** The `ccr code` command does NOT work with VS Code Extension. You MUST use `ccr start` separately.

**CCR + VS Code Extension** - GUI experience:

**Step 1: Start CCR Server**

```bash
ccr start
```

**Step 2: Configure VS Code Extension**

1. Install [Claude Code Extension](https://marketplace.visualstudio.com/items?itemName=Anthropic.claude-code) in VS Code
2. Configure in `~/.claude/settings.json` or `OS environment variables`:
   ```json
   {
     "env": {
       "ANTHROPIC_BASE_URL": "http://127.0.0.1:3456",
       "ANTHROPIC_AUTH_TOKEN": "your-value-here" // If APIKEY is not empty, must match APIKEY in CCR config
     }
   }
   ```

**Step 3: Bypass Login Screen (if shown)**

If the extension shows "How do you want to log in" screen:
1. Click **"Anthropic Console"** button
2. Extension will use the configured `ANTHROPIC_AUTH_TOKEN`
3. This bypasses the normal login flow

**Note:** The login screen only appears when CCR has `APIKEY` configured. With empty `APIKEY`, the extension connects directly.

**Advantages:**
- Full VS Code integration
- Visual interface
- Side-by-side code and chat

---

#### Bonus: JetBrains IDEs Extension

**Claude Code is also available for JetBrains IDEs** (IntelliJ IDEA, PyCharm, WebStorm, Rider, etc.)

**Plugin Link:** [Claude Code [Beta] - JetBrains Marketplace](https://plugins.jetbrains.com/plugin/27310-claude-code-beta-)

**How it works:**
1. Install the plugin from JetBrains Marketplace
2. A Claude Code button appears in your IDE toolbar
3. Click the button to launch Claude Code in the IDE's integrated terminal
4. The extension automatically:
   - Configures Claude Code for the current workspace
   - Pre-configures the IDE integration (no need for `/ide` command)
   - Opens Claude Code ready to work with your project

**Advantages:**
- Pre-configured Claude Code experience
- Integrated terminal within your JetBrains IDE
- Automatic workspace detection
- No manual IDE configuration needed
- One-click launch

**Setup:**
1. Start CCR server: `ccr start`
2. Configure `~/.claude/settings.json` or OS environment variables (same as Method 2/3)
3. Install the JetBrains plugin
4. Click the Claude Code button in your IDE

**Note:** This is similar to opening your JetBrains IDE's integrated terminal and running `claude` + configuring the IDE with `/ide` command, but fully automated.

---

### Quick Comparison

| Feature                  | `ccr code`      | `ccr start` + `claude` | `ccr start` + VS Code Extension |
|--------------------------|-----------------|------------------------|---------------------------------|
| **Configuration**        | None needed     | Manual                 | Manual                          |
| **ANTHROPIC_AUTH_TOKEN** | Auto-configured | Required               | Required                        |


### Understanding Reasoning Modes

The transformer provides **three levels of reasoning control**:

#### Level 1: Native Reasoning (Model-Decided)

When reasoning is enabled, the GLM models decide when to use their thinking capabilities.

**How to enable:**
- **Quick toggle:** Press `Tab` key during Claude Code session
- **File setting:** Set `"alwaysThinkingEnabled": true` in `~/.claude/settings.json`

**Behavior:**
- Model intelligently decides when reasoning is needed
- No prompt enhancement
- Natural, model-controlled thinking

**Example:**
```
Write a function to sort an array.
```
Model may or may not use reasoning, depending on complexity.

---

#### Level 2: Automatic Reasoning Enhancement (Keyword-Triggered)

When you use specific keywords, the transformer enhances reasoning by optimizing your prompt.

**Requirements:** This only works when **both** are true:
- `reasoning=true` (model supports native reasoning)
- `keywordDetection=true` (keyword detection enabled)

If either is false, keywords are ignored (model behaves normally).

**Keywords that trigger automatic reasoning enhancement:**
- **Counting:** how many, count, number of, total
- **Analysis:** analyze, reason, think, deduce, infer
- **Calculations:** calculate, solve, determine
- **Explanations:** explain, demonstrate, detail, step by step
- **Identification:** identify, find, search, locate
- **Comparisons:** compare, evaluate, verify, check

**Example:**
```
Can you analyze this code and explain how it works?
```

The transformer will:
1. Detect keywords "analyze" and "explain"
2. Add reasoning instructions to your prompt
3. Enable the model to use step-by-step thinking

---

#### Level 3: UltraThink Mode

**User-triggered via Claude Code CLI** - Type "ultrathink" anywhere in your message. Claude Code highlights this keyword with rainbow colors to indicate activation.

**How it works:**
1. You type "ultrathink" in your message (case-insensitive)
2. Claude Code → CCR → Transformer detects the keyword
3. Transformer activates thinking + adds reasoning instructions
4. Works independently of all configuration settings and global overrides

**Examples:**
```
ultrathink: How many letters are in "strawberry"?
```
```
How many distinct letters are in "Mississippi"? Ultrathink
```
```
Please ULTRATHINK this problem before answering.
```

---

### Sampling Control (Temperature & Top-P)

The transformer automatically ensures sampling parameters work correctly:

**Automatic Configuration:**
- Sets `do_sample=true` on every request (currently the Z.ai API default, but explicitly set in case the default changes)
- Applies model-specific temperature:
  - GLM 4.6: 1.0 (more creative)
  - GLM 4.5 variants: 0.6 (balanced)
- Applies top_p: 0.95 (the model considers only the most probable word choices that collectively represent 95% likelihood, ignoring very unlikely options)
---

## Troubleshooting

### CCR Won't Start

**Problem:** `ccr: command not found`

**Solution:**

```bash
npm install -g @musistudio/claude-code-router
```

Verify: `ccr version`

---

### Z.ai API Key Invalid

**Problem:** `401 Unauthorized` or `Invalid API Key`

**Solution:**

1. Verify API key at https://z.ai/manage-apikey/apikey-list
2. Update `config.json` with correct key (`"api_key": "YOUR_ZAI_API_KEY_HERE"`)
3. Restart CCR

---

### Thinking Not Working

**Problem:** Model isn't thinking/reasoning

**Checklist:**
    
1. ✓ Using Z.ai OpenAI-compatible endpoint (`https://api.z.ai/api/coding/paas/v4/chat/completions`)
2. ✓ `alwaysThinkingEnabled: true` in Claude Code settings
3. ✓ Transformer is loaded (check CCR startup log)
4. ✓ Try using `ultrathink` keyword to activate thinking

---

### Debug Logs Too Large

**Problem:** `zai-transformer-[timestamp].log` files growing too large

**Solution:**

The debug transformer automatically rotates logs at 10 MB. To adjust:

1. Edit `zai-debug.js`
2. Find line: `this.maxLogSize = this.options.maxLogSize || 10 * 1024 * 1024;`
3. Change `10` to desired MB limit (e.g., `5` for 5 MB)
4. Restart CCR

---

### Connection Fails with Specific IP

**Problem:** Claude Code can't connect to CCR even though CCR is running

**Cause:** CCR is bound to a specific IP address and Claude Code is trying to connect via `127.0.0.1`

**Solution:**

1. Check CCR's `config.json` for `HOST` and `PORT` values
2. If `HOST` uses a specific IP (e.g., `"HOST": "10.10.10.10"`) and `"PORT": 3456`, update `ANTHROPIC_BASE_URL` to match:
   ```json
   "ANTHROPIC_BASE_URL": "http://10.10.10.10:3456"
   ```
3. **Never use** `127.0.0.1` in `ANTHROPIC_BASE_URL` if CCR is bound to a specific LAN IP
4. Alternatively, set CCR's `HOST` to `"0.0.0.0"` to listen on all interfaces

**Example:**
- ✗ CCR: `"HOST": "10.10.10.10"` and `"PORT": 3456` + `"ANTHROPIC_BASE_URL": "http://127.0.0.1:3456"` → **Fails**
- ✓ CCR: `"HOST": "10.10.10.10"` and `"PORT": 3456` + `"ANTHROPIC_BASE_URL": "http://10.10.10.10:3456"` → **Works**

---

### Claude Code Not Displaying Thinking

**Problem:** Claude Code doesn't show the model's reasoning/thinking process, even when reasoning is active.

**Cause:** OpenAI-compatible providers (like Z.ai) send `reasoning_content` but don't include the `signature` field that Claude Code requires to display thinking blocks.

**Solution:** Add CCR's internal `"reasoning"` transformer to the provider configuration.

**Configuration in `config.json`:**

```json
{
  "name": "ZAI",
  "api_base_url": "https://api.z.ai/api/coding/paas/v4/chat/completions",
  "api_key": "YOUR_ZAI_API_KEY_HERE",
  "models": [
    "glm-4.6",
    "glm-4.5",
    "glm-4.5v",
    "glm-4.5-air"
  ],
  "transformer": {
    "use": [
      "zai",
      "reasoning" // ← Converts OpenAI's reasoning_content to Anthropic's thinking format
                  // ← Generates signatures to display thinking in Claude Code
    ]
  }
}
```

**What does `ReasoningTransformer` do?**

- Reads `reasoning_content` blocks from the provider's response
- Auto-generates signatures (`signature = Date.now().toString()`)
- Converts OpenAI format to Anthropic format with signatures
- Enables Claude Code to display: `∴ Thought for 1s (ctrl+o to show thinking)`

**Result:** Thinking blocks are now visible in Claude Code.

**References:**
- **ReasoningTransformer (source code):** https://github.com/musistudio/llms/blob/main/src/transformers/reasoning.transformer.ts
- **Anthropic Extended Thinking:** https://anthropic.mintlify.app/en/docs/build-with-claude/extended-thinking

---

### Using CCR Built-in Transformers Only

**Problem:** You want to use Z.ai with Claude Code but don't want to use the custom transformer (`zai.js`).

**Solution:** Use Claude Code Router's built-in transformers (`maxtoken`, `sampling`, `reasoning`) with model-specific configurations.

**Configuration in `config.json`:**

```json
{
  "LOG": false,
  "LOG_LEVEL": "debug",
  "HOST": "127.0.0.1",
  "PORT": 3456,
  "APIKEY": "",
  "API_TIMEOUT_MS": "600000",
  "PROXY_URL": "",
  "CUSTOM_ROUTER_PATH": "",
  "transformers": [],
  "Providers": [
    {
      "name": "ZAI",
      "api_base_url": "https://api.z.ai/api/coding/paas/v4/chat/completions",
      "api_key": "YOUR_ZAI_API_KEY_HERE",
      "models": [
        "glm-4.6",
        "glm-4.5",
        "glm-4.5v",
        "glm-4.5-air"
      ],
      "transformer": {
        "use": [
          ["maxtoken", {"max_tokens": 131072}],
          ["sampling", {"temperature": 1.0, "top_p": 0.95}],
          "reasoning"
        ],
        "glm-4.5": {
          "use": [
            ["maxtoken", {"max_tokens": 98304}],
            ["sampling", {"temperature": 0.6, "top_p": 0.95}]
          ]
        },
        "glm-4.5-air": {
          "use": [
            ["maxtoken", {"max_tokens": 98304}],
            ["sampling", {"temperature": 0.6, "top_p": 0.95}]
          ]
        },
        "glm-4.5v": {
          "use": [
            ["maxtoken", {"max_tokens": 16384}],
            ["sampling", {"temperature": 0.6, "top_p": 0.95}]
          ]
        }
      }
    }
  ],
  "Router": {
    "default": "ZAI,glm-4.6",
    "background": "ZAI,glm-4.6",
    "think": "ZAI,glm-4.6",
    "longContext": "ZAI,glm-4.6",
    "longContextThreshold": 204800,
    "webSearch": "ZAI,glm-4.6",
    "image": "ZAI,glm-4.5v"
  }
}
```

**What this configuration does:**

- **Provider level** (applies to GLM 4.6 by default):
  - `maxtoken`: Sets max output to 128K (131,072 tokens)
  - `sampling`: Sets temperature to 1.0 and top_p to 0.95
  - `reasoning`: Generates signatures for thinking blocks

- **Model-specific overrides**:
  - GLM 4.5 / 4.5-air: 96K output (98,304 tokens), temperature 0.6
  - GLM 4.5v: 16K output (16,384 tokens), temperature 0.6

---

## Additional Resources

- **Claude Code Router:** https://github.com/musistudio/claude-code-router
- **Claude Code Setup:** https://docs.claude.com/en/docs/claude-code/setup
- **Z.ai API Reference:** https://docs.z.ai/api-reference/llm/chat-completion
