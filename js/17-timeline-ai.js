(function () {
  "use strict";

  var SYSTEM_RULES = [
    "You are a careful historian assisting with Biblical-era and world-history research.",
    "Years are integers; negative numbers are BCE (e.g. 586 BCE = -586) and positive numbers are CE.",
    "Never invent sources, quotations, or precise dates. Say when dates are disputed or approximate.",
    "Do not treat a continent as a single civilization, and do not imply contact between distant regions without evidence."
  ].join(" ");

  function yearsValid(start, end) {
    return Number.isFinite(start) && Number.isFinite(end) && start >= -6000 && end <= 2100 && end - start <= 4000;
  }

  // Small models often drop the BCE sign and return e.g. 600..586 for 600–586 BCE.
  function repairYears(start, end) {
    if (start > end && start > 0 && end > 0) {
      return { start: -start, end: -end };
    }
    if (start > end) {
      return { start: end, end: start };
    }
    return { start: start, end: end };
  }

  function numbered(items, prefix, formatter) {
    return items.map(function (item, index) {
      return "[" + prefix + (index + 1) + "] " + formatter(item);
    }).join("\n");
  }

  function eventLine(event) {
    return APP.timeline.formatPrecision(event) + " | " +
      (event.regions.join(", ") || "unplaced") + " | " +
      event.title + (event.summary && event.summary !== event.title ? " — " + APP.utils.truncate(event.summary, 220) : "");
  }

  APP.timelineAI = {
    planQuestion: function (plan, signal) {
      var regions = APP.timeline.laneOrder();
      var schema = {
        type: "object",
        properties: {
          start_year: { type: "integer" },
          end_year: { type: "integer" },
          keywords: { type: "string" },
          search_queries: { type: "array", items: { type: "string" }, maxItems: 3 },
          regions: { type: "array", items: { type: "string", enum: regions }, maxItems: 4 },
          reasoning: { type: "string" }
        },
        required: ["start_year", "end_year", "keywords", "search_queries", "regions", "reasoning"]
      };

      return APP.llm.chatJson([
        {
          role: "system",
          content: SYSTEM_RULES + " Convert the user's question into an encyclopedia search plan. " +
            "keywords: 2-6 words naming the central topic. search_queries: up to 3 short Wikipedia-style queries for " +
            "specific events or polities in the period. regions: pick from the allowed list only. " +
            "Example: 'What was China doing during the Babylonian exile?' -> start_year -605, end_year -539, " +
            "keywords 'Babylonian exile', search_queries ['Spring and Autumn period', 'Zhou dynasty'], regions ['East Asia','West Asia / Near East']."
        },
        {
          role: "user",
          content: "Question: " + plan.query +
            (APP.timeline.hasRange(plan) ? "\nKnown date range: " + plan.start + " to " + plan.end : "")
        }
      ], schema, { signal: signal }).then(function (result) {
        var refined = Object.assign({}, plan, { planner: "llm", notes: plan.notes.slice() });
        var start = Number(result.start_year);
        var end = Number(result.end_year);
        var explicit = /your start and end years|the date/.test(plan.notes[0] || "");

        if (result.keywords && String(result.keywords).trim()) {
          refined.keywords = String(result.keywords).trim();
        }

        refined.extraQueries = (result.search_queries || [])
          .map(function (query) { return String(query).trim(); })
          .filter(Boolean)
          .slice(0, 3);

        (result.regions || []).forEach(function (region) {
          if (regions.indexOf(region) !== -1 && refined.focusRegions.indexOf(region) === -1) {
            refined.focusRegions.push(region);
          }
        });

        if (Number.isFinite(start) && Number.isFinite(end) && !explicit) {
          var repaired = repairYears(start, end);
          var agrees = !APP.timeline.hasRange(plan) ||
            APP.utils.rangesOverlap(repaired.start, repaired.end, plan.start - 50, plan.end + 50);

          if (yearsValid(repaired.start, repaired.end) && agrees) {
            refined.start = repaired.start;
            refined.end = repaired.end;
            refined.notes.push("AI suggested the range " + APP.utils.formatRange(repaired.start, repaired.end) + ".");
          } else {
            refined.notes.push("AI range " + start + "–" + end + " was rejected as implausible or inconsistent.");
          }
        }

        if (result.reasoning) {
          refined.notes.push("AI plan: " + APP.utils.truncate(String(result.reasoning), 240));
        }
        if (refined.extraQueries.length) {
          refined.notes.push("Extra searches: " + refined.extraQueries.join("; ") + ".");
        }

        return refined;
      });
    },

    // Extracts dated events from free text (web results, user URLs). Results stay low-confidence.
    extractEvents: function (plan, sources, signal) {
      var usable = sources.filter(function (source) {
        return (source.fullText || source.excerpt || "").length > 120 && source.sourceType !== "URL unavailable";
      }).slice(0, 8);

      if (!usable.length) {
        return Promise.resolve([]);
      }

      var schema = {
        type: "object",
        properties: {
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                start_year: { type: "integer" },
                end_year: { type: "integer" },
                place: { type: "string" },
                summary: { type: "string" },
                source_number: { type: "integer" }
              },
              required: ["title", "start_year", "end_year", "place", "summary", "source_number"]
            },
            maxItems: 15
          }
        },
        required: ["events"]
      };

      var budget = 7000;
      var evidence = numbered(usable, "S", function (source) {
        var text = APP.utils.truncate(source.fullText || source.excerpt, Math.floor(budget / usable.length));
        return source.title + "\n" + text;
      });

      return APP.llm.chatJson([
        {
          role: "system",
          content: SYSTEM_RULES + " Extract only events whose dates are stated or clearly implied in the numbered sources. " +
            "Use source_number for the [S#] each event came from. Return an empty list if none qualify."
        },
        {
          role: "user",
          content: (APP.timeline.hasRange(plan) ? "Period of interest: " + plan.start + " to " + plan.end + "\n\n" : "") + evidence
        }
      ], schema, { signal: signal }).then(function (result) {
        return (result.events || []).map(function (item) {
          var source = usable[Number(item.source_number) - 1];
          var years = repairYears(Number(item.start_year), Number(item.end_year));

          if (!source || !item.title || !yearsValid(years.start, years.end)) {
            return null;
          }
          if (APP.timeline.hasRange(plan) &&
            !APP.utils.rangesOverlap(years.start, years.end, plan.start - 50, plan.end + 50)) {
            return null;
          }

          return APP.timeline.createEvent({
            title: item.title,
            summary: [item.summary, item.place ? "Place: " + item.place + "." : ""].filter(Boolean).join(" "),
            start: years.start,
            end: years.end,
            precision: "year",
            approximate: true,
            flags: ["ai-extracted"],
            provider: "llm-extract",
            providerLabel: "AI extraction from " + source.sourceType.toLowerCase(),
            sourceUrl: source.url,
            sourceTitle: source.title
          });
        }).filter(Boolean);
      });
    },

    // Asks for notable events in thin regions, then keeps only what Wikipedia/Wikidata can date-confirm.
    suggestAndVerify: function (plan, events, api) {
      var counts = {};
      events.forEach(function (event) {
        event.regions.forEach(function (region) {
          counts[region] = (counts[region] || 0) + 1;
        });
      });

      var targets = (plan.focusRegions.length ? plan.focusRegions : ["West Asia / Near East", "East Asia", "South Asia", "Mediterranean Europe", "Nile Valley", "Mesoamerica"])
        .filter(function (region) {
          return plan.region === "All" || region === plan.region;
        })
        .sort(function (a, b) {
          return (counts[a] || 0) - (counts[b] || 0);
        })
        .slice(0, 4);

      if (!targets.length) {
        targets = [plan.region];
      }

      var schema = {
        type: "object",
        properties: {
          events: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                wikipedia_title: { type: "string" },
                start_year: { type: "integer" },
                end_year: { type: "integer" },
                region: { type: "string" }
              },
              required: ["title", "wikipedia_title", "start_year", "end_year", "region"]
            },
            maxItems: api.depth.gapFill
          }
        },
        required: ["events"]
      };

      var already = events.slice(0, 40).map(function (event) {
        return "- " + event.title;
      }).join("\n");

      api.progress("Asking the model for missing events");

      return APP.llm.chatJson([
        {
          role: "system",
          content: SYSTEM_RULES + " Suggest well-documented events, reigns, or developments that a history encyclopedia would have an article about. " +
            "wikipedia_title must be the likely English Wikipedia article title. Prefer specific, verifiable items over vague trends."
        },
        {
          role: "user",
          content: "Period: " + plan.start + " to " + plan.end + "\nRegions needing coverage: " + targets.join(", ") +
            "\nUp to " + api.depth.gapFill + " items not already in this list:\n" + (already || "(none)")
        }
      ], schema, { signal: api.signal }).then(function (result) {
        var suggestions = (result.events || []).slice(0, api.depth.gapFill);
        var verified = 0;

        return Promise.all(suggestions.map(function (item) {
          var years = repairYears(Number(item.start_year), Number(item.end_year));
          if (!item.title || !yearsValid(years.start, years.end)) {
            return null;
          }

          return APP.timelineProviders.lookupArticles(item.wikipedia_title || item.title, 3, api.signal).then(function (found) {
            var slack = Math.max(5, Math.round((plan.end - plan.start) * 0.1));
            var wanted = item.wikipedia_title || item.title;
            var match = found.events.filter(function (record) {
              return APP.timeline.titleSimilarity(wanted, record.title) >= 0.5 &&
                APP.utils.rangesOverlap(record.start, record.end, years.start - slack, years.end + slack) &&
                APP.utils.rangesOverlap(record.start, record.end, plan.start - slack, plan.end + slack) &&
                (record.end - record.start) < 1500;
            })[0];

            if (match) {
              verified += 1;
              var event = APP.timeline.createEvent(match);
              event.provenance.push({
                provider: "llm-suggest",
                label: "AI suggestion (verified)",
                url: "",
                title: item.title
              });
              event.flags.push("ai-verified");
              event.confidence = APP.timeline.scoreConfidence(event);
              return event;
            }

            return APP.timeline.createEvent({
              title: item.title,
              summary: "Suggested by the language model but not confirmed by a dated Wikipedia/Wikidata record.",
              start: years.start,
              end: years.end,
              precision: "year",
              approximate: true,
              regions: APP.timeline.laneOrder().indexOf(item.region) !== -1 ? [item.region] : [],
              flags: ["unverified"],
              provider: "llm-suggest",
              providerLabel: "AI suggestion (unverified)"
            });
          }).catch(function (error) {
            if (APP.http.isAbort(error)) {
              throw error;
            }
            return null;
          });
        })).then(function (items) {
          return {
            events: items.filter(Boolean),
            message: verified + " of " + suggestions.length + " suggestions verified"
          };
        });
      });
    },

    buildDeepDivePrompt: function (event, packet) {
      var sources = [];
      if (packet.article) {
        sources.push({ label: "Encyclopedia article: " + packet.articleTitle, text: packet.article });
      }
      event.provenance.forEach(function (item) {
        if (item.title) {
          sources.push({ label: item.label + ": " + item.title, text: "" });
        }
      });
      packet.works.forEach(function (work) {
        sources.push({ label: "Scholarship: " + work.title + (work.meta ? " (" + work.meta + ")" : ""), text: work.excerpt });
      });

      return [
        {
          role: "system",
          content: SYSTEM_RULES + " Write a research brief in Markdown using ## headings. End every paragraph or bullet with the " +
            "numbered source(s) it relies on, written exactly like [S1] or [S1, S3]; if a statement relies on no listed source, " +
            "write (general knowledge) instead. Keep it under 650 words."
        },
        {
          role: "user",
          content: [
            "EVENT: " + event.title,
            "DATE: " + APP.timeline.formatPrecision(event) + " (confidence " + APP.timeline.confidenceLabel(event.confidence) + ")",
            "REGIONS: " + (event.regions.concat(event.places).join(", ") || "unknown"),
            "SUMMARY: " + event.summary,
            "",
            "SOURCES:",
            numbered(sources, "S", function (source) {
              return source.label + (source.text ? "\n" + source.text : "");
            }) || "(none)",
            "",
            "CONTEMPORANEOUS EVENTS ELSEWHERE:",
            packet.meanwhile.map(function (item) { return "- " + eventLine(item); }).join("\n") || "(none collected)",
            "",
            "Sections: ## What happened, ## Dating and evidence (competing dates, how certain), ## Wider context, " +
              "## Relevance to the Biblical world (only if there is a real connection; otherwise say so briefly), ## Open questions."
          ].join("\n")
        }
      ];
    },

    buildSummaryPrompt: function (plan, lanes, sources) {
      var eventIndex = 0;
      var laneText = lanes.map(function (lane) {
        return "### " + lane.name + "\n" + lane.events.map(function (event) {
          eventIndex += 1;
          event._ref = "E" + eventIndex;
          return "[E" + eventIndex + "] " + eventLine(event);
        }).join("\n");
      }).join("\n\n");

      var works = sources.filter(function (source) {
        return source.sourceType === "Scholarship";
      }).slice(0, 8);

      return [
        {
          role: "system",
          content: SYSTEM_RULES + " Synthesize the evidence into a comparative overview in Markdown. Support each claim with the " +
            "event numbers it rests on, written exactly like [E3] or [E3, E7], and works as [S1]. " +
            "Only claim connections between regions that the evidence supports. Keep it under 800 words."
        },
        {
          role: "user",
          content: [
            "QUESTION: " + (plan.query || "(range search)"),
            "PERIOD: " + APP.utils.formatRange(plan.start, plan.end),
            "",
            "EVENTS BY REGION:",
            laneText || "(none)",
            "",
            "SCHOLARSHIP:",
            numbered(works, "S", function (work) { return work.title + (work.meta ? " (" + work.meta + ")" : ""); }) || "(none)",
            "",
            "Sections: ## Overview (answer the question directly), ## Region by region, ## Connections and contacts, " +
              "## Chronological uncertainties, ## Suggested next searches."
          ].join("\n")
        }
      ];
    }
  };
}());
