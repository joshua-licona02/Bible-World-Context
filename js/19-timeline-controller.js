(function () {
  "use strict";

  var T = APP.tdom;
  var renderTimer = null;
  var lastRender = 0;
  var drag = null;
  var deepDiveAbort = null;
  var summaryAbort = null;

  function state() {
    return APP.state.timeline;
  }

  function setMessage(message, type) {
    T.formMessage.textContent = message || "";
    T.formMessage.className = "form-message" + (type ? " " + type : "");
  }

  function numberOrNull(input) {
    return input.value.trim() === "" ? null : Number(input.value);
  }

  function enabledProviderIds() {
    return Array.prototype.slice.call(T.providerOptions.querySelectorAll("input[type=checkbox]"))
      .filter(function (box) { return box.checked; })
      .map(function (box) { return box.value; });
  }

  function currentFilters() {
    var timeline = state();
    return {
      start: timeline.view.start,
      end: timeline.view.end,
      continent: T.continent.value,
      region: T.region.value,
      category: T.filterCategory.value,
      minConfidence: Number(T.filterConfidence.value),
      showUnverified: T.showUnverified.checked,
      text: T.filterText.value
    };
  }

  function visibleEvents() {
    return APP.timeline.applyFilters(state().events, currentFilters());
  }

  function savePreferences() {
    APP.core.writeStoredSettings({
      timelineProviders: enabledProviderIds(),
      timelineDepth: T.depth.value,
      searxEndpoint: T.searxEndpoint.value.trim(),
      timelineAi: {
        plan: T.llmPlan.checked,
        extract: T.llmExtract.checked,
        gapFill: T.llmGapFill.checked
      }
    });
  }

  APP.timelineController = {
    init: function () {
      var stored = APP.core.readStoredSettings();
      var enabled = stored.timelineProviders;

      T.providerOptions.innerHTML = APP.timelineProviders.list.filter(function (provider) {
        return !provider.hidden;
      }).map(function (provider) {
        var checked = enabled ? enabled.indexOf(provider.id) !== -1 : provider.defaultOn;
        return '<label class="checkbox-label provider-option" for="tlProvider-' + provider.id + '">' +
          '<input id="tlProvider-' + provider.id + '" type="checkbox" value="' + provider.id + '"' + (checked ? " checked" : "") + ">" +
          "<span><strong>" + APP.utils.escapeHtml(provider.label) + "</strong><small>" + APP.utils.escapeHtml(provider.description) + "</small></span>" +
          "</label>";
      }).join("");

      Object.keys(APP.sources.continents).forEach(function (continent) {
        var option = document.createElement("option");
        option.value = continent;
        option.textContent = continent;
        T.continent.appendChild(option);
      });

      T.depth.value = stored.timelineDepth || "standard";
      T.searxEndpoint.value = stored.searxEndpoint || "";
      if (stored.timelineAi) {
        T.llmPlan.checked = Boolean(stored.timelineAi.plan);
        T.llmExtract.checked = Boolean(stored.timelineAi.extract);
        T.llmGapFill.checked = Boolean(stored.timelineAi.gapFill);
      }

      APP.core.setState({ timeline: APP.timelineController.emptyState() });
      APP.timelineController.bindEvents();
      APP.timelineController.refreshLlmLine();
    },

    emptyState: function () {
      return {
        plan: null,
        aiPlan: null,
        pendingRange: [],
        urls: [],
        events: [],
        sources: [],
        ranked: [],
        statuses: {},
        running: false,
        abort: null,
        view: { start: 0, end: 1 },
        selectedId: null,
        tableLimit: 100,
        summaryText: ""
      };
    },

    bindEvents: function () {
      T.form.addEventListener("submit", function (event) {
        event.preventDefault();
        APP.timelineController.runSearch();
      });
      T.stopButton.addEventListener("click", APP.timelineController.stop);

      T.continent.addEventListener("change", function () {
        T.region.innerHTML = '<option value="All">All regions</option>';
        (APP.sources.continents[T.continent.value] || []).forEach(function (region) {
          var option = document.createElement("option");
          option.value = region;
          option.textContent = region;
          T.region.appendChild(option);
        });
        APP.timelineController.rerender();
      });
      T.region.addEventListener("change", APP.timelineController.rerender);

      [T.groupBy, T.filterCategory, T.filterConfidence, T.showUnverified].forEach(function (element) {
        element.addEventListener("change", APP.timelineController.rerender);
      });
      T.filterText.addEventListener("input", APP.timelineController.scheduleRender);

      [T.depth, T.searxEndpoint, T.llmPlan, T.llmExtract, T.llmGapFill].forEach(function (element) {
        element.addEventListener("change", savePreferences);
      });
      T.providerOptions.addEventListener("change", savePreferences);

      T.zoomIn.addEventListener("click", function () { APP.timelineController.zoom(0.5); });
      T.zoomOut.addEventListener("click", function () { APP.timelineController.zoom(2); });
      T.zoomReset.addEventListener("click", APP.timelineController.fitView);

      T.chart.addEventListener("click", function (event) {
        var target = event.target.closest(".tl-event");
        if (target && !drag) {
          APP.timelineController.select(target.getAttribute("data-id"), false);
        }
      });
      T.chart.addEventListener("keydown", function (event) {
        var target = event.target.closest(".tl-event");
        if (target && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          APP.timelineController.select(target.getAttribute("data-id"), false);
        }
      });
      T.chart.addEventListener("mousedown", APP.timelineController.startPan);
      T.chart.addEventListener("wheel", function (event) {
        if (!event.ctrlKey) {
          return;
        }
        event.preventDefault();
        var rect = T.chart.getBoundingClientRect();
        var fraction = APP.utils.clamp((event.clientX - rect.left + T.chart.scrollLeft - 156) / Math.max(1, rect.width - 174), 0, 1);
        APP.timelineController.zoom(event.deltaY > 0 ? 1.25 : 0.8, fraction);
      }, { passive: false });

      // Lists, lane cards, "meanwhile" links, and citations all select events via data-id / data-ref.
      document.getElementById("timelineWorkspace").addEventListener("click", function (event) {
        var idButton = event.target.closest("button[data-id]");
        if (idButton && !T.chart.contains(idButton)) {
          APP.timelineController.select(idButton.getAttribute("data-id"), true);
          return;
        }

        var cite = event.target.closest(".cite-ref");
        if (cite) {
          var container = cite.closest("[data-cite-scope]");
          var target = container && container._citeMap ? container._citeMap[cite.getAttribute("data-ref")] : null;
          if (target && target.eventId) {
            APP.timelineController.select(target.eventId, true);
          } else if (target && APP.utils.safeUrl(target.url)) {
            window.open(target.url, "_blank", "noopener");
          }
          return;
        }

        if (event.target.id === "tlShowMore") {
          state().tableLimit += 100;
          APP.timelineController.renderTables(visibleEvents());
        } else if (event.target.id === "tlDeepDive") {
          APP.timelineController.deepDive();
        } else if (event.target.id === "tlCenterEvent") {
          APP.timelineController.centerOnSelected();
        }
      });

      T.summarize.addEventListener("click", APP.timelineController.summarize);
      T.exportCsv.addEventListener("click", function () {
        APP.utils.downloadFile("timeline.csv", APP.timelineView.toCsv(visibleEvents()), "text/csv;charset=utf-8");
      });
      T.exportMd.addEventListener("click", function () {
        var timeline = state();
        APP.utils.downloadFile("timeline.md", APP.timelineView.toMarkdown(
          timeline.plan,
          APP.timelineView.groupLanes(visibleEvents(), T.groupBy.value),
          timeline.sources,
          timeline.summaryText
        ), "text/markdown;charset=utf-8");
      });
      T.exportJson.addEventListener("click", function () {
        var timeline = state();
        APP.utils.downloadFile("timeline.json", JSON.stringify({
          generatedAt: new Date().toISOString(),
          plan: timeline.plan,
          events: visibleEvents(),
          sources: timeline.sources
        }, null, 2), "application/json");
      });

      window.addEventListener("resize", APP.timelineController.scheduleRender);
    },

    refreshLlmLine: function () {
      T.llmLine.textContent = "Uses " + APP.llm.describe() + " (change in AI settings). Searches still run if the model is unavailable.";
    },

    // Called from the analysis workspace to continue research on the same period.
    openWith: function (values) {
      APP.controller.showWorkspace("timeline");
      T.query.value = values.query || "";
      T.start.value = values.start;
      T.end.value = values.end;
      APP.timelineController.runSearch();
    },

    // ---------- Search orchestration ----------

    runSearch: function () {
      APP.timelineController.stop();

      var plan = APP.timeline.buildPlan({
        query: T.query.value,
        start: numberOrNull(T.start),
        end: numberOrNull(T.end),
        continent: T.continent.value,
        region: T.region.value,
        depth: T.depth.value
      });

      if (!plan.valid) {
        setMessage(plan.error, "error");
        return;
      }

      var timeline = APP.timelineController.emptyState();
      timeline.plan = plan;
      timeline.running = true;
      timeline.abort = new AbortController();
      APP.core.setState({ timeline: timeline });

      savePreferences();
      APP.timelineController.setRunning(true);
      APP.timelineController.hideDetail();
      T.summary.innerHTML = '<p class="muted">Generate a comparative, cited overview of the events in view.</p>';
      setMessage("Searching…", "");
      APP.core.addAudit("info", "Timeline search started: " + (plan.query || APP.utils.formatRange(plan.start, plan.end)) + ".");

      var signal = timeline.abort.signal;
      var useAiPlan = T.llmPlan.checked && plan.query;

      if (APP.timeline.hasRange(plan)) {
        APP.timelineController.fitView();
      }

      // The AI planner runs alongside the sources so a slow local model never delays the first results.
      var planned = useAiPlan
        ? APP.timelineController.track("ai-plan", "AI planner", function () {
          return APP.timelineAI.planQuestion(plan, signal).then(function (refined) {
            timeline.aiPlan = refined;
            return { message: (refined.extraQueries.length || 0) + " extra searches planned" };
          });
        })
        : Promise.resolve();

      Promise.all([planned, APP.timelineController.runProviders(signal)]).then(function () {
        return signal.aborted ? null : APP.timelineController.applyAiPlan(signal);
      }).then(function () {
        if (signal.aborted || !APP.timeline.hasRange(timeline.plan)) {
          return null;
        }
        return APP.timelineController.runAiStage(signal);
      }).then(function () {
        // A newer search may have replaced this one; only the current search may report completion.
        if (state() === timeline) {
          APP.timelineController.finish(signal.aborted ? "Search stopped." : null);
        }
      }).catch(function (error) {
        if (state() === timeline) {
          APP.timelineController.finish(APP.http.isAbort(error) ? "Search stopped." : "Search failed: " + error.message, !APP.http.isAbort(error));
        }
      });

      APP.timelineController.render();
    },

    runProviders: function (signal) {
      var timeline = state();
      var enabled = enabledProviderIds();
      var urls = APP.clean.parseUrlLines(T.urls.value);
      var providers = APP.timelineProviders.list.filter(function (provider) {
        return provider.id === "urls" ? urls.length > 0 : enabled.indexOf(provider.id) !== -1;
      });

      if (!providers.length) {
        setMessage("Select at least one source.", "error");
        return Promise.resolve();
      }

      timeline.urls = urls;

      if (APP.timeline.hasRange(timeline.plan)) {
        return APP.timelineController.runGroup(providers, signal);
      }

      // Keyword-only search: find dated articles first, infer the period, then read period-based sources.
      var keywordGroup = providers.filter(function (provider) { return provider.needs !== "range"; });
      timeline.pendingRange = providers.filter(function (provider) { return provider.needs === "range"; });

      timeline.pendingRange.forEach(function (provider) {
        timeline.statuses[provider.id] = { label: provider.label, state: "pending", message: "Waiting for a date range" };
      });

      return APP.timelineController.runGroup(keywordGroup, signal).then(function () {
        var derived = APP.timeline.deriveRange(timeline.ranked.length ? timeline.ranked : timeline.events);
        if (signal.aborted || !derived) {
          return null;
        }
        return APP.timelineController.adoptRange(derived, "the best-matching dated articles", signal);
      });
    },

    runGroup: function (group, signal) {
      return Promise.all(group.map(function (provider) {
        return APP.timelineController.runProvider(provider, signal);
      }));
    },

    // Sets the range for a keyword-only search and runs the period-based sources that were waiting on it.
    adoptRange: function (range, origin, signal) {
      var timeline = state();
      var pending = timeline.pendingRange || [];

      timeline.plan.start = range.start;
      timeline.plan.end = range.end;
      timeline.plan.notes.push("Range inferred from " + origin + ": " + APP.utils.formatRange(range.start, range.end) + ".");
      timeline.pendingRange = [];
      APP.timelineController.fitView();
      return APP.timelineController.runGroup(pending, signal);
    },

    // Folds the AI plan in once it arrives: extra targeted searches, region focus, and a fallback range.
    applyAiPlan: function (signal) {
      var timeline = state();
      var refined = timeline.aiPlan;
      var plan = timeline.plan;
      var tasks = [];

      if (refined) {
        plan.planner = "llm";
        refined.focusRegions.forEach(function (region) {
          if (plan.focusRegions.indexOf(region) === -1) {
            plan.focusRegions.push(region);
          }
        });
        refined.notes.forEach(function (note) {
          if (/^(AI plan|Extra searches)/.test(note) && plan.notes.indexOf(note) === -1) {
            plan.notes.push(note);
          }
        });

        if (!APP.timeline.hasRange(plan) && APP.timeline.hasRange(refined)) {
          tasks.push(APP.timelineController.adoptRange(refined, "the AI planner (no dated articles were found)", signal));
        }

        if (refined.extraQueries && refined.extraQueries.length) {
          var encyclopedia = APP.timelineProviders.get("encyclopedia");
          var extraPlan = Object.assign({}, plan, {
            keywords: refined.extraQueries[0],
            extraQueries: refined.extraQueries.slice(1)
          });
          tasks.push(APP.timelineController.runProvider(encyclopedia, signal, {
            id: "ai-search",
            label: "AI-planned searches",
            plan: extraPlan
          }));
        }
      }

      return Promise.all(tasks).then(function () {
        if (!APP.timeline.hasRange(timeline.plan)) {
          (timeline.pendingRange || []).forEach(function (provider) {
            timeline.statuses[provider.id] = { label: provider.label, state: "skipped", message: "No date range could be inferred" };
          });
          setMessage("No dated results were found to infer a period. Add start and end years to search by date.", "error");
        }
      });
    },

    runProvider: function (provider, signal, override) {
      var timeline = state();
      var settings = override || {};

      return APP.timelineController.track(settings.id || provider.id, settings.label || provider.label, function (status) {
        return provider.run(settings.plan || timeline.plan, {
          signal: signal,
          depth: APP.timeline.depthSettings[timeline.plan.depth] || APP.timeline.depthSettings.standard,
          options: { searxEndpoint: T.searxEndpoint.value.trim(), urls: timeline.urls || [] },
          progress: function (message) {
            status.message = message;
            APP.timelineController.scheduleRender();
          },
          emit: function (events, sources, meta) {
            if (signal.aborted) {
              return;
            }
            APP.timelineController.addResults(events, sources);
            if (meta && meta.ranked) {
              timeline.ranked = timeline.ranked.concat(events);
            }
          }
        });
      });
    },

    // Wraps a unit of work with status-chip bookkeeping. Failures are recorded, never thrown.
    track: function (id, label, work) {
      var timeline = state();
      var started = performance.now();
      var status = { label: label, state: "running", message: "" };
      timeline.statuses[id] = status;
      APP.timelineController.scheduleRender();

      return Promise.resolve().then(function () {
        return work(status);
      }).then(function (result) {
        status.state = result && result.skipped ? "skipped" : "done";
        status.message = result && result.message ? result.message : "Done";
      }).catch(function (error) {
        if (APP.http.isAbort(error)) {
          status.state = "skipped";
          status.message = "Stopped";
          return;
        }
        status.state = "error";
        status.message = id.indexOf("ai-") === 0 ? APP.llm.explainError(error) : error.message;
        APP.core.addAudit("warning", label + ": " + status.message);
      }).finally(function () {
        status.ms = performance.now() - started;
        APP.timelineController.scheduleRender();
      });
    },

    runAiStage: function (signal) {
      var timeline = state();
      var tasks = [];

      if (T.llmExtract.checked) {
        var textSources = timeline.sources.filter(function (source) {
          return source.provider === "web" || source.provider === "urls";
        });
        if (textSources.length) {
          tasks.push(APP.timelineController.track("ai-extract", "AI extraction", function () {
            return APP.timelineAI.extractEvents(timeline.plan, textSources, signal).then(function (events) {
              APP.timelineController.addResults(events, []);
              return { message: events.length + " dated events extracted" };
            });
          }));
        }
      }

      if (T.llmGapFill.checked) {
        tasks.push(APP.timelineController.track("ai-gapfill", "AI gap-fill", function (status) {
          return APP.timelineAI.suggestAndVerify(timeline.plan, timeline.events, {
            signal: signal,
            depth: APP.timeline.depthSettings[timeline.plan.depth],
            progress: function (message) {
              status.message = message;
              APP.timelineController.scheduleRender();
            }
          }).then(function (result) {
            APP.timelineController.addResults(result.events, []);
            return { message: result.message };
          });
        }));
      }

      return Promise.all(tasks);
    },

    addResults: function (events, sources) {
      var timeline = state();
      APP.timeline.merge(timeline.events, events);

      sources.forEach(function (source) {
        var exists = timeline.sources.some(function (existing) {
          return existing.url && existing.url === source.url;
        });
        if (!exists) {
          timeline.sources.push(source);
        }
      });

      APP.timelineController.scheduleRender();
    },

    stop: function () {
      var timeline = state();
      if (timeline && timeline.abort) {
        timeline.abort.abort();
      }
    },

    finish: function (message, isError) {
      var timeline = state();
      timeline.running = false;
      APP.timelineController.setRunning(false);
      APP.timelineController.render();

      var count = timeline.events.length;
      var summary = message || (count + " events and " + timeline.sources.length + " sources collected.");
      setMessage(summary, isError ? "error" : count ? "success" : "");
      APP.core.addAudit(isError ? "error" : "success", "Timeline search: " + summary);
      if (APP.controller && APP.controller.renderAudit) {
        APP.controller.renderAudit();
      }
    },

    setRunning: function (running) {
      T.searchButton.disabled = running;
      T.searchButton.textContent = running ? "Searching…" : "Search timeline";
      T.stopButton.classList.toggle("hidden", !running);
    },

    // ---------- View window ----------

    fitView: function () {
      var plan = state().plan;
      if (!plan || !APP.timeline.hasRange(plan)) {
        return;
      }
      var pad = Math.max(2, Math.round((plan.end - plan.start) * 0.04));
      state().view = { start: plan.start - pad, end: plan.end + pad };
      APP.timelineController.rerender();
    },

    zoom: function (factor, anchorFraction) {
      var view = state().view;
      var span = view.end - view.start;
      var anchor = anchorFraction === undefined ? 0.5 : anchorFraction;
      var pivot = view.start + span * anchor;
      var nextSpan = APP.utils.clamp(span * factor, 4, 12000);
      state().view = {
        start: Math.round(pivot - nextSpan * anchor),
        end: Math.round(pivot + nextSpan * (1 - anchor))
      };
      APP.timelineController.rerender();
    },

    centerOnSelected: function () {
      var timeline = state();
      var event = APP.timelineController.findEvent(timeline.selectedId);
      if (!event) {
        return;
      }
      var span = Math.max(20, event.end - event.start + 20);
      var middle = (event.start + event.end) / 2;
      timeline.view = { start: Math.round(middle - span / 2), end: Math.round(middle + span / 2) };
      APP.timelineController.rerender();
    },

    startPan: function (event) {
      if (event.button !== 0 || event.target.closest(".tl-event")) {
        return;
      }
      var view = state().view;
      drag = { x: event.clientX, start: view.start, end: view.end, moved: false };

      function move(moveEvent) {
        var width = Math.max(1, T.chart.clientWidth - 174);
        var deltaYears = ((moveEvent.clientX - drag.x) / width) * (drag.end - drag.start);
        if (Math.abs(moveEvent.clientX - drag.x) > 3) {
          drag.moved = true;
        }
        state().view = { start: Math.round(drag.start - deltaYears), end: Math.round(drag.end - deltaYears) };
        APP.timelineController.renderChart(visibleEvents());
      }

      function up() {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        var moved = drag && drag.moved;
        window.setTimeout(function () { drag = null; }, 0);
        if (moved) {
          APP.timelineController.rerender();
        }
      }

      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    },

    // ---------- Rendering ----------

    scheduleRender: function () {
      if (renderTimer) {
        return;
      }
      var wait = Math.max(0, 200 - (performance.now() - lastRender));
      renderTimer = window.setTimeout(function () {
        renderTimer = null;
        window.requestAnimationFrame(APP.timelineController.render);
      }, wait);
    },

    rerender: function () {
      state().tableLimit = 100;
      APP.timelineController.render();
    },

    render: function () {
      var timeline = state();
      lastRender = performance.now();

      if (!timeline.plan) {
        return;
      }

      T.empty.classList.add("hidden");
      T.providerStatus.innerHTML = APP.timelineView.buildProviderStatus(timeline.statuses);
      T.planSummary.classList.remove("hidden");
      T.planSummary.innerHTML = APP.timelineView.buildPlanSummary(timeline.plan);
      T.rangeBadge.textContent = APP.timeline.hasRange(timeline.plan)
        ? APP.utils.formatRange(timeline.plan.start, timeline.plan.end)
        : "Inferring range…";

      if (!APP.timeline.hasRange(timeline.plan) && !timeline.events.length) {
        return;
      }

      T.results.classList.remove("hidden");
      var events = visibleEvents();
      APP.timelineController.renderChart(events);
      T.legend.innerHTML = APP.timelineView.buildLegend(events);
      T.laneSummary.innerHTML = APP.timelineView.buildLaneSummary(APP.timelineView.groupLanes(events, T.groupBy.value));
      APP.timelineController.renderTables(events);
    },

    renderChart: function (events) {
      var timeline = state();
      var chart = APP.timelineView.buildChart(events, {
        width: T.chart.clientWidth - 2,
        viewStart: timeline.view.start,
        viewEnd: timeline.view.end,
        focusStart: timeline.plan.start,
        focusEnd: timeline.plan.end,
        groupBy: T.groupBy.value,
        selectedId: timeline.selectedId
      });
      T.chart.innerHTML = chart.html;
      T.viewLabel.textContent = "Viewing " + APP.utils.formatRange(timeline.view.start, timeline.view.end) +
        " · " + events.length + " events" + (chart.hidden ? " (" + chart.hidden + " not drawn for space)" : "");
    },

    renderTables: function (events) {
      var timeline = state();
      T.eventsHeading.textContent = "Events in view (" + events.length + " of " + timeline.events.length + ")";
      T.eventsTable.innerHTML = APP.timelineView.buildEventsTable(events, timeline.tableLimit);
      T.sourcesTable.innerHTML = APP.timelineView.buildSourcesTable(timeline.sources);
    },

    // ---------- Selection, deep dives, synthesis ----------

    findEvent: function (id) {
      return state().events.filter(function (event) {
        return event.id === id;
      })[0] || null;
    },

    meanwhile: function (event) {
      var lane = APP.timeline.primaryLane(event, "region");
      var pad = Math.max(5, APP.timeline.tolerance(event));
      var filters = currentFilters();
      filters.start = event.start - pad;
      filters.end = event.end + pad;
      filters.continent = "All";
      filters.region = "All";
      filters.text = "";

      // Favor specific, well-dated contemporaries over centuries-long background periods.
      var specificity = function (other) {
        return other.confidence - Math.min(0.6, (other.end - other.start) / 400);
      };

      return APP.timeline.applyFilters(state().events, filters).filter(function (other) {
        return other.id !== event.id && APP.timeline.primaryLane(other, "region") !== lane &&
          other.end - other.start <= 400;
      }).sort(function (a, b) {
        return specificity(b) - specificity(a);
      }).slice(0, 8);
    },

    select: function (id, scroll) {
      var event = APP.timelineController.findEvent(id);
      if (!event) {
        return;
      }

      var timeline = state();
      timeline.selectedId = id;

      if (!APP.utils.rangesOverlap(event.start, event.end, timeline.view.start, timeline.view.end)) {
        APP.timelineController.centerOnSelected();
      } else {
        APP.timelineController.renderChart(visibleEvents());
      }

      if (deepDiveAbort) {
        deepDiveAbort.abort();
      }
      T.detail.innerHTML = APP.timelineView.buildDetail(event, APP.timelineController.meanwhile(event), APP.llm.isConfigured());
      T.detail.classList.remove("hidden");
      if (scroll) {
        T.detail.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    },

    hideDetail: function () {
      T.detail.classList.add("hidden");
      T.detail.innerHTML = "";
    },

    deepDive: function () {
      var event = APP.timelineController.findEvent(state().selectedId);
      var output = document.getElementById("tlDeepDiveOutput");
      var button = document.getElementById("tlDeepDive");
      if (!event || !output) {
        return;
      }

      if (deepDiveAbort) {
        deepDiveAbort.abort();
      }
      deepDiveAbort = new AbortController();
      var signal = deepDiveAbort.signal;
      var articleTitle = event.articleTitle || event.links[0] || "";
      var searchTitle = event.title.replace(/\([^)]*\)/g, "").trim();

      button.disabled = true;
      output.classList.remove("hidden");
      output.innerHTML = '<p class="muted">Gathering the full article, related scholarship, and contemporaneous events…</p>';

      Promise.all([
        articleTitle ? APP.timelineProviders.fetchArticleText(articleTitle, signal).catch(function () { return ""; }) : Promise.resolve(""),
        APP.timelineProviders.searchScholarship(searchTitle, 4, signal).catch(function () { return []; })
      ]).then(function (results) {
        var packet = {
          articleTitle: articleTitle,
          article: results[0],
          works: results[1],
          meanwhile: APP.timelineController.meanwhile(event)
        };
        var packetHtml = APP.timelineView.buildPacket(packet);

        if (!APP.llm.isConfigured()) {
          output.innerHTML = "<h4>Research packet</h4>" + (packetHtml || '<p class="muted">No additional material was found.</p>');
          return null;
        }

        output.innerHTML = '<div class="ai-output" data-cite-scope="deep"><p class="muted">Asking ' + APP.utils.escapeHtml(APP.llm.describe()) + "…</p></div>" +
          (packetHtml ? '<details class="packet"><summary>Research packet used</summary>' + packetHtml + "</details>" : "");

        var aiBox = output.querySelector(".ai-output");
        var citeMap = {};
        var sourceIndex = 0;
        if (packet.article) {
          sourceIndex += 1;
          citeMap["S" + sourceIndex] = { url: APP.timelineProviders.wikiUrl(articleTitle) };
        }
        event.provenance.forEach(function (item) {
          if (item.title) {
            sourceIndex += 1;
            citeMap["S" + sourceIndex] = { url: item.url };
          }
        });
        packet.works.forEach(function (work) {
          sourceIndex += 1;
          citeMap["S" + sourceIndex] = { url: work.url };
        });
        aiBox._citeMap = citeMap;

        return APP.llm.chat(APP.timelineAI.buildDeepDivePrompt(event, packet), {
          signal: signal,
          onToken: function (text) {
            aiBox.innerHTML = APP.utils.renderMarkdown(text);
          }
        }).then(function (text) {
          aiBox.innerHTML = APP.utils.renderMarkdown(text);
          APP.timelineView.linkMentions(aiBox, packet.meanwhile);
          aiBox.insertAdjacentHTML("beforeend",
            '<p class="ai-footnote">Generated by ' + APP.utils.escapeHtml(APP.llm.describe()) + ". Verify against the linked sources.</p>");
        });
      }).catch(function (error) {
        if (!APP.http.isAbort(error)) {
          output.insertAdjacentHTML("afterbegin", '<p class="form-message error">' + APP.utils.escapeHtml(APP.llm.explainError(error)) + "</p>");
        }
      }).finally(function () {
        button.disabled = false;
      });
    },

    summarize: function () {
      var timeline = state();
      var events = visibleEvents();
      if (!events.length) {
        T.summary.innerHTML = '<p class="muted">There are no events in view to summarize.</p>';
        return;
      }

      if (summaryAbort) {
        summaryAbort.abort();
      }
      summaryAbort = new AbortController();

      var lanes = APP.timelineView.groupLanes(events, "region").slice(0, 10).map(function (lane) {
        return {
          name: lane.name,
          events: lane.events.slice().sort(function (a, b) {
            return b.confidence - a.confidence;
          }).slice(0, 12).sort(function (a, b) {
            return a.start - b.start;
          })
        };
      });
      var plan = Object.assign({}, timeline.plan, { start: timeline.view.start, end: timeline.view.end });
      var messages = APP.timelineAI.buildSummaryPrompt(plan, lanes, timeline.sources);
      var citeMap = {};

      lanes.forEach(function (lane) {
        lane.events.forEach(function (event) {
          citeMap[event._ref] = { eventId: event.id };
        });
      });
      timeline.sources.filter(function (source) {
        return source.sourceType === "Scholarship";
      }).slice(0, 8).forEach(function (source, index) {
        citeMap["S" + (index + 1)] = { url: source.url };
      });

      T.summary.setAttribute("data-cite-scope", "summary");
      T.summary._citeMap = citeMap;
      T.summary.innerHTML = '<p class="muted">Asking ' + APP.utils.escapeHtml(APP.llm.describe()) + "…</p>";
      T.summarize.disabled = true;

      APP.llm.chat(messages, {
        signal: summaryAbort.signal,
        onToken: function (text) {
          T.summary.innerHTML = APP.utils.renderMarkdown(text);
        }
      }).then(function (text) {
        timeline.summaryText = text;
        T.summary.innerHTML = APP.utils.renderMarkdown(text);
        var mentions = APP.timelineView.linkMentions(T.summary, events);
        T.summary.insertAdjacentHTML("beforeend",
          '<p class="ai-footnote">Generated by ' + APP.utils.escapeHtml(APP.llm.describe()) + " from the " + events.length +
          " events in view. " + (mentions ? mentions + " mentioned event(s) are linked to their records — " : "") +
          "check claims against the linked sources.</p>");
      }).catch(function (error) {
        if (!APP.http.isAbort(error)) {
          T.summary.innerHTML = '<p class="form-message error">' + APP.utils.escapeHtml(APP.llm.explainError(error)) + "</p>";
        }
      }).finally(function () {
        T.summarize.disabled = false;
      });
    }
  };

  APP.timelineController.init();
}());
