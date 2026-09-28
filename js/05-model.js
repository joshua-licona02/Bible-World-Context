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

    buildBibleContext: function (reference, passageText) {
      var era = APP.data.eras[reference.book.eraId];
      var events = APP.sources.getLocalEvents(era.start, era.end, "All", "All");

      return {
        type: "bible",
        reference: reference,
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

    buildFallbackAnalysis: function (context) {
      var eventCount = context.biblicalEvents.length + context.worldEvents.length;
      var scope = APP.utils.formatRange(context.start, context.end);
      var regionText = context.regionalRequest
        ? " The selected geographic scope is " + context.regionalRequest.region + " within " + context.regionalRequest.continent + "."
        : "";

      return {
        source: "Local historical context engine",
        bluf:
          context.era.label + " spans approximately " + scope + "." +
          regionText + " The embedded timeline found " + eventCount + " relevant event records.",

        historicalSetting:
          context.era.summary +
          " The timeline is a curated starting point, not a complete historical record. " +
          "Use research mode and source review when greater detail is required.",

        application:
          context.type === "bible"
            ? "Read the selected Biblical passage first in its literary setting within " +
              context.reference.book.name + ". Then consider the political, social, religious, and geographic conditions represented by the historical timeline. " +
              (context.passageText
                ? "Passage text was supplied, so Ollama can provide a more passage-specific synthesis if enabled."
                : "No passage text was supplied, so this result remains reference-and-era level.")
            : "Use this regional view to compare contemporaneous developments without assuming direct contact or causal influence between distant regions. " +
              "Long-running periods should be distinguished from specific events, and date precision should not exceed the available evidence.",

        notes:
          "Dates in the embedded dataset are approximate and selectively curated. A continent is a broad modern organizing label; use the subregion filter for more historically precise research."
      };
    }
  };
}());