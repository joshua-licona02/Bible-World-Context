(function () {
  "use strict";

  APP.model = {
    parseReference: function (input) {
      var normalized = APP.clean.normalizeReference(input);
      var lower = normalized.toLowerCase();
      var matchedBook = null;
      var matchedText = "";

      APP.data.books
        .slice()
        .sort(function (a, b) {
          return b.name.length - a.name.length;
        })
        .some(function (book) {
          if (lower.indexOf(book.name.toLowerCase()) === 0) {
            matchedBook = book;
            matchedText = book.name;
            return true;
          }
          return false;
        });

      if (!matchedBook) {
        Object.keys(APP.data.aliases)
          .sort(function (a, b) {
            return b.length - a.length;
          })
          .some(function (alias) {
            if (lower.indexOf(alias) === 0) {
              var canonical = APP.data.aliases[alias];
              matchedBook = APP.data.books.filter(function (book) {
                return book.name === canonical;
              })[0];
              matchedText = alias;
              return true;
            }
            return false;
          });
      }

      if (!matchedBook) {
        return {
          valid: false,
          error: "Book not recognized. Use a canonical book name or a common abbreviation, such as John 19, Gen 12, or 1 Cor 13."
        };
      }

      var remaining = normalized.slice(matchedText.length).trim();
      var referencePattern = /^(\d+)?(?:\s*:\s*(\d+)(?:\s*-\s*(\d+))?)?(?:\s*-\s*(\d+)(?::(\d+))?)?$/;
      var match = remaining ? remaining.match(referencePattern) : null;

      if (remaining && !match) {
        return {
          valid: false,
          error: "The book was recognized, but the passage format was not. Use John 3:16, Daniel 6, or 1 Kings 18:20-39."
        };
      }

      return {
        valid: true,
        raw: normalized,
        display: matchedBook.name + (remaining ? " " + remaining : ""),
        book: matchedBook,
        chapter: match && match[1] ? Number(match[1]) : null,
        verseStart: match && match[2] ? Number(match[2]) : null,
        verseEnd: match && match[3] ? Number(match[3]) : null
      };
    },

    scopeOf: function (reference) {
      return reference.verseStart ? "verse" : reference.chapter ? "chapter" : "book";
    },

    // Chapter-level references can sit in a different era than the book as a whole (e.g. Isaiah 40–55).
    chapterSection: function (reference) {
      var ranges = APP.data.chapterEras[reference.book.name];
      if (!ranges || !reference.chapter) {
        return null;
      }
      var match = ranges.filter(function (range) {
        return reference.chapter >= range[0] && reference.chapter <= range[1];
      })[0];
      return match ? { eraId: match[2], note: match[3] } : null;
    },

    buildBibleContext: function (reference, passageText) {
      var section = APP.model.chapterSection(reference);
      var era = APP.data.eras[section ? section.eraId : reference.book.eraId];
      var ranges = APP.data.chapterEras[reference.book.name];

      // A whole-book search on a multi-era book keeps the book's default era but says what else it spans.
      if (!section && ranges) {
        section = {
          note: "This book spans several periods — " + ranges.map(function (range) {
            return range[3];
          }).join("; ")
        };
      }
      var events = APP.sources.getLocalEvents(era.start, era.end, "All", "All");

      return {
        type: "bible",
        reference: reference,
        scope: APP.model.scopeOf(reference),
        bookSection: section ? section.note : "",
        passageText: APP.clean.normalizePassageText(passageText),
        era: era,
        start: era.start,
        end: era.end,
        biblicalEvents: events.filter(function (event) {
          return event.domain === "Biblical";
        }),
        worldEvents: events.filter(function (event) {
          return event.domain !== "Biblical";
        })
      };
    },

    buildRegionalContext: function (request) {
      var events = APP.sources.getLocalEvents(
        request.start,
        request.end,
        request.continent,
        request.region
      );

      return {
        type: "regional",
        reference: null,
        passageText: "",
        era: {
          label: request.label,
          start: request.start,
          end: request.end,
          summary: request.description
        },
        start: request.start,
        end: request.end,
        regionalRequest: request,
        biblicalEvents: events.filter(function (event) {
          return event.domain === "Biblical";
        }),
        worldEvents: events.filter(function (event) {
          return event.domain !== "Biblical";
        })
      };
    },

    // Scope-aware opening line built from the passage research, when available.
    describePassage: function (context, packet) {
      if (context.type !== "bible" || !packet) {
        return "";
      }

      var firstSentence = function (text) {
        return String(text || "").split(/(?<=[.!?])\s+/)[0];
      };

      if (packet.scope === "verse") {
        var words = APP.passage.focusText(packet);
        var note = packet.verseNotes[0];
        return context.reference.display + (words ? " reads: \"" + APP.utils.truncate(words.replace(/^\d+\s/, ""), 260) + "\"" : "") +
          (note ? " " + APP.utils.truncate(firstSentence(note.text), 260) : "") +
          (packet.chapterArticle ? " " + firstSentence(packet.chapterArticle.intro) : "");
      }

      if (packet.scope === "chapter") {
        return packet.chapterArticle
          ? APP.utils.truncate(packet.chapterArticle.intro, 520)
          : context.reference.display + " is a chapter of " + context.reference.book.name + ".";
      }

      return packet.bookArticle ? APP.utils.truncate(packet.bookArticle.intro, 520) : "";
    },

    fallbackSoWhat: function (packet) {
      if (!packet) {
        return "";
      }

      var lines = [];
      if (packet.citations && packet.citations.total) {
        var examples = packet.citations.items.filter(function (item) {
          return !packet.chapterArticle || item.title !== packet.chapterArticle.title;
        }).slice(0, 5).map(function (item) { return item.title; });
        lines.push("\"" + packet.citations.phrase + "\" is quoted or referenced in " + packet.citations.total +
          " Wikipedia articles" + (examples.length ? ", including " + examples.join("; ") : "") + ".");
      }
      packet.legacy.slice(0, 2).forEach(function (item) {
        lines.push(item.heading + " (" + item.source + "): " + APP.utils.truncate(item.text, 420));
      });
      if (!lines.length) {
        return "No reception or influence evidence was collected for this passage. Enable AI synthesis for an interpretive overview.";
      }
      lines.push("Enable AI synthesis for an interpretive account of how this passage shaped the wider region.");
      return lines.join("\n\n");
    },

    buildFallbackAnalysis: function (context, packet) {
      var eventCount = context.biblicalEvents.length + context.worldEvents.length;
      var scope = APP.utils.formatRange(context.start, context.end);
      var regionText = context.regionalRequest
        ? " The selected geographic scope is " + context.regionalRequest.region + " within " + context.regionalRequest.continent + "."
        : "";
      var passageLine = APP.model.describePassage(context, packet);

      return {
        source: "Local historical context engine",
        soWhat: APP.model.fallbackSoWhat(packet),
        soWhatFromModel: false,
        bluf:
          (passageLine ? passageLine + "\n\n" : "") +
          context.era.label + (context.bookSection ? " (" + context.bookSection + ")" : "") +
          " spans approximately " + scope + "." +
          regionText + " The embedded timeline found " + eventCount + " relevant event records.",

        historicalSetting:
          context.era.summary +
          " The timeline is a curated starting point, not a complete historical record. " +
          "Use research mode and source review when greater detail is required.",

        application:
          context.type === "bible"
            ? "Read the selected Biblical passage first in its literary setting within " +
              context.reference.book.name + ". Then consider the political, social, religious, and geographic conditions represented by the historical timeline. " +
              (context.passageText || (packet && packet.passage)
                ? "The passage text is available, so AI synthesis (if enabled) can give a passage-specific reading."
                : "No passage text was available, so this result remains reference-and-era level.")
            : "Use this regional view to compare contemporaneous developments without assuming direct contact or causal influence between distant regions. " +
              "Long-running periods should be distinguished from specific events, and date precision should not exceed the available evidence.",

        notes:
          "Dates in the embedded dataset are approximate and selectively curated. A continent is a broad modern organizing label; use the subregion filter for more historically precise research."
      };
    }
  };
}());