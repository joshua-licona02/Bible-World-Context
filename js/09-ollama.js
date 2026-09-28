(function () {
  "use strict";

  APP.ollama = {
    // Accepts legacy values such as http://localhost:11434/api/generate.
    normalizeBaseUrl: function (url) {
      return String(url || APP.config.defaultOllamaEndpoint)
        .trim()
        .replace(/\/+$/, "")
        .replace(/\/api(\/(generate|chat|tags))?$/i, "");
    },

    listModels: function (baseUrl, signal) {
      return APP.llm.fetchWithTimeout(APP.ollama.normalizeBaseUrl(baseUrl) + "/api/tags", {
        method: "GET"
      }, 15000, signal).then(function (response) {
        return APP.llm.ensureOk(response, "Ollama");
      }).then(function (response) {
        return response.json();
      }).then(function (data) {
        return (data.models || []).map(function (model) {
          return {
            id: model.name,
            label: model.name +
              (model.details && model.details.parameter_size ? " · " + model.details.parameter_size : "")
          };
        });
      });
    },

    chat: function (baseUrl, model, messages, options) {
      options = options || {};

      var streaming = typeof options.onToken === "function";
      var body = {
        model: model,
        messages: messages,
        stream: streaming,
        think: false,
        options: {
          temperature: options.temperature === undefined ? 0.3 : options.temperature,
          num_ctx: APP.config.llmContextTokens,
          // Hard stop for small models that fall into repetition loops under a JSON grammar.
          num_predict: APP.llm.tokenLimit(options)
        }
      };

      if (options.schema) {
        body.format = options.schema;
      }

      function send(payload) {
        return APP.llm.fetchWithTimeout(APP.ollama.normalizeBaseUrl(baseUrl) + "/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }, APP.config.llmTimeoutMs, options.signal);
      }

      return send(body).then(function (response) {
        if (response.status === 400 && body.think !== undefined) {
          // Older Ollama builds and some models reject the think flag; retry without it.
          delete body.think;
          return send(body);
        }
        return response;
      }).then(function (response) {
        return APP.llm.ensureOk(response, "Ollama");
      }).then(function (response) {
        if (!streaming) {
          return response.json().then(function (data) {
            if (!data || !data.message || typeof data.message.content !== "string") {
              throw new Error("Ollama returned no usable message content.");
            }
            return data.message.content;
          });
        }

        var text = "";
        return APP.llm.readLines(response, function (line) {
          var chunk = JSON.parse(line);
          if (chunk.error) {
            throw new Error("Ollama: " + chunk.error);
          }
          if (chunk.message && chunk.message.content) {
            text += chunk.message.content;
            options.onToken(APP.llm.stripThinking(text));
          }
        }).then(function () {
          return text;
        });
      });
    },

    // Retained for callers that predate the provider-neutral APP.llm layer.
    generate: function (endpoint, model, prompt) {
      return APP.ollama.chat(endpoint, model, [{ role: "user", content: prompt }]);
    },

    testConnection: function (endpoint, model) {
      return APP.ollama.chat(endpoint, model, [
        { role: "user", content: "Reply with exactly: OLLAMA CONNECTION OK" }
      ], { temperature: 0 });
    }
  };
}());
