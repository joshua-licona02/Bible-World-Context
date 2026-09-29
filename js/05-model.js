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

    // Scope-aware opening built from the passage research: the words, then what they meant.
    describePassage: function (context, packet) {
      if (context.type !== "bible" || !packet) {
        return "";
      }

      var lead = APP.passage.firstSentences;
      var parts = [];

      if (packet.scope === "verse") {
        var words = APP.passage.focusText(packet).replace(/^\d+\s/, "").replace(/\s\d+\s/g, " ");
        if (words) {
          parts.push(context.reference.display + " (" + packet.passage.translation + "): \"" + APP.utils.truncate(words, 320) + "\"");
        }
        var note = packet.notes.filter(function (item) {
          return item.first <= packet.verseStart && item.last >= packet.verseStart;
        }).pop();
        if (note) {
          parts.push("Tyndale notes: " + lead(note.text, 2));
        }
        if (packet.gill[0]) {
          parts.push("Gill (Baptist): " + lead(packet.gill[0].text.replace(/^[^.]*\.{3,4}\s*/, ""), 2));
        }
      } else if (packet.scope === "chapter") {
        var summary = packet.notes.filter(function (item) {
          return item.last > item.first;
        }).slice(0, 4).map(function (item) {
          return item.range + " " + lead(item.text, 1);
        });
        if (summary.length) {
          parts.push("How " + context.reference.display + " unfolds (Tyndale notes):\n" + summary.join("\n"));
        } else if (packet.chapterArticle) {
          parts.push(lead(packet.chapterArticle.intro, 3) + " (general reference)");
        }
      } else if (packet.tyndaleIntro) {
        parts.push(lead(packet.tyndaleIntro.intro, 3) + " (Tyndale notes)");
      } else if (packet.bookArticle) {
        parts.push(lead(packet.bookArticle.intro, 3) + " (general reference)");
      }

      return parts.join("\n\n");
    },

    // Without a model, "So what?" is assembled from Scripture cross-references, Baptist commentary,
    // evangelical notes, and cultural references, each attributed.
    fallbackSoWhat: function (packet) {
      if (!packet) {
        return "";
      }

      var lead = APP.passage.firstSentences;
      var lines = [];

      if (packet.crossRefs.length) {
        lines.push("Through the rest of Scripture: " + packet.display + " is most often read alongside " +
          packet.crossRefs.slice(0, 5).map(function (ref) { return ref.reference; }).join(", ") +
          " (OpenBible cross-references). See the passages below.");
      }
      if (packet.scope === "chapter" && packet.gillIntro) {
        lines.push("Baptist commentary (John Gill, introducing the chapter): " + APP.utils.truncate(lead(packet.gillIntro, 3), 600));
      } else if (packet.scope !== "book" && packet.gill.length) {
        lines.push("Baptist commentary (John Gill, on verse " + packet.gill[0].verse + "): " +
          APP.utils.truncate(lead(packet.gill[0].text.replace(/^[^.]*\.{3,4}\s*/, ""), 3), 600));
      }
      if (packet.message) {
        lines.push("The book's message (Tyndale notes): " + APP.utils.truncate(lead(packet.message.text, 3), 600));
      }
      if (packet.citations && packet.citations.items.length) {
        lines.push("In worship and culture: referenced in works such as " + packet.citations.items.slice(0, 4).map(function (item) {
          return item.title;
        }).join("; ") + " (general reference).");
      }

      if (!lines.length) {
        return "No influence evidence was collected for this passage.";
      }
      lines.push("Turn on AI synthesis for a fuller account of how this passage shaped its region, with these sources as evidence.");
      return lines.join("\n\n");
    },

    settingText: function (context, packet) {
      var lead = APP.passage.firstSentences;
      var parts = [context.era.summary];
      if (packet && packet.setting) {
        parts.push("Setting (Tyndale notes): " + APP.utils.truncate(lead(packet.setting.text, 4), 800));
      }
      if (packet && packet.tyndaleIntro) {
        packet.tyndaleIntro.sections.filter(function (section) {
          return /date of writing|^date/i.test(section.heading);
        }).slice(0, 1).forEach(function (section) {
          parts.push("Date of writing (Tyndale notes): " + APP.utils.truncate(lead(section.text, 3), 600));
        });
      }
      return parts.join("\n\n");
    },

    originalContextText: function (context, packet) {
      if (!packet) {
        return "Read the passage first in its literary setting within " + context.reference.book.name +
          ", then consider the political, social, and religious conditions of the era shown in the timeline.";
      }

      var lead = APP.passage.firstSentences;
      var parts = [];
      var historical = packet.notes.filter(function (note) {
        return /\b(\d{3,4}\s?BC|BC\b|AD\s?\d|king|empire|Babylon|Assyria|Persia|Rome|Roman|Egypt|city|temple|exile)/i.test(note.text);
      });

      (historical.length ? historical : packet.notes).slice(0, packet.scope === "verse" ? 3 : 4).forEach(function (note) {
        parts.push(note.range + " — " + APP.utils.truncate(lead(note.text, 3), 420));
      });
      if (packet.interpreting) {
        parts.push(packet.interpreting.heading + " (Tyndale notes): " + APP.utils.truncate(lead(packet.interpreting.text, 3), 600));
      }
      if (!parts.length && packet.scope === "book" && packet.tyndaleIntro) {
        packet.tyndaleIntro.sections.filter(function (section) {
          return /summary|author|recipients/i.test(section.heading);
        }).slice(0, 2).forEach(function (section) {
          parts.push(section.heading + " (Tyndale notes): " + APP.utils.truncate(lead(section.text, 3), 600));
        });
      }
      return parts.length ? parts.join("\n\n") + "\n\nSource: Tyndale Open Study Notes (evangelical)." :
        "No study notes were found for this passage.";
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

        historicalSetting: context.type === "bible"
          ? APP.model.settingText(context, packet)
          : context.era.summary +
            " The timeline is a curated starting point, not a complete historical record. " +
            "Use research mode and source review when greater detail is required.",

        application:
          context.type === "bible"
            ? APP.model.originalContextText(context, packet)
            : "Use this regional view to compare contemporaneous developments without assuming direct contact or causal influence between distant regions. " +
              "Long-running periods should be distinguished from specific events, and date precision should not exceed the available evidence.",

        notes:
          "Dates in the embedded dataset are approximate and selectively curated. A continent is a broad modern organizing label; use the subregion filter for more historically precise research."
      };
    }
  };
}());