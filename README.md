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
   - [Understanding Reasoning Hierarchy](#understanding-reasoning-hierarchy)
   - [Sampling Control (Temperature & Top-P)](#sampling-control-temperature--top-p)
9. [Troubleshooting](#troubleshooting)
   - [Quick Guide: Thinking/Reasoning Issues](#quick-guide-thinkingreasoning-issues)
   - [CCR Won't Start](#ccr-wont-start)
   - [Z.ai API Key Invalid](#zai-api-key-invalid)
   - [Thinking Not Working](#thinking-not-working)
   - [Claude Code Not Displaying Thinking](#claude-code-not-displaying-thinking)
   - [Model Still Thinking Despite Disabling It](#model-still-thinking-despite-disabling-it)
   - [Tools Not Working Correctly](#tools-not-working-correctly)
   - [Debug Logs Accumulation](#debug-logs-accumulation)
   - [Connection Fails with Specific IP](#connection-fails-with-specific-ip)
   - [Using CCR Built-in Transformers Only](#using-ccr-built-in-transformers-only)
10. [Additional Resources](#additional-resources)

---

## Overview

This guide explains how to configure **Claude Code (CC)** to work with **Z.ai's** OpenAI-Compatible Endpoint using **Claude Code Router (CCR)** with a custom transformer.

**Key Features:**

- ✓ **Resolves Claude Code's token limitations** - Automatically applies correct `max_tokens` for each model (GLM 4.6: 128K, GLM 4.5: 96K, GLM 4.5v: 16K)
- ✓ **Sampling control guaranteed** - Sets `do_sample=true` to ensure `temperature` and `top_p` always work
- ✓ **Native reasoning control** - Transformer can pass control to Claude Code (Tab key / `alwaysThinkingEnabled` setting)
- ✓ **Force Permanent Thinking mode** - Nuclear option: Forces thinking on EVERY message (ignores all other settings)
- ✓ **User tags for manual control** - `<Thinking:On|Off>`, `<Effort:Low|Medium|High>` for precise per-message control
- ✓ **Keyword detection** - Auto-detects analytical keywords (analyze, calculate, explain, etc.) and enhances prompts
- ✓ **"Ultrathink" mode** - Type "ultrathink" anywhere in your message for maximum reasoning (highlighted in rainbow colors)
- ✓ **Global Configuration Overrides** - Apply settings across ALL models (max_tokens, temperature, reasoning, keywords, etc.)
- ✓ **Cross-platform support** - Windows, macOS, Linux
- ✓ **Enhanced StatusLine** - Git integration with branch tracking and file changes

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
    },
    {
      "path": "C:\\Users\\<Your-Username>\\.claude-code-router\\plugins\\zai-debug.js",
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
          "zai",       // ← Change to "zai-debug" to enable debug logging
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
    "path": "/Users/<Your-Username>/.claude-code-router/plugins/zai.js",
    "options": {}
  },
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
    "path": "/home/<Your-Username>/.claude-code-router/plugins/zai.js",
    "options": {}
  },
  {
    "path": "/home/<Your-Username>/.claude-code-router/plugins/zai-debug.js",
    "options": {}
  }
]
```

**To switch between transformers:**

Simply change the `"use"` value in the provider configuration:
- Use `"zai"` for production (no logging)
- Use `"zai-debug"` for debugging (with detailed logs)

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
   
   **Reference:** This behavior is implemented in `src/index.ts` and `src/middleware/auth.ts` - https://github.com/musistudio/claude-code-router
   
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

| Option                      | Type      | Default | Description                                                                                                              |
|-----------------------------|-----------|---------|--------------------------------------------------------------------------------------------------------------------------|
| `forcePermanentThinking`    | `boolean` | `false` | Level 0 - Maximum Priority. Nuclear option for forcing thinking permanently (see note 5 below). |
| `overrideMaxTokens`         | `number`  | `null`  | Apply max_tokens for ALL models (replaces model defaults)                                                                |
| `overrideTemperature`       | `number`  | `null`  | Apply temperature for ALL models (replaces model defaults)                                                               |
| `overrideTopP`              | `number`  | `null`  | Apply top_p for ALL models (replaces model defaults)                                                                     |
| `overrideReasoning`         | `boolean` | `null`  | Enable reasoning on/off for ALL models (replaces model defaults)                                                         |
| `overrideKeywordDetection`  | `boolean` | `null`  | Enable keyword detection on/off for ALL models (replaces model defaults)                                                 |
| `customKeywords`            | `array`   | `[]`    | Additional keywords to trigger automatic reasoning enhancement                                                           |
| `overrideKeywords`          | `boolean` | `false` | If `true`, ONLY `customKeywords` are used (default list ignored). If `false`, `customKeywords` are ADDED to default list |

**Important Notes:**

1. **Global Overrides Priority:** When set, these options override ALL model-specific configurations
2. **Custom Keywords Behavior:**
   - `overrideKeywords: false` (default) → Adds custom keywords to the default list (~40 keywords)
   - `overrideKeywords: true` → Replaces ALL default keywords with ONLY your custom keywords
3. **Keyword Detection Requirements:** Custom keywords only work when BOTH `reasoning=true` AND `keywordDetection=true`
4. **Null vs False:** Use `null` (omit the option) to use model defaults, use `false` to explicitly disable
5. **forcePermanentThinking:** Forces `reasoning=true` + `effort=high` on EVERY message. Overrides ALL other settings (Ultrathink, User Tags, Global Overrides). User Tags like `<Thinking:Off>`, `<Effort:Low>`, `<Effort:Medium>` are completely ignored. Use ONLY when you want thinking 100% of the time. (Note: Inline user tags normally have HIGHER priority than global overrides, except when this option is active)

**Examples:**

```json
// Example 1: Force thinking permanently (Nuclear Option)
"options": {
  "forcePermanentThinking": true
}

// Example 2: Apply lower temperature for ALL models
"options": {
  "overrideTemperature": 0.5
}

// Example 3: Disable reasoning for ALL models
"options": {
  "overrideReasoning": false
}

// Example 4: Add custom keywords to default list
"options": {
  "customKeywords": ["blueprint", "strategy", "roadmap"]
}

// Example 5: Use ONLY custom keywords (ignore defaults)
"options": {
  "customKeywords": ["think", "analyze", "reason"],
  "overrideKeywords": true
}

// Example 6: Complete custom setup
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
    "command": "pwsh -NoProfile -ExecutionPolicy Bypass -Command \"& { $p = Join-Path $env:USERPROFILE '.claude\\statusline.ps1'; & $p }\""
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

For the complete code, see the [StatusLine Scripts](#statusline-scripts) section.

---

## Transformer Files

This project includes two transformer versions. You can install both and choose which one to use per model.

### Production Transformer (zai.js)

**[→ View zai.js](zai.js)**

**Transformer name:** `zai`

**Purpose:** Optimized for production use. Use when you want maximum performance and don't need logging overhead.

**Features:**
- Optimized for production use
- No logging overhead
- Minimal memory footprint
- All reasoning features included (keywords, User Tags, Ultrathink, 6-level hierarchy with priorities 0-5)

**When to use this transformer:**
- ✓ Production models where performance matters
- ✓ Everything is working correctly and you don't need logs
- ✓ You want the smallest memory footprint
- ✓ Stable models that don't require troubleshooting

**Installation Location:**
- **Windows:** `%USERPROFILE%\.claude-code-router\plugins\zai.js`
- **macOS/Linux:** `~/.claude-code-router/plugins/zai.js`

---

### Debug Transformer (zai-debug.js)

**[→ View zai-debug.js](zai-debug.js)**

**Transformer name:** `zai-debug`

**Purpose:** Troubleshooting and debugging transformer. Use when you need to understand what's happening inside the reasoning system or diagnose problems with model behavior.

**Features:**
- Complete logging to `~/.claude-code-router/logs/zai-transformer-[timestamp].log`
- Automatic log rotation at 10 MB
- Records all decisions, transformations, and reasoning detection
- Shows request/response flow with detailed annotations
- Tracking of keyword detection, Ultrathink mode, and prompt enhancements
- Helps diagnose: why reasoning isn't triggering, tool calling issues, configuration problems

**When to use this transformer:**
- ✓ Model not entering think mode when expected
- ✓ Debugging keyword detection (is my keyword being recognized?)
- ✓ Investigating Ultrathink behavior
- ✓ Verifying User Tags are working (`<Thinking:On>`, `<Effort:High>`)
- ✓ Checking if global config overrides are applied correctly
- ✓ Analyzing why certain prompts behave differently
- ✓ Preparing detailed logs for bug reports or support

**Installation Location:**
- **Windows:** `%USERPROFILE%\.claude-code-router\plugins\zai-debug.js`
- **macOS/Linux:** `~/.claude-code-router/plugins/zai-debug.js`

---

### Using Both Transformers Simultaneously

You can install both transformers and call them individually per model. This allows you to:

- **Use production transformer (`zai`)** for models you trust and want maximum performance
- **Use debug transformer (`zai-debug`)** for models where you're troubleshooting issues, testing new configurations, or need detailed logs

**When to use `zai` (production):**
- ✓ Stable models in production environment
- ✓ Performance is critical
- ✓ You don't need logging overhead
- ✓ Everything works as expected

**When to use `zai-debug` (debug):**
- ✓ Troubleshooting reasoning issues (why model isn't using think mode)
- ✓ Debugging tool calling problems (tools not being invoked correctly)
- ✓ Testing new keyword detection or Ultrathink mode
- ✓ Investigating unexpected model behavior
- ✓ Analyzing request/response transformations
- ✓ Verifying configuration changes are working
- ✓ Log files needed for issue reporting

**Configuration example:**

```json
{
  "transformers": [
    {
      "path": "C:\\Users\\<Your-Username>\\.claude-code-router\\plugins\\zai.js",
      "options": {}
    },
    {
      "path": "C:\\Users\\<Your-Username>\\.claude-code-router\\plugins\\zai-debug.js",
      "options": {}
    }
  ],
  "Providers": [
    {
      "name": "ZAI",
      "transformer": {
        "glm-4.6": {
          "use": [
            "zai",           // ← Uses production transformer (no logging)
            "reasoning"
          ]
        },
        "glm-4.5": {
          "use": [
            "zai-debug",     // ← Uses debug transformer (with logging)
            "reasoning"
          ]
        }
      }
    }
  ]
}
```

**Important:** The transformer name in `"use"` must match the `name` property in the transformer class:
- `zai.js` exports `name = "zai"`
- `zai-debug.js` exports `name = "zai-debug"`

**Typical setup strategies:**
1. **Performance-first:** Use `"zai"` on all models except when actively debugging
2. **Debug-first:** Use `"zai-debug"` on experimental models, `"zai"` on proven ones
3. **Hybrid:** Use `"zai-debug"` on one model for testing, `"zai"` on others for comparison

**Log Structure Example:**

```
❯ ccr start
Loaded JSON config from: C:\Users\Bedolla\.claude-code-router\config.json
[START] Z.ai Transformer (Debug) initialized
[CONFIG] Log file: C:\Users\Bedolla\.claude-code-router\logs\zai-transformer-2025-10-25T05-25-55.log
[CONFIG] Maximum size per file: 10.0 MB

╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
   [STAGE 1/3] INPUT: Claude Code → CCR → transformRequestIn() [Request #1]
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
     "zai-debug"
   ]

   [CONTEXT] HTTP request from client:
   req: [_Request]

   [INPUT] Request received from Claude Code:
   model: "glm-4.6"
   max_tokens: 32769
   stream: true
   messages: 2 messages
    [0] system: 14154 chars - "You are Claude Code, Anthropic's official CLI for ..."
    [1] user: 3426 chars - "<system-reminder> This is a reminder that your tod..."
   tools: 53 tools
    └─ [Task, Bash, Glob, Grep, ExitPlanMode, Read, Edit, Write, NotebookEdit, WebFetch, ... +43 more]
   tool_choice: undefined
   reasoning: {
     "effort": "high",
     "enabled": true
   }

   [OVERRIDE] Original max_tokens: 32769 → Override to 131072

   [CUSTOM TAGS] Searching for tags in user messages...
   [SYSTEM] Message 1 ignored (system-reminder)
   [INFO] No custom tags detected in messages

   [REASONING] Determining effective configuration...
   [PRIORITY 4] Model config: reasoning=true → reasoning=true, effort=high
   [RESULT] Effective reasoning=true, effort level=high

   [CLEANUP] Removing tags from messages...
   [INFO] No tags found to remove

   [REASONING FIELD] Adding reasoning field to request...
   [INFO] Active conditions detected, overriding reasoning
   reasoning.enabled = true
   reasoning.effort = "high"
   [THINKING] Z.AI format applied

   [KEYWORDS] Checking for analytical keywords in ALL user messages...
   [MESSAGE 1] system-reminder ignored
   [RESULT] No keywords detected in any message
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
    [0] system: 14154 chars - "You are Claude Code, Anthropic's official CLI for ..."
    [1] user: 3426 chars - "<system-reminder> This is a reminder that your tod..."
   tools: 53 tools
    └─ [Task, Bash, Glob, Grep, ExitPlanMode, Read, Edit, Write, NotebookEdit, WebFetch, ... +43 more]
   tool_choice: undefined
   thinking: {
     "type": "enabled"
   }
   [EXTRAS]: reasoning
    └─ reasoning: {
         "enabled": true,
         "effort": "high"
       }
╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝


╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗
   [STAGE 3/3] LLM Provider → CCR → transformResponseOut() [Request #1]
   Response RECEIVED from provider, BEFORE sending to Claude Code
╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝

   [INFO] Response for Request #1 | Response Object ID: 1762148421903-3

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
   [CHUNK 3] 335 bytes [THINKING] → {role:"assistant", reasoning_content:" user"}
   [CHUNK 4] 165 bytes [THINKING] → {role:"assistant", reasoning_content:" me"}
   [CHUNK 5] 165 bytes [THINKING] → {role:"assistant", reasoning_content:" to"}
   [CHUNK 6] 170 bytes [THINKING] → {role:"assistant", reasoning_content:" analyze"}
   [CHUNK 7] 166 bytes [THINKING] → {role:"assistant", reasoning_content:" the"}
   [CHUNK 8] 333 bytes [THINKING] → {role:"assistant", reasoning_content:" code"}
   [CHUNK 9] 334 bytes [THINKING] → {role:"assistant", reasoning_content:" find"}
   [CHUNK 10] 163 bytes [THINKING] → {role:"assistant", reasoning_content:"."}
   [CHUNK 11] 167 bytes [THINKING] → {role:"assistant", reasoning_content:" They"}
   [CHUNK 12] 167 bytes [THINKING] → {role:"assistant", reasoning_content:" also"}
   [CHUNK 13] 172 bytes [THINKING] → {role:"assistant", reasoning_content:" mentioned"}
   [CHUNK 14] 165 bytes [THINKING] → {role:"assistant", reasoning_content:" ""}
   [CHUNK 15] 328 bytes [THINKING] → {role:"assistant", reasoning_content:"U"}
   [CHUNK 16] 165 bytes [THINKING] → {role:"assistant", reasoning_content:"ath"}
   [CHUNK 17] 165 bytes [THINKING] → {role:"assistant", reasoning_content:"ink"}
   [CHUNK 18] 164 bytes [THINKING] → {role:"assistant", reasoning_content:"""}
   [CHUNK 19] 336 bytes [THINKING] → {role:"assistant", reasoning_content:" which"}
   [CHUNK 20] 165 bytes [THINKING] → {role:"assistant", reasoning_content:" be"}
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


### Understanding Reasoning Hierarchy

The transformer implements a **6-level reasoning hierarchy** with clear priorities. Higher levels override lower levels.

---

#### Level 0: Force Permanent Thinking (MAXIMUM PRIORITY - Nuclear Option)

**Configuration-based permanent override** - Set `forcePermanentThinking: true` in transformer options.

**Behavior:**
- ✓ Forces `reasoning = true`  
- ✓ Forces `effort = high`
- ✓ Overrides **EVERYTHING** (Ultrathink, User Tags, Global Overrides, Model Config, Default)
- ✓ No way to disable thinking once enabled (not even Ultrathink can override it)
- ✗ User Tags like `<Thinking:Off>`, `<Effort:Low>`, `<Effort:Medium>` are **completely ignored**
- ✗ No method can disable or reduce thinking when this option is active

**Configuration example:**

```json
"transformers": [
  {
    "path": "~/.claude-code-router/plugins/zai.js",
    "options": {
      "forcePermanentThinking": true  // ← Maximum priority, overrides ALL other settings
    }
  }
]
```

**When to use:**
- Development/testing environments where you always want full reasoning traces
- Research scenarios where consistent reasoning is required
- Debugging complex problems where thinking should never be skipped

**When NOT to use:**
- Production environments (no flexibility)
- When you need to toggle thinking on/off
- When you want User Tags or Ultrathink to work
- When you want control over reasoning behavior

**Implementation:** Applied immediately in transformer logic, before any other checks.

---

#### Level 1: Ultrathink Mode (HIGHEST PRIORITY)

**User-triggered via Claude Code CLI** - Type "ultrathink" anywhere in your message. Claude Code highlights this keyword with rainbow colors to indicate activation.

**Behavior:**
- ✓ Forces `reasoning = true`
- ✓ Forces `effort = high`
- ✓ Adds reasoning instructions to prompt
- ✓ Overrides ALL other settings (global overrides, model config, default, user tags)
- ✓ Keyword is **kept in the message** (visible to the model)
- ✗ Cannot override Force Permanent Thinking (Level 0)

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

**Implementation:** The keyword is kept in the message (visible to the model).

---

#### Level 2: User Tags (HIGH PRIORITY)

**Manual control via inline tags** - Add simple tags anywhere in your message to control reasoning behavior.

**Available tags:**

```
<Thinking:On>    <!-- Enables reasoning -->
<Thinking:Off>   <!-- Disables reasoning -->

<Effort:Low>     <!-- Low effort -->
<Effort:Medium>  <!-- Medium effort -->
<Effort:High>    <!-- High effort -->
```

**Key points:**
- Tags are **case insensitive** (`<Thinking:On>`, `<thinking:on>`, `<THINKING:ON>` are equivalent)
- Tags are **inline and self-contained** (they don't wrap content)
- Can be placed **anywhere** in your message (beginning, middle, or end)
- Can be **combined** in any order
- Are **removed from the message** before sending to the model (not visible to the model)

**Examples:**

```
<Thinking:On> Analyze the performance of this sorting algorithm.
```

```
Calculate the anagrams for "Mississippi" <Effort:High>
```

```
<Effort:Low><Thinking:On> Quick summary of this code please.
```

```
<Thinking:On> What's the time complexity? <Effort:Medium>
```

```
Just give me a quick answer <Thinking:Off>
```

**Behavior:**
- ✓ Overrides global configuration (Level 3)
- ✓ Overrides model-specific config (Level 4)
- ✓ Overrides default behavior (Level 5)
- ✗ Cannot override Force Permanent Thinking (Level 0)
- ✗ Cannot override Ultrathink (Level 1)

**Tag Removal Behavior:**
- **User Tags are removed**: `<Thinking:On>`, `<Thinking:Off>`, `<Effort:Low|Medium|High>` are stripped from the message before sending to the model
- **Ultrathink keyword is kept**: The word "ultrathink" remains in the message and is visible to the model

---

#### Level 3: Global Configuration Override (MEDIUM PRIORITY)

**Configuration in `config.json`** - Apply settings across ALL models.

**Example:**
```json
"transformers": [
  {
    "path": "~/.claude-code-router/plugins/zai.js",
    "options": {
      "overrideReasoning": true,
      "overrideKeywordDetection": true
    }
  }
]
```

**Behavior:**
- ✓ Overrides Model Config (Level 4)
- ✗ Cannot override Force Permanent Thinking (Level 0)
- ✗ Cannot override Ultrathink (Level 1)
- ✗ Cannot override User Tags (Level 2)

---

#### Level 4: Model Configuration (LOW PRIORITY)

**Per-model settings** - Configure reasoning per model in transformer code.

**Default configurations for Z.AI GLM models:**
```javascript
modelConfigurations = {
  "glm-4.6": { reasoning: true, keywordDetection: true },
  "glm-4.5": { reasoning: true, keywordDetection: true },
  "glm-4.5-air": { reasoning: true, keywordDetection: true },
  "glm-4.5v": { reasoning: true, keywordDetection: true }
}
```

**Behavior:**
- ✗ Cannot override Force Permanent Thinking (Level 0)
- ✗ Cannot override Ultrathink (Level 1)
- ✗ Cannot override User Tags (Level 2)
- ✗ Cannot override Global Configuration (Level 3)

**Note:** With `reasoning: true` (default), the transformer always enables thinking. To allow Claude Code's native toggle to work, set `reasoning: false` for all models.

---

#### Level 5: Default (Native Control)

**Passthrough mode** - Transformer passes control to Claude Code when no other levels are active.

**Behavior:**
- ✓ Transformer passes `request.reasoning` from Claude Code unchanged
- ✓ Claude Code's Tab key works (toggle thinking on/off)
- ✓ `alwaysThinkingEnabled` setting in `~/.claude/settings.json` works
- ✓ Model decides when to use reasoning based on Claude Code's request
- ✗ Cannot override Force Permanent Thinking (Level 0)
- ✗ Cannot override Ultrathink (Level 1)
- ✗ Cannot override User Tags (Level 2)
- ✗ Cannot override Global Configuration (Level 3)
- ✗ Cannot override Model Config (Level 4)

**Important:** With default configuration (`reasoning: true` for all models), Level 4 is **always active**, so Level 5 is **never reached**. The transformer always controls reasoning, and Claude Code's native toggle does not work.

**To enable Level 5 (Native Control):**

Edit transformer code and set `reasoning: false` for all models:

```javascript
'glm-4.6': {
  reasoning: false,  // ← Change from true to false
  keywordDetection: true,
  // ...
}
```

**Trade-offs:**
- ✓ Claude Code's Tab key and settings work
- ✗ Lose automatic reasoning activation for keywords and Ultrathink
- ✗ Lose User Tags control (`<Thinking:On>`, `<Effort:High>`)
- ✗ Lose Global Override control

---

### Reasoning Hierarchy Priority Table

**Note:** With default configuration (`reasoning: true` for all models), Level 4 is always active, preventing Level 5 from being reached. Claude Code's native toggle (Tab key / `alwaysThinkingEnabled` setting) does not have effect unless you set `reasoning: false` for all models.

| Priority | Level | Source | Overrides | Can be overridden by | Active by Default? |
|----------|-------|--------|-----------|----------------------|--------------------|
| **0** (Maximum) | Force Permanent Thinking | `forcePermanentThinking: true` in options | All (1-5) | None (Nuclear Option - ignores all tags) | No |
| **1** (Highest) | Ultrathink | Message keyword "ultrathink" | 2-5 | 0 | No (user-triggered) |
| **2** | User Tags | `<Thinking:On\|Off>`, `<Effort:...>` | 3-5 | 0-1 | No (user-triggered) |
| **3** | Global Override | `config.json` options | 4-5 | 0-2 | No (optional config) |
| **4** | Model Config | Transformer code (`reasoning: true` by default) | 5 | 0-3 | **YES (always active)** |
| **5** (Lowest) | Native Control | Claude Code's `request.reasoning` | None | 0-4 | **NO (unreachable by default)** |

---

### Keyword-Based Prompt Enhancement

**Note:** This is NOT a priority level, but a feature that activates when conditions are met.

**Activation requirements (ALL must be true):**
1. ✓ `reasoning = true` (from any level 0-6)
2. ✓ `keywordDetection = true` (from any level 0-6)
3. ✓ Keywords detected in message text

**When activated:** Transformer automatically enhances prompt with reasoning instructions.

**Keywords that trigger enhancement (51 English keywords):**

**Note:** The table below shows a summary of keyword categories. The complete list of 51 keywords is implemented in the transformer code (zai.js / zai-debug.js).

| Category | Keywords |
|----------|----------|
| **Counting** | how many, count, number of, total, quantity |
| **Analysis** | analyze, analyse, reason, think, deduce, infer, examine |
| **Calculations** | calculate, solve, determine, compute |
| **Explanations** | explain, demonstrate, detail, step by step, walk through |
| **Identification** | identify, find, search, locate, discover |
| **Comparisons** | compare, contrast, evaluate, assess, verify, check |

**Example:**
```
Can you analyze this code and explain how it works?
```

Transformer detects "analyze" and "explain" → Adds reasoning instructions to prompt.

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

### Quick Guide: Thinking/Reasoning Issues

**If you experience any problems with thinking or reasoning:**

| Problem | See Section |
|---------|-------------|
| Model not thinking when expected | [Thinking Not Working](#thinking-not-working) |
| Thinking blocks not visible in Claude Code | [Claude Code Not Displaying Thinking](#claude-code-not-displaying-thinking) |
| Model keeps thinking despite disabling it | [Model Still Thinking Despite Disabling It](#model-still-thinking-despite-disabling-it) |

**Common Solution for Mixed Transformer Issues:**

If you're using both `zai` and `reasoning` transformers together and experiencing conflicts, use only `zai`:

```json
"transformer": {
  "glm-4.6": {
    "use": [
      "zai"  // ← Only use the custom transformer (removes reasoning conflicts)
    ]
  }
}
```

**Result:** Everything works perfectly (reasoning control, keywords, Ultrathink, User Tags, all features).

**Trade-off:** Thinking blocks won't display in Claude Code UI (but thinking still happens normally).

**Alternative:** If you must see thinking blocks displayed, use [CCR Built-in Transformers Only](#using-ccr-built-in-transformers-only) instead of custom transformers.

---

### Thinking Not Working

**Problem:** Model isn't thinking/reasoning when you expect it to.

**Common Causes & Solutions:**

1. **Model has `reasoning: true` enabled (default)**
   - With default configuration, reasoning is always active
   - The transformer enables thinking automatically
   - Solution: This is expected behavior. Reasoning should work by default.

2. **Using `overrideReasoning: false` in global options**
   - Check `config.json` transformer options
   - If `overrideReasoning: false` is set, reasoning is disabled globally
   - Solution: Remove this option or set to `true`

3. **Transformer not loaded properly**
   - Check CCR startup log for transformer loading confirmation
   - Verify path in `config.json` points to correct transformer file
   - Solution: Fix path and restart CCR

4. **Using `<Thinking:Off>` tag**
   - User Tags override model configuration
   - Solution: Remove tag or use `<Thinking:On>`

5. **Force activation methods:**
   - Use `ultrathink` keyword in your message
   - Use `<Thinking:On>` tag
   - Use `<Effort:High>` tag

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

**Reference:** Source code at https://github.com/musistudio/llms/blob/main/src/transformer/reasoning.transformer.ts
- Converts OpenAI format to Anthropic format with signatures
- Enables Claude Code to display: `∴ Thought for 1s (ctrl+o to show thinking)`

**Result:** Thinking blocks are now visible in Claude Code.

**References:**
- **ReasoningTransformer (source code):** https://github.com/musistudio/llms/blob/main/src/transformer/reasoning.transformer.ts
- **Anthropic Extended Thinking:** https://anthropic.mintlify.app/en/docs/build-with-claude/extended-thinking

---

### Model Still Thinking Despite Disabling It

**Problem:** You want to disable thinking but the model continues to use reasoning.

**Most Common Cause:** Using CCR's built-in `reasoning` transformer alongside `zai`

If you have this configuration:

```json
"transformer": {
  "glm-4.6": {
    "use": [
      "zai",
      "reasoning"  // ← This can override your reasoning settings
    ]
  }
}
```

**What CCR's `reasoning` transformer does:**
- Converts reasoning responses to display thinking blocks in Claude Code
- **Side effect:** When `enable: true` (default), it forces `reasoning: { enabled: true }` on every request
- This overrides the custom transformer's reasoning settings

**Quick Solution:** Remove `"reasoning"` from the `use` array:

```json
"transformer": {
  "glm-4.6": {
    "use": [
      "zai"  // ← Only use the custom transformer
    ]
  }
}
```

**Result:**
- ✓ All reasoning control works perfectly (Level hierarchy, keywords, Ultrathink, User Tags)
- ✓ Model respects your reasoning settings correctly
- ✗ You won't see thinking blocks displayed in Claude Code UI (but thinking still happens if enabled)

---

**Other Causes and Solutions:**

**Root Cause:** The custom transformer (`zai.js` / `zai-debug.js`) has `reasoning: true` enabled by default for all GLM models:

```javascript
modelConfigurations = {
  "glm-4.6": { reasoning: true, ... },
  "glm-4.5": { reasoning: true, ... },
  "glm-4.5-air": { reasoning: true, ... },
  "glm-4.5v": { reasoning: true, ... }
}
```

This makes the transformer **always control reasoning** (Level 4 always active), preventing Level 5 (Native Control) from being reached. Claude Code's native toggle (Tab key / `alwaysThinkingEnabled` setting) does not work.

**Why Claude Code's toggle doesn't work:**

When `reasoning: true` is set in model configuration (Level 4), the transformer always has "active conditions":

```javascript
const hasActiveConditions = ... || config.reasoning === true;  // Always true
```

This causes the transformer to **always control reasoning** and prevents Level 5 (Native Control) from activating. The transformer never passes `request.reasoning` from Claude Code to the model.

**Alternative Solutions:**

**Option 1: Use User Tags to disable thinking per message**

Use `<Thinking:Off>` in your messages:

```
<Thinking:Off> Just give me a quick answer without deep reasoning
```

User Tags (Level 2) override Model Config (Level 4).

**Option 2: Set global override to disable reasoning**

In `config.json`, add `overrideReasoning: false`:

```json
"transformers": [
  {
    "path": "~/.claude-code-router/plugins/zai.js",
    "options": {
      "overrideReasoning": false  // ← Disables reasoning for ALL models
    }
  }
]
```

Global Override (Level 3) takes precedence over Model Config (Level 4).

**Option 3: Modify transformer code to enable Level 5 (Native Control)**

Edit `zai.js` and change all models to `reasoning: false`:

```javascript
'glm-4.6': {
  reasoning: false,  // ← Change from true to false
  // ...
}
```

**Result:** Level 4 becomes inactive, allowing Level 5 (Native Control) to activate. Claude Code's Tab key and `alwaysThinkingEnabled` setting will work.

**Trade-offs:**
- ✓ Claude Code's native toggle works
- ✗ Lose automatic reasoning activation for keywords and Ultrathink mode
- ✗ Lose User Tags control (`<Thinking:On>`, `<Effort:High>`)
- ✗ Lose Global Override control

**Note:** The model can still think/reason internally based on your settings. You just won't see the visual thinking blocks in the Claude Code interface.

---

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

### Tools Not Working Correctly

**Problem:** Model doesn't call tools when it should, gets stuck in tool-calling loops, or generates "invalid JSON" errors in tool arguments.

**Root Causes:**
1. Model doesn't understand when to use tools
2. Model doesn't know how to exit tool mode
3. Model generates malformed JSON for tool arguments
4. Streaming responses fragment tool call data

**Solution:** Use CCR's built-in `tooluse` and `enhancetool` transformers.

#### What These Transformers Do

**`tooluse` (Tool Mode Manager):**
- **Problem it solves:** Models sometimes don't call tools when they should, or get stuck in infinite tool-calling loops.
- **Solution:** Injects system instructions for tool mode, forces the model to call a tool (`tool_choice: required`), and automatically adds a special `ExitTool` that allows the model to exit tool mode when it completes its task.

**`enhancetool` (JSON Argument Fixer):**
- **Problem it solves:** Models sometimes generate malformed JSON in tool arguments (missing quotes, extra commas, etc.), causing parsing errors.
- **Solution:** Implements a 3-level cascade parsing system:
  1. **Standard JSON:** Tries normal parsing
  2. **JSON5:** If it fails, uses JSON5 which tolerates relaxed syntax (trailing commas, comments, etc.)
  3. **jsonrepair:** If it still fails, attempts to automatically repair JSON (adds missing quotes, fixes structures, etc.)

#### Configuration Example

**Add to your `config.json`:**

```json
{
  "Providers": [
    {
      "name": "ZAI",
      "transformer": {
        "glm-4.6": {
          "use": [
            "zai",          // ← The custom transformer
            "reasoning",
            "tooluse",      // ← Manages tool mode lifecycle
            "enhancetool"   // ← Parses tool arguments robustly
          ]
        }
      }
    }
  ]
}
```

**Order matters:** `tooluse` should come before `enhancetool`.

#### Important Notes

1. **`ExitTool` depends on the model:** The effectiveness of `tooluse` depends on the model correctly understanding and using `ExitTool`. Most models handle this well, but some may occasionally fail to invoke it or invoke it prematurely.

2. **`tool_choice: required` forces calls:** The `tooluse` transformer forces the model to call a tool. This is crucial for tool mode but could lead to unexpected behavior if the model struggles to find a suitable tool.

3. **Parsing fallback:** While `enhancetool` is very robust, extremely malformed arguments might still fail. In such cases, the system logs an error and returns an empty JSON object as fallback.

4. **Universal compatibility:** These transformers work with any OpenAI-compatible provider (Z.AI, nVidia, OpenRouter, etc.).

#### When to Use These Transformers

Use these transformers when:
- Model doesn't call tools when it should
- Model gets stuck in infinite tool-calling loops
- You see "invalid JSON in tool arguments" errors
- Tool calls work inconsistently across different models
- You want a guaranteed tool mode exit mechanism

#### References

- **CCR Repository:** https://github.com/musistudio/llms
- **Source Code:** 
  - `tooluse`: https://github.com/musistudio/llms/blob/main/src/transformer/tooluse.transformer.ts
  - `enhancetool`: https://github.com/musistudio/llms/blob/main/src/transformer/enhancetool.transformer.ts

---

### Debug Logs Accumulation

**Problem:** Multiple rotated log files accumulating in `~/.claude-code-router/logs/` directory

**Cause:** The debug transformer automatically rotates logs when a file reaches 10 MB. Each session creates files named:
- `zai-transformer-[timestamp].log` (current, up to 10 MB)
- `zai-transformer-[timestamp]-part1.log` (rotated, 10 MB)
- `zai-transformer-[timestamp]-part2.log` (rotated, 10 MB)
- And so on...

**Solutions:**

**Option 1: Delete old logs manually**
```bash
# Windows (PowerShell)
Remove-Item "$env:USERPROFILE\.claude-code-router\logs\zai-transformer-*.log"

# macOS/Linux
rm ~/.claude-code-router/logs/zai-transformer-*.log
```

**Option 2: Reduce rotation size (creates smaller files, but more frequently)**

1. Edit `zai-debug.js`
2. Find line: `this.maxLogSize = this.options.maxLogSize || 10 * 1024 * 1024;`
3. Change `10` to desired MB limit (e.g., `5` for 5 MB)
4. Restart CCR

**Note:** Reducing the rotation size does NOT prevent accumulation, it only creates smaller files more frequently.

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
        "glm-4.6": {
          "use": [            
            ["reasoning", {"enable": true}],
            ["maxtoken", {"max_tokens": 131072}],
            ["sampling", {"temperature": 1.0, "top_p": 0.95}],
          ]
        },
        "glm-4.5": {
          "use": [
            ["reasoning", {"enable": true}],
            ["maxtoken", {"max_tokens": 98304}],
            ["sampling", {"temperature": 0.6, "top_p": 0.95}]
          ]
        },
        "glm-4.5-air": {
          "use": [
            ["reasoning", {"enable": true}],
            ["maxtoken", {"max_tokens": 98304}],
            ["sampling", {"temperature": 0.6, "top_p": 0.95}]
          ]
        },
        "glm-4.5v": {
          "use": [
            ["reasoning", {"enable": true}],
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
