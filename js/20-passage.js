(function () {
  "use strict";

  var WIKI_API = "https://en.wikipedia.org/w/api.php";
  var BIBLE_API = "https://bible-api.com/";

  var SKIP_HEADINGS = /^(text|textual witnesses|parashot|see also|references|notes|citations|bibliography|external links|further reading|sources|explanatory notes|footnotes|jewish|christian|historical english)$/i;
  var ABOUT_HEADINGS = /structure|summary|outline|contents|composition|authorship|dating|date|historical (context|background|setting)|background|setting|themes?|theology|purpose|overview|general presentation|genre|audience|places/i;
  var LEGACY_HEADINGS = /influence|interpretation|reception|legacy|uses? in|in (judaism|christianity|islam|the new testament)|liturgy|liturgical|hermeneutics|impact|significance|music|in (art|culture|literature|popular culture)|commemorat|tradition/i;

  var esc = function (value) {
    return APP.utils.escapeHtml(value);
  };

  function wikiUrl(title) {
    return "https://en.wikipedia.org/wiki/" + encodeURIComponent(String(title).replace(/ /g, "_"));
  }

  function bookTitle(book) {
    return APP.data.wikiBookTitles[book] || "Book of " + book;
  }

  function chapterTitle(book, chapter) {
    return (book === "Psalms" ? "Psalm" : book) + " " + chapter;
  }

  // Full article as plain text with "== Heading ==" markers, split into an intro and sections.
  function fetchArticle(title, signal) {
    return APP.http.getJson(APP.http.buildUrl(WIKI_API, {
      action: "query",
      format: "json",
      formatversion: 2,
      origin: "*",
      prop: "extracts|pageprops",
      ppprop: "disambiguation",
      explaintext: 1,
      exsectionformat: "wiki",
      redirects: 1,
      titles: title
    }), { signal: signal }).then(function (data) {
      var page = data.query && data.query.pages && data.query.pages[0];
      if (!page || page.missing || !page.extract || (page.pageprops && page.pageprops.disambiguation !== undefined)) {
        return null;
      }

      var parts = page.extract.split(/^(={2,5})\s*(.+?)\s*\1\s*$/m);
      var sections = [];
      var parents = [];
      for (var index = 1; index < parts.length; index += 3) {
        var level = parts[index].length;
        var heading = parts[index + 1];
        parents = parents.slice(0, level - 2);
        sections.push({
          heading: heading,
          level: level,
          parents: parents.slice(),
          text: String(parts[index + 2] || "").trim()
        });
        parents[level - 2] = heading;
      }

      return {
        title: page.title,
        url: wikiUrl(page.title),
        intro: String(parts[0] || "").trim(),
        sections: sections.filter(function (section) {
          return !SKIP_HEADINGS.test(section.heading) && !section.parents.some(function (parent) {
            return SKIP_HEADINGS.test(parent);
          });
        })
      };
    });
  }

  // "Isaiah 41:4-10" style passages from bible-api.com (World English Bible, public domain).
  function fetchPassage(query, signal) {
    return APP.http.getJson(BIBLE_API + encodeURIComponent(query).replace(/%20/g, "+") + "?translation=web", {
      signal: signal,
      retries: 1
    }).then(function (data) {
      return {
        reference: data.reference,
        translation: data.translation_name || "World English Bible",
        verses: (data.verses || []).map(function (verse) {
          return { chapter: verse.chapter, verse: verse.verse, text: String(verse.text || "").replace(/\s+/g, " ").trim() };
        })
      };
    });
  }

  // Articles that quote the passage: hymns, cantatas, mottos, place names, and so on.
  function fetchCitations(phrase, signal) {
    return APP.http.getJson(APP.http.buildUrl(WIKI_API, {
      action: "query",
      format: "json",
      origin: "*",
      list: "search",
      srlimit: 12,
      srsearch: "\"" + phrase + "\""
    }), { signal: signal }).then(function (data) {
      var query = data.query || {};
      return {
        phrase: phrase,
        total: query.searchinfo ? query.searchinfo.totalhits : 0,
        items: (query.search || []).map(function (item) {
          return {
            title: item.title,
            snippet: String(item.snippet || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(),
            url: wikiUrl(item.title)
          };
        })
      };
    });
  }

  // Parses "(1:16–8:39)", "(5–11)", "chapters 40–55" into a chapter span.
  function chapterSpan(text) {
    var match = String(text).match(/\(?\b(?:chapters?\s+)?(\d{1,3})(?::\d+)?\s*[–-]\s*(\d{1,3})(?::\d+)?\)?/i);
    if (!match) {
      return null;
    }
    var first = Number(match[1]);
    var second = Number(match[2]);
    return second >= first ? { start: first, end: second } : { start: first, end: first };
  }

  function sentences(text) {
    return String(text).split(/(?<=[.!?])\s+(?=[A-Z"“(])/);
  }

  // Where a chapter sits in the book: outline headings covering it, plus sentences naming a covering range.
  function placement(bookArticle, chapter) {
    if (!bookArticle) {
      return [];
    }

    var found = [];
    bookArticle.sections.forEach(function (section) {
      var span = chapterSpan(section.heading);
      if (span && chapter >= span.start && chapter <= span.end && span.end - span.start < 60) {
        found.push({ heading: section.heading, text: APP.utils.truncate(section.text, 600) });
      }
    });

    bookArticle.sections.concat([{ heading: "Introduction", text: bookArticle.intro }]).forEach(function (section) {
      if (!ABOUT_HEADINGS.test(section.heading) && section.heading !== "Introduction") {
        return;
      }
      sentences(section.text).forEach(function (sentence) {
        var pattern = /chapters?\s+(\d{1,3})\s*[–-]\s*(\d{1,3})/gi;
        var match;
        while ((match = pattern.exec(sentence))) {
          if (chapter >= Number(match[1]) && chapter <= Number(match[2]) && found.length < 6 &&
            !found.some(function (item) { return item.text === sentence; })) {
            found.push({ heading: section.heading, text: sentence });
          }
        }
      });
    });

    return found.slice(0, 6);
  }

  function verseNotes(chapterArticle, start, end) {
    if (!chapterArticle) {
      return [];
    }
    return chapterArticle.sections.filter(function (section) {
      var match = section.heading.match(/^verses?\s+(\d+)(?:\s*[–-]\s*(\d+))?/i);
      if (!match) {
        return false;
      }
      var first = Number(match[1]);
      var last = match[2] ? Number(match[2]) : first;
      return first <= end && last >= start && section.text.length > 20;
    }).map(function (section) {
      return { heading: section.heading, text: section.text };
    });
  }

  function legacySections(article) {
    if (!article) {
      return [];
    }
    // Subsections inherit legacy status from their parent ("Later interpretation and influence" > "Christianity").
    return article.sections.filter(function (section) {
      return section.text.length > 60 && [section.heading].concat(section.parents).some(function (heading) {
        return LEGACY_HEADINGS.test(heading);
      });
    }).map(function (section) {
      var parent = section.parents[section.parents.length - 1];
      var label = parent && !LEGACY_HEADINGS.test(section.heading) ? parent + ": " + section.heading : section.heading;
      return { source: article.title, url: article.url, heading: label, text: section.text };
    });
  }

  function aboutSections(article) {
    if (!article) {
      return [];
    }
    return article.sections.filter(function (section) {
      var heads = [section.heading].concat(section.parents);
      return section.text.length > 60 && !/^verses?\s+\d/i.test(section.heading) &&
        heads.some(function (heading) { return ABOUT_HEADINGS.test(heading); }) &&
        !heads.some(function (heading) { return LEGACY_HEADINGS.test(heading); });
    }).map(function (section) {
      var parent = section.parents[section.parents.length - 1];
      return {
        heading: parent && !ABOUT_HEADINGS.test(section.heading) ? parent + ": " + section.heading : section.heading,
        text: section.text
      };
    });
  }

  // Exact-phrase OpenAlex queries for the chapter and the book's reception. Works are kept only when the
  // title names the book, since abstracts mentioning a common name ("John") admit unrelated papers.
  function scholarship(book, chapterName, signal) {
    var stem = book.replace(/^\d\s+/, "").split(" ").pop().replace(/s$/, "");
    var mentions = new RegExp("\\b" + stem, "i");
    var queries = ["\"" + bookTitle(book) + "\" reception"];
    if (chapterName) {
      queries.unshift("\"" + chapterName + "\"");
    }

    return Promise.all(queries.map(function (query) {
      return APP.timelineProviders.searchScholarship(query, 8, signal).catch(function () {
        return [];
      });
    })).then(function (lists) {
      var seen = {};
      return [].concat.apply([], lists).filter(function (work) {
        var key = work.title.toLowerCase();
        if (seen[key] || !mentions.test(work.title)) {
          return false;
        }
        seen[key] = true;
        return true;
      }).slice(0, 6);
    });
  }

  function settle(promise) {
    return promise.catch(function (error) {
      if (APP.http.isAbort(error)) {
        throw error;
      }
      return null;
    });
  }

  APP.passage = {
    gather: function (reference, signal) {
      var scope = APP.model.scopeOf(reference);
      var book = reference.book.name;
      var chapter = reference.chapter;
      var start = reference.verseStart;
      var end = reference.verseEnd || start;
      var chapterName = chapter ? chapterTitle(book, chapter) : "";
      var passageQuery = scope === "verse"
        ? book + " " + chapter + ":" + Math.max(1, start - 3) + "-" + (end + 3)
        : scope === "chapter" ? book + " " + chapter : "";
      var citationPhrase = scope === "verse"
        ? chapterName + ":" + start + (end !== start ? "-" + end : "")
        : scope === "chapter" ? chapterName : "";

      // Passages that run past the chapter end make the context request fail; fall back to the exact verses.
      var passage = passageQuery
        ? fetchPassage(passageQuery, signal).catch(function (error) {
          if (APP.http.isAbort(error) || scope !== "verse") {
            throw error;
          }
          return fetchPassage(book + " " + chapter + ":" + start + (end !== start ? "-" + end : ""), signal);
        })
        : Promise.resolve(null);

      return Promise.all([
        settle(fetchArticle(bookTitle(book), signal)),
        scope !== "book" ? settle(fetchArticle(chapterName, signal)) : Promise.resolve(null),
        settle(passage),
        citationPhrase ? settle(fetchCitations(citationPhrase, signal)) : Promise.resolve(null),
        settle(scholarship(book, scope === "book" ? "" : chapterName, signal))
      ]).then(function (results) {
        var bookArticle = results[0];
        var chapterArticle = results[1];
        var text = results[2];

        if (text) {
          text.verses.forEach(function (verse) {
            verse.focus = scope !== "verse" || (verse.chapter === chapter && verse.verse >= start && verse.verse <= end);
          });
        }

        return {
          scope: scope,
          display: reference.display,
          book: book,
          chapter: chapter,
          verseStart: start,
          verseEnd: end,
          passage: text,
          bookArticle: bookArticle,
          bookAbout: aboutSections(bookArticle),
          chapterArticle: chapterArticle,
          chapterAbout: aboutSections(chapterArticle),
          placement: scope !== "book" ? placement(bookArticle, chapter) : [],
          verseNotes: scope === "verse" ? verseNotes(chapterArticle, start, end) : [],
          legacy: legacySections(scope === "book" ? bookArticle : chapterArticle)
            .concat(scope === "book" ? [] : legacySections(bookArticle).slice(0, 2)),
          citations: results[3],
          works: results[4] || []
        };
      });
    },

    focusText: function (packet) {
      if (!packet || !packet.passage) {
        return "";
      }
      return packet.passage.verses.filter(function (verse) {
        return verse.focus;
      }).map(function (verse) {
        return verse.verse + " " + verse.text;
      }).join(" ");
    },

    // Condensed scope-specific material for the model prompt.
    promptMaterial: function (packet) {
      if (!packet) {
        return { notes: "[Passage research unavailable.]", reception: "[None collected.]" };
      }

      var notes = [];
      var add = function (label, text, limit) {
        if (text) {
          notes.push(label + ": " + APP.utils.truncate(text, limit));
        }
      };

      if (packet.scope === "verse") {
        packet.verseNotes.forEach(function (note) { add("Encyclopedia note (" + note.heading + ")", note.text, 900); });
        add("Chapter overview", packet.chapterArticle && packet.chapterArticle.intro, 700);
        packet.placement.slice(0, 2).forEach(function (item) { add("Place in the book (" + item.heading + ")", item.text, 400); });
      } else if (packet.scope === "chapter") {
        add("Chapter overview", packet.chapterArticle && packet.chapterArticle.intro, 1200);
        packet.chapterAbout.slice(0, 3).forEach(function (item) { add("Chapter " + item.heading, item.text, 600); });
        packet.placement.slice(0, 3).forEach(function (item) { add("Place in the book (" + item.heading + ")", item.text, 400); });
      } else {
        add("Book overview", packet.bookArticle && packet.bookArticle.intro, 1200);
        packet.bookAbout.slice(0, 5).forEach(function (item) { add(item.heading, item.text, 700); });
      }

      var reception = packet.legacy.slice(0, 4).map(function (item) {
        return "- " + item.source + " — " + item.heading + ": " + APP.utils.truncate(item.text, 700);
      });
      if (packet.citations && packet.citations.items.length) {
        reception.push("- Quoted or referenced in " + packet.citations.total + " encyclopedia articles, including: " +
          packet.citations.items.filter(function (item) {
            return !packet.chapterArticle || item.title !== packet.chapterArticle.title;
          }).slice(0, 10).map(function (item) { return item.title; }).join("; ") + ".");
      }
      packet.works.slice(0, 5).forEach(function (work) {
        reception.push("- Scholarship: " + work.title + (work.meta ? " (" + work.meta + ")" : ""));
      });

      return {
        notes: notes.join("\n") || "[No encyclopedia notes found for this passage.]",
        reception: reception.join("\n") || "[No reception evidence collected.]"
      };
    }
  };

  // ---------- Rendering ----------

  var SCOPE_LABELS = {
    verse: "Verse focus: the words themselves, their immediate context, and notes on this verse.",
    chapter: "Chapter focus: the full chapter, its structure, and where it sits in the book.",
    book: "Book focus: authorship, date, structure, and major themes of the whole book."
  };

  function details(title, text, open) {
    return '<details class="passage-details"' + (open ? " open" : "") + "><summary>" + esc(title) + "</summary>" +
      APP.utils.textToParagraphs(APP.utils.truncate(text, 2400)) + "</details>";
  }

  function sourceLink(article) {
    return article
      ? '<a class="source-link" href="' + esc(article.url) + '" target="_blank" rel="noopener noreferrer">' + esc(article.title) + " (Wikipedia)</a>"
      : "";
  }

  function passageHtml(packet) {
    if (!packet.passage || !packet.passage.verses.length) {
      return "";
    }

    var verses = packet.passage.verses;
    var body = verses.map(function (verse) {
      return '<span class="verse' + (verse.focus ? " verse-focus" : "") + '"><sup>' + verse.verse + "</sup>" + esc(verse.text) + "</span>";
    }).join(" ");

    return '<blockquote class="passage-text' + (packet.scope === "chapter" ? " passage-chapter" : "") + '">' + body + "</blockquote>" +
      '<p class="field-help">' + esc(packet.passage.translation) + " (public domain), via bible-api.com" +
      (packet.scope === "verse" && verses.some(function (verse) { return !verse.focus; })
        ? ". Surrounding verses are shown dimmed for context." : ".") + "</p>";
  }

  APP.passageView = {
    // Links names in model output that match collected evidence (quoting articles, influence sections,
    // scholarship), so backed examples are distinguishable from the model's general knowledge.
    linkEvidence: function (container, packet) {
      if (!container || !packet) {
        return 0;
      }

      var items = [];
      if (packet.citations) {
        packet.citations.items.forEach(function (item) {
          items.push({ name: item.title.replace(/,\s*BWV.*$/, "").replace(/\s*\([^)]*\)$/, ""), url: item.url });
        });
      }
      packet.works.forEach(function (work) {
        items.push({ name: work.title, url: APP.utils.safeUrl(work.url) });
      });

      // Names that merely restate the passage ("Isaiah 41") would be circular evidence.
      var passageNames = [packet.display, packet.chapterArticle && packet.chapterArticle.title, packet.bookArticle && packet.bookArticle.title]
        .filter(Boolean).map(function (name) { return name.toLowerCase(); });
      var seen = {};
      var count = 0;
      items.filter(function (item) {
        var key = item.name.toLowerCase();
        var circular = passageNames.some(function (name) {
          return name === key || name.indexOf(key) === 0;
        });
        if (!item.url || circular || seen[key] || item.name.length < 6 || item.name.length > 80) {
          return false;
        }
        seen[key] = true;
        return true;
      }).forEach(function (item) {
        var pattern = new RegExp("\\b" + item.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
        var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
        var node;
        while ((node = walker.nextNode())) {
          if (node.parentElement.closest("a, button")) {
            continue;
          }
          var match = node.nodeValue.match(pattern);
          if (!match) {
            continue;
          }
          var mention = node.splitText(match.index);
          mention.splitText(match[0].length);
          var link = document.createElement("a");
          link.className = "evidence-link";
          link.href = item.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.title = "Backed by a collected source";
          link.textContent = match[0];
          mention.parentNode.replaceChild(link, mention);
          count += 1;
          break;
        }
      });

      return count;
    },

    buildFocus: function (packet, context) {
      if (!packet) {
        return '<div class="narrative-card"><p>Passage research was unavailable. Check your connection and try again.</p></div>';
      }

      var parts = [
        '<div class="scope-row"><span class="scope-pill scope-' + packet.scope + '">' + packet.scope.toUpperCase() + "</span>" +
          '<span class="field-help">' + esc(SCOPE_LABELS[packet.scope]) + "</span></div>"
      ];

      if (context && context.bookSection) {
        parts.push('<p class="scope-note">' + esc(context.bookSection) + (packet.scope === "book"
          ? ". The era below reflects the opening section; search a chapter for its own period."
          : ". The historical era below reflects this section, not the whole book.") + "</p>");
      }

      parts.push(passageHtml(packet));

      if (packet.scope === "verse") {
        parts.push(packet.verseNotes.length
          ? packet.verseNotes.map(function (note, index) {
            return details("Notes on " + note.heading.toLowerCase(), note.text, index === 0);
          }).join("")
          : '<p class="field-help">No verse-specific encyclopedia notes were found for ' + esc(packet.display) +
            "; the chapter context below still applies.</p>");
        if (packet.chapterArticle) {
          parts.push(details("Chapter context: " + packet.chapterArticle.title, packet.chapterArticle.intro, false));
        }
      }

      if (packet.scope === "chapter") {
        if (packet.chapterArticle) {
          parts.push(details("Chapter overview", packet.chapterArticle.intro, true));
          packet.chapterAbout.slice(0, 4).forEach(function (item) {
            parts.push(details(item.heading, item.text, false));
          });
        } else {
          parts.push('<p class="field-help">No dedicated encyclopedia article exists for this chapter; the book overview below applies.</p>');
        }
      }

      if (packet.scope !== "book" && packet.placement.length) {
        parts.push('<div class="passage-block"><h4>Place in the book</h4><ul class="evidence-list">' +
          packet.placement.map(function (item) {
            return "<li><strong>" + esc(item.heading) + ":</strong> " + esc(APP.utils.truncate(item.text, 320)) + "</li>";
          }).join("") + "</ul></div>");
      }

      if (packet.scope === "book") {
        if (packet.bookArticle) {
          parts.push(details("Book overview", packet.bookArticle.intro, true));
        }
        packet.bookAbout.slice(0, 6).forEach(function (item) {
          parts.push(details(item.heading, item.text, false));
        });
        parts.push('<p class="field-help">Tip: search a chapter (e.g. ' + esc(packet.book) + " 1) or a verse for passage-level detail.</p>");
      }

      parts.push('<p class="field-help">Sources: ' + [sourceLink(packet.chapterArticle), sourceLink(packet.bookArticle)].filter(Boolean).join(" · ") + "</p>");
      return parts.join("");
    },

    buildSoWhat: function (packet, analysisText, fromModel) {
      var parts = [];

      if (analysisText) {
        parts.push('<div class="ai-output">' + (fromModel ? APP.utils.renderMarkdown(analysisText) : APP.utils.textToParagraphs(analysisText)) + "</div>");
      }

      if (!packet) {
        return parts.join("");
      }

      var evidence = [];

      if (packet.citations && packet.citations.items.length) {
        var others = packet.citations.items.filter(function (item) {
          return !packet.chapterArticle || item.title !== packet.chapterArticle.title;
        });
        evidence.push('<div class="passage-block"><h4>Where "' + esc(packet.citations.phrase) + '" is quoted</h4>' +
          '<p class="field-help">Referenced in ' + packet.citations.total + " Wikipedia article" + (packet.citations.total === 1 ? "" : "s") +
          " — hymns, music, liturgy, place names, and more.</p><ul class=\"evidence-list\">" +
          others.slice(0, 8).map(function (item) {
            return '<li><a class="source-link" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">' + esc(item.title) + "</a>" +
              (item.snippet ? ' <span class="muted">— ' + esc(APP.utils.truncate(item.snippet, 140)) + "</span>" : "") + "</li>";
          }).join("") + "</ul></div>");
      }

      if (packet.legacy.length) {
        evidence.push('<div class="passage-block"><h4>Interpretation and influence</h4>' +
          packet.legacy.slice(0, 5).map(function (item, index) {
            return details(item.heading + " — " + item.source, item.text, index === 0 && !analysisText);
          }).join("") + "</div>");
      }

      if (packet.works.length) {
        evidence.push('<div class="passage-block"><h4>Scholarship</h4><ul class="evidence-list">' +
          packet.works.map(function (work) {
            var url = APP.utils.safeUrl(work.url);
            return "<li>" + (url ? '<a class="source-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(work.title) + "</a>" : esc(work.title)) +
              (work.meta ? ' <span class="muted">' + esc(work.meta) + "</span>" : "") + "</li>";
          }).join("") + "</ul></div>");
      }

      if (evidence.length) {
        parts.push('<details class="passage-details evidence-group"' + (analysisText ? "" : " open") + "><summary>Evidence behind this section</summary>" +
          evidence.join("") + "</details>");
      }

      return parts.join("") || '<p class="muted">No influence or reception evidence was found for this passage.</p>';
    }
  };
}());
