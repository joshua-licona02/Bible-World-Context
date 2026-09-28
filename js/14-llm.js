(function () {
  "use strict";

  var openai = {
    normalizeBaseUrl: function (url) {
      return String(url || "")
        .trim()
        .replace(/\/+$/, "")
        .replace(/\/(chat\/completions|completions|models)$/i, "");
    },

    headers: function (apiKey) {
      var headers = { "Content-Type": "application/json" };
      if (apiKey) {
        headers.Authorization = "Bearer " + apiKey;
      }
      return headers;
    },

    listModels: function (settings, signal) {
      return APP.llm.fetchWithTimeout(openai.normalizeBaseUrl(settings.baseUrl) + "/models", {
        method: "GET",
        headers: openai.headers(settings.apiKey)
      }, 15000, signal).then(function (response) {
        return APP.llm.ensureOk(response, "Model server");
      }).then(function (response) {
        return response.json();
      }).then(function (data) {
        return (data.data || []).map(function (model) {
          return { id: model.id, label: model.id };
        });
      });
    },

    chat: function (settings, messages, options) {
      options = options || {};

      var streaming = typeof options.onToken === "function";
      var body = {
        model: settings.model,
        messages: messages,
        stream: streaming,
        temperature: options.temperature === undefined ? 0.3 : options.temperature,
        max_tokens: APP.llm.tokenLimit(options)
      };

      if (options.schema) {
        body.response_format = {
          type: "json_schema",
          json_schema: { name: "result", schema: options.schema, strict: false }
        };
      }

      function send(payload) {
        return APP.llm.fetchWithTimeout(openai.normalizeBaseUrl(settings.baseUrl) + "/chat/completions", {
          method: "POST",
          headers: openai.headers(settings.apiKey),
          body: JSON.stringify(payload)
        }, APP.config.llmTimeoutMs, options.signal);
      }

      return send(body).then(function (response) {
        if (response.status === 400 && body.response_format) {
          // Not every OpenAI-compatible server supports json_schema; fall back to prompt-only JSON.
          delete body.response_format;
          return send(body);
        }
        return response;
      }).then(function (response) {
        return APP.llm.ensureOk(response, "Model server");
      }).then(function (response) {
        if (!streaming) {
          return response.json().then(function (data) {
            var choice = data && data.choices && data.choices[0];
            if (!choice || !choice.message || typeof choice.message.content !== "string") {
              throw new Error("Model server returned no usable message content.");
            }
            return choice.message.content;
          });
        }

        var text = "";
        return APP.llm.readLines(response, function (line) {
          if (line.indexOf("data:") !== 0) {
            return;
          }
          var payload = line.slice(5).trim();
          if (payload === "[DONE]") {
            return;
          }
          var chunk = JSON.parse(payload);
          var delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
          if (delta && delta.content) {
            text += delta.content;
            options.onToken(APP.llm.stripThinking(text));
          }
        }).then(function () {
          return text;
        });
      });
    }
  };

  APP.llm = {
    providers: {
      ollama: "Ollama",
      openai: "OpenAI-compatible"
    },

    getSettings: function () {
      return APP.state.llm;
    },

    tokenLimit: function (options) {
      return options.maxTokens || (options.schema ? 1500 : 2000);
    },

    isConfigured: function () {
      var settings = APP.state.llm;
      return Boolean(settings.baseUrl && settings.model);
    },

    describe: function () {
      var settings = APP.state.llm;
      return settings.model + " via " + APP.llm.providers[settings.provider];
    },

    fetchWithTimeout: function (url, init, timeoutMs, signal) {
      var controller = new AbortController();
      var timedOut = false;
      var timer = window.setTimeout(function () {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      function forwardAbort() {
        controller.abort();
      }

      if (signal) {
        if (signal.aborted) {
          controller.abort();
        }
        signal.addEventListener("abort", forwardAbort, { once: true });
      }

      init.signal = controller.signal;

      return fetch(url, init).catch(function (error) {
        if (timedOut) {
          throw new Error("The model did not respond within " + Math.round(timeoutMs / 1000) + " seconds.");
        }
        if (signal && signal.aborted) {
          throw APP.http.abortError();
        }
        throw error;
      }).finally(function () {
        window.clearTimeout(timer);
        if (signal) {
          signal.removeEventListener("abort", forwardAbort);
        }
      });
    },

    ensureOk: function (response, label) {
      if (response.ok) {
        return response;
      }

      return response.text().then(function (text) {
        var detail = "";
        try {
          var parsed = JSON.parse(text);
          detail = parsed.error && (parsed.error.message || parsed.error) || "";
        } catch (error) {
          detail = text.slice(0, 200);
        }

        var httpError = new Error(label + " returned HTTP " + response.status + (detail ? ": " + detail : "."));
        httpError.status = response.status;
        throw httpError;
      });
    },

    // Reads newline-delimited stream bodies (Ollama NDJSON and OpenAI server-sent events).
    readLines: function (response, onLine) {
      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";

      function flush(final) {
        var lines = buffer.split("\n");
        buffer = final ? "" : lines.pop();
        lines.forEach(function (line) {
          var trimmed = line.trim();
          if (trimmed) {
            onLine(trimmed);
          }
        });
      }

      function next() {
        return reader.read().then(function (result) {
          if (result.done) {
            buffer += decoder.decode();
            flush(true);
            return;
          }
          buffer += decoder.decode(result.value, { stream: true });
          flush(false);
          return next();
        });
      }

      return next();
    },

    // Removes reasoning blocks that some models emit inline, including an unfinished trailing block.
    stripThinking: function (text) {
      return String(text || "")
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/<think>[\s\S]*$/i, "")
        .trim();
    },

    extractJson: function (text) {
      var cleaned = APP.llm.stripThinking(text).replace(/^```(?:json)?\s*|\s*```$/g, "");

      try {
        return JSON.parse(cleaned);
      } catch (error) {
        var start = cleaned.search(/[\[{]/);
        var end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
        if (start !== -1 && end > start) {
          return JSON.parse(cleaned.slice(start, end + 1));
        }
        throw new Error("The model did not return valid JSON.");
      }
    },

    listModels: function (signal) {
      var settings = APP.state.llm;
      return settings.provider === "openai"
        ? openai.listModels(settings, signal)
        : APP.ollama.listModels(settings.baseUrl, signal);
    },

    chat: function (messages, options) {
      var settings = APP.state.llm;

      if (!APP.llm.isConfigured()) {
        return Promise.reject(new Error("Choose an LLM endpoint and model in AI settings."));
      }

      var request = settings.provider === "openai"
        ? openai.chat(settings, messages, options)
        : APP.ollama.chat(settings.baseUrl, settings.model, messages, options);

      return request.then(APP.llm.stripThinking);
    },

    chatJson: function (messages, schema, options) {
      var merged = Object.assign({ temperature: 0.1 }, options || {}, { schema: schema });

      return APP.llm.chat(messages, merged).then(APP.llm.extractJson).catch(function (error) {
        if (APP.http.isAbort(error) || /HTTP|respond|endpoint|fetch/i.test(error.message)) {
          throw error;
        }

        // One corrective retry for malformed JSON from smaller local models.
        return APP.llm.chat(messages.concat([{
          role: "user",
          content: "Your previous reply was not valid JSON. Reply again with only the JSON object."
        }]), merged).then(APP.llm.extractJson);
      });
    },

    generate: function (prompt, options) {
      return APP.llm.chat([{ role: "user", content: prompt }], options);
    },

    test: function () {
      return APP.llm.chat([
        { role: "user", content: "Reply with exactly: CONNECTION OK" }
      ], { temperature: 0 });
    },

    explainError: function (error) {
      var message = error && error.message ? error.message : String(error);

      if (error instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(message)) {
        var fromFile = window.location.protocol === "file:";
        return "The browser could not reach the model server. Confirm it is running at the configured URL. " +
          (fromFile
            ? "This page is opened from a file, so the browser sends Origin: null, which Ollama rejects by default. " +
              "Set the environment variable OLLAMA_ORIGINS=* (or serve this folder from localhost) and restart Ollama."
            : "If it is running, allow this page's origin (for Ollama, set OLLAMA_ORIGINS) and restart it.");
      }

      if (/not found|404/i.test(message)) {
        return message + " — the model may not be installed. Use \"Refresh models\" to pick an installed one.";
      }

      return message;
    }
  };
}());
