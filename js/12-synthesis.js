(function () {
  "use strict";

  var HEADINGS = ["BOTTOM LINE", "HISTORICAL SETTING", "ORIGINAL-SETTING CONTEXT", "WORLD CONNECTIONS", "CAUTIONS"];

  var SCOPE_INSTRUCTIONS = {
    verse: "The user asked about specific verse(s). Focus on those words and their immediate context. Do not summarize the whole book.",
    chapter: "The user asked about a whole chapter. Cover the chapter's movement and how it fits its section of the book.",
    book: "The user asked about an entire book. Cover authorship, date, and the historical circumstances of its writing."
  };

  var PERSPECTIVES = {
    baptist: "INTERPRETIVE LENS: Where you interpret the passage, do so from a conservative Baptist perspective consistent with " +
      "the Baptist Faith and Message (2000): Scripture is divinely inspired, true, and authoritative. Lean on the Tyndale " +
      "study notes for interpretation.",
    evangelical: "INTERPRETIVE LENS: Where you interpret the passage, do so from a broadly evangelical perspective that holds " +
      "Scripture to be inspired and authoritative. Lean on the Tyndale study notes for interpretation.",
    academic: "INTERPRETIVE LENS: Write as a nonsectarian historian. Describe religious interpretations without endorsing them."
  };

  var SOURCE_RULES = "SOURCE RULES: Use only the facts in the material below; do not add events, people, dates, works, or quotations " +
    "that are not in it. Historical facts may come from any listed source, but say which. When a claim reflects critical " +
    "scholarship (for example late dating or multiple authorship), label it \"(critical view)\" and give the traditional view " +
    "alongside it. Refer to Scripture by exact reference (e.g. Acts 17:2).";

  APP.synthesis = {
    perspectives: PERSPECTIVES,

    buildPrompt: function (context, sources, packet, perspective) {
      var scope = context.scope || "book";
      var lens = PERSPECTIVES[perspective] ? perspective : "baptist";
      var material = APP.passage.promptMaterial(packet, context);
      var passageText = context.passageText || APP.passage.focusText(packet);

      var evidence = sources.length
        ? sources.map(function (source) {
          return "- SOURCE: " + source.title + " (" + source.sourceType + "): " + source.excerpt;
        }).join("\n")
        : "[No external sources collected.]";

      return [
        "You are a careful Bible and history research assistant. The goal is to show how Biblical history fits within " +
          "world history, and how the events of the wider world shaped the beginning and growth of Christianity.",
        "Write with substance: specific names, places, dates, and Scripture references rather than generalities.",
        "Do not treat a broad continent as a unified civilization. Distinguish dated events from long periods.",
        "",
        PERSPECTIVES[lens],
        SOURCE_RULES,
        "",
        "SCOPE: " + scope.toUpperCase() + ". " + SCOPE_INSTRUCTIONS[scope],
        "Era: " + context.era.label + (context.bookSection ? " — " + context.bookSection : ""),
        "Date range: " + APP.utils.formatRange(context.start, context.end),
        "Bible reference: " + (context.reference ? context.reference.display : "[No Bible reference]"),
        "Passage text" + (packet && packet.passage ? " (" + packet.passage.translation + ")" : "") + ": " +
          (passageText || "[No passage text available]"),
        "",
        "COMMENTARY AND STUDY NOTES:",
        material.commentary,
        "",
        "HISTORICAL DEVELOPMENTS THAT SHAPED CHRISTIANITY'S GROWTH (curated, with sources):",
        material.growth,
        "",
        "WORLD EVENTS IN THIS ERA:",
        material.world,
        "",
        "GENERAL REFERENCE (Wikipedia; historical background):",
        material.reference,
        "",
        "COLLECTED EVIDENCE:",
        evidence,
        "",
        "Return exactly these headings, each on its own line:",
        "BOTTOM LINE",
        "HISTORICAL SETTING",
        "ORIGINAL-SETTING CONTEXT",
        "WORLD CONNECTIONS",
        "CAUTIONS",
        "",
        "Under WORLD CONNECTIONS, use these bolded sub-headings, each with a substantive paragraph:",
        "**The world at this time** — the empires, peoples, and events surrounding the passage, from WORLD EVENTS and the developments.",
        "**How the wider world shaped this passage** — how those powers and conditions bear on what the passage says or describes.",
        "**How this era shaped Christianity's growth** — using the HISTORICAL DEVELOPMENTS by name, explain how this era's " +
          "conditions prepared for, carried, or tested the spread of Christianity. For Old Testament eras, explain what it set in " +
          "motion for the later church. Cite the Scripture references given with each development.",
        "Name only developments and events listed above, and say plainly when a connection is indirect or debated.",
        "",
        "Keep the whole response below 1100 words."
      ].join("\n");
    },

    parse: function (text, fallback) {
      // Models often decorate headings ("## BOTTOM LINE", "**World Connections:**"); reduce them to bare headings.
      var normalized = APP.llm.stripThinking(text).replace(
        /^[#>\s*_]*(BOTTOM LINE|HISTORICAL SETTING|ORIGINAL-SETTING CONTEXT|WORLD CONNECTIONS|CAUTIONS)[\s*_:?]*$/gim,
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

      var connections = readSection("WORLD CONNECTIONS");

      return {
        source: "AI synthesis with collected evidence",
        bluf: plain(readSection("BOTTOM LINE")) || fallback.bluf,
        historicalSetting: plain(readSection("HISTORICAL SETTING")) || fallback.historicalSetting,
        application: plain(readSection("ORIGINAL-SETTING CONTEXT")) || fallback.application,
        connections: connections || fallback.connections,
        connectionsFromModel: Boolean(connections),
        notes: plain(readSection("CAUTIONS")) || fallback.notes
      };
    }
  };
}());
