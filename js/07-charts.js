(function () {
  "use strict";

  APP.charts = {
    // Uses the shared swimlane renderer: one lane per domain, rows packed so labels never overlap,
    // and the view framed on the era so centuries-long background periods do not squash it.
    buildTimeline: function (context) {
      var lanes = APP.timeline.laneOrder();
      var events = context.biblicalEvents.concat(context.worldEvents).map(function (event) {
        return APP.timeline.createEvent({
          id: "context-" + event.id,
          title: event.title,
          summary: event.detail,
          start: event.start,
          end: event.end,
          approximate: true,
          regions: event.regions.filter(function (region) { return lanes.indexOf(region) !== -1; }),
          places: event.regions.filter(function (region) { return lanes.indexOf(region) === -1; }),
          continents: event.continents,
          domain: event.domain,
          provider: "curated",
          providerLabel: "Curated dataset"
        });
      }).filter(Boolean);
      var pad = Math.max(5, Math.round((context.end - context.start) * 0.15));
      var chart = APP.timelineView.buildChart(events, {
        width: APP.dom.timelineChart.clientWidth - 2,
        minWidth: 480,
        viewStart: context.start - pad,
        viewEnd: context.end + pad,
        focusStart: context.start,
        focusEnd: context.end,
        groupBy: "domain",
        selectedId: null
      });

      return chart.html + '<div class="tl-legend chart-legend">' + APP.timelineView.buildLegend(events) + "</div>";
    },

    buildRegionalComparison: function (context, selectedRegions) {
      var regions = selectedRegions.length ? selectedRegions : ["West Asia / Near East", "East Asia", "South Asia", "Europe"];
      var cards = regions.map(function (region) {
        var events = APP.sources.getLocalEvents(context.start, context.end, "All", region);
        var names = events.slice(0, 2).map(function (event) {
          return event.title;
        });

        return [
          '<div class="comparison-card">',
          '<span class="comparison-title">' + APP.utils.escapeHtml(region) + "</span>",
          '<span class="comparison-count">' + events.length + " matching record" + (events.length === 1 ? "" : "s") + "</span>",
          '<span class="comparison-detail">' +
            APP.utils.escapeHtml(names.length ? names.join("; ") : "No embedded event records in this range.") +
          "</span>",
          "</div>"
        ].join("");
      });

      return cards.join("");
    }
  };
}());