(function () {
  "use strict";

  var HEADINGS = ["BOTTOM LINE", "HISTORICAL SETTING", "ORIGINAL-SETTING CONTEXT", "SO WHAT", "CAUTIONS"];

  var SCOPE_INSTRUCTIONS = {
    verse: "The user asked about specific verse(s). Focus tightly on those words: what they say, their immediate " +
      "literary context, key terms or images, and what they meant to the first audience. Do not summarize the whole book.",
    chapter: "The user asked about a whole chapter. Cover the chapter's structure and movement, its main themes, " +
      "and how it fits its section of the book. Do not drift into a summary of the whole book.",
    book: "The user asked about an entire book. Cover authorship and dating debates, structure, major themes, " +
      "and the historical circumstances of composition."
  };

  APP.synthesis = {
    buildPrompt: function (context, sources, packet) {
      var scope = context.scope || "book";
      var material = APP.passage.promptMaterial(packet);
      var passageText = context.passageText || APP.passage.focusText(packet);

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
        "Write a balanced, nonsectarian analysis.",
        "Do not invent quotations, sources, dates, or historical details.",
        "Do not treat a broad continent as a unified civilization.",
        "Distinguish a dated event from a long-running historical period.",
        "State uncertainty when dates, authorship, or relationships are disputed.",
        "",
        "SCOPE: " + scope.toUpperCase() + ". " + SCOPE_INSTRUCTIONS[scope],
        "Era: " + context.era.label + (context.bookSection ? " — " + context.bookSection : ""),
        "Date range: " + APP.utils.formatRange(context.start, context.end),
        "Bible reference: " + (context.reference ? context.reference.display : "[No Bible reference]"),
        "Passage text: " + (passageText || "[No passage text available]"),
        "",
        "ENCYCLOPEDIA NOTES FOR THIS " + scope.toUpperCase() + ":",
        material.notes,
        "",
        "RECEPTION AND INFLUENCE EVIDENCE:",
        material.reception,
        "",
        "LOCAL TIMELINE:",
        localEvents || "[No matching local events.]",
        "",
        "COLLECTED EVIDENCE:",
        evidence,
        "",
        "Return exactly these headings, each on its own line:",
        "BOTTOM LINE",
        "HISTORICAL SETTING",
        "ORIGINAL-SETTING CONTEXT",
        "SO WHAT",
        "CAUTIONS",
        "",
        "Under SO WHAT, explain how this " + scope + " shaped the wider region and later history, using short labeled paragraphs " +
          "or bullets: its effect on the original community; how Jewish and Christian traditions (and Islamic, where relevant) " +
          "interpreted and used it; its political, social, or cultural impact across the Near East, the Mediterranean, and beyond; " +
          "and its afterlife in liturgy, art, music, literature, or place names. Ground these points in the RECEPTION AND " +
          "INFLUENCE EVIDENCE, name specific examples from it, and say plainly when influence is indirect, debated, or modest.",
        "",
        "Keep the whole response below 1000 words."
      ].join("\n");
    },

    parse: function (text, fallback) {
      // Models often decorate headings ("## BOTTOM LINE", "**So What?**"); reduce them to bare headings.
      var normalized = APP.llm.stripThinking(text).replace(
        /^[#>\s*_]*(BOTTOM LINE|HISTORICAL SETTING|ORIGINAL-SETTING CONTEXT|SO WHAT|CAUTIONS)[\s*_:?]*$/gim,
        function (line, heading) {
          return heading.toUpperCase();
        }
      );

      function readSection(name) {
        var following = HEADINGS.slice(HEADINGS.indexOf(name) + 1);
        // "(?![\s\S])" is end-of-text; "$" would match every line end under the multiline flag.
        var next = following.length ? "(?=\\n(?:" + following.join("|") + ")\\s*\\n|(?![\\s\\S]))" : "(?![\\s\\S])";
        var expression = new RegExp("^" + name + "\\s*\\n([\\s\\S]*?)" + next, "im");
        var match = normalized.match(expression);
        return match ? match[1].trim() : "";
      }

      function plain(value) {
        return value.replace(/\*\*/g, "");
      }

      var soWhat = readSection("SO WHAT");

      return {
        source: "AI synthesis with collected evidence",
        bluf: plain(readSection("BOTTOM LINE")) || fallback.bluf,
        historicalSetting: plain(readSection("HISTORICAL SETTING")) || fallback.historicalSetting,
        application: plain(readSection("ORIGINAL-SETTING CONTEXT")) || fallback.application,
        soWhat: soWhat || fallback.soWhat,
        soWhatFromModel: Boolean(soWhat),
        notes: plain(readSection("CAUTIONS")) || fallback.notes
      };
    }
  };
}());
