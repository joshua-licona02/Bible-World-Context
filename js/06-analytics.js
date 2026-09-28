(function () {
  "use strict";

  APP.analytics = {
    buildMetrics: function (context, analysis, sourceCount) {
      return {
        scope: context.reference ? context.reference.display : context.era.label,
        dateRange: APP.utils.formatRange(context.start, context.end),
        biblicalCount: context.biblicalEvents.length,
        worldCount: context.worldEvents.length,
        sourceCount: sourceCount,
        analysisMode: analysis.source
      };
    },

    buildWarnings: function (context, sourceCount) {
      var warnings = [];

      if (!context.reference && !context.regionalRequest) {
        warnings.push("No Bible reference or regional request was retained.");
      }

      if (context.type === "bible" && !context.passageText) {
        warnings.push("No passage text was supplied; interpretation remains reference-level.");
      }

      if (!context.worldEvents.length) {
        warnings.push("No local world-history events matched the selected range and region.");
      }

      if (sourceCount === 0) {
        warnings.push("No external research sources were collected for this result.");
      }

      return warnings;
    }
  };
}());