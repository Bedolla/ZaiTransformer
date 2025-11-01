// ============================================================================
// Z.AI TRANSFORMER FOR CLAUDE CODE ROUTER (DEBUG)
// ============================================================================
//
// PURPOSE: Claude Code Router Transformer for Z.ai's OpenAI-Compatible Endpoint
//          Solves Claude Code CLI limitations and enables advanced features.
//          DEBUG VERSION: Complete logging and transformation tracking.
//
// FLOW: Claude Code CLI → This Transformer → Z.AI OpenAI-Compatible Endpoint
//
// KEY FEATURES:
//
// 1. MAX OUTPUT TOKENS FIX (Primary Solution)
//    - Problem: Claude Code CLI limits max_tokens to 32K/64K
//    - Solution: Transformer overrides to real model limits
//      • GLM 4.6:     128K (131,072 tokens)
//      • GLM 4.5:     96K  (98,304 tokens)
//      • GLM 4.5-air: 96K  (98,304 tokens)
//      • GLM 4.5v:    16K  (16,384 tokens)
//
// 2. SAMPLING CONTROL (Guaranteed)
//    - Sets do_sample=true to ensure temperature and top_p always work
//    - Applies model-specific temperature and top_p values
//
// 3. NATIVE REASONING CONTROL (Model-Decided)
//    - When reasoning=true: Model decides when to use reasoning
//    - When reasoning=false: Reasoning completely disabled
//    - Translation: Claude Code reasoning.enabled → Z.AI thinking.type
//
// 4. KEYWORD-BASED PROMPT ENHANCEMENT (Auto-Detection)
//    - Detects analytical keywords: analyze, calculate, count, explain, etc.
//    - Automatically adds reasoning instructions to user prompt
//    - REQUIRES: reasoning=true AND keywordDetection=true (both must be true)
//    - If either is false, keywords are ignored
//
// 5. ULTRATHINK MODE (User-Triggered via Claude Code CLI)
//    - User types "ultrathink" anywhere in their message
//    - Enables enhanced reasoning with prompt optimization
//    - WORKS INDEPENDENTLY: Does NOT require reasoning or keywordDetection
//    - NOT AFFECTED by global overrides (works independently of settings)
//    - Highest precedence, always enabled when detected
//
// 6. GLOBAL CONFIGURATION OVERRIDES (Optional)
//    - Override settings across ALL models via options
//    - overrideMaxTokens: Override max_tokens globally
//    - overrideTemperature: Override temperature globally
//    - overrideTopP: Override top_p globally
//    - overrideReasoning: Override reasoning on/off globally
//    - overrideKeywordDetection: Override keyword detection globally
//    - customKeywords: Add or replace keyword list
//    - overrideKeywords: Use ONLY custom keywords (true) or add to defaults (false)
//    - NOTE: Ultrathink works independently of global overrides
//
// REASONING HIERARCHY (4 Levels):
//   Level 4: ultrathink keyword → Enhanced reasoning + prompt optimization
//   Level 3: reasoning.enabled=false → Disable all reasoning
//   Level 3: reasoning.enabled=true → Enable native reasoning
//   Level 2: reasoning=true + keywordDetection=true + keywords → Auto prompt enhancement
//   Level 1: reasoning=true → Native support (model decides)
//
// DEBUG FEATURES:
// - Complete logging to ~/.claude-code-router/logs/zai-transformer-[timestamp].log
// - Automatic rotation when file reaches size limit (default: 10 MB)
// - Rotated files named: zai-transformer-[timestamp]-part[N].log
// - Records all decisions and transformations
// - Symbols: [SUCCESS], [ERROR], [WARNING], [INFO], [ENHANCEMENT],
//            [OMISSION], [NO CHANGES], [TRANSLATION], [APPLIED], [THINKING], [DO_SAMPLE]
//
// CCR TYPE DEFINITIONS:
// Based on: https://github.com/musistudio/llms/blob/main/src/types/llm.ts
//           https://github.com/musistudio/llms/blob/main/src/types/transformer.ts
//
// REFERENCES:
// - CCR Transformer: https://github.com/musistudio/claude-code-router
// - Z.AI Thinking: https://docs.z.ai/guides/overview/concept-param#thinking
// ============================================================================

const fs = require('fs');
const path = require('path');

/**
 * Cache control settings for messages and content blocks
 * @typedef {Object} CacheControl
 * @property {string} type - Cache control type (e.g., "ephemeral")
 */

/**
 * Image URL container
 * @typedef {Object} ImageUrl
 * @property {string} url - The actual image URL (can be data URL or http/https)
 */

/**
 * Function call details
 * @typedef {Object} FunctionCallDetails
 * @property {string} name - Name of the function to call
 * @property {string} arguments - JSON string of function arguments
 */

/**
 * Thinking/reasoning content block from model
 * @typedef {Object} ThinkingBlock
 * @property {string} content - The thinking/reasoning text
 * @property {string} [signature] - Optional signature for thinking verification
 */

/**
 * Function parameters JSON Schema
 * @typedef {Object} FunctionParameters
 * @property {"object"} type - Always "object" for parameters root
 * @property {Object.<string, any>} properties - Parameter definitions
 * @property {string[]} [required] - List of required parameter names
 * @property {boolean} [additionalProperties] - Allow additional properties
 * @property {string} [$schema] - JSON Schema version
 */

/**
 * Function definition
 * @typedef {Object} FunctionDefinition
 * @property {string} name - Function name (must be unique)
 * @property {string} description - Description of what the function does
 * @property {FunctionParameters} parameters - JSON Schema for function parameters
 */

/**
 * Reasoning configuration
 * @typedef {Object} ReasoningConfig
 * @property {ThinkLevel} [effort] - Reasoning effort level (OpenAI-style)
 * @property {number} [max_tokens] - Maximum tokens for reasoning (Anthropic-style)
 * @property {boolean} [enabled] - Whether reasoning is enabled
 */

/**
 * Transformer configuration item (object form)
 * @typedef {Object} TransformerConfigItem
 * @property {string} name - Transformer name
 * @property {Object} [options] - Transformer options
 */

/**
 * Transformer configuration
 * @typedef {Object} TransformerConfig
 * @property {string|string[]|TransformerConfigItem[]} use - Transformer name(s) or configuration(s)
 */

/**
 * Global overrides configuration
 * @typedef {Object} GlobalOverrides
 * @property {number|null} maxTokens - Override max_tokens for all models (takes precedence over model config)
 * @property {number|null} temperature - Override temperature for all models
 * @property {number|null} topP - Override top_p for all models
 * @property {boolean|null} reasoning - Override reasoning on/off for all models
 * @property {boolean|null} keywordDetection - Override automatic prompt enhancement on/off for all models
 */

/**
 * Text content block in a message
 * @typedef {Object} TextContent
 * @property {"text"} type - Content type identifier
 * @property {string} text - The actual text content
 * @property {CacheControl} [cache_control] - Optional cache control settings
 */

/**
 * Image content block in a message
 * @typedef {Object} ImageContent
 * @property {"image_url"} type - Content type identifier for images
 * @property {ImageUrl} image_url - Image URL container
 * @property {string} media_type - MIME type of the image (e.g., "image/png", "image/jpeg")
 */

/**
 * Union type for message content blocks
 * @typedef {TextContent | ImageContent} MessageContent
 */

/**
 * Tool/function call representation
 * @typedef {Object} ToolCall
 * @property {string} id - Unique identifier for this tool call
 * @property {"function"} type - Always "function" for function calls
 * @property {FunctionCallDetails} function - Function call details
 */

/**
 * Unified message format compatible with multiple LLM providers
 * @typedef {Object} UnifiedMessage
 * @property {"user"|"assistant"|"system"|"tool"} role - Message role in conversation
 * @property {string|null|MessageContent[]} content - Message content (string, null, or structured blocks)
 * @property {ToolCall[]} [tool_calls] - Tool/function calls made by assistant
 * @property {string} [tool_call_id] - ID of tool call this message is responding to (for role="tool")
 * @property {CacheControl} [cache_control] - Cache control settings for this message
 * @property {ThinkingBlock} [thinking] - Reasoning/thinking content from model
 */

/**
 * Tool/function definition for LLM
 * @typedef {Object} UnifiedTool
 * @property {"function"} type - Always "function" for function tools
 * @property {FunctionDefinition} function - Function definition
 */

/**
 * Reasoning effort level (OpenAI o1-style)
 * @typedef {"none"|"low"|"medium"|"high"} ThinkLevel
 */

/**
 * @typedef {Object} UnifiedChatRequest
 * @property {UnifiedMessage[]} messages - Array of conversation messages
 * @property {string} model - LLM model name
 * @property {number} [max_tokens] - Maximum tokens in response
 * @property {number} [temperature] - Temperature for generation (0.0 - 2.0)
 * @property {number} [top_p] - Top-P nucleus sampling (0.0 - 1.0)
 * @property {boolean} [stream] - Whether response should be streamed
 * @property {UnifiedTool[]} [tools] - Available tools for the model
 * @property {"auto"|"none"|"required"|string|UnifiedTool} [tool_choice] - Tool selection strategy
 * @property {ReasoningConfig} [reasoning] - Reasoning configuration
 * @property {ThinkingConfiguration} [thinking] - Thinking configuration (provider-specific)
 */

/**
 * @typedef {Object} LLMProvider
 * @property {string} name - Provider name
 * @property {string} baseUrl - API base URL
 * @property {string} apiKey - API key
 * @property {string[]} models - Available models
 * @property {TransformerConfig} [transformer] - Transformer configuration
 */

/**
 * @typedef {Object} TransformerContext
 * @property {*} [key] - Additional context for transformer
 */

/**
 * Standard Fetch API Response (also available in Node.js 18+)
 * @typedef {Object} Response
 * @property {boolean} ok - Indicates if response was successful (status 200-299)
 * @property {number} status - HTTP status code
 * @property {string} statusText - HTTP status message
 * @property {Headers} headers - Response headers
 * @property {boolean} redirected - Indicates if response is result of redirect
 * @property {string} type - Response type (basic, cors, etc.)
 * @property {string} url - Response URL
 * @property {function(): Promise<ArrayBuffer>} arrayBuffer - Read body as ArrayBuffer
 * @property {function(): Promise<Blob>} blob - Read body as Blob
 * @property {function(): Promise<FormData>} formData - Read body as FormData
 * @property {function(): Promise<any>} json - Read body as JSON
 * @property {function(): Promise<string>} text - Read body as text
 * @property {ReadableStream} [body] - Body stream
 * @property {boolean} bodyUsed - Indicates if body has been read
 */

/**
 * Model-specific configuration
 * @typedef {Object} ModelConfig
 * @property {number} maxTokens - Maximum output tokens
 * @property {number|null} contextWindow - Maximum input tokens (context)
 * @property {number|null} temperature - Randomness control (0.0-2.0)
 * @property {number|null} topP - Nucleus sampling (0.0-1.0)
 * @property {boolean} reasoning - Whether model supports native reasoning (model decides when to use it)
 * @property {boolean} keywordDetection - Enable automatic prompt enhancement when analytical keywords are detected
 * @property {string} provider - Model provider (Z.AI only)
 */

/**
 * Request body to be modified by reasoning formatter
 * @typedef {Object} RequestBody
 * @property {*} [key] - Dynamic properties for the request body
 */

/**
 * Function that applies provider-specific reasoning format
 * @typedef {function(RequestBody, string): void} ReasoningFormatter
 * @param {RequestBody} body - Request body to modify
 * @param {string} modelName - Model name
 */

/**
 * Dictionary of model configurations indexed by model name
 * @typedef {Record<string, ModelConfig>} ModelConfigurationMap
 */

/**
 * Dictionary of reasoning formatters indexed by provider
 * @typedef {Record<string, ReasoningFormatter>} ReasoningFormatterMap
 */

/**
 * Thinking/reasoning configuration for provider
 * @typedef {Object} ThinkingConfiguration
 * @property {string} type - Thinking type (e.g., "enabled")
 * @property {*} [key] - Additional provider-specific properties
 */

/**
 * Delta content in streaming response
 * @typedef {Object} StreamDelta
 * @property {string} [role] - Message role
 * @property {string} [content] - Content chunk
 * @property {string} [reasoning_content] - Reasoning/thinking content chunk
 * @property {string} [finish_reason] - Reason for completion
 */

/**
 * Choice in streaming response
 * @typedef {Object} StreamChoice
 * @property {StreamDelta} delta - Delta content
 * @property {number} index - Choice index
 */

/**
 * Modified request body to send to provider
 * @typedef {Object} ModifiedRequestBody
 * @property {string} model - Model name
 * @property {number} max_tokens - Maximum tokens
 * @property {number} [temperature] - Temperature setting
 * @property {number} [top_p] - Top-P setting
 * @property {boolean} [do_sample] - Sampling control
 * @property {UnifiedMessage[]} messages - Messages array
 * @property {ThinkingConfiguration} [thinking] - Thinking configuration
 * @property {StreamChoice[]} [choices] - Choices in response (for streaming)
 * @property {*} [key] - Additional dynamic properties
 */

/**
 * CCR Transformer interface (based on @musistudio/llms)
 * 
 * @typedef {Object} CCRTransformer
 * @property {string} name - Unique transformer name (REQUIRED)
 * @property {function(UnifiedChatRequest, LLMProvider, TransformerContext): Promise<Object>} [transformRequestIn] - Transforms request before sending to provider
 * @property {function(Response): Promise<Response>} [transformResponseOut] - Converts response to unified format
 */

/**
 * Configuration options for transformer constructors
 * @typedef {Object} TransformerOptions
 * @property {number} [overrideMaxTokens] - Override max_tokens globally for all models
 * @property {number} [overrideTemperature] - Override temperature globally for all models
 * @property {number} [overrideTopP] - Override top_p globally for all models
 * @property {boolean} [overrideReasoning] - Override reasoning on/off globally for all models
 * @property {boolean} [overrideKeywordDetection] - Override keyword detection globally for all models
 * @property {string[]} [customKeywords] - Custom keywords to add or replace default keywords
 * @property {boolean} [overrideKeywords] - If true, ONLY use customKeywords (ignore defaults); if false, add to defaults
 * @property {number} [maxLogSize] - Maximum log file size before rotation (debug only, default: 10 MB)
 * @property {*} [key] - Allows any additional option
 */

/**
 * Transformer constructor with static name
 * @typedef {Object} TransformerConstructor
 * @property {string} [TransformerName] - Static transformer name (alternative to name property)
 */

/**
 * Z.ai Transformer for Claude Code Router.
 * Translates Claude Code reasoning format to Z.AI-specific format.
 * 
 * @class
 * @implements {CCRTransformer}
 */
class ZaiTransformer {
  /**
   * Transformer name (required by CCR)
   * @type {string}
   */
  name = "zai";

  /**
   * Constructor
   * @param {TransformerOptions} options - Configuration options
   */
  constructor (options) {
    /**
     * Configuration options
     * @type {TransformerOptions}
     */
    this.options = options || {};

    /**
     * Default maximum output tokens (fallback for unknown models)
     * @type {number}
     */
    this.defaultMaxTokens = 131072; // 128K default

    /**
     * Global overrides - Apply to ALL models when specified.
     * These have the highest priority and override model-specific settings.
     * 
     * @type {GlobalOverrides}
     */
    this.globalOverrides = {
      maxTokens: this.options.overrideMaxTokens != null ? this.options.overrideMaxTokens : null,
      temperature: this.options.overrideTemperature != null ? this.options.overrideTemperature : null,
      topP: this.options.overrideTopP != null ? this.options.overrideTopP : null,
      reasoning: this.options.overrideReasoning != null ? this.options.overrideReasoning : null,
      keywordDetection: this.options.overrideKeywordDetection != null ? this.options.overrideKeywordDetection : null
    };

    /**
     * Log buffer for asynchronous writing (avoids blocking event loop)
     * @type {string[]}
     */
    this.logBuffer = [];

    /**
     * Timeout for automatic log buffer flush
     * @type {ReturnType<typeof setTimeout>|null}
     */
    this.flushTimeout = null;

    /**
     * Maximum log file size before rotation (default: 10 MB)
     * @type {number}
     */
    this.maxLogSize = this.options.maxLogSize || 10 * 1024 * 1024; // 10 MB

    /**
     * Session start timestamp (for log file names)
     * @type {string}
     */
    this.sessionTimestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');

    /**
     * Rotation counter for this session
     * @type {number}
     */
    this.rotationCounter = 0;

    /**
      * Request counter to identify unique requests
      * @type {number}
      */
    this.requestCounter = 0;

    /**
      * WeakSet to track which Response objects have been processed for stream reading
      * @type {WeakSet<Response>}
      */
    this.processedResponses = new WeakSet();

    /**
      * Response ID counter for unique response identification
      * @type {number}
      */
    this.responseIdCounter = 0;

    /**
     * Ignore system messages when detecting reasoning keywords.
     * 
     * RECOMMENDED: true (default value)
     * - Avoids false positives from technical system instructions
     * - Responds only to real user questions
     * - Doesn't waste tokens on unnecessary thinking
     * - More predictable and controllable
     * - For enhanced thinking, use "ultrathink" in user message
     * 
     * When enabled (true, default):
     * - Only analyzes messages with role="user" for keywords
     * - Messages with role="system" do NOT trigger prompt enhancement
     * 
     * When disabled (false):
     * - Analyzes ALL messages (user and system) for keywords
     * - Useful if system sends complex instructions requiring analysis
     * 
     * @type {boolean}
     * @default true
     */
    this.ignoreSystemMessages = true;

    /**
     * Model configurations by provider.
     * Defines maxTokens, contextWindow, temperature, topP, reasoning, keywordDetection, provider.
     * @type {ModelConfigurationMap}
     */
    this.modelConfigurations = {
      // ===== Z.AI =====
      'glm-4.6': {
        maxTokens: 128 * 1024,          // 131,072 (128K)
        contextWindow: 200 * 1024,      // 204,800 (200K)
        temperature: 1.0,               // Official value
        topP: 0.95,                     // Official value
        reasoning: true,                // Supports native reasoning (model decides when to use it)
        keywordDetection: true,         // Enable automatic prompt enhancement when analytical keywords detected
        provider: 'Z.AI'
      },
      'glm-4.5': {
        maxTokens: 96 * 1024,           // 98,304 (96K)
        contextWindow: 128 * 1024,      // 131,072 (128K)
        temperature: 0.6,               // Official value
        topP: 0.95,                     // Official value
        reasoning: true,                // Supports native reasoning (model decides when to use it)
        keywordDetection: true,         // Enable automatic prompt enhancement when analytical keywords detected
        provider: 'Z.AI'
      },
      'glm-4.5-air': {
        maxTokens: 96 * 1024,           // 98,304 (96K)
        contextWindow: 128 * 1024,      // 131,072 (128K)
        temperature: 0.6,               // Official value
        topP: 0.95,                     // Official value
        reasoning: true,                // Supports native reasoning (model decides when to use it)
        keywordDetection: true,         // Enable automatic prompt enhancement when analytical keywords detected
        provider: 'Z.AI'
      },
      'glm-4.5v': {
        maxTokens: 16 * 1024,           // 16,384 (16K)
        contextWindow: 128 * 1024,      // 131,072 (128K)
        temperature: 0.6,               // Official value
        topP: 0.95,                     // Official value
        reasoning: true,                // Supports native reasoning (model decides when to use it)
        keywordDetection: true,         // Enable automatic prompt enhancement when analytical keywords detected
        provider: 'Z.AI'
      }
    };

    /**
     * Reasoning formats by provider.
     * Z.AI uses thinking, format: {type: "enabled"}
     * @type {ReasoningFormatterMap}
     */
    this.reasoningFormatters = {
      'Z.AI': (body, _modelName) => {
        body.thinking = { type: 'enabled' };
      }
    };

    /**
     * Keywords that trigger automatic prompt enhancement for analytical requests.
     * 
     * Regular keywords require both reasoning=true AND keywordDetection=true.
     * If either is false, these keywords are ignored.
     * 
     * The "ultrathink" keyword works independently of all settings and overrides.
     * It activates thinking and enhances prompt when detected.
     * 
     * Customization Options:
     * - customKeywords: Array of additional keywords to add to the default list
     * - overrideKeywords: If true, ONLY customKeywords are used (ignores default list)
     *                     If false (default), customKeywords are added to default list
     * 
     * Examples:
     * - customKeywords: ['design', 'plan'], overrideKeywords: false → adds to defaults
     * - customKeywords: ['design', 'plan'], overrideKeywords: true → replaces defaults
     * 
     * @type {string[]}
     */
    const defaultKeywords = [
      // Counting questions
      'how many', 'how much', 'count', 'number of', 'total of', 'amount of',

      // Analysis and reasoning
      'analyze', 'analysis', 'reason', 'reasoning', 'think', 'thinking',
      'deduce', 'deduction', 'infer', 'inference',

      // Calculations and problem-solving
      'calculate', 'calculation', 'solve', 'solution', 'determine',

      // Detailed explanations
      'explain', 'explanation', 'demonstrate', 'demonstration',
      'detail', 'detailed', 'step by step', 'step-by-step',

      // Identification and search
      'identify', 'find', 'search', 'locate', 'enumerate', 'list',

      // Precision-requiring words
      'letters', 'characters', 'digits', 'numbers', 'figures',
      'positions', 'position', 'index', 'indices',

      // Comparisons and evaluations
      'compare', 'comparison', 'evaluate', 'evaluation',
      'verify', 'verification', 'check'
    ];

    // Build final keywords list based on customization options
    const customKeywords = this.options.customKeywords || [];
    const overrideKeywords = this.options.overrideKeywords || false;

    this.keywords = overrideKeywords ? customKeywords : [...defaultKeywords, ...customKeywords];

    /**
     * Path to debug log file
     * Each session creates its own timestamped file:
     * ~/.Claude-Code-Router/Logs/zai-transformer-[timestamp].log
     * 
     * Rotates automatically when reaching size limit (default: 10 MB)
     * Rotated files: zai-transformer-[timestamp]-part[N].log
     * @type {string}
     */
    const logsDirectory = path.join(process.env.USERPROFILE || process.env.HOME, '.claude-code-router', 'logs');
    if (!fs.existsSync(logsDirectory)) {
      fs.mkdirSync(logsDirectory, { recursive: true });
    }

    // Each session has its own timestamped file from the start
    this.logFile = path.join(logsDirectory, `zai-transformer-${this.sessionTimestamp}.log`);

    this.log('[START] Z.ai Transformer (Debug) initialized');
    this.log(`[CONFIG] ignoreSystemMessages: ${this.ignoreSystemMessages}`);
    this.log(`[CONFIG] Log file: ${this.logFile}`);
    this.log(`[CONFIG] Maximum size per file: ${(this.maxLogSize / 1024 / 1024).toFixed(1)} MB`);
  }

  /**
   * Logs a message to console and file
   * 
   * NOTE: CCR automatically provides a logger (winston/pino) after registerTransformer().
   * If this.logger !== console, it means CCR has already provided it.
   * 
   * To avoid blocking the event loop, messages are accumulated in a buffer
   * and written asynchronously every 100ms or at the end of the request.
   * 
   * @param {string} message - Message to log
   */
  log (message) {
    const line = `${message}\n`;
    console.log(line.trimEnd());

    // Add to buffer instead of writing immediately
    this.logBuffer.push(line);

    // Force flush if buffer grows too large (prevent memory leaks)
    if (this.logBuffer.length > 1000) {
      this.flushLogs();
    }

    // Schedule automatic flush if not already scheduled
    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => {
        this.flushLogs();
      }, 100); // Flush every 100ms
    }
  }

  /**
   * Checks log file size and rotates if necessary
   * @private
   */
  checkAndRotateLog () {
    try {
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size >= this.maxLogSize) {
          this.rotationCounter++;

          // Create new name with session timestamp + rotation counter
          const baseName = `zai-transformer-${this.sessionTimestamp}-part${this.rotationCounter}`;
          const rotatedPath = path.join(path.dirname(this.logFile), `${baseName}.log`);

          // Rename current log
          fs.renameSync(this.logFile, rotatedPath);
          const message = `   [LOG ROTATION] Size limit reached (${(stats.size / 1024 / 1024).toFixed(2)} MB) - Continuing in: ${path.basename(this.logFile)}`;
          console.log(message);
          // Create new file with continuation message (file was just renamed, so now it doesn't exist)
          fs.writeFileSync(this.logFile, `${message}\n   [CONTINUATION] Log file part ${this.rotationCounter + 1}\n`);
        }
      }
    } catch (error) {
      // Ignore rotation errors (debug only)
      console.error(`   [LOG ROTATION ERROR] ${error.message}`);
    }
  }

  /**
   * Writes log buffer to file asynchronously
   * @private
   */
  flushLogs () {
    if (this.logBuffer.length === 0) return;

    const content = this.logBuffer.join('');
    this.logBuffer = []; // Clear buffer
    this.flushTimeout = null;

    // Check if log rotation is needed before writing
    this.checkAndRotateLog();

    // Asynchronous write (doesn't block event loop)
    fs.appendFile(this.logFile, content, (error) => {
      if (error) {
        console.error(`   [LOG WRITE ERROR] ${error.message}`);
      }
    });
  }

  /**
   * Safe JSON.stringify that handles circular references
   * @param {any} obj - Object to serialize
   * @param {number} [maxDepth=3] - Maximum recursion depth
   * @param {string} [indent=''] - Additional indentation for each line
   * @returns {string} JSON string or error message
   */
  safeJSON (obj, maxDepth = 3, indent = '') {
    try {
      const seen = new WeakSet();
      const json = JSON.stringify(obj, (key, value) => {
        // Avoid circular references
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '   [Circular Reference]';
          }
          seen.add(value);
        }
        return value;
      }, 2);

      // If no JSON (undefined, null), return 'undefined' as string
      if (json === undefined) {
        return 'undefined';
      }
      if (json === null || json === 'null') {
        return 'null';
      }

      // If indentation requested, add it to each line
      if (indent && json) {
        return json.split('\n').map((line, idx) => {
          // Don't indent first line (already has context indentation)
          return idx === 0 ? line : indent + line;
        }).join('\n');
      }

      return json;
    } catch (error) {
      return `   [Serialization Error: ${error.message}]`;
    }
  }

  /**
   * Safely gets object keys
   * @param {any} obj - Object to inspect
   * @returns {string[]} Array of property names
   */
  safeKeys (obj) {
    try {
      if (!obj || typeof obj !== 'object') return [];
      return Object.keys(obj);
    } catch (error) {
      return ['   [Error getting keys]'];
    }
  }

  /**
   * Gets model-specific configuration
   * @param {string} modelName - Model name
   * @returns {ModelConfig} Model configuration or default values
   */
  getModelConfiguration (modelName) {
    const config = this.modelConfigurations[modelName];

    if (!config) {
      // If model not configured, use default values
      return {
        maxTokens: this.defaultMaxTokens,
        contextWindow: null,
        temperature: null,
        topP: null,
        reasoning: false,          // Default: does NOT support reasoning
        keywordDetection: false,   // Default: keyword detection disabled
        provider: 'Unknown'
      };
    }

    return config;
  }

  /**
   * Detects if text contains keywords requiring reasoning
   * @param {string} text - Text to analyze
   * @returns {boolean} true if keywords detected
   */
  detectReasoningNeeded (text) {
    if (!text) return false;

    const lowerText = text.toLowerCase();
    return this.keywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Enhances prompt by adding reasoning instructions
   * @param {string} content - Original prompt content
   * @returns {string} Enhanced content with reasoning instructions
   */
  modifyPromptForReasoning (content) {
    const reasoningInstruction = "\n\n[IMPORTANT: This question requires careful analysis. Think step by step and show your detailed reasoning before answering.]\n\n";
    return reasoningInstruction + content;
  }

  /**
   * Transforms request before sending to provider.
   * Applies model configuration, reasoning, and keywords.
   * 
   * @param {UnifiedChatRequest} request - Claude Code request
   * @param {LLMProvider} provider - LLM provider information
   * @param {TransformerContext} context - Context (contains HTTP request)
   * @returns {Promise<ModifiedRequestBody>} Optimized body for provider
   */
  async transformRequestIn (request, provider, context) {
    // Increment request counter and store current request ID
    this.requestCounter++;
    const currentRequestId = this.requestCounter;

    this.log('');
    this.log('╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗');
    this.log(`   [STAGE 1/3] INPUT: Claude Code CLI → CCR → transformRequestIn() [Request #${currentRequestId}]`);
    this.log('   Request RECEIVED from Claude Code, BEFORE sending to provider');
    this.log('╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝');

    // ========================================
    // 1. LLM PROVIDER (final destination)
    // ========================================
    this.log('');
    this.log('   [PROVIDER] LLM destination information:');
    if (provider) {
      this.log(`   name: "${provider.name}"`);
      this.log(`   baseUrl: "${provider.baseUrl}"`);
      this.log(`   models: ${this.safeJSON(provider.models, 3, '   ')}`);
      if (provider.transformer && provider.transformer.use) {
        const transformerNames = Array.isArray(provider.transformer.use)
          ? provider.transformer.use.map(t => typeof t === 'string' ? t : t.name || 'unknown')
          : [provider.transformer.use];
        this.log(`   transformer: ${this.safeJSON(transformerNames, 3, '   ')}`);
      }
    } else {
      this.log('    [NOT PROVIDED]');
    }

    // ========================================
    // 2. HTTP CONTEXT
    // ========================================
    this.log('');
    this.log('   [CONTEXT] HTTP request from client:');
    if (context && this.safeKeys(context).length > 0) {
      const contextKeys = this.safeKeys(context);
      contextKeys.forEach(key => {
        const value = context[key];
        const type = typeof value;
        if (type === 'string' || type === 'number' || type === 'boolean') {
          this.log(`   ${key}: ${value}`);
        } else if (type === 'object' && value !== null) {
          this.log(`   ${key}: [${value.constructor?.name || 'Object'}]`);
        }
      });
    } else {
      this.log('   [EMPTY]');
    }

    // ========================================
    // 3. REQUEST FROM CLAUDE CODE → CCR
    // ========================================
    this.log('');
    this.log('   [INPUT] Request received from Claude Code:');
    this.log(`   model: "${request.model}"`);
    this.log(`   max_tokens: ${request.max_tokens !== undefined ? request.max_tokens : 'undefined'}`);
    this.log(`   stream: ${request.stream}`);

    // Show message preview (roles and content length) - inline with other properties
    if (request.messages && request.messages.length > 0) {
      this.log(`   messages: ${request.messages.length} messages`);
      request.messages.forEach((msg, idx) => {
        const role = msg.role || 'unknown';

        // Extract real text from content (handle string or array)
        let textContent = '';
        if (typeof msg.content === 'string') {
          textContent = msg.content;
        } else if (Array.isArray(msg.content)) {
          // Claude Code sends: [{type: "text", text: "..."}]
          textContent = msg.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join(' ');
        } else {
          textContent = JSON.stringify(msg.content || '');
        }

        const contentLength = textContent.length;
        const preview = textContent.substring(0, 50).replace(/\n/g, ' ');
        this.log(`    [${idx}] ${role}: ${contentLength} chars - "${preview}${contentLength > 50 ? '...' : ''}"`);
      });
    } else {
      this.log(`   messages: undefined`);
    }

    // Show tools with their names
    if (request.tools) {
      this.log(`   tools: ${request.tools.length} tools`);
      const toolNames = request.tools.map((t, idx) => {
        if (t.function?.name) return t.function.name;
        if (t.name) return t.name;
        return `tool_${idx}`;
      });
      this.log(`    └─ [${toolNames.slice(0, 10).join(', ')}${request.tools.length > 10 ? `, ... +${request.tools.length - 10} more` : ''}]`);
    } else {
      this.log(`   tools: undefined`);
    }

    this.log(`   tool_choice: ${request.tool_choice !== undefined ? request.tool_choice : 'undefined'}`);
    this.log(`   reasoning: ${this.safeJSON(request.reasoning, 3, '   ') || 'undefined'}`);
    this.log('');

    // Extra properties
    const knownProperties = [
      'model', 'max_tokens', 'temperature', 'stream', 'messages',
      'tools', 'tool_choice', 'reasoning'
    ];
    const unknownProperties = this.safeKeys(request).filter(k => !knownProperties.includes(k));
    if (unknownProperties.length > 0) {
      this.log(`   [EXTRAS]: ${this.safeJSON(unknownProperties, 3, '   ')}`);
    }

    const modelName = request.model || 'UNKNOWN';
    const config = this.getModelConfiguration(modelName);

    // Create copy of request with optimized parameters
    // Global override has the highest priority: globalOverrides.maxTokens || config.maxTokens || defaultMaxTokens
    const finalMaxTokens = this.globalOverrides.maxTokens || config.maxTokens;

    const modifiedRequest = {
      ...request,
      max_tokens: finalMaxTokens
    };

    // Log max_tokens setting (global override or model-specific)
    if (this.globalOverrides.maxTokens) {
      this.log(`   [GLOBAL OVERRIDE] max_tokens: ${this.globalOverrides.maxTokens} (overrides model default)`);
    } else if (request.max_tokens !== config.maxTokens) {
      this.log(`   [OVERRIDE] Original max_tokens: ${request.max_tokens} → Override to ${finalMaxTokens}`);
    }
    // max_tokens already set in line 922, no need to reassign

    // Determine effective reasoning setting
    // Priority: Global Override > Claude Code > Model Config
    const claudeCodeReasoning = request.reasoning?.enabled;
    let effectiveReasoning;

    // Check if global override is set (highest priority)
    if (this.globalOverrides.reasoning !== null) {
      effectiveReasoning = this.globalOverrides.reasoning;
      this.log(`   [GLOBAL OVERRIDE] reasoning=${effectiveReasoning} (applies to all requests)`);
    } else if (claudeCodeReasoning === true) {
      // Claude Code wants reasoning ON (only if model supports it)
      if (config.reasoning) {
        effectiveReasoning = true;
        this.log(`   [TRANSLATION] Claude Code requests reasoning.enabled=true`);
        this.log(`   [APPLIED] Effective reasoning=${effectiveReasoning} (model supports)`);
      } else {
        effectiveReasoning = false;
        this.log(`   [TRANSLATION] Claude Code requests reasoning.enabled=true`);
        this.log('   [WARNING] Model does NOT support thinking');
        this.log(`   [APPLIED] Effective reasoning=${effectiveReasoning} (model limitation)`);
      }
    } else if (claudeCodeReasoning === false) {
      // Claude Code wants reasoning OFF
      effectiveReasoning = false;
      this.log(`   [TRANSLATION] Claude Code requests reasoning.enabled=false`);
      this.log(`   [APPLIED] Effective reasoning=${effectiveReasoning} (Claude Code disabled)`);
    } else {
      // Claude Code didn't specify, use model default
      effectiveReasoning = config.reasoning;
      this.log(`   [TRANSLATION] Claude Code did NOT send reasoning.enabled`);
      this.log(`   [CONFIG] Effective reasoning=${effectiveReasoning} (model default)`);
    }

    // Apply thinking format if reasoning is enabled
    if (effectiveReasoning) {
      const providerName = config.provider;
      if (this.reasoningFormatters[providerName]) {
        this.reasoningFormatters[providerName](modifiedRequest, modelName);
        this.log(`   [THINKING] ${providerName} format applied`);
      } else {
        this.log(`   [OMISSION] thinking NOT added (no formatter for ${providerName})`);
      }
    }

    // Add temperature (global override takes priority)
    const finalTemperature = this.globalOverrides.temperature !== null ? this.globalOverrides.temperature : config.temperature;
    if (finalTemperature !== null) {
      modifiedRequest.temperature = finalTemperature;
    }

    // Add topP (global override takes priority)
    const finalTopP = this.globalOverrides.topP !== null ? this.globalOverrides.topP : config.topP;
    if (finalTopP !== null) {
      modifiedRequest.top_p = finalTopP;
    }

    // Add do_sample to ensure temperature and top_p take effect
    modifiedRequest.do_sample = true;

    // Check if keywords are detected for prompt enhancement
    let processedMessageIndex = -1; // Save index of processed message for later comparison
    let promptAlreadyEnhanced = false; // Track if prompt was enhanced to avoid duplication

    if (request.messages && Array.isArray(request.messages)) {
      // Search for last user message in reverse order
      for (let i = request.messages.length - 1; i >= 0; i--) {
        const message = request.messages[i];

        // Filter messages according to ignoreSystemMessages configuration
        const isUser = message.role === 'user';
        const isSystem = message.role === 'system';

        // If ignoreSystemMessages=true, only process role="user"
        // If ignoreSystemMessages=false, process role="user" AND role="system"
        const shouldProcess = isUser || (!this.ignoreSystemMessages && isSystem);

        if (shouldProcess) {
          processedMessageIndex = i; // Save index of processed message
          // Extract complete text from user message
          let messageText = '';

          if (typeof message.content === 'string') {
            messageText = message.content;
          } else if (Array.isArray(message.content)) {
            messageText = message.content
              .filter(content => content.type === 'text' && content.text)
              .map(content => content.text)
              .join(' ');
          }

          // Create simple hash of message for duplicate detection
          let messageHash = 0;
          for (let j = 0; j < messageText.length; j++) {
            const char = messageText.charCodeAt(j);
            messageHash = ((messageHash << 5) - messageHash) + char;
            messageHash = messageHash & messageHash; // Convert to 32bit integer
          }
          const hashHex = (messageHash >>> 0).toString(16).toUpperCase().padStart(8, '0');

          this.log(`   [LAST ${message.role.toUpperCase()} MESSAGE] "${messageText.substring(0, 100).replace(/\n/g, '↕')}${messageText.length > 100 ? '...' : ''}"`);
          this.log(`   [MESSAGE HASH] ${hashHex} (length: ${messageText.length} chars)`);

          // Detect "ultrathink" keyword for enhanced reasoning activation
          // This works independently of all configuration settings and global overrides
          const containsUltraThink = messageText.toLowerCase().includes('ultrathink');

          if (containsUltraThink) {
            this.log('   [ULTRATHINK] Keyword detected');
            this.log('   [ULTRATHINK] Enabling thinking activation and prompt enhancement');

            const providerName = config.provider;
            const formatAlreadyApplied = (providerName === 'Z.AI' && modifiedRequest.thinking !== undefined);

            // Apply provider thinking format if not already present
            if (!formatAlreadyApplied) {
              if (this.reasoningFormatters[providerName]) {
                this.reasoningFormatters[providerName](modifiedRequest, modelName);
                this.log(`   [ULTRATHINK] Thinking ${providerName} format applied`);
              }
            } else {
              this.log('   [ULTRATHINK] Thinking format already present');
            }

            // Add reasoning instructions to the user's prompt
            // Safety check: Ensure messages array exists before cloning
            if (!request.messages || !Array.isArray(request.messages)) {
              this.log('   [WARNING] request.messages is undefined or not an array, skipping ultrathink enhancement');
            } else {
              modifiedRequest.messages = [...request.messages];
              const modifiedMessage = { ...modifiedRequest.messages[i] };

              if (typeof modifiedMessage.content === 'string') {
                modifiedMessage.content = this.modifyPromptForReasoning(modifiedMessage.content);
              } else if (Array.isArray(modifiedMessage.content)) {
                modifiedMessage.content = modifiedMessage.content.map(content => {
                  if (content.type === 'text' && content.text) {
                    return {
                      ...content,
                      text: this.modifyPromptForReasoning(content.text)
                    };
                  }
                  return content;
                });
              }

              modifiedRequest.messages[i] = modifiedMessage;
              promptAlreadyEnhanced = true; // Mark prompt as enhanced
              this.log('   [ULTRATHINK] Prompt enhanced + native thinking enabled');
            }
          } else if (!promptAlreadyEnhanced) {
            // Normal logic for other keywords (only if prompt not already enhanced by ultrathink)
            const reasoningNeededByKeywords = this.detectReasoningNeeded(messageText);

            // Apply global override to keywordDetection
            const finalKeywordDetection = this.globalOverrides.keywordDetection !== null ? this.globalOverrides.keywordDetection : config.keywordDetection;

            this.log(`   [REASONING] Effective: ${effectiveReasoning} | KeywordDetection: ${finalKeywordDetection}${this.globalOverrides.keywordDetection !== null ? ' (GLOBAL OVERRIDE)' : ''} | Keywords: ${reasoningNeededByKeywords}`);

            // Enhance prompt if: effectiveReasoning=true AND keywordDetection=true AND keywords detected
            if (effectiveReasoning && finalKeywordDetection && reasoningNeededByKeywords) {
              this.log('   [ENHANCEMENT] ENHANCING PROMPT (effectiveReasoning + keywordDetection + keywords)');

              // Clone message array to not mutate original
              // Safety check: Ensure messages array exists before cloning
              if (!request.messages || !Array.isArray(request.messages)) {
                this.log('   [WARNING] request.messages is undefined or not an array, skipping keyword enhancement');
              } else {
                modifiedRequest.messages = [...request.messages];
                const modifiedMessage = { ...modifiedRequest.messages[i] };

                // Modify according to content type
                if (typeof modifiedMessage.content === 'string') {
                  modifiedMessage.content = this.modifyPromptForReasoning(modifiedMessage.content);
                } else if (Array.isArray(modifiedMessage.content)) {
                  modifiedMessage.content = modifiedMessage.content.map(content => {
                    if (content.type === 'text' && content.text) {
                      return {
                        ...content,
                        text: this.modifyPromptForReasoning(content.text)
                      };
                    }
                    return content;
                  });
                }

                modifiedRequest.messages[i] = modifiedMessage;
                promptAlreadyEnhanced = true; // Mark prompt as enhanced
                this.log('   [ENHANCEMENT] Reasoning instructions added to prompt');
              }
            } else {
              // Log why NOT enhancing
              if (!effectiveReasoning) {
                this.log('   [OMISSION] NOT enhancing prompt: effectiveReasoning=false (disabled or model doesn\'t support)');
              } else if (!finalKeywordDetection) {
                this.log('   [OMISSION] NOT enhancing prompt: keywordDetection=false');
              } else if (!reasoningNeededByKeywords) {
                this.log('   [OMISSION] NOT enhancing prompt: NO keywords detected');
              }
            }
          }

          break; // Process only last valid message (user or system according to configuration)
        }
      }
    }

    // ========================================
    // STAGE 1 CLOSE
    // ========================================
    this.log('╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝');

    // ========================================
    // 4. OUTPUT: CCR → LLM Provider
    // ========================================
    this.log('');
    this.log('');
    this.log('╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗');
    this.log(`   [STAGE 2/3] OUTPUT: transformRequestIn() → CCR → LLM Provider [Request #${currentRequestId}]`);
    this.log('   OPTIMIZED request to be sent to provider');
    this.log('╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝');
    this.log('');
    this.log('   [OUTPUT] Body to be sent to provider:');
    this.log(`   model: "${modifiedRequest.model}"`);
    this.log(`   max_tokens: ${modifiedRequest.max_tokens}`);
    this.log(`   temperature: ${modifiedRequest.temperature || 'undefined'}`);
    this.log(`   top_p: ${modifiedRequest.top_p || 'undefined'}`);
    this.log(`   do_sample: true`);
    this.log(`   stream: ${modifiedRequest.stream}`);

    // Show message preview (roles and content length)
    if (modifiedRequest.messages && modifiedRequest.messages.length > 0) {
      this.log(`   messages: ${modifiedRequest.messages.length} messages`);
      modifiedRequest.messages.forEach((msg, idx) => {
        const role = msg.role || 'unknown';

        // Extract real text from content (handle string or array)
        let textContent = '';
        if (typeof msg.content === 'string') {
          textContent = msg.content;
        } else if (Array.isArray(msg.content)) {
          textContent = msg.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join(' ');
        } else {
          textContent = JSON.stringify(msg.content || '');
        }

        const contentLength = textContent.length;
        const preview = textContent.substring(0, 50).replace(/\n/g, ' ');
        this.log(`    [${idx}] ${role}: ${contentLength} chars - "${preview}${contentLength > 50 ? '...' : ''}"`);
      });
    } else {
      this.log(`   messages: undefined`);
    }

    // Show tools with their names (same as INPUT)
    if (modifiedRequest.tools) {
      this.log(`   tools: ${modifiedRequest.tools.length} tools`);
      const toolNames = modifiedRequest.tools.map((t, idx) => {
        if (t.function?.name) return t.function.name;
        if (t.name) return t.name;
        return `tool_${idx}`;
      });
      this.log(`    └─ [${toolNames.slice(0, 10).join(', ')}${modifiedRequest.tools.length > 10 ? `, ... +${modifiedRequest.tools.length - 10} more` : ''}]`);
    } else {
      this.log(`   tools: undefined`);
    }

    this.log(`   tool_choice: ${modifiedRequest.tool_choice || 'undefined'}`);
    this.log(`   thinking: ${this.safeJSON(modifiedRequest.thinking, 3, '   ') || 'undefined'}`);

    // Extra properties (show any other properties that might have been passed through or added)
    const knownOutputProperties = [
      'model', 'max_tokens', 'temperature', 'top_p', 'do_sample',
      'thinking', 'stream', 'messages',
      'tools', 'tool_choice'
    ];
    const unknownOutputProperties = this.safeKeys(modifiedRequest).filter(k => !knownOutputProperties.includes(k));
    if (unknownOutputProperties.length > 0) {
      this.log(`   [EXTRAS]: ${unknownOutputProperties.join(', ')}`);
      // Show values of extra properties
      unknownOutputProperties.forEach(key => {
        const value = modifiedRequest[key];
        if (value !== undefined) {
          if (typeof value === 'object') {
            this.log(`    └─ ${key}: ${this.safeJSON(value, 2, '       ')}`);
          } else {
            this.log(`    └─ ${key}: ${value}`);
          }
        }
      });
    }

    // Show if last message was modified (compare processed message, not last in array)
    if (request.messages && modifiedRequest.messages &&
      processedMessageIndex >= 0 &&
      request.messages.length > processedMessageIndex &&
      modifiedRequest.messages.length > processedMessageIndex) {

      // Helper function to extract text from content (string or array)
      const extractText = (msg) => {
        if (!msg || msg.content == null) return '';
        if (typeof msg.content === 'string') return msg.content;
        if (Array.isArray(msg.content)) {
          return msg.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join(' ');
        }
        return JSON.stringify(msg.content ?? '');
      };

      const originalMessage = extractText(request.messages[processedMessageIndex]);
      const modifiedMessage = extractText(modifiedRequest.messages[processedMessageIndex]);

      const originalLength = originalMessage.length;
      const modifiedLength = modifiedMessage.length;

      if (originalLength !== modifiedLength) {
        const difference = modifiedLength - originalLength;
        this.log('');
        this.log(`   [ENHANCEMENT] Last user message was ENHANCED:`);
        this.log(`   Original: ${originalLength} chars → Enhanced: ${modifiedLength} chars (${difference > 0 ? '+' : ''}${difference})`);
        this.log(`   [Reasoning instructions added to prompt]`);
      } else {
        this.log('');
        this.log(`   [NO CHANGES] Messages were not altered`);
      }
    }

    this.log('╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝');
    this.log('');

    // Flush logs before returning (ensure they're written)
    this.flushLogs();

    return modifiedRequest;
  }

  /**
   * Transforms response before sending to Claude Code.
   * 
   * @param {Response} response - Response processed by CCR
   * @returns {Promise<Response>} Unmodified response
   */
  async transformResponseOut (response) {
    // Get Request ID first (before logging) to show in header
    const requestId = this.requestCounter; // Use current counter as this Response belongs to last Request

    this.log('');
    this.log('╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗');
    this.log(`   [STAGE 3/3] LLM Provider → CCR → transformResponseOut() [Request #${requestId}]`);
    this.log('   Response RECEIVED from provider, BEFORE sending to Claude Code');
    this.log('╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝');
    this.log('');

    // Detect response type and avoid duplicate processing
    if (response?.constructor?.name === 'Response' && !this.processedResponses.has(response)) {

      // Generate unique ID for this Response object using counter + timestamp
      this.responseIdCounter++;
      const responseId = `${Date.now()}-${this.responseIdCounter}`;

      this.log(`   [INFO] Response for Request #${requestId} | Response Object ID: ${responseId}`);
      this.log('');

      // Mark as processed to avoid duplicate reads
      this.processedResponses.add(response);

      // It's a Response object - show info and read chunks
      this.log(`   [RESPONSE OBJECT DETECTED]`);
      this.log(`   Response.ok: ${response.ok}`);
      this.log(`   Response.status: ${response.status} ${response.statusText}`);
      this.log(`   Response.url: ${response.url}`);
      this.log(`   Response.bodyUsed: ${response.bodyUsed}`);

      // Show important headers
      try {
        const contentType = response.headers?.get('content-type');
        if (contentType) this.log(`   Content-Type: ${contentType}`);
      } catch (e) {
        this.log(`   Headers: Not available`);
      }

      this.log(``);
      this.log(`   NOTE: This is the original Response BEFORE CCR parsing.`);
      this.log(`   CCR will read the stream and convert it to Anthropic format for Claude Code.`);

      // READ REAL CHUNKS FROM STREAM
      this.log('');
      this.log('╔═══════════════════════════════════════════════════════════════════════════════════════════════════╗');
      this.log('   [STREAMING] Reading first chunks from Response');
      this.log('   RAW stream content BEFORE CCR parses it');
      this.log('╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝');
      this.log('');

      // Read chunks in BACKGROUND
      (async () => {
        try {
          // Clone Response to not consume original that CCR needs
          const cloned = response.clone();
          const reader = cloned.body.getReader();
          const decoder = new TextDecoder();

          let chunksRead = 0;
          const maxChunks = 20;
          const chunksToShow = []; // Buffer to accumulate chunks before showing

          try {
            // Read chunks asynchronously
            while (chunksRead < maxChunks) {
              const { done, value } = await reader.read();

              if (done) {
                chunksToShow.push(`   [STREAM] Ended after ${chunksRead} chunks`);
                break;
              }

              chunksRead++;
              const text = decoder.decode(value, { stream: true });

              // Detect if contains reasoning_content or content
              const hasReasoning = text.includes('"reasoning_content"');
              const hasContent = text.includes('"content"') && !hasReasoning;
              const type = hasReasoning ? '[THINKING]' : hasContent ? '[CONTENT]' : '[DATA]';

              // Extract useful properties from chunk (delta, role, etc.)
              let usefulInfo = '';
              try {
                // Try to parse chunk JSON to extract useful info
                // SSE chunks come as: data: {...JSON...}
                const textLines = text.split('\n');
                for (const line of textLines) {
                  if (line.startsWith('data: ')) {
                    const jsonStr = line.substring(6).trim(); // Remove "data: " and trim
                    if (!jsonStr || jsonStr === '[DONE]') continue; // Skip empty or [DONE]

                    // Validate JSON string before parsing
                    try {
                      const chunkData = JSON.parse(jsonStr);

                      // Extract info from delta (most important)
                      if (chunkData.choices && chunkData.choices[0] && chunkData.choices[0].delta) {
                        const delta = chunkData.choices[0].delta;
                        const properties = [];

                        if (delta.role) properties.push(`role:"${delta.role}"`);
                        if (delta.content !== undefined) {
                          const contentStr = String(delta.content);
                          const contentPreview = contentStr.substring(0, 30).replace(/\n/g, '↵');
                          properties.push(`content:"${contentPreview}${contentStr.length > 30 ? '...' : ''}"`);
                        }
                        if (delta.reasoning_content !== undefined) {
                          const reasoningStr = String(delta.reasoning_content);
                          const reasoningPreview = reasoningStr.substring(0, 30).replace(/\n/g, '↵');
                          properties.push(`reasoning_content:"${reasoningPreview}${reasoningStr.length > 30 ? '...' : ''}"`);
                        }
                        if (delta.finish_reason) properties.push(`finish_reason:"${delta.finish_reason}"`);

                        if (properties.length > 0) {
                          usefulInfo = ` → {${properties.join(', ')}}`;
                        }
                      }
                    } catch (parseError) {
                      // Skip invalid JSON chunks
                      continue;
                    }
                    break; // Only process first data: line
                  }
                }
              } catch (e) {
                // If parse fails, don't show extra info
                usefulInfo = '';
              }

              chunksToShow.push(`   [CHUNK ${chunksRead}] ${value.byteLength} bytes ${type}${usefulInfo}`);
            }

            if (chunksRead >= maxChunks) {
              chunksToShow.push(`   [STREAM] Limit of ${maxChunks} chunks reached (more data exists)`);
            }

            chunksToShow.push(``);
            chunksToShow.push(`   [SUCCESS] Reading completed - Original Response was NOT consumed`);

            // Show all accumulated chunks at once (atomic)
            chunksToShow.forEach(line => this.log(line));

            // Close the streaming block
            this.log('╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝');
            this.log('');
          } finally {
            // Always cancel reader, even if error
            try {
              await reader.cancel();
            } catch (e) {
              // Ignore cancellation error
            }
          }
        } catch (err) {
          this.log(`   [ERROR] Reading stream: ${err.message}`);
          this.log('╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝');
          this.log('');
        }

        this.flushLogs();
      })().catch(() => { }); // Execute in background, catch to silence unhandled rejection warnings

      // Return Response immediately (don't wait for chunk reading)
      return response;
    }

    // CCR calls this method multiple times: first with complete Response object,
    // then with each parsed chunk individually. Chunks were already shown
    // in first call (Response object), so here we just return the chunk
    // without additional logging to avoid information duplication.
    return response;
  }
}

// Export class for CCR
module.exports = ZaiTransformer;
