(function () {
  "use strict";

  var CATEGORY_COLORS = {
    conflict: "#ed7d7d",
    politics: "#e6bb62",
    religion: "#68b8ff",
    culture: "#b69cff",
    science: "#61c49c",
    economy: "#5fd3d3",
    disaster: "#ff9f6b",
    people: "#c9d4e0",
    other: "#8297ad"
  };

  var ROW_HEIGHT = 26;
  var MAX_ROWS = 7;
  var GUTTER = 156;
  var AXIS_HEIGHT = 34;

  var esc = function (value) {
    return APP.utils.escapeHtml(value);
  };

  function axisLabel(year) {
    if (year < 0) {
      return Math.abs(year) + " BCE";
    }
    return (year === 0 ? 1 : year) + " CE";
  }

  function niceStep(span) {
    var rough = span / 8;
    var steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
    return steps.filter(function (step) {
      return step >= rough;
    })[0] || 10000;
  }

  function laneSort(groupBy) {
    var order = groupBy === "region"
      ? APP.timeline.laneOrder()
      : groupBy === "domain"
        ? ["Biblical", "World", "Regional"]
        : [];

    return function (a, b) {
      var indexA = order.indexOf(a);
      var indexB = order.indexOf(b);
      if (a === "Unplaced") { return 1; }
      if (b === "Unplaced") { return -1; }
      if (indexA === -1 && indexB === -1) { return a.localeCompare(b); }
      if (indexA === -1) { return 1; }
      if (indexB === -1) { return -1; }
      return indexA - indexB;
    };
  }

  function providerBadges(event) {
    return event.provenance.map(function (item) {
      var url = APP.utils.safeUrl(item.url);
      var label = esc(item.label || item.provider);
      return url
        ? '<a class="provider-badge" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(item.title || url) + '">' + label + "</a>"
        : '<span class="provider-badge">' + label + "</span>";
    }).join("");
  }

  function confidenceMeter(value) {
    var label = APP.timeline.confidenceLabel(value);
    return '<span class="confidence confidence-' + label.toLowerCase() + '" title="Confidence ' + Math.round(value * 100) + '%">' +
      '<span class="confidence-bar"><span style="width:' + Math.round(value * 100) + '%"></span></span>' + label + "</span>";
  }

  APP.timelineView = {
    categoryColors: CATEGORY_COLORS,

    groupLanes: function (events, groupBy) {
      var lanes = {};
      events.forEach(function (event) {
        var name = APP.timeline.primaryLane(event, groupBy);
        (lanes[name] = lanes[name] || []).push(event);
      });

      return Object.keys(lanes).sort(laneSort(groupBy)).map(function (name) {
        return { name: name, events: lanes[name] };
      });
    },

    buildChart: function (events, options) {
      var width = Math.max(options.minWidth || 720, Math.round(options.width || 900));
      var viewStart = options.viewStart;
      var viewEnd = Math.max(options.viewEnd, viewStart + 1);
      var usable = width - GUTTER - 18;
      var scale = function (year) {
        return GUTTER + ((year - viewStart) / (viewEnd - viewStart)) * usable;
      };
      var visible = events.filter(function (event) {
        return APP.utils.rangesOverlap(event.start, event.end, viewStart, viewEnd);
      });
      var lanes = APP.timelineView.groupLanes(visible, options.groupBy);
      var laneMarkup = [];
      var y = AXIS_HEIGHT;
      var hidden = 0;
      var selected = null;

      lanes.forEach(function (lane, laneIndex) {
        var rowEnds = [];
        var marks = [];
        var overflow = 0;

        lane.events.slice().sort(function (a, b) {
          return b.confidence - a.confidence;
        }).sort(function (a, b) {
          return a.start - b.start;
        }).forEach(function (event) {
          var x1 = scale(Math.max(event.start, viewStart));
          var x2 = scale(Math.min(event.end, viewEnd));
          var barWidth = Math.max(0, x2 - x1);
          var label = APP.utils.truncate(event.title, 40);
          var labelWidth = label.length * 5.9 + 12;
          // Labels near the right edge shift left so they stay inside the chart.
          var labelX = Math.max(GUTTER + 4, Math.min(x1, width - 10 - labelWidth));
          var occupiedStart = Math.min(x1, labelX);
          var occupiedEnd = Math.max(x1 + Math.max(barWidth, 12), labelX + labelWidth) + 6;
          var reserved = occupiedEnd - occupiedStart;
          var row = -1;

          for (var index = 0; index < rowEnds.length; index += 1) {
            if (rowEnds[index] <= occupiedStart) {
              row = index;
              break;
            }
          }
          if (row === -1 && rowEnds.length < MAX_ROWS) {
            row = rowEnds.length;
            rowEnds.push(0);
          }
          if (row === -1) {
            overflow += 1;
            return;
          }
          rowEnds[row] = occupiedEnd;

          var rowY = y + 6 + row * ROW_HEIGHT;
          var color = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.other;
          var coarse = event.precision === "century" || event.precision === "millennium" || event.approximate;
          var unverified = event.flags.indexOf("unverified") !== -1;
          var isSelected = event.id === options.selectedId;
          var mark = event.end > event.start && barWidth >= 4
            ? '<rect x="' + x1.toFixed(1) + '" y="' + (rowY + 15) + '" width="' + Math.max(barWidth, 4).toFixed(1) +
              '" height="6" rx="3" fill="' + color + '" fill-opacity="' + (coarse ? 0.45 : 0.9) + '"' +
              (coarse || unverified ? ' stroke="' + color + '" stroke-dasharray="3 2"' : "") + "/>"
            : '<circle cx="' + (x1 + 4).toFixed(1) + '" cy="' + (rowY + 18) + '" r="4.5" fill="' + (unverified ? "none" : color) +
              '" stroke="' + color + '"' + (coarse ? ' fill-opacity="0.5"' : "") + "/>";

          if (isSelected) {
            selected = { x: x1, event: event };
          }

          marks.push(
            '<g class="tl-event' + (isSelected ? " is-selected" : "") + (unverified ? " is-unverified" : "") +
              '" data-id="' + esc(event.id) + '" tabindex="0" role="button" aria-label="' +
              esc(event.title + ", " + APP.timeline.formatPrecision(event)) + '">' +
              "<title>" + esc(event.title + "\n" + APP.timeline.formatPrecision(event) + " · " +
                (event.regions.join(", ") || "unplaced") + " · " + APP.timeline.confidenceLabel(event.confidence) + " confidence") + "</title>" +
              '<rect class="tl-hit" x="' + (occupiedStart - 2).toFixed(1) + '" y="' + rowY + '" width="' + (reserved - 2).toFixed(1) + '" height="' + (ROW_HEIGHT - 2) + '" rx="4"/>' +
              mark +
              '<text x="' + labelX.toFixed(1) + '" y="' + (rowY + 11) + '" class="tl-label">' + esc(label) + "</text>" +
            "</g>"
          );
        });

        hidden += overflow;
        var laneHeight = Math.max(1, rowEnds.length) * ROW_HEIGHT + 12;

        laneMarkup.push(
          '<rect x="0" y="' + y + '" width="' + width + '" height="' + laneHeight + '" class="' + (laneIndex % 2 ? "tl-lane-alt" : "tl-lane") + '"/>' +
          '<text x="12" y="' + (y + 20) + '" class="tl-lane-name">' + esc(APP.utils.truncate(lane.name, 22)) + "</text>" +
          '<text x="12" y="' + (y + 35) + '" class="tl-lane-count">' + lane.events.length + " record" + (lane.events.length === 1 ? "" : "s") + "</text>" +
          (overflow ? '<text x="' + (width - 10) + '" y="' + (y + laneHeight - 6) + '" class="tl-overflow" text-anchor="end">+' + overflow + " more · zoom in or use the table</text>" : "") +
          marks.join("")
        );

        y += laneHeight;
      });

      var height = y + 8;
      var step = niceStep(viewEnd - viewStart);
      var ticks = [];
      for (var tick = Math.ceil(viewStart / step) * step; tick <= viewEnd; tick += step) {
        var x = scale(tick);
        ticks.push(
          '<line x1="' + x.toFixed(1) + '" y1="' + (AXIS_HEIGHT - 6) + '" x2="' + x.toFixed(1) + '" y2="' + height + '" class="tl-grid"/>' +
          '<text x="' + x.toFixed(1) + '" y="18" class="tl-tick" text-anchor="middle">' + esc(axisLabel(tick)) + "</text>"
        );
      }

      var focus = "";
      if (options.focusStart !== null && options.focusEnd !== null &&
        (options.focusStart > viewStart || options.focusEnd < viewEnd)) {
        var fx1 = scale(Math.max(options.focusStart, viewStart));
        var fx2 = scale(Math.min(options.focusEnd + 1, viewEnd));
        focus = '<rect x="' + fx1.toFixed(1) + '" y="' + AXIS_HEIGHT + '" width="' + Math.max(2, fx2 - fx1).toFixed(1) +
          '" height="' + (height - AXIS_HEIGHT) + '" class="tl-focus"/>';
      }

      var guide = selected
        ? '<line x1="' + selected.x.toFixed(1) + '" y1="' + AXIS_HEIGHT + '" x2="' + selected.x.toFixed(1) + '" y2="' + height + '" class="tl-guide"/>'
        : "";

      var empty = lanes.length
        ? ""
        : '<text x="' + (width / 2) + '" y="' + (AXIS_HEIGHT + 40) + '" class="tl-lane-count" text-anchor="middle">No events in this window with the current filters.</text>';

      return {
        hidden: hidden,
        laneCount: lanes.length,
        html: '<svg class="tl-svg" width="' + width + '" height="' + Math.max(height, AXIS_HEIGHT + 70) + '" viewBox="0 0 ' + width + " " +
          Math.max(height, AXIS_HEIGHT + 70) + '" role="group" aria-label="Timeline swimlanes">' +
          '<rect class="tl-bg" x="0" y="0" width="' + width + '" height="' + Math.max(height, AXIS_HEIGHT + 70) + '"/>' +
          focus + ticks.join("") + laneMarkup.join("") + guide + empty +
          '<line x1="' + GUTTER + '" y1="' + AXIS_HEIGHT + '" x2="' + GUTTER + '" y2="' + height + '" class="tl-gutter"/>' +
          "</svg>"
      };
    },

    buildLegend: function (events) {
      var present = {};
      events.forEach(function (event) {
        present[event.category] = true;
      });

      return Object.keys(CATEGORY_COLORS).filter(function (category) {
        return present[category];
      }).map(function (category) {
        return '<span class="legend-item"><span class="legend-swatch" style="background:' + CATEGORY_COLORS[category] + '"></span>' +
          esc(category) + "</span>";
      }).join("") +
        '<span class="legend-item"><span class="legend-swatch legend-dashed"></span>approximate / coarse date</span>' +
        '<span class="legend-item"><span class="legend-swatch legend-focus"></span>search range</span>';
    },

    buildProviderStatus: function (statuses) {
      return Object.keys(statuses).map(function (id) {
        var status = statuses[id];
        var time = status.ms ? " · " + (status.ms / 1000).toFixed(1) + "s" : "";
        return '<span class="provider-chip provider-' + status.state + '" title="' + esc(status.message || "") + '">' +
          '<span class="provider-dot"></span>' + esc(status.label) +
          '<span class="provider-note">' + esc(status.message ? APP.utils.truncate(status.message, 60) : status.state) + time + "</span>" +
          "</span>";
      }).join("");
    },

    buildPlanSummary: function (plan) {
      var parts = [
        "<strong>" + (APP.timeline.hasRange(plan) ? esc(APP.utils.formatRange(plan.start, plan.end)) : "Range pending") + "</strong>"
      ];
      if (plan.keywords) {
        parts.push("keywords: <em>" + esc(plan.keywords) + "</em>");
      }
      if (plan.region !== "All" || plan.continent !== "All") {
        parts.push("filter: " + esc(plan.region !== "All" ? plan.region : plan.continent));
      }
      parts.push("planner: " + (plan.planner === "llm" ? "AI + local" : "local"));

      return "<p>" + parts.join(" · ") + "</p>" + (plan.notes.length
        ? '<ul class="plan-notes">' + plan.notes.map(function (note) { return "<li>" + esc(note) + "</li>"; }).join("") + "</ul>"
        : "");
    },

    buildLaneSummary: function (lanes) {
      if (!lanes.length) {
        return '<div class="narrative-card"><p>No events match the current filters.</p></div>';
      }

      return lanes.map(function (lane) {
        var top = lane.events.slice().sort(function (a, b) {
          return b.confidence - a.confidence;
        }).slice(0, 3);

        return '<div class="comparison-card">' +
          '<span class="comparison-title">' + esc(lane.name) + "</span>" +
          '<span class="comparison-count">' + lane.events.length + " record" + (lane.events.length === 1 ? "" : "s") + "</span>" +
          '<span class="comparison-detail">' + top.map(function (event) {
            return '<button type="button" class="link-button" data-id="' + esc(event.id) + '">' + esc(APP.utils.truncate(event.title, 70)) + "</button>";
          }).join("<br>") + "</span></div>";
      }).join("");
    },

    buildEventsTable: function (events, limit) {
      if (!events.length) {
        return '<div class="narrative-card"><p>No events match the current filters.</p></div>';
      }

      var rows = events.slice(0, limit).map(function (event) {
        var flags = event.flags.map(function (flag) {
          return '<span class="flag flag-' + esc(flag) + '">' + esc(flag.replace(/-/g, " ")) + "</span>";
        }).join("");

        return "<tr data-id=\"" + esc(event.id) + "\">" +
          '<td class="event-date">' + esc(APP.timeline.formatPrecision(event)) + "</td>" +
          '<td class="event-region">' + esc(event.regions.concat(event.places.filter(function (place) {
            return event.regions.indexOf(place) === -1;
          })).join(", ") || "Unplaced") + "</td>" +
          '<td><button type="button" class="link-button event-title" data-id="' + esc(event.id) + '">' + esc(event.title) + "</button>" +
            (event.summary && event.summary !== event.title ? "<br>" + esc(APP.utils.truncate(event.summary, 260)) : "") +
            '<div class="chip-row"><span class="category-chip" style="--chip:' + (CATEGORY_COLORS[event.category] || CATEGORY_COLORS.other) + '">' +
            esc(event.category) + "</span>" + flags + "</div></td>" +
          "<td>" + confidenceMeter(event.confidence) + "</td>" +
          '<td class="provider-cell">' + providerBadges(event) + "</td>" +
          "</tr>";
      }).join("");

      return '<table class="data-table tl-table">' +
        "<thead><tr><th>Date</th><th>Region</th><th>Event</th><th>Confidence</th><th>Sources</th></tr></thead>" +
        "<tbody>" + rows + "</tbody></table>" +
        (events.length > limit
          ? '<div class="table-more"><button type="button" id="tlShowMore" class="button button-secondary">Show ' +
            Math.min(100, events.length - limit) + " more of " + (events.length - limit) + " remaining</button></div>"
          : "");
    },

    buildSourcesTable: function (sources) {
      if (!sources.length) {
        return '<div class="narrative-card"><p>No reading sources collected yet.</p></div>';
      }

      var order = ["Scholarship", "Encyclopedia article", "Wikipedia chronicle", "Web search", "User-provided public URL", "URL unavailable"];
      var sorted = sources.slice().sort(function (a, b) {
        return order.indexOf(a.sourceType) - order.indexOf(b.sourceType);
      });

      return '<table class="data-table">' +
        "<thead><tr><th>Type</th><th>Source</th></tr></thead><tbody>" +
        sorted.map(function (source) {
          var url = APP.utils.safeUrl(source.url);
          var title = url
            ? '<a class="source-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(source.title) + "</a>"
            : "<strong>" + esc(source.title) + "</strong>";
          return "<tr><td class=\"event-region\">" + esc(source.sourceType) + "</td><td>" + title +
            (source.meta ? '<div class="source-meta">' + esc(source.meta) + "</div>" : "") +
            (source.excerpt ? "<div>" + esc(APP.utils.truncate(source.excerpt, 300)) + "</div>" : "") +
            "</td></tr>";
        }).join("") +
        "</tbody></table>";
    },

    buildDetail: function (event, meanwhile, llmReady) {
      var articleUrl = APP.utils.safeUrl(event.url);
      var places = event.regions.concat(event.places.filter(function (place) {
        return event.regions.indexOf(place) === -1;
      }));

      return '<div class="tl-detail-head">' +
          "<div>" +
            '<p class="section-label">' + esc(event.domain.toUpperCase() + " · " + event.category.toUpperCase()) + "</p>" +
            "<h3>" + esc(event.title) + "</h3>" +
            '<p class="tl-detail-date">' + esc(APP.timeline.formatPrecision(event)) + (places.length ? " · " + esc(places.join(", ")) : "") + "</p>" +
          "</div>" +
          confidenceMeter(event.confidence) +
        "</div>" +
        (event.summary && event.summary !== event.title ? '<p class="tl-detail-summary">' + esc(event.summary) + "</p>" : "") +
        '<div class="tl-detail-grid">' +
          "<div><h4>Evidence trail</h4><ul class=\"evidence-list\">" +
            event.provenance.map(function (item) {
              var url = APP.utils.safeUrl(item.url);
              return "<li>" + (url
                ? '<a class="source-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(item.label) + "</a>"
                : esc(item.label)) + (item.title ? " — " + esc(item.title) : "") + "</li>";
            }).join("") +
            (event.flags.length ? "<li class=\"muted\">Flags: " + esc(event.flags.join(", ")) + "</li>" : "") +
          "</ul></div>" +
          "<div><h4>Meanwhile elsewhere</h4>" + (meanwhile.length
            ? '<ul class="evidence-list">' + meanwhile.map(function (item) {
              return '<li><button type="button" class="link-button" data-id="' + esc(item.id) + '">' + esc(APP.utils.truncate(item.title, 80)) + "</button>" +
                ' <span class="muted">' + esc(APP.timeline.formatPrecision(item) + " · " + (item.regions[0] || "unplaced")) + "</span></li>";
            }).join("") + "</ul>"
            : '<p class="muted">No overlapping events in other lanes.</p>') +
          "</div>" +
        "</div>" +
        '<div class="button-row">' +
          '<button type="button" id="tlDeepDive" class="button button-primary">' + (llmReady ? "Deep dive with AI" : "Gather research packet") + "</button>" +
          '<button type="button" id="tlCenterEvent" class="button button-secondary">Center timeline here</button>' +
          (articleUrl ? '<a class="button button-secondary" href="' + esc(articleUrl) + '" target="_blank" rel="noopener noreferrer">Open article</a>' : "") +
        "</div>" +
        '<div id="tlDeepDiveOutput" class="deep-dive hidden" aria-live="polite"></div>';
    },

    buildPacket: function (packet) {
      return (packet.article
          ? "<h4>Article extract</h4><p>" + esc(APP.utils.truncate(packet.article, 1800)) + "</p>"
          : "") +
        (packet.works.length
          ? "<h4>Scholarship</h4><ul>" + packet.works.map(function (work) {
            var url = APP.utils.safeUrl(work.url);
            return "<li>" + (url ? '<a class="source-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(work.title) + "</a>" : esc(work.title)) +
              (work.meta ? ' <span class="muted">' + esc(work.meta) + "</span>" : "") + "</li>";
          }).join("") + "</ul>"
          : "");
    },

    // Links event names mentioned in generated text back to their records, so claims can be checked
    // even when a model ignores the citation format. Only short, name-like titles are matched.
    linkMentions: function (container, events) {
      var candidates = events.filter(function (event) {
        return event.title.length >= 6 && event.title.length <= 60 && !/[.;]$/.test(event.title);
      }).map(function (event) {
        var name = event.title.replace(/\s*\([^)]*\)\s*$/, "");
        return { id: event.id, pattern: new RegExp("\\b" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b") };
      });
      var count = 0;

      // One link per event, at its first mention; each candidate walks the current text nodes afresh.
      candidates.forEach(function (candidate) {
        var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        var textNode;

        while ((textNode = walker.nextNode())) {
          if (textNode.parentElement.closest("button, a")) {
            continue;
          }
          var match = textNode.nodeValue.match(candidate.pattern);
          if (!match) {
            continue;
          }
          var mention = textNode.splitText(match.index);
          mention.splitText(match[0].length);
          var button = document.createElement("button");
          button.type = "button";
          button.className = "mention-ref";
          button.setAttribute("data-id", candidate.id);
          button.title = "Show this record on the timeline";
          button.textContent = match[0];
          mention.parentNode.replaceChild(button, mention);
          count += 1;
          break;
        }
      });

      return count;
    },

    // ---------- Exports ----------

    toCsv: function (events) {
      var header = ["start", "end", "precision", "approximate", "title", "summary", "regions", "places", "category", "domain", "confidence", "sources"];
      var cell = function (value) {
        return '"' + String(value === undefined || value === null ? "" : value).replace(/"/g, '""') + '"';
      };

      return [header.join(",")].concat(events.map(function (event) {
        return [
          event.start, event.end, event.precision, event.approximate, event.title, event.summary,
          event.regions.join("; "), event.places.join("; "), event.category, event.domain, event.confidence,
          event.provenance.map(function (item) { return item.label + (item.url ? " <" + item.url + ">" : ""); }).join("; ")
        ].map(cell).join(",");
      })).join("\r\n");
    },

    toMarkdown: function (plan, lanes, sources, summaryText) {
      var lines = [
        "# Timeline research: " + (plan.query || APP.utils.formatRange(plan.start, plan.end)),
        "",
        "- Period: " + APP.utils.formatRange(plan.start, plan.end),
        "- Generated: " + new Date().toISOString(),
        "- Notes: " + plan.notes.join(" "),
        ""
      ];

      if (summaryText) {
        lines.push("## AI synthesis", "", summaryText, "");
      }

      lanes.forEach(function (lane) {
        lines.push("## " + lane.name, "");
        lane.events.forEach(function (event) {
          var link = event.provenance.filter(function (item) { return item.url; })[0];
          lines.push("- **" + APP.timeline.formatPrecision(event) + "** — " + event.title +
            " _(" + APP.timeline.confidenceLabel(event.confidence) + " confidence" + (link ? "; [source](" + link.url + ")" : "") + ")_");
        });
        lines.push("");
      });

      lines.push("## Sources", "");
      sources.forEach(function (source) {
        lines.push("- [" + source.sourceType + "] " + (source.url ? "[" + source.title + "](" + source.url + ")" : source.title) +
          (source.meta ? " — " + source.meta : ""));
      });

      return lines.join("\n");
    }
  };
}());
