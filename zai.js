// ============================================================================
// Z.AI TRANSFORMER FOR CLAUDE CODE ROUTER (PRODUCTION)
// ============================================================================
//
// PURPOSE: Claude Code Router Transformer for Z.ai's OpenAI-Compatible Endpoint
//          Solves Claude Code CLI limitations and enables advanced features.
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
// PRODUCTION: No debug logging, optimal performance
//
// CCR TYPE DEFINITIONS:
// Based on: https://github.com/musistudio/llms/blob/main/src/types/llm.ts
//           https://github.com/musistudio/llms/blob/main/src/types/transformer.ts
//
// REFERENCES:
// - CCR Transformer: https://github.com/musistudio/claude-code-router
// - Z.AI Thinking: https://docs.z.ai/guides/overview/concept-param#thinking
// ============================================================================

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
     * If true (recommended), only analyzes user messages for keywords.
     * If false, analyzes user and system messages.
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
     * Customization:
     * - overrideKeywords=false (default): customKeywords are added to this default list
     * - overrideKeywords=true: only customKeywords are used, this list is ignored
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

    /**
     * Custom keywords provided by user via options.customKeywords
     * @type {string[]}
     */
    const customKeywords = this.options.customKeywords || [];

    /**
     * If true, ONLY use customKeywords (ignore default keywords)
     * If false (default), ADD customKeywords to default keywords
     * @type {boolean}
     */
    const overrideKeywords = this.options.overrideKeywords || false;

    /**
     * Final keyword list based on override setting
     * @type {string[]}
     */
    this.keywords = overrideKeywords ? customKeywords : [...defaultKeywords, ...customKeywords];
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
   * @param {LLMProvider} [_provider] - LLM provider information (unused in production version)
   * @param {TransformerContext} [_context] - Context (unused in production version)
   * @returns {Promise<ModifiedRequestBody>} Optimized body for provider
   */
  async transformRequestIn (request, _provider, _context) {
    const modelName = request.model || 'UNKNOWN';
    const config = this.getModelConfiguration(modelName);

    // Apply max_tokens based on model configuration and global overrides
    // Claude Code has limitation of 32000/65537, we use actual model values
    // Global override has the highest priority
    const modifiedRequest = {
      ...request,
      max_tokens: this.globalOverrides.maxTokens || config.maxTokens
    };

    // Determine effective reasoning setting
    // Priority: Global Override > Claude Code > Model Config
    const claudeCodeReasoning = request.reasoning?.enabled;
    let effectiveReasoning;

    // Check if global override is set (highest priority)
    if (this.globalOverrides.reasoning !== null) {
      // Global override takes precedence over Claude Code and model config
      effectiveReasoning = this.globalOverrides.reasoning;
    } else if (claudeCodeReasoning === true) {
      // Claude Code wants reasoning ON (only if model supports it)
      effectiveReasoning = config.reasoning;
    } else if (claudeCodeReasoning === false) {
      // Claude Code wants reasoning OFF
      effectiveReasoning = false;
    } else {
      // Claude Code didn't specify, use model default
      effectiveReasoning = config.reasoning;
    }

    // Apply thinking format if reasoning is enabled
    if (effectiveReasoning) {
      const providerName = config.provider;
      if (this.reasoningFormatters[providerName]) {
        this.reasoningFormatters[providerName](modifiedRequest, modelName);
      }
    }

    // Add temperature (global override has priority)
    const finalTemperature = this.globalOverrides.temperature !== null
      ? this.globalOverrides.temperature
      : config.temperature;
    if (finalTemperature !== null) {
      modifiedRequest.temperature = finalTemperature;
    }

    // Add topP (global override has priority)
    const finalTopP = this.globalOverrides.topP !== null
      ? this.globalOverrides.topP
      : config.topP;
    if (finalTopP !== null) {
      modifiedRequest.top_p = finalTopP;
    }

    // Add do_sample to ensure temperature and top_p take effect
    modifiedRequest.do_sample = true;

    // Check if keywords are detected for prompt enhancement
    let promptAlreadyEnhanced = false; // Track if prompt was enhanced to avoid duplication

    if (request.messages && Array.isArray(request.messages)) {
      // Search for last user message (iterate backwards)
      for (let i = request.messages.length - 1; i >= 0; i--) {
        const message = request.messages[i];

        // Apply message filtering according to ignoreSystemMessages
        const shouldProcess = this.ignoreSystemMessages
          ? message.role === 'user'
          : (message.role === 'user' || message.role === 'system');

        if (shouldProcess) {
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

          // Detect "ultrathink" keyword for enhanced reasoning activation
          // This works independently of all configuration settings and global overrides
          const containsUltraThink = messageText.toLowerCase().includes('ultrathink');

          if (containsUltraThink) {
            const providerName = config.provider;
            const formatAlreadyApplied = (providerName === 'Z.AI' && modifiedRequest.thinking !== undefined);

            // Apply provider thinking format if not already present
            if (!formatAlreadyApplied) {
              if (this.reasoningFormatters[providerName]) {
                this.reasoningFormatters[providerName](modifiedRequest, modelName);
              }
            }

            // Add reasoning instructions to the user's prompt
            // Safety check: Ensure messages array exists before cloning
            if (!request.messages || !Array.isArray(request.messages)) {
              // Skip enhancement if messages array is invalid
              break;
            }
            modifiedRequest.messages = [...request.messages];
            const modifiedMessage = { ...modifiedRequest.messages[i] };

            if (typeof modifiedMessage.content === 'string') {
              modifiedMessage.content = this.modifyPromptForReasoning(modifiedMessage.content);
            } else if (Array.isArray(modifiedMessage.content)) {
              modifiedMessage.content = modifiedMessage.content.map(content => {
                if (content.type === 'text' && content.text) {
                  return { ...content, text: this.modifyPromptForReasoning(content.text) };
                }
                return content;
              });
            }

            modifiedRequest.messages[i] = modifiedMessage;
            promptAlreadyEnhanced = true; // Mark prompt as enhanced
          } else if (!promptAlreadyEnhanced) {
            // Normal logic for other keywords (only if prompt not already enhanced by ultrathink)
            const reasoningNeededByKeywords = this.detectReasoningNeeded(messageText);

            // Apply global override for keywordDetection if set
            const finalKeywordDetection = this.globalOverrides.keywordDetection !== null
              ? this.globalOverrides.keywordDetection
              : config.keywordDetection;

            if (effectiveReasoning && finalKeywordDetection && reasoningNeededByKeywords) {
              // Modify the prompt of the detected message
              // Safety check: Ensure messages array exists before cloning
              if (!request.messages || !Array.isArray(request.messages)) {
                // Skip enhancement if messages array is invalid
                break;
              }
              modifiedRequest.messages = [...request.messages];
              const modifiedMessage = { ...modifiedRequest.messages[i] };

              if (typeof modifiedMessage.content === 'string') {
                modifiedMessage.content = this.modifyPromptForReasoning(modifiedMessage.content);
              } else if (Array.isArray(modifiedMessage.content)) {
                modifiedMessage.content = modifiedMessage.content.map(content => {
                  if (content.type === 'text' && content.text) {
                    return { ...content, text: this.modifyPromptForReasoning(content.text) };
                  }
                  return content;
                });
              }

              modifiedRequest.messages[i] = modifiedMessage;
              promptAlreadyEnhanced = true; // Mark prompt as enhanced
            }
          }

          // Already processed the relevant message, exit loop
          break;
        }
      }
    }

    return modifiedRequest;
  }

  /**
   * Transforms response before sending to Claude Code.
   * 
   * @param {Response} response - Response processed by CCR
   * @returns {Promise<Response>} Unmodified response
   */
  async transformResponseOut (response) {
    return response;
  }
}

// Export class for CCR
module.exports = ZaiTransformer;
