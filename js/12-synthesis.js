(function () {
  "use strict";

  APP.synthesis = {
    buildPrompt: function (context, sources) {
      var localEvents = context.biblicalEvents.concat(context.worldEvents)
        .map(function (event) {
          return "- [" + event.domain + "] " +
            APP.utils.formatRange(event.start, event.end) +
            " | " + event.regions.join(", ") +
            " | " + event.title +
            ": " + event.detail;
        })
        .join("\n");

      var evidence = sources.length
        ? sources.map(function (source) {
          return "- SOURCE: " + source.title + "\n" +
            "  TYPE: " + source.sourceType + "\n" +
            "  EXCERPT: " + source.excerpt;
        }).join("\n")
        : "[No external sources collected.]";

      return [
        "You are a careful historical-context research assistant.",
        "Write a concise, balanced, nonsectarian analysis.",
        "Do not invent quotations, sources, dates, or historical details.",
        "Do not treat a broad continent as a unified civilization.",
        "Distinguish a dated event from a long-running historical period.",
        "State uncertainty when dates or relationships are disputed.",
        "",
        "Scope: " + context.era.label,
        "Date range: " + APP.utils.formatRange(context.start, context.end),
        "Bible reference: " + (context.reference ? context.reference.display : "[No Bible reference]"),
        "Passage text: " + (context.passageText || "[No passage text supplied]"),
        "",
        "LOCAL TIMELINE:",
        localEvents || "[No matching local events.]",
        "",
        "COLLECTED EVIDENCE:",
        evidence,
        "",
        "Return exactly these headings:",
        "BOTTOM LINE",
        "HISTORICAL SETTING",
        "ORIGINAL-SETTING CONTEXT",
        "CAUTIONS",
        "",
        "Keep the response below 700 words."
      ].join("\n");
    },

    parse: function (text, fallback) {
      // Models often decorate headings ("## BOTTOM LINE", "**Bottom Line:**"); reduce them to bare headings.
      var normalized = APP.llm.stripThinking(text).replace(
        /^[#>\s*_]*(BOTTOM LINE|HISTORICAL SETTING|ORIGINAL-SETTING CONTEXT|CAUTIONS)[\s*_:]*$/gim,
        function (line, heading) {
          return heading.toUpperCase();
        }
      );

      function readSection(name, nextSections) {
        var next = nextSections.length ? "(?=\\n(?:" + nextSections.join("|") + ")\\s*\\n|$)" : "$";
        var expression = new RegExp(name + "\\s*\\n([\\s\\S]*?)" + next, "i");
        var match = normalized.match(expression);
        return match ? match[1].replace(/\*\*/g, "").trim() : "";
      }

      return {
        source: "Ollama synthesis with collected evidence",
        bluf: readSection("BOTTOM LINE", ["HISTORICAL SETTING", "ORIGINAL-SETTING CONTEXT", "CAUTIONS"]) || fallback.bluf,
        historicalSetting: readSection("HISTORICAL SETTING", ["ORIGINAL-SETTING CONTEXT", "CAUTIONS"]) || fallback.historicalSetting,
        application: readSection("ORIGINAL-SETTING CONTEXT", ["CAUTIONS"]) || fallback.application,
        notes: readSection("CAUTIONS", []) || fallback.notes
      };
    }
  };
}());