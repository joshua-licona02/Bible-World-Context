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

  var PERSPECTIVES = {
    baptist: "INTERPRETIVE LENS: Write theological interpretation and application from a conservative Baptist perspective, " +
      "consistent with the Baptist Faith and Message (2000): Scripture is divinely inspired, true, and authoritative; " +
      "salvation is by grace through faith in Jesus Christ alone; the whole Bible points to Christ. Lean on the John Gill " +
      "(Baptist) commentary and the Tyndale study notes for interpretation. Mention Baptist distinctives (believer's baptism, " +
      "soul liberty, local church autonomy) only where the passage genuinely touches them.",
    evangelical: "INTERPRETIVE LENS: Write theological interpretation and application from a broadly evangelical perspective " +
      "that holds Scripture to be inspired and authoritative. Lean on the Tyndale study notes and the John Gill commentary.",
    academic: "INTERPRETIVE LENS: Write as a nonsectarian historian. Describe religious interpretations without endorsing them."
  };

  var SOURCE_RULES = "SOURCE RULES: Historical and archaeological facts may come from any source, but say where they come from. " +
    "When a claim reflects secular or critical scholarship (for example late dating or multiple authorship), label it " +
    "\"(critical view)\" and state the traditional view alongside it. Label Wikipedia material \"(general reference)\". " +
    "Quote or cite Gill as \"Gill\" and the study notes as \"Tyndale notes\". Refer to Scripture by exact reference (e.g. Romans 8:31).";

  APP.synthesis = {
    perspectives: PERSPECTIVES,

    buildPrompt: function (context, sources, packet, perspective) {
      var scope = context.scope || "book";
      var lens = PERSPECTIVES[perspective] ? perspective : "baptist";
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
        "You are a careful Bible and history research assistant.",
        "Write with substance: specific names, places, dates, and Scripture references rather than generalities.",
        "Do not invent quotations, sources, dates, or historical details.",
        "Do not treat a broad continent as a unified civilization.",
        "Distinguish a dated event from a long-running historical period.",
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
        "COMMENTARY AND STUDY NOTES (primary interpretive sources):",
        material.commentary,
        "",
        "CROSS-REFERENCES (where Scripture echoes this passage):",
        material.scripture,
        "",
        "GENERAL REFERENCE (Wikipedia; historical background only):",
        material.reference,
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
        "Under SO WHAT, use these bolded sub-headings, each with a substantive paragraph:",
        "**For the first audience** — what it meant to the people who first heard or read it, in their historical situation.",
        "**Through the rest of Scripture** — how later Scripture takes up its themes, citing the CROSS-REFERENCES by reference.",
        "**In church history and the wider region** — how Jewish and Christian communities (including Baptists, where evidenced) " +
          "used it, and its political, social, or cultural impact across the Near East, the Mediterranean, and beyond.",
        "**In worship and culture** — hymns, sermons, music, art, or place names, naming examples only from the RECEPTION AND INFLUENCE EVIDENCE.",
        "**For readers today** — application consistent with the interpretive lens.",
        "Say plainly when influence is indirect, debated, or modest.",
        "",
        "Keep the whole response below 1200 words."
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
