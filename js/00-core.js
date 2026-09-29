(function () {
  "use strict";

  window.APP = window.APP || {};

  APP.config = {
    defaultOllamaEndpoint: "http://localhost:11434",
    defaultOpenAiEndpoint: "http://localhost:1234/v1",
    defaultOllamaModel: "llama3.2",
    maxAuditEntries: 14,
    maxPassageLength: 12000,
    maxSourceTextLength: 4500,
    maxSourceUrls: 8,
    httpConcurrency: 4,
    httpTimeoutMs: 20000,
    maxCachedResponseChars: 400000,
    llmTimeoutMs: 300000,
    llmContextTokens: 8192,
    settingsStorageKey: "bwc-settings-v1"
  };

  APP.state = {
    reference: null,
    context: null,
    analysis: null,
    regionalRequest: null,
    researchSources: [],
    passage: null,
    isLoading: false,
    useOllama: false,
    useResearch: false,
    llm: {
      provider: "ollama",
      baseUrl: APP.config.defaultOllamaEndpoint,
      model: APP.config.defaultOllamaModel,
      apiKey: ""
    },
    timeline: null,
    audit: []
  };

  APP.core = {
    setState: function (changes) {
      Object.keys(changes).forEach(function (key) {
        APP.state[key] = changes[key];
      });
    },

    addAudit: function (level, message) {
      APP.state.audit.unshift({
        level: level || "info",
        message: message,
        time: new Date().toLocaleTimeString()
      });

      APP.state.audit = APP.state.audit.slice(0, APP.config.maxAuditEntries);
    },

    // Per-browser preferences only; API keys are never written here.
    readStoredSettings: function () {
      try {
        return JSON.parse(window.localStorage.getItem(APP.config.settingsStorageKey)) || {};
      } catch (error) {
        return {};
      }
    },

    writeStoredSettings: function (changes) {
      try {
        var merged = Object.assign(APP.core.readStoredSettings(), changes);
        window.localStorage.setItem(APP.config.settingsStorageKey, JSON.stringify(merged));
      } catch (error) {
        // Storage may be blocked; settings then last for this page session only.
      }
    },

    resetResults: function () {
      APP.state.reference = null;
      APP.state.context = null;
      APP.state.analysis = null;
      APP.state.regionalRequest = null;
      APP.state.researchSources = [];
    }
  };
}());