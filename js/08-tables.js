(function () {
  "use strict";

  APP.tables = {
    buildEventsTable: function (events, emptyMessage) {
      if (!events.length) {
        return '<div class="narrative-card"><p>' + APP.utils.escapeHtml(emptyMessage) + "</p></div>";
      }

      var rows = APP.utils.sortBy(events, "start").map(function (event) {
        return [
          "<tr>",
          '<td class="event-date">' + APP.utils.escapeHtml(APP.utils.formatRange(event.start, event.end)) + "</td>",
          '<td class="event-region">' + APP.utils.escapeHtml(event.regions.join(", ")) + "</td>",
          "<td><strong>" + APP.utils.escapeHtml(event.title) + "</strong><br>" +
            APP.utils.escapeHtml(event.detail) + "</td>",
          "</tr>"
        ].join("");
      }).join("");

      return [
        '<table class="data-table">',
        "<thead><tr><th>Approx. Date</th><th>Region</th><th>Event and Relevance</th></tr></thead>",
        "<tbody>" + rows + "</tbody>",
        "</table>"
      ].join("");
    },

    buildSourcesTable: function (sources) {
      if (!sources.length) {
        return '<div class="narrative-card"><p>No public-source records were collected. Enable research mode or provide CORS-accessible public URLs.</p></div>';
      }

      var rows = sources.map(function (source) {
        var link = source.url
          ? '<a class="source-link" href="' + APP.utils.escapeHtml(source.url) + '" target="_blank" rel="noopener noreferrer">Open source</a>'
          : "No link";

        return [
          "<tr>",
          '<td class="event-region">' + APP.utils.escapeHtml(source.sourceType) + "</td>",
          "<td><strong>" + APP.utils.escapeHtml(source.title) + "</strong><br>" +
            APP.utils.escapeHtml(APP.utils.truncate(source.excerpt, 260)) + "</td>",
          "<td>" + link + "</td>",
          "</tr>"
        ].join("");
      }).join("");

      return [
        '<table class="data-table">',
        "<thead><tr><th>Source Type</th><th>Collected Evidence</th><th>Link</th></tr></thead>",
        "<tbody>" + rows + "</tbody>",
        "</table>"
      ].join("");
    },

    buildMetrics: function (metrics) {
      var cards = [
        ["Scope", metrics.scope],
        ["Date Range", metrics.dateRange],
        ["Biblical Events", metrics.biblicalCount],
        ["World Events", metrics.worldCount],
        ["Sources", metrics.sourceCount],
        ["Analysis Mode", metrics.analysisMode]
      ];

      return cards.map(function (card) {
        return [
          '<div class="metric-card">',
          '<span class="metric-label">' + APP.utils.escapeHtml(card[0]) + "</span>",
          '<span class="metric-value">' + APP.utils.escapeHtml(String(card[1])) + "</span>",
          "</div>"
        ].join("");
      }).join("");
    },

    buildAuditLog: function (entries) {
      if (!entries.length) {
        return '<div class="audit-entry info"><span class="audit-time">Ready</span>Enter a reference or select a historical anchor.</div>';
      }

      return entries.map(function (entry) {
        return [
          '<div class="audit-entry ' + APP.utils.escapeHtml(entry.level) + '">',
          '<span class="audit-time">' + APP.utils.escapeHtml(entry.time) + "</span>",
          APP.utils.escapeHtml(entry.message),
          "</div>"
        ].join("");
      }).join("");
    }
  };
}());