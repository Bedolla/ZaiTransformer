// ============================================================================
// Z.AI TRANSFORMER FOR CLAUDE CODE ROUTER (DEBUG)
// ============================================================================
//
// PURPOSE: Claude Code Router Transformer for Z.ai's OpenAI-Compatible Endpoint
//          Solves Claude Code limitations and enables advanced features.
//          DEBUG VERSION: Complete logging and transformation tracking.
//
// FLOW: Claude Code → This Transformer → Z.AI OpenAI-Compatible Endpoint
//
// KEY FEATURES:
//
// 1. MAX OUTPUT TOKENS FIX (Primary Solution)
//    - Problem: Claude Code limits max_tokens to 32K/64K
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
// 3. REASONING CONTROL (Transformer-Managed)
//    - With default config (reasoning=true), transformer always controls reasoning
//    - Claude Code's native toggle (Tab key / alwaysThinkingEnabled) does NOT work
//    - To enable Claude Code control: Set all models to reasoning=false
//    - Translation: Transforms Claude Code reasoning → Z.AI thinking format
//
// 4. KEYWORD-BASED PROMPT ENHANCEMENT (Auto-Detection)
//    - Detects analytical keywords: analyze, calculate, count, explain, etc.
//    - Automatically adds reasoning instructions to user prompt
//    - REQUIRES: reasoning=true AND keywordDetection=true (both must be true)
//    - If either is false, keywords are ignored
//
// 5. ULTRATHINK MODE (User-Triggered)
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
//
// 7. CUSTOM USER TAGS (Direct Control)
//    - Custom tags in messages: <Thinking:On|Off>
//    - Effort tags: <Effort:Low|Medium|High>
//    - Direct control over reasoning without modifying configuration
//    - High priority: Overrides global overrides and model configuration
//
// 8. FORCE PERMANENT THINKING (Level 0 - Maximum Priority)
//    - Option: forcePermanentThinking (in transformer options)
//    - Forces reasoning=true + effort=high on EVERY user message
//    - Overrides ALL other settings (Ultrathink, User Tags, Global Overrides, Model Config, Default)
//    - User Tags like <Thinking:Off>, <Effort:Low>, <Effort:Medium> are completely ignored
//    - Nuclear option: Use only when you want thinking 100% of the time with no way to disable it
//
// REASONING HIERARCHY (6 Priority Levels):
//   Priority 0 (Maximum): Force Permanent Thinking → reasoning=true, effort=high (overrides EVERYTHING, including Ultrathink)
//   Priority 1 (Highest): Ultrathink → reasoning=true, effort=high (overrides all below)
//   Priority 2: Custom Tags (<Thinking>/<Effort>) → Direct user control
//   Priority 3: Global Override (overrideReasoning) → Applied to all models
//   Priority 4: Model Configuration (config.reasoning) → Hardcoded per model (reasoning=true by default)
//   Priority 5: Default → Only active when NO other level is active
//
//   NOTE: With default config (reasoning=true for all models), Priority 4 is always active,
//         making Claude Code's native toggle (Tab key / alwaysThinkingEnabled) ineffective.
//
// KEYWORD SYSTEM (Independent):
//   - REQUIRES 3 simultaneous conditions: reasoning=true + keywordDetection=true + keywords detected
//   - Automatic prompt enhancement when all 3 conditions met
//   - Works with any reasoning priority level (1-5)
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
 * @typedef {"low"|"medium"|"high"} ThinkLevel
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
 * @property {boolean} [forcePermanentThinking] - Force reasoning=true + effort=high on EVERY user message (Level 0 - Maximum Priority)
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
  name = "zai-debug";

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
     * Force Permanent Thinking - MAXIMUM PRIORITY (Level 0)
     * When enabled, forces reasoning=true + effort=high on EVERY user message.
     * Overrides ALL other settings including Ultrathink, User Tags, and Global Overrides.
     * 
     * WARNING: This is the nuclear option. Use only when you want thinking 100% of the time.
     * 
     * @type {boolean}
     */
    this.forcePermanentThinking = this.options.forcePermanentThinking === true;

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
     * Model configurations by provider.
     * Defines maxTokens, contextWindow, temperature, topP, reasoning, keywordDetection, provider.
     * @type {ModelConfigurationMap}
     */
    this.modelConfigurations = {
      // ===== Z.AI =====

      // GLM 4.6 - Advanced reasoning with extended context
      'glm-4.6': {
        maxTokens: 128 * 1024,          // 131,072 (128K)
        contextWindow: 200 * 1024,      // 204,800 (200K)
        temperature: 1.0,               // Official value
        topP: 0.95,                     // Official value
        reasoning: true,                // Supports native reasoning (model decides when to use it)
        keywordDetection: true,         // Enable automatic prompt enhancement when analytical keywords detected
        provider: 'Z.AI'
      },

      // GLM 4.5 - General purpose with reasoning
      'glm-4.5': {
        maxTokens: 96 * 1024,           // 98,304 (96K)
        contextWindow: 128 * 1024,      // 131,072 (128K)
        temperature: 0.6,               // Official value
        topP: 0.95,                     // Official value
        reasoning: true,                // Supports native reasoning (model decides when to use it)
        keywordDetection: true,         // Enable automatic prompt enhancement when analytical keywords detected
        provider: 'Z.AI'
      },

      // GLM 4.5-air - Lightweight and fast version
      'glm-4.5-air': {
        maxTokens: 96 * 1024,           // 98,304 (96K)
        contextWindow: 128 * 1024,      // 131,072 (128K)
        temperature: 0.6,               // Official value
        topP: 0.95,                     // Official value
        reasoning: true,                // Supports native reasoning (model decides when to use it)
        keywordDetection: true,         // Enable automatic prompt enhancement when analytical keywords detected
        provider: 'Z.AI'
      },

      // GLM 4.5v - For vision and multimodal
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
   * @param {boolean} isUltrathink - If Ultrathink mode is active
   * @returns {string} Enhanced content with reasoning instructions
   */
  modifyPromptForReasoning (content, isUltrathink = false) {
    let reasoningInstruction;

    if (isUltrathink) {
      // Ultrathink active: more intensive instructions with natural ULTRATHINK integration
      reasoningInstruction = "\n\n[IMPORTANT: This question requires careful analysis with ULTRATHINK mode engaged. Think step by step, analyze every aspect thoroughly, consider multiple perspectives, and show your detailed reasoning before answering.]\n\n";
    } else {
      // Normal mode: standard instructions
      reasoningInstruction = "\n\n[IMPORTANT: This question requires careful analysis. Think step by step and show your detailed reasoning before answering.]\n\n";
    }

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
    this.log(`   [STAGE 1/3] INPUT: Claude Code → CCR → transformRequestIn() [Request #${currentRequestId}]`);
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

    // Detect custom tags in user messages
    // Priority: Force Permanent Thinking (0) > Ultrathink (1) > User Tags (2) > Global Override (3) > Model Config (4) > Claude Code (5)
    let ultrathinkDetected = false;
    let thinkingTag = null; // 'On', 'Off'
    let effortTag = null; // 'Low', 'Medium', 'High'

    this.log('');
    this.log('   [CUSTOM TAGS] Searching for tags in user messages...');

    // Search for tags in ALL user messages (most recent takes precedence)
    if (request.messages && Array.isArray(request.messages)) {
      for (let i = 0; i < request.messages.length; i++) {
        const message = request.messages[i];
        if (message.role === 'user') {
          let messageText = '';
          if (typeof message.content === 'string') {
            messageText = message.content;
          } else if (Array.isArray(message.content)) {
            messageText = message.content
              .filter(c => c.type === 'text' && c.text)
              .map(c => c.text)
              .join(' ');
          }

          // Skip system-reminders
          if (messageText.trim().startsWith('<system-reminder>')) {
            this.log(`   [SYSTEM] Message ${i} ignored (system-reminder)`);
            continue;
          }

          // Detect Ultrathink (case insensitive) - NOTE: Keep in message for English version
          if (/\bultrathink\b/i.test(messageText)) {
            ultrathinkDetected = true;
            this.log(`   [TAG DETECTED] Ultrathink found in message ${i} (will be KEPT in message)`);
          }

          // Detect Thinking tags (English only)
          const thinkingMatch = messageText.match(/<Thinking:(On|Off)>/i);
          if (thinkingMatch) {
            thinkingTag = thinkingMatch[1]; // Capture: On, Off
            this.log(`   [TAG DETECTED] <Thinking:${thinkingTag}> in message ${i}`);
          }

          // Detect Effort tags (English only)
          const effortMatch = messageText.match(/<Effort:(Low|Medium|High)>/i);
          if (effortMatch) {
            effortTag = effortMatch[1]; // Capture: Low, Medium, High
            this.log(`   [TAG DETECTED] <Effort:${effortTag}> in message ${i}`);
          }
        }
      }
    }

    if (!ultrathinkDetected && !thinkingTag && !effortTag) {
      this.log('   [INFO] No custom tags detected in messages');
    }

    // Determine effective reasoning based on priority
    let effectiveReasoning = false;
    let effortLevel = "high"; // Default

    this.log('');
    this.log('   [REASONING] Determining effective configuration...');

    // 0. Force Permanent Thinking (MAXIMUM PRIORITY - Nuclear Option)
    if (this.forcePermanentThinking) {
      effectiveReasoning = true;
      effortLevel = "high";
      this.log('   [PRIORITY 0] ⚠️  Force Permanent Thinking ACTIVE → reasoning=true, effort=high (MAXIMUM PRIORITY - overrides EVERYTHING)');
    }
    // 1. Ultrathink (highest priority, overrides EVERYTHING except forcePermanentThinking)
    else if (ultrathinkDetected) {
      effectiveReasoning = true;
      effortLevel = "high";
      this.log('   [PRIORITY 1] Ultrathink detected → reasoning=true, effort=high (highest priority)');
    }
    // 2. User Tags
    else if (thinkingTag || effortTag) {
      this.log('   [PRIORITY 2] User Tags detected:');

      // If there's a Thinking tag
      if (thinkingTag) {
        const thinkingLower = thinkingTag.toLowerCase();
        if (thinkingLower === 'off') {
          // Thinking explicitly OFF
          // BUT: If effort tag present, assume reasoning wanted
          effectiveReasoning = effortTag ? true : false;
          if (effortTag) {
            this.log(`   <Thinking:${thinkingTag}> but <Effort:${effortTag}> present → reasoning=true (effort implies reasoning)`);
          } else {
            this.log(`   <Thinking:${thinkingTag}> → reasoning=false (explicitly disabled)`);
          }
        } else if (thinkingLower === 'on') {
          // Thinking explicitly ON
          effectiveReasoning = true;
          this.log(`   <Thinking:${thinkingTag}> → reasoning=true`);
        }
      }
      // If NO thinking tag but there IS effort tag, assume reasoning ON
      else if (effortTag) {
        effectiveReasoning = true;
        this.log(`   <Effort:${effortTag}> without Thinking tag → reasoning=true (effort implies reasoning)`);
      }

      // Map effort tag to standard values (if exists)
      if (effortTag) {
        const effortLower = effortTag.toLowerCase();
        if (effortLower === 'low') {
          effortLevel = "low";
        } else if (effortLower === 'medium') {
          effortLevel = "medium";
        } else if (effortLower === 'high') {
          effortLevel = "high";
        }
        this.log(`   Effort level mapped: ${effortTag} → ${effortLevel}`);
      } else {
        this.log(`   No Effort tag, using default: ${effortLevel}`);
      }
    }
    // 3. Global Override
    else if (this.globalOverrides.reasoning !== null) {
      effectiveReasoning = this.globalOverrides.reasoning;
      effortLevel = "high";
      this.log(`   [PRIORITY 3] Global Override: reasoning=${this.globalOverrides.reasoning} → reasoning=${effectiveReasoning}, effort=high`);
    }
    // 4. Model Config
    else if (config.reasoning === true) {
      effectiveReasoning = true;
      effortLevel = "high";
      this.log(`   [PRIORITY 4] Model config: reasoning=${config.reasoning} → reasoning=true, effort=high`);
    } else {
      this.log(`   [DEFAULT] No tags, no global override, model config reasoning=${config.reasoning} → reasoning=false`);
    }

    this.log(`   [RESULT] Effective reasoning=${effectiveReasoning}, effort level=${effortLevel}`);

    // Remove tags from ALL user messages (English version: remove Effort and Thinking, KEEP Ultrathink)
    this.log('');
    this.log('   [CLEANUP] Removing tags from messages...');
    let tagsRemovedCount = 0;

    if (request.messages && Array.isArray(request.messages)) {
      let messagesModified = false;

      for (let i = 0; i < request.messages.length; i++) {
        const message = request.messages[i];
        if (message.role === 'user') {
          let textModified = false;

          if (typeof message.content === 'string') {
            let newText = message.content;
            const originalText = newText;

            // Remove tags
            newText = newText.replace(/<Effort:(Low|Medium|High)>/gi, '');
            newText = newText.replace(/<Thinking:(On|Off)>/gi, '');

            if (newText !== message.content) {
              textModified = true;
              tagsRemovedCount++;
              this.log(`   Message ${i}: Tags removed`);
              if (!messagesModified) {
                modifiedRequest.messages = [...request.messages];
                messagesModified = true;
              }
              modifiedRequest.messages[i] = { ...message, content: newText.trim() };
            }
          } else if (Array.isArray(message.content)) {
            const newContent = message.content.map(content => {
              if (content.type === 'text' && content.text) {
                let newText = content.text;

                // Remove tags
                newText = newText.replace(/<Effort:(Low|Medium|High)>/gi, '');
                newText = newText.replace(/<Thinking:(On|Off)>/gi, '');

                if (newText !== content.text) {
                  textModified = true;
                  return { ...content, text: newText.trim() };
                }
              }
              return content;
            });

            if (textModified) {
              tagsRemovedCount++;
              this.log(`   Message ${i}: Tags removed (array content)`);
              if (!messagesModified) {
                modifiedRequest.messages = [...request.messages];
                messagesModified = true;
              }
              modifiedRequest.messages[i] = { ...message, content: newContent };
            }
          }
        }
      }
    }

    if (tagsRemovedCount === 0) {
      this.log('   [INFO] No tags found to remove');
    } else {
      this.log(`   [COMPLETED] ${tagsRemovedCount} message(s) modified`);
    }

    // Add reasoning field with effort level to request
    // Only override if there's Ultrathink, user tags, global override, or config.reasoning
    this.log('');
    this.log('   [REASONING FIELD] Adding reasoning field to request...');
    const hasActiveConditions = ultrathinkDetected || thinkingTag || effortTag || this.globalOverrides.reasoning !== null || config.reasoning === true;

    if (hasActiveConditions) {
      this.log(`   [INFO] Active conditions detected, overriding reasoning`);
      if (effectiveReasoning) {
        modifiedRequest.reasoning = {
          enabled: true,
          effort: effortLevel
        };
        this.log(`   reasoning.enabled = true`);
        this.log(`   reasoning.effort = "${effortLevel}"`);

        // Apply provider thinking format
        const providerName = config.provider;
        if (this.reasoningFormatters[providerName]) {
          this.reasoningFormatters[providerName](modifiedRequest, modelName);
          this.log(`   [THINKING] ${providerName} format applied`);
        } else {
          this.log(`   [OMISSION] thinking NOT added (no formatter for ${providerName})`);
        }
      } else {
        modifiedRequest.reasoning = {
          enabled: false
        };
        this.log(`   reasoning.enabled = false`);
      }
    } else {
      // No active conditions: pass original reasoning from Claude Code if exists
      if (request.reasoning) {
        modifiedRequest.reasoning = request.reasoning;
        this.log(`   [INFO] No active conditions, passing original reasoning from Claude Code`);
        this.log(`   reasoning = ${JSON.stringify(request.reasoning)}`);

        // If original reasoning is enabled, apply provider format
        if (request.reasoning.enabled === true) {
          const providerName = config.provider;
          if (this.reasoningFormatters[providerName]) {
            this.reasoningFormatters[providerName](modifiedRequest, modelName);
            this.log(`   [THINKING] ${providerName} format applied for original reasoning`);
          } else {
            this.log(`   [OMISSION] thinking NOT added (no formatter for ${providerName})`);
          }
        }
      } else {
        this.log(`   [INFO] No active conditions and no original reasoning, field not added`);
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
    // ONLY if reasoning is active AND keywordDetection is enabled
    // Search in ALL user messages
    this.log('');
    this.log('   [KEYWORDS] Checking for analytical keywords in ALL user messages...');

    let keywordsDetectedInConversation = false;
    let messageWithKeywords = -1; // Index of message containing keywords

    if (request.messages && Array.isArray(request.messages)) {
      for (let i = 0; i < request.messages.length; i++) {
        const message = request.messages[i];

        // Only analyze user messages for keywords
        if (message.role === 'user') {
          // Extract text from message (can be string or array of contents)
          let messageText = '';
          if (typeof message.content === 'string') {
            messageText = message.content;
          } else if (Array.isArray(message.content)) {
            messageText = message.content
              .filter(c => c.type === 'text' && c.text)
              .map(c => c.text)
              .join(' ');
          }

          // Skip automatic Claude Code system-reminder messages
          if (messageText.trim().startsWith('<system-reminder>')) {
            this.log(`   [MESSAGE ${i}] system-reminder ignored`);
            continue; // Skip to next message
          }

          // Detect analytical keywords in any valid message
          const hasKeywords = this.detectReasoningNeeded(messageText);
          const preview = messageText.substring(0, 50).replace(/\n/g, '↕');

          if (hasKeywords) {
            keywordsDetectedInConversation = true;
            messageWithKeywords = i;
            this.log(`   [MESSAGE ${i}] ${message.role.toUpperCase()} - Keywords DETECTED: "${preview}..."`);
            break; // Already detected, no need to continue searching
          } else {
            this.log(`   [MESSAGE ${i}] ${message.role.toUpperCase()} - No keywords: "${preview}..."`);
          }
        }
      }
    }

    if (!keywordsDetectedInConversation) {
      this.log('   [RESULT] No keywords detected in any message');
    } else {
      this.log(`   [RESULT] Keywords detected in message ${messageWithKeywords}`);
    }

    // Apply prompt enhancement if keywords were detected
    if (request.messages && Array.isArray(request.messages) && keywordsDetectedInConversation) {
      // Apply global override for keywordDetection if set
      const finalKeywordDetection = this.globalOverrides.keywordDetection !== null
        ? this.globalOverrides.keywordDetection
        : config.keywordDetection;

      this.log(`   [CONFIGURATION] reasoning=${effectiveReasoning} | keywordDetection=${finalKeywordDetection}${this.globalOverrides.keywordDetection !== null ? ' (GLOBAL)' : ''}`);

      // Only enhance prompt if reasoning is active AND detection enabled
      if (effectiveReasoning && finalKeywordDetection) {
        this.log('   [ENHANCEMENT] Conditions met, searching for last valid message to enhance...');

        // Search for last user message to enhance its prompt
        for (let i = request.messages.length - 1; i >= 0; i--) {
          const message = request.messages[i];

          // Apply same filtering
          // Enhancement always targets user messages only
          if (message.role === 'user') {
            // Extract text from message
            let messageText = '';
            if (typeof message.content === 'string') {
              messageText = message.content;
            } else if (Array.isArray(message.content)) {
              messageText = message.content
                .filter(c => c.type === 'text' && c.text)
                .map(c => c.text)
                .join(' ');
            }

            // Skip system-reminders
            if (messageText.trim().startsWith('<system-reminder>')) {
              this.log(`   [SKIPPED] Message ${i} is system-reminder, continuing search...`);
              continue;
            }

            // Create simple hash of message for identification
            let messageHash = 0;
            for (let j = 0; j < messageText.length; j++) {
              const char = messageText.charCodeAt(j);
              messageHash = ((messageHash << 5) - messageHash) + char;
              messageHash = messageHash & messageHash; // Convert to 32bit integer
            }
            const hashHex = (messageHash >>> 0).toString(16).toUpperCase().padStart(8, '0');

            this.log(`   [LAST USER MESSAGE] Message ${i} - Hash: ${hashHex}`);
            this.log(`   "${messageText.substring(0, 100).replace(/\n/g, '↕')}${messageText.length > 100 ? '...' : ''}"`);

            // Modify the prompt of the last valid message
            // Safety check: Ensure messages array exists before cloning
            if (!request.messages || !Array.isArray(request.messages)) {
              this.log('   [WARNING] request.messages invalid, skipping enhancement');
              break;
            }

            // If we already modified messages to remove tags, use that copy
            if (!modifiedRequest.messages) {
              modifiedRequest.messages = [...request.messages];
            }
            const modifiedMessage = { ...modifiedRequest.messages[i] };

            if (typeof modifiedMessage.content === 'string') {
              modifiedMessage.content = this.modifyPromptForReasoning(modifiedMessage.content, ultrathinkDetected);
            } else if (Array.isArray(modifiedMessage.content)) {
              modifiedMessage.content = modifiedMessage.content.map(content => {
                if (content.type === 'text' && content.text) {
                  return { ...content, text: this.modifyPromptForReasoning(content.text, ultrathinkDetected) };
                }
                return content;
              });
            }

            modifiedRequest.messages[i] = modifiedMessage;
            this.log('   [COMPLETED] Reasoning instructions added to the last message prompt');

            // Already modified the last valid message, exit loop
            break;
          }
        }
      } else {
        // Log why NOT enhancing
        if (!effectiveReasoning) {
          this.log('   [SKIPPED] NOT enhancing prompt: reasoning disabled');
        } else if (!finalKeywordDetection) {
          this.log('   [SKIPPED] NOT enhancing prompt: keywordDetection=false');
        }
      }
    }

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
