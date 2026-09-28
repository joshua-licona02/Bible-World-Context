(function () {
  "use strict";

  APP.controller = {
    init: function () {
      APP.controller.populateAnchors();
      APP.controller.populateContinents();
      APP.controller.bindEvents();
      APP.controller.loadLlmSettings();

      APP.core.addAudit("info", "Application initialized in local historical context mode.");
      APP.controller.renderAudit();
      APP.controller.renderStatus("neutral", "Local context mode");
      APP.controller.showWorkspace(APP.core.readStoredSettings().workspace === "timeline" ? "timeline" : "analysis");
      APP.controller.detectModels();
    },

    loadLlmSettings: function () {
      var stored = APP.core.readStoredSettings().llm || {};
      var provider = stored.provider === "openai" ? "openai" : "ollama";

      APP.dom.llmProvider.value = provider;
      APP.dom.ollamaEndpoint.value = stored.baseUrl ||
        (provider === "openai" ? APP.config.defaultOpenAiEndpoint : APP.config.defaultOllamaEndpoint);
      APP.dom.ollamaModel.value = stored.model || APP.config.defaultOllamaModel;
      APP.controller.saveSettings();
    },

    // If the saved model is not installed, quietly switch to one that is.
    detectModels: function () {
      return APP.llm.listModels().then(function (models) {
        APP.controller.fillModelOptions(models);
        var ids = models.map(function (model) { return model.id; });

        if (ids.length && ids.indexOf(APP.state.llm.model) === -1) {
          var previous = APP.state.llm.model;
          APP.dom.ollamaModel.value = ids[0];
          APP.controller.saveSettings();
          APP.core.addAudit("info", "Model \"" + previous + "\" is not installed; using " + ids[0] + ".");
          APP.controller.renderAudit();
        }
        return models;
      }).catch(function () {
        return [];
      });
    },

    fillModelOptions: function (models) {
      APP.dom.llmModelOptions.innerHTML = models.map(function (model) {
        return '<option value="' + APP.utils.escapeHtml(model.id) + '">' + APP.utils.escapeHtml(model.label) + "</option>";
      }).join("");
    },

    showWorkspace: function (name) {
      var timeline = name === "timeline";
      APP.dom.analysisWorkspace.classList.toggle("hidden", timeline);
      APP.dom.timelineWorkspace.classList.toggle("hidden", !timeline);
      APP.dom.tabAnalysis.setAttribute("aria-selected", String(!timeline));
      APP.dom.tabTimeline.setAttribute("aria-selected", String(timeline));
      APP.core.writeStoredSettings({ workspace: name });

      if (timeline && APP.state.timeline && APP.state.timeline.plan) {
        APP.timelineController.render();
      }
    },

    handleProviderChange: function () {
      var url = APP.dom.ollamaEndpoint.value.trim();
      var defaults = [APP.config.defaultOllamaEndpoint, APP.config.defaultOpenAiEndpoint, ""];

      // Only swap the URL when it is still a default; keep anything the user typed.
      if (defaults.indexOf(url) !== -1) {
        APP.dom.ollamaEndpoint.value = APP.dom.llmProvider.value === "openai"
          ? APP.config.defaultOpenAiEndpoint
          : APP.config.defaultOllamaEndpoint;
      }

      APP.controller.saveSettings();
      APP.controller.handleRefreshModels();
    },

    handleRefreshModels: function () {
      APP.controller.saveSettings();
      APP.controller.setDialogMessage("Loading models…", "");

      APP.llm.listModels().then(function (models) {
        APP.controller.fillModelOptions(models);
        APP.controller.setDialogMessage(
          models.length ? models.length + " model(s) available. Pick one from the Model field." : "The server reported no models.",
          models.length ? "success" : "error"
        );
      }).catch(function (error) {
        APP.controller.setDialogMessage(APP.llm.explainError(error), "error");
      });
    },

    setDialogMessage: function (message, type) {
      APP.dom.llmDialogMessage.textContent = message || "";
      APP.dom.llmDialogMessage.className = "form-message" + (type ? " " + type : "");
    },

    bindEvents: function () {
      APP.dom.referenceForm.addEventListener("submit", APP.controller.handleBibleSearch);
      APP.dom.regionalSearchButton.addEventListener("click", APP.controller.handleRegionalSearch);
      APP.dom.historicalAnchor.addEventListener("change", APP.controller.handleAnchorChange);
      APP.dom.continentSelect.addEventListener("change", APP.controller.handleContinentChange);
      APP.dom.testOllamaButton.addEventListener("click", APP.controller.handleTestOllama);

      APP.dom.useOllama.addEventListener("change", APP.controller.saveSettings);
      APP.dom.useResearch.addEventListener("change", APP.controller.saveSettings);
      APP.dom.ollamaEndpoint.addEventListener("change", APP.controller.saveSettings);
      APP.dom.ollamaModel.addEventListener("change", APP.controller.saveSettings);
      APP.dom.llmApiKey.addEventListener("change", APP.controller.saveSettings);
      APP.dom.llmProvider.addEventListener("change", APP.controller.handleProviderChange);
      APP.dom.llmRefreshModels.addEventListener("click", APP.controller.handleRefreshModels);

      APP.dom.openLlmSettings.addEventListener("click", function () {
        APP.controller.setDialogMessage("", "");
        APP.dom.llmDialog.showModal();
      });
      APP.dom.llmDialog.addEventListener("close", APP.controller.saveSettings);

      APP.dom.tabAnalysis.addEventListener("click", function () {
        APP.controller.showWorkspace("analysis");
      });
      APP.dom.tabTimeline.addEventListener("click", function () {
        APP.controller.showWorkspace("timeline");
      });

      APP.dom.exploreInTimeline.addEventListener("click", function () {
        var context = APP.state.context;
        if (!context) {
          return;
        }
        APP.timelineController.openWith({
          query: context.reference ? context.reference.display : "",
          start: context.start,
          end: context.end
        });
      });
    },

    populateAnchors: function () {
      APP.sources.anchors.forEach(function (anchor) {
        var option = document.createElement("option");
        option.value = anchor.id;
        option.textContent = anchor.label;
        APP.dom.historicalAnchor.appendChild(option);
      });
    },

    populateContinents: function () {
      Object.keys(APP.sources.continents).forEach(function (continent) {
        var option = document.createElement("option");
        option.value = continent;
        option.textContent = continent;
        APP.dom.continentSelect.appendChild(option);
      });
    },

    populateRegions: function (continent) {
      APP.dom.regionSelect.innerHTML = '<option value="All">All regions</option>';

      if (continent === "All") {
        return;
      }

      APP.sources.continents[continent].forEach(function (region) {
        var option = document.createElement("option");
        option.value = region;
        option.textContent = region;
        APP.dom.regionSelect.appendChild(option);
      });
    },

    saveSettings: function () {
      var provider = APP.dom.llmProvider.value;
      var baseUrl = APP.dom.ollamaEndpoint.value.trim();

      APP.core.setState({
        useOllama: APP.dom.useOllama.checked,
        useResearch: APP.dom.useResearch.checked,
        llm: {
          provider: provider,
          baseUrl: provider === "ollama" ? APP.ollama.normalizeBaseUrl(baseUrl) : baseUrl,
          model: APP.dom.ollamaModel.value.trim(),
          apiKey: APP.dom.llmApiKey.value.trim()
        }
      });

      APP.core.writeStoredSettings({
        llm: {
          provider: APP.state.llm.provider,
          baseUrl: APP.state.llm.baseUrl,
          model: APP.state.llm.model
        }
      });

      APP.dom.llmSummaryLine.textContent = "Model: " + APP.llm.describe() + ". Change it in AI settings.";
      if (APP.timelineController) {
        APP.timelineController.refreshLlmLine();
      }
    },

    handleContinentChange: function () {
      APP.controller.populateRegions(APP.dom.continentSelect.value);
    },

    handleAnchorChange: function () {
      var anchorId = APP.dom.historicalAnchor.value;

      if (anchorId === "reference") {
        return;
      }

      var anchor = APP.sources.anchors.filter(function (item) {
        return item.id === anchorId;
      })[0];

      APP.dom.customStartYear.value = anchor.start;
      APP.dom.customEndYear.value = anchor.end;
    },

    handleBibleSearch: function (event) {
      event.preventDefault();

      var reference = APP.model.parseReference(APP.dom.referenceInput.value);

      if (!reference.valid) {
        APP.controller.setFormMessage(reference.error, "error");
        APP.core.addAudit("error", reference.error);
        APP.controller.renderAudit();
        return;
      }

      var context = APP.model.buildBibleContext(reference, APP.dom.passageText.value);

      APP.core.setState({
        reference: reference,
        context: context,
        regionalRequest: null,
        researchSources: []
      });

      APP.core.addAudit("info", "Bible reference parsed: " + reference.display + ".");
      APP.controller.runAnalysis(context);
    },

    handleRegionalSearch: function () {
      var request = APP.controller.getRegionalRequest();

      if (!request.valid) {
        APP.controller.setFormMessage(request.error, "error");
        APP.core.addAudit("error", request.error);
        APP.controller.renderAudit();
        return;
      }

      var context = APP.model.buildRegionalContext(request);

      APP.core.setState({
        reference: null,
        context: context,
        regionalRequest: request,
        researchSources: []
      });

      APP.core.addAudit(
        "info",
        "Regional search started: " + request.continent + " / " + request.region +
        " for " + APP.utils.formatRange(request.start, request.end) + "."
      );

      APP.controller.runAnalysis(context);
    },

    getRegionalRequest: function () {
      var anchorId = APP.dom.historicalAnchor.value;
      var selectedAnchor = APP.sources.anchors.filter(function (anchor) {
        return anchor.id === anchorId;
      })[0];

      var start = Number(APP.dom.customStartYear.value);
      var end = Number(APP.dom.customEndYear.value);

      if (anchorId === "reference") {
        if (!APP.state.context || !APP.state.reference) {
          return {
            valid: false,
            error: "Choose a historical anchor, enter a custom date range, or analyze a Bible reference before using its era."
          };
        }

        start = APP.state.context.start;
        end = APP.state.context.end;
      } else if (selectedAnchor && (!APP.dom.customStartYear.value || !APP.dom.customEndYear.value)) {
        start = selectedAnchor.start;
        end = selectedAnchor.end;
      }

      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return {
          valid: false,
          error: "Enter both a valid start year and end year, or select a historical anchor."
        };
      }

      if (start > end) {
        return {
          valid: false,
          error: "The start year must be earlier than or equal to the end year."
        };
      }

      return {
        valid: true,
        start: start,
        end: end,
        continent: APP.dom.continentSelect.value,
        region: APP.dom.regionSelect.value,
        label: selectedAnchor ? selectedAnchor.label : "Custom historical range",
        description: selectedAnchor
          ? selectedAnchor.description
          : "A user-defined historical research range.",
        compareRegions: APP.utils.getSelectedValues(APP.dom.compareRegions)
      };
    },

    runAnalysis: function (context) {
      APP.core.setState({
        analysis: null,
        isLoading: true
      });

      APP.controller.saveSettings();
      APP.controller.setLoading(true);
      APP.controller.setFormMessage("Building local historical context…", "");
      APP.controller.renderAudit();

      window.setTimeout(function () {
        APP.controller.collectResearchThenAnalyze(context);
      }, 20);
    },

    collectResearchThenAnalyze: function (context) {
      var useResearch = APP.state.useResearch;
      var userUrls = APP.clean.parseUrlLines(APP.dom.sourceUrls.value);
      var topic = APP.dom.researchTopic.value.trim() ||
        (context.reference
          ? context.reference.display + " historical context"
          : context.era.label + " " + APP.utils.formatRange(context.start, context.end));

      // Passage research (text, verse/chapter/book notes, influence evidence) runs alongside source collection.
      var passage = context.type === "bible"
        ? APP.passage.gather(context.reference).then(function (packet) {
          APP.core.addAudit("success", "Passage research gathered for " + context.reference.display + " (" + packet.scope + " scope).");
          return packet;
        }).catch(function (error) {
          APP.core.addAudit("warning", "Passage research failed: " + error.message);
          return null;
        })
        : Promise.resolve(null);

      var research = Promise.resolve([]);
      if (useResearch || userUrls.length) {
        research = APP.research.collect({
          useSearch: useResearch,
          query: topic,
          urls: userUrls,
          maxSources: Number(APP.dom.maxSources.value)
        }).then(function (sources) {
          APP.core.addAudit("success", "Research collection completed with " + sources.length + " source record(s).");
          return sources;
        }).catch(function (error) {
          APP.core.addAudit("warning", "Research collection failed; local analysis will continue. " + error.message);
          return [];
        });
      }

      APP.controller.setFormMessage(context.type === "bible"
        ? "Reading the " + context.scope + " and collecting evidence…"
        : "Collecting permitted public-source evidence…", "");

      Promise.all([passage, research]).then(function (results) {
        APP.core.setState({
          passage: results[0],
          researchSources: results[1]
        });
        APP.controller.finishAnalysis(context, results[1], results[0]);
      });
    },

    finishAnalysis: function (context, sources, packet) {
      var fallback = APP.model.buildFallbackAnalysis(context, packet);

      if (!APP.state.useOllama) {
        APP.core.setState({
          analysis: fallback,
          isLoading: false
        });

        APP.core.addAudit("success", "Local analysis completed.");
        APP.controller.renderResults();
        APP.controller.setLoading(false);
        APP.controller.setFormMessage("Local historical analysis completed.", "success");
        return;
      }

      APP.controller.setFormMessage("Generating synthesis with " + APP.llm.describe() + "…", "");

      APP.llm.generate(APP.synthesis.buildPrompt(context, sources, packet), { maxTokens: 2600 }).then(function (responseText) {
        APP.core.setState({
          analysis: APP.synthesis.parse(responseText, fallback),
          isLoading: false
        });

        APP.core.addAudit("success", "AI synthesis completed with " + APP.llm.describe() + ".");
        APP.controller.renderStatus("success", "AI synthesis active");
        APP.controller.setFormMessage("AI-enhanced analysis completed.", "success");
      }).catch(function (error) {
        APP.core.setState({
          analysis: fallback,
          isLoading: false
        });

        APP.core.addAudit("warning", "Model unavailable; local fallback used. " + error.message);
        APP.controller.renderStatus("warning", "Local fallback active");
        APP.controller.setFormMessage(
          "The model was unavailable, so the local analysis is shown. " + APP.llm.explainError(error),
          "error"
        );
      }).finally(function () {
        APP.controller.renderResults();
        APP.controller.setLoading(false);
      });
    },

    handleTestOllama: function () {
      APP.controller.saveSettings();

      if (!APP.llm.isConfigured()) {
        APP.controller.setDialogMessage("Enter both a server URL and a model name before testing.", "error");
        return;
      }

      var model = APP.state.llm.model;
      APP.dom.testOllamaButton.disabled = true;
      APP.controller.setDialogMessage("Testing " + APP.llm.describe() + " (the first call may take a while as the model loads)…", "");
      APP.controller.renderStatus("warning", "Testing model");

      APP.llm.test()
        .then(function (reply) {
          APP.core.addAudit("success", "Model connection test succeeded for " + model + ".");
          APP.controller.renderStatus("success", "Model available");
          APP.controller.setDialogMessage("Connected. The model replied: " + APP.utils.truncate(reply, 80), "success");
        })
        .catch(function (error) {
          APP.core.addAudit("warning", "Model test failed: " + error.message);
          APP.controller.renderStatus("warning", "Model unavailable");
          APP.controller.setDialogMessage(APP.llm.explainError(error), "error");
        })
        .finally(function () {
          APP.dom.testOllamaButton.disabled = false;
          APP.controller.renderAudit();
        });
    },

    renderResults: function () {
      var context = APP.state.context;
      var analysis = APP.state.analysis;
      var sources = APP.state.researchSources;
      var metrics = APP.analytics.buildMetrics(context, analysis, sources.length);
      var warnings = APP.analytics.buildWarnings(context, sources.length);
      var compareRegions = context.regionalRequest
        ? context.regionalRequest.compareRegions
        : APP.utils.getSelectedValues(APP.dom.compareRegions);

      APP.dom.emptyState.classList.add("hidden");
      APP.dom.resultContent.classList.remove("hidden");

      APP.dom.referenceBadge.textContent = context.reference
        ? context.reference.display
        : context.era.label;

      var isBible = context.type === "bible";
      APP.dom.passageSection.classList.toggle("hidden", !isBible);
      APP.dom.soWhatSection.classList.toggle("hidden", !isBible);
      if (isBible) {
        APP.dom.passageTitle.textContent = context.scope === "verse" ? "The Verse" : context.scope === "chapter" ? "The Chapter" : "The Book";
        APP.dom.passageContent.innerHTML = APP.passageView.buildFocus(APP.state.passage, context);
        APP.dom.soWhatContent.innerHTML = APP.passageView.buildSoWhat(APP.state.passage, analysis.soWhat, analysis.soWhatFromModel);
        if (analysis.soWhatFromModel) {
          var backed = APP.passageView.linkEvidence(APP.dom.soWhatContent.querySelector(".ai-output"), APP.state.passage);
          APP.dom.soWhatContent.querySelector(".ai-output").insertAdjacentHTML("beforeend",
            '<p class="ai-footnote">Generated by ' + APP.utils.escapeHtml(APP.llm.describe()) + ". " +
            (backed ? backed + " named example(s) are linked to the source that backs them; " : "") +
            "unlinked examples come from the model's general knowledge and should be checked against the evidence below.</p>");
        }
      }

      APP.dom.blufContent.innerHTML = APP.utils.textToParagraphs(analysis.bluf);
      APP.dom.historicalSettingContent.innerHTML = APP.utils.textToParagraphs(analysis.historicalSetting);
      APP.dom.applicationContent.innerHTML = APP.utils.textToParagraphs(analysis.application);
      APP.dom.timelineChart.innerHTML = APP.charts.buildTimeline(context);
      APP.dom.regionalComparison.innerHTML = APP.charts.buildRegionalComparison(context, compareRegions);

      APP.dom.biblicalEventsTable.innerHTML = APP.tables.buildEventsTable(
        context.biblicalEvents,
        "No embedded Biblical events matched the selected time range and filters."
      );

      APP.dom.worldEventsTable.innerHTML = APP.tables.buildEventsTable(
        context.worldEvents,
        "No embedded world or regional events matched the selected time range and filters."
      );

      APP.dom.sourcesTable.innerHTML = APP.tables.buildSourcesTable(sources);

      APP.dom.methodNotes.innerHTML = APP.utils.textToParagraphs(
        analysis.notes +
        "\n\nSelected date range: " + APP.utils.formatRange(context.start, context.end) + "." +
        (warnings.length ? "\n\nWarnings:\n- " + warnings.join("\n- ") : "")
      );

      APP.dom.metricsContent.innerHTML = APP.tables.buildMetrics(metrics);
      APP.controller.renderAudit();
    },

    renderAudit: function () {
      APP.dom.auditLog.innerHTML = APP.tables.buildAuditLog(APP.state.audit);
    },

    renderStatus: function (type, label) {
      var dotClass = type === "success"
        ? "status-success"
        : type === "warning"
          ? "status-warning"
          : "status-neutral";

      APP.dom.connectionStatus.innerHTML =
        '<span class="status-dot ' + dotClass + '"></span>' +
        APP.utils.escapeHtml(label);
    },

    setLoading: function (isLoading) {
      APP.dom.analyzeButton.disabled = isLoading;
      APP.dom.regionalSearchButton.disabled = isLoading;
      APP.dom.testOllamaButton.disabled = isLoading;
      APP.dom.analyzeButton.textContent = isLoading ? "Analyzing…" : "Analyze Biblical Context";
      APP.dom.regionalSearchButton.textContent = isLoading ? "Researching…" : "View Regional History";
    },

    setFormMessage: function (message, type) {
      APP.dom.formMessage.textContent = message || "";
      APP.dom.formMessage.className = "form-message" + (type ? " " + type : "");
    }
  };

  APP.controller.init();
}());