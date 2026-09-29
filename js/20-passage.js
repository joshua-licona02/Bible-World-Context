(function () {
  "use strict";

  var WIKI_API = "https://en.wikipedia.org/w/api.php";
  var FREE_BIBLE_API = "https://bible.helloao.org/api/";
  var ESV_API = "https://api.esv.org/v3/passage/text/";
  var API_BIBLE = "https://api.scripture.api.bible/v1/";

  var ESV_COPYRIGHT = "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), " +
    "© 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.";

  var SKIP_HEADINGS = /^(text|textual witnesses|parashot|see also|references|notes|citations|bibliography|external links|further reading|sources|explanatory notes|footnotes|jewish|christian|historical english)$/i;
  var ABOUT_HEADINGS = /structure|summary|outline|contents|composition|authorship|dating|date|historical (context|background|setting)|background|setting|purpose|overview|general presentation|genre|audience|places/i;
  var RECEPTION_HEADINGS = /influence|interpretation|reception|legacy|uses? in|liturgy|hermeneutics|music|in (art|culture|literature|popular culture)|tradition/i;

  // Where each kind of material comes from, shown next to it so readers can weigh it.
  var SOURCES = {
    tyndale: {
      label: "Evangelical study notes",
      detail: "Tyndale Open Study Notes (Tyndale House Publishers, CC BY-SA), quoted verbatim."
    },
    wikipedia: {
      label: "General reference",
      detail: "Wikipedia. Secular, community-edited reference used for historical background only."
    },
    curated: {
      label: "Curated history",
      detail: "Historical developments curated for this app, each with a linked source to verify it."
    }
  };

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

  function bookFromCode(code) {
    var usfm = APP.data.usfm;
    return Object.keys(usfm).filter(function (name) {
      return usfm[name] === code;
    })[0] || code;
  }

  function clean(text) {
    // Only trailing spaces are trimmed: blank lines mark section breaks in the Tyndale introductions.
    return APP.utils.fixMojibake(text).replace(/¶\s*/g, "").replace(/[ \t]+\n/g, "\n").trim();
  }

  function settle(promise) {
    return promise.catch(function (error) {
      if (APP.http.isAbort(error)) {
        throw error;
      }
      return null;
    });
  }

  function sentences(text) {
    return String(text).split(/(?<=[.!?])\s+(?=[A-Z"“(])/);
  }

  // ---------- Bible text: free translations, ESV, and API.Bible ----------

  function flattenContent(content) {
    return (content || []).map(function (part) {
      if (typeof part === "string") {
        return part;
      }
      if (part && part.text) {
        return part.text;
      }
      if (part && part.heading) {
        return part.heading;
      }
      return part && part.lineBreak ? "\n" : "";
    }).join(" ").replace(/ *\n */g, "\n").replace(/[ \t]+/g, " ");
  }

  // "[1] In the beginning… [2] The earth…" -> verse items (ESV and API.Bible plain-text formats).
  function parseNumberedText(text) {
    var parts = String(text || "").split(/\[(\d+)\]/);
    var items = [];
    for (var index = 1; index < parts.length; index += 2) {
      items.push({ type: "verse", verse: Number(parts[index]), text: parts[index + 1].replace(/\s+/g, " ").trim() });
    }
    return items;
  }

  function fetchFreeChapter(translation, code, chapter, signal) {
    return APP.http.getJson(FREE_BIBLE_API + translation + "/" + code + "/" + chapter + ".json", { signal: signal }).then(function (data) {
      var items = [];
      (data.chapter.content || []).forEach(function (item) {
        if (item.type === "heading") {
          items.push({ type: "heading", text: clean(flattenContent(item.content)) });
        } else if (item.type === "verse") {
          items.push({ type: "verse", verse: item.number, text: clean(flattenContent(item.content)).replace(/\n/g, " ") });
        }
      });
      return { translation: data.translation.name, copyright: "", items: items };
    });
  }

  // Licensed text is not cached, in keeping with the publishers' API terms.
  function fetchEsvChapter(code, chapter, signal) {
    var key = APP.state.bibleKeys.esv;
    if (!key) {
      return Promise.reject(new Error("Add your ESV API key in Settings to read the ESV."));
    }
    return APP.http.getJson(APP.http.buildUrl(ESV_API, {
      q: bookFromCode(code) + " " + chapter,
      "include-passage-references": "false",
      "include-verse-numbers": "true",
      "include-first-verse-numbers": "true",
      "include-footnotes": "false",
      "include-headings": "false",
      "include-short-copyright": "false"
    }), { signal: signal, cache: false, retries: 0, headers: { Authorization: "Token " + key } }).then(function (data) {
      return {
        translation: "English Standard Version (ESV)",
        copyright: ESV_COPYRIGHT,
        items: parseNumberedText((data.passages || [])[0])
      };
    });
  }

  function fetchApiBibleChapter(bibleId, label, code, chapter, signal) {
    var key = APP.state.bibleKeys.apiBible;
    if (!key) {
      return Promise.reject(new Error("Add your API.Bible key in Settings to read " + label + "."));
    }
    return APP.http.getJson(APP.http.buildUrl(API_BIBLE + "bibles/" + bibleId + "/chapters/" + code + "." + chapter, {
      "content-type": "text",
      "include-notes": "false",
      "include-titles": "false",
      "include-chapter-numbers": "false",
      "include-verse-numbers": "true",
      "include-verse-spans": "false"
    }), { signal: signal, cache: false, retries: 0, headers: { "api-key": key } }).then(function (data) {
      return {
        translation: label,
        copyright: data.data && data.data.copyright ? String(data.data.copyright).replace(/\s+/g, " ").trim() : "",
        items: parseNumberedText(data.data && data.data.content)
      };
    });
  }

  function fetchChapter(translation, code, chapter, signal) {
    if (translation === "ESV") {
      return fetchEsvChapter(code, chapter, signal);
    }
    if (translation.indexOf("apibible:") === 0) {
      var parts = translation.split(":");
      return fetchApiBibleChapter(parts[1], parts.slice(2).join(":") || parts[1], code, chapter, signal);
    }
    return fetchFreeChapter(translation, code, chapter, signal);
  }

  // ---------- Commentary: Tyndale Open Study Notes (evangelical) ----------

  function fetchCommentary(id, code, chapter, signal) {
    return APP.http.getJson(FREE_BIBLE_API + "c/" + id + "/" + code + "/" + chapter + ".json", { signal: signal }).then(function (data) {
      var verses = {};
      (data.chapter.content || []).forEach(function (item) {
        if (item.type === "verse") {
          verses[item.number] = (item.content || []).map(clean).filter(Boolean);
        }
      });
      return { introduction: clean(data.chapter.introduction || ""), verses: verses };
    });
  }

  function fetchTyndaleIntro(code, signal) {
    return APP.http.getJson(FREE_BIBLE_API + "c/tyndale/books.json", { signal: signal }).then(function (data) {
      var book = (data.books || []).filter(function (item) {
        return item.id === code;
      })[0];
      if (!book || !book.introduction) {
        return null;
      }

      var parts = clean(book.introduction).split(/\n\n([A-Z][A-Za-z ,'’\-]{2,40})\n\n/);
      var sections = [];
      for (var index = 1; index < parts.length; index += 2) {
        sections.push({ heading: parts[index], text: String(parts[index + 1] || "").trim() });
      }
      return { intro: parts[0].trim(), sections: sections };
    });
  }

  function tyndaleSection(intro, pattern) {
    if (!intro) {
      return null;
    }
    return intro.sections.filter(function (section) {
      return pattern.test(section.heading);
    })[0] || null;
  }

  // Tyndale notes begin with their own range: "41:5-7 …" within the chapter, or "6:1–16:21 …" beyond it.
  function tyndaleNotes(commentary, chapter, start, end) {
    if (!commentary) {
      return [];
    }
    var notes = [];
    Object.keys(commentary.verses).forEach(function (verse) {
      commentary.verses[verse].forEach(function (note) {
        var match = note.match(/^(\d+):(\d+)(?:[-–](\d+)(?::(\d+))?)?\s+/);
        var first = match ? Number(match[2]) : Number(verse);
        var last = match && match[4] ? 999 : match && match[3] ? Number(match[3]) : first;
        if (!start || (first <= end && last >= start)) {
          notes.push({ range: match ? match[0].trim() : chapter + ":" + verse, first: first, last: last, text: match ? note.slice(match[0].length) : note });
        }
      });
    });
    return notes.sort(function (a, b) {
      return a.first - b.first || (b.last - b.first) - (a.last - a.first);
    });
  }

  // ---------- Wikipedia: historical background only ----------

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
        sections.push({ heading: heading, level: level, parents: parents.slice(), text: String(parts[index + 2] || "").trim() });
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

  function aboutSections(article) {
    if (!article) {
      return [];
    }
    return article.sections.filter(function (section) {
      var heads = [section.heading].concat(section.parents);
      return section.text.length > 60 && !/^verses?\s+\d/i.test(section.heading) &&
        heads.some(function (heading) { return ABOUT_HEADINGS.test(heading); }) &&
        !heads.some(function (heading) { return RECEPTION_HEADINGS.test(heading); });
    }).map(function (section) {
      var parent = section.parents[section.parents.length - 1];
      return {
        heading: parent && !ABOUT_HEADINGS.test(section.heading) ? parent + ": " + section.heading : section.heading,
        text: section.text
      };
    });
  }

  function placement(bookArticle, chapter) {
    if (!bookArticle) {
      return [];
    }
    var found = [];
    bookArticle.sections.concat([{ heading: "Introduction", text: bookArticle.intro }]).forEach(function (section) {
      if (!ABOUT_HEADINGS.test(section.heading) && section.heading !== "Introduction") {
        return;
      }
      sentences(section.text).forEach(function (sentence) {
        var pattern = /chapters?\s+(\d{1,3})\s*[–-]\s*(\d{1,3})/gi;
        var match;
        while ((match = pattern.exec(sentence))) {
          if (chapter >= Number(match[1]) && chapter <= Number(match[2]) && found.length < 4 &&
            !found.some(function (item) { return item.text === sentence; })) {
            found.push({ heading: section.heading, text: sentence });
          }
        }
      });
    });
    return found;
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

  function studyLinks(packet) {
    var slug = packet.book === "Song of Solomon" ? "songs" : packet.book.toLowerCase().replace(/ /g, "_");
    var chapter = packet.chapter || 1;
    var links = [{
      label: "John Gill's Exposition of " + packet.book + " " + chapter,
      note: "18th-century Baptist commentary; reads Revelation as a forecast of church history · BibleHub",
      url: "https://biblehub.com/commentaries/gill/" + slug + "/" + chapter + ".htm"
    }];
    if (packet.scope === "verse") {
      links.push({
        label: "Other classic commentaries on " + packet.display,
        note: "BibleHub",
        url: "https://biblehub.com/commentaries/" + slug + "/" + chapter + "-" + packet.verseStart + ".htm"
      });
    }
    links.push({
      label: "The Baptist Faith and Message (2000)",
      note: "Southern Baptist Convention statement of faith",
      url: "https://bfm.sbc.net/bfm2000/"
    });
    return links;
  }

  APP.passage = {
    sources: SOURCES,

    // English Bibles an API.Bible key can access (NIV and others appear only if the key is licensed for them).
    listApiBibles: function (key) {
      return APP.http.getJson(API_BIBLE + "bibles?language=eng", {
        cache: false,
        retries: 0,
        headers: { "api-key": key }
      }).then(function (data) {
        return (data.data || []).map(function (bible) {
          return { id: bible.id, label: (bible.abbreviationLocal || bible.abbreviation) + " — " + (bible.nameLocal || bible.name) };
        });
      });
    },

    gather: function (reference, options, signal) {
      options = options || {};
      var translation = options.translation || "BSB";
      var scope = APP.model.scopeOf(reference);
      var book = reference.book.name;
      var code = APP.data.usfm[book];
      var chapter = reference.chapter;
      var start = reference.verseStart;
      var end = reference.verseEnd || start;
      var textError = null;

      var text = scope !== "book"
        ? fetchChapter(translation, code, chapter, signal).catch(function (error) {
          if (APP.http.isAbort(error)) {
            throw error;
          }
          textError = error.message;
          // Fall back to the free BSB so the analysis still has the passage.
          return translation === "BSB" ? null : settle(fetchFreeChapter("BSB", code, chapter, signal));
        })
        : Promise.resolve(null);

      return Promise.all([
        text,
        scope !== "book" ? settle(fetchCommentary("tyndale", code, chapter, signal)) : Promise.resolve(null),
        settle(fetchTyndaleIntro(code, signal)),
        settle(fetchArticle(bookTitle(book), signal)),
        scope !== "book" ? settle(fetchArticle(chapterTitle(book, chapter), signal)) : Promise.resolve(null)
      ]).then(function (results) {
        var chapterText = results[0];
        var passage = null;

        if (chapterText) {
          var contextRange = scope === "verse" ? { first: Math.max(1, start - 3), last: end + 3 } : null;
          passage = {
            translation: chapterText.translation,
            copyright: chapterText.copyright,
            notice: textError,
            items: chapterText.items.filter(function (item) {
              return !contextRange || (item.type === "verse" && item.verse >= contextRange.first && item.verse <= contextRange.last);
            }).map(function (item) {
              item.focus = item.type === "verse" && (scope !== "verse" || (item.verse >= start && item.verse <= end));
              return item;
            })
          };
        }

        var tyndaleIntro = results[2];
        var bookArticle = results[3];
        var chapterArticle = results[4];
        var packet = {
          scope: scope,
          display: reference.display,
          book: book,
          chapter: chapter,
          verseStart: start,
          verseEnd: end,
          passage: passage,
          textError: textError,
          notes: tyndaleNotes(results[1], chapter, scope === "verse" ? start : 0, end),
          tyndaleIntro: tyndaleIntro,
          setting: tyndaleSection(tyndaleIntro, /^setting$/i),
          message: tyndaleSection(tyndaleIntro, /meaning and message|message/i),
          interpreting: tyndaleSection(tyndaleIntro, /^interpreting/i),
          bookArticle: bookArticle,
          bookAbout: aboutSections(bookArticle),
          chapterArticle: chapterArticle,
          placement: scope !== "book" ? placement(bookArticle, chapter) : [],
          verseNotes: scope === "verse" ? verseNotes(chapterArticle, start, end) : []
        };
        packet.links = studyLinks(packet);
        return packet;
      });
    },

    focusText: function (packet) {
      if (!packet || !packet.passage) {
        return "";
      }
      return packet.passage.items.filter(function (item) {
        return item.type === "verse" && item.focus;
      }).map(function (item) {
        return item.verse + " " + item.text;
      }).join(" ");
    },

    firstSentences: function (text, count) {
      return sentences(String(text || "").replace(/\s+/g, " ")).slice(0, count || 2).join(" ");
    },

    // Condensed material for the model prompt, labeled by source.
    promptMaterial: function (packet, context) {
      var truncate = APP.utils.truncate;
      var commentary = [];
      var reference = [];

      if (packet) {
        packet.notes.slice(0, packet.scope === "verse" ? 6 : 10).forEach(function (note) {
          commentary.push("[Tyndale study note " + note.range + "] " + truncate(note.text, 500));
        });
        [packet.setting, packet.interpreting, packet.message].filter(Boolean).forEach(function (section) {
          commentary.push("[Tyndale book introduction: " + section.heading + "] " + truncate(section.text, 900));
        });
        if (packet.scope === "book" && packet.tyndaleIntro) {
          packet.tyndaleIntro.sections.filter(function (section) {
            return /authorship|author|date/i.test(section.heading);
          }).forEach(function (section) {
            commentary.push("[Tyndale book introduction: " + section.heading + "] " + truncate(section.text, 700));
          });
        }
        packet.verseNotes.forEach(function (note) {
          reference.push("[Wikipedia, " + note.heading + "] " + truncate(note.text, 500));
        });
        if (packet.chapterArticle) {
          reference.push("[Wikipedia chapter overview] " + truncate(packet.chapterArticle.intro, 500));
        }
        if (packet.scope === "book" && packet.bookArticle) {
          reference.push("[Wikipedia book overview] " + truncate(packet.bookArticle.intro, 600));
        }
      }

      var growth = APP.growth.forRange(context.start, context.end).map(function (factor) {
        return "- " + factor.title + " (" + APP.utils.formatRange(factor.start, factor.end) + ", " + factor.kind.toLowerCase() + "): " +
          factor.happened + " Connection: " + factor.growth +
          (factor.scripture.length ? " Scripture: " + factor.scripture.join("; ") + "." : "");
      });

      var world = context.worldEvents.map(function (event) {
        return "- " + APP.utils.formatRange(event.start, event.end) + " | " + event.regions.join(", ") + " | " + event.title + ": " + event.detail;
      });

      return {
        commentary: commentary.join("\n") || "[No commentary found.]",
        reference: reference.join("\n") || "[No general-reference notes found.]",
        growth: growth.join("\n") || "[No curated developments overlap this era.]",
        world: world.join("\n") || "[No world events in the local dataset for this era.]"
      };
    }
  };

  // ---------- Rendering ----------

  var SCOPE_LABELS = {
    verse: "Verse focus: the words themselves, their immediate context, and commentary on this verse.",
    chapter: "Chapter focus: the full chapter, its movement and structure, and where it sits in the book.",
    book: "Book focus: setting, authorship, date, structure, and message of the whole book."
  };

  function badge(key) {
    var source = SOURCES[key];
    return '<span class="source-badge source-' + key + '" title="' + esc(source.detail) + '">' + esc(source.label) + "</span>";
  }

  function paragraphs(text, limit) {
    return APP.utils.textToParagraphs(APP.utils.truncate(text, limit || 2400));
  }

  function details(title, body, open, sourceKey) {
    return '<details class="passage-details"' + (open ? " open" : "") + "><summary>" + esc(title) +
      (sourceKey ? " " + badge(sourceKey) : "") + "</summary>" + body + "</details>";
  }

  function sourceNote(key) {
    return '<p class="source-note">' + esc(SOURCES[key].detail) + "</p>";
  }

  function refButton(reference) {
    return '<button type="button" class="scripture-ref" data-analyze-ref="' + esc(reference) + '" title="Analyze ' + esc(reference) + '">' +
      esc(reference) + "</button>";
  }

  function passageHtml(packet) {
    if (!packet.passage || !packet.passage.items.length) {
      return '<p class="form-message error">' + esc(packet.textError || "The passage text could not be loaded.") + "</p>";
    }

    var body = packet.passage.items.map(function (item) {
      if (item.type === "heading") {
        return '<span class="passage-heading">' + esc(item.text) + "</span>";
      }
      return '<span class="verse' + (item.focus ? " verse-focus" : "") + '"><sup>' + item.verse + "</sup>" + esc(item.text) + "</span>";
    }).join(" ");

    return (packet.passage.notice ? '<p class="form-message error">' + esc(packet.passage.notice) + " Showing the Berean Standard Bible instead.</p>" : "") +
      '<blockquote class="passage-text' + (packet.scope === "chapter" ? " passage-chapter" : "") + '">' + body + "</blockquote>" +
      '<p class="field-help">' + esc(packet.passage.translation) +
      (packet.scope === "verse" ? ". Surrounding verses are dimmed for context." : ".") + "</p>" +
      (packet.passage.copyright ? '<p class="source-note">' + esc(packet.passage.copyright) + "</p>" : "");
  }

  function notesHtml(notes, limit) {
    return '<ul class="note-list">' + notes.slice(0, limit).map(function (note) {
      return "<li><strong>" + esc(note.range) + "</strong> " + esc(note.text) + "</li>";
    }).join("") + "</ul>";
  }

  function linksHtml(links) {
    return '<ul class="evidence-list">' + links.map(function (link) {
      return '<li><a class="source-link" href="' + esc(link.url) + '" target="_blank" rel="noopener noreferrer">' + esc(link.label) + "</a>" +
        ' <span class="muted">— ' + esc(link.note) + "</span></li>";
    }).join("") + "</ul>";
  }

  function wikipediaHtml(packet) {
    var parts = [];
    packet.verseNotes.forEach(function (note) {
      parts.push("<h5>" + esc(note.heading) + "</h5>" + paragraphs(note.text, 1200));
    });
    if (packet.scope !== "book" && packet.chapterArticle) {
      parts.push("<h5>Chapter overview</h5>" + paragraphs(packet.chapterArticle.intro, 1200));
    }
    if (packet.placement.length) {
      parts.push("<h5>Place in the book</h5><ul class=\"evidence-list\">" + packet.placement.map(function (item) {
        return "<li>" + esc(APP.utils.truncate(item.text, 320)) + "</li>";
      }).join("") + "</ul>");
    }
    if (packet.scope === "book") {
      if (packet.bookArticle) {
        parts.push("<h5>Overview</h5>" + paragraphs(packet.bookArticle.intro, 1200));
      }
      packet.bookAbout.slice(0, 5).forEach(function (item) {
        parts.push("<h5>" + esc(item.heading) + "</h5>" + paragraphs(item.text, 900));
      });
    }
    var article = packet.scope === "book" ? packet.bookArticle : packet.chapterArticle || packet.bookArticle;
    if (article) {
      parts.push('<p class="field-help"><a class="source-link" href="' + esc(article.url) + '" target="_blank" rel="noopener noreferrer">' +
        esc(article.title) + " on Wikipedia</a></p>");
    }
    return parts.join("");
  }

  function factorCard(factor) {
    return '<article class="growth-card">' +
      '<div class="growth-head"><span class="growth-kind">' + esc(factor.kind) + "</span>" +
        '<span class="growth-date">' + esc(APP.utils.formatRange(factor.start, factor.end)) + "</span></div>" +
      "<h4>" + esc(factor.title) + "</h4>" +
      "<p><strong>What happened:</strong> " + esc(factor.happened) + "</p>" +
      "<p><strong>How it shaped Christianity's growth:</strong> " + esc(factor.growth) + "</p>" +
      (factor.scripture.length ? '<p class="growth-refs">' + factor.scripture.map(refButton).join(" · ") + "</p>" : "") +
      '<p class="field-help">Source: <a class="source-link" href="' + esc(factor.source.url) + '" target="_blank" rel="noopener noreferrer">' +
        esc(factor.source.label) + "</a></p>" +
      "</article>";
  }

  APP.passageView = {
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
          ? ". The era shown reflects the opening section; search a chapter for its own period."
          : ". The historical era shown reflects this section.") + "</p>");
      }

      if (packet.scope !== "book") {
        parts.push(passageHtml(packet));
      }

      if (packet.notes.length) {
        parts.push(details((packet.scope === "verse" ? "Study notes on " : "Study notes through ") + packet.display,
          notesHtml(packet.notes, packet.scope === "verse" ? 8 : 40) + sourceNote("tyndale"), true, "tyndale"));
      }

      if (packet.tyndaleIntro) {
        var introParts = [];
        if (packet.scope === "book") {
          introParts.push(paragraphs(packet.tyndaleIntro.intro, 1500));
          packet.tyndaleIntro.sections.forEach(function (section, index) {
            introParts.push(details(section.heading, paragraphs(section.text, 3500), index === 0));
          });
        } else {
          [packet.setting, packet.interpreting].filter(Boolean).forEach(function (section) {
            introParts.push("<h5>" + esc(section.heading) + "</h5>" + paragraphs(section.text, 1600));
          });
        }
        if (introParts.length) {
          parts.push(details(packet.scope === "book" ? "Introduction to " + packet.book : "The book's setting",
            introParts.join("") + sourceNote("tyndale"), packet.scope === "book", "tyndale"));
        }
      }

      var wiki = wikipediaHtml(packet);
      if (wiki) {
        parts.push(details("Historical background (general reference)", wiki + sourceNote("wikipedia"), false, "wikipedia"));
      }

      parts.push('<div class="passage-block"><h4>Further study</h4>' + linksHtml(packet.links) + "</div>");
      return parts.join("");
    },

    // World Connections: how the world of this era shaped Christianity's beginning and spread.
    buildConnections: function (context, analysisText, fromModel) {
      var factors = APP.growth.forRange(context.start, context.end);
      var parts = [];

      if (analysisText) {
        parts.push('<div class="ai-output">' + (fromModel ? APP.utils.renderMarkdown(analysisText) : APP.utils.textToParagraphs(analysisText)) + "</div>");
      }

      if (factors.length) {
        parts.push('<div class="passage-block"><h4>Developments in this era ' + badge("curated") + "</h4>" +
          '<div class="growth-grid">' + factors.map(factorCard).join("") + "</div></div>");
      }

      if (context.worldEvents.length) {
        parts.push('<div class="passage-block"><h4>Meanwhile in the wider world</h4><ul class="evidence-list">' +
          context.worldEvents.slice(0, 8).map(function (event) {
            return "<li><strong>" + esc(APP.utils.formatRange(event.start, event.end)) + "</strong> · " + esc(event.title) +
              ' <span class="muted">(' + esc(event.regions.slice(0, 2).join(", ")) + ")</span></li>";
          }).join("") + "</ul>" +
          '<p class="field-help">Use "Explore this period in Timeline search" above for events across every region.</p></div>');
      }

      return parts.join("") || '<p class="muted">No curated developments overlap this era yet.</p>';
    },

    // Links development titles the model names to their sources, and Scripture references to new analyses.
    linkMentions: function (container, context) {
      if (!container) {
        return 0;
      }

      var count = 0;
      APP.growth.forRange(context.start, context.end).forEach(function (factor) {
        var pattern = new RegExp(factor.title.replace(/^The /, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
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
          link.href = factor.source.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.title = "Source: " + factor.source.label;
          link.textContent = match[0];
          mention.parentNode.replaceChild(link, mention);
          count += 1;
          break;
        }
      });

      var refPattern = /\b([1-3]\s)?(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation)\s(\d{1,3}):(\d{1,3})(?:[–-](\d{1,3}))?\b/;
      var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      var textNodes = [];
      var textNode;
      while ((textNode = walker.nextNode())) {
        if (!textNode.parentElement.closest("a, button")) {
          textNodes.push(textNode);
        }
      }
      textNodes.forEach(function (current) {
        var match;
        while (current && (match = current.nodeValue.match(refPattern))) {
          var refNode = current.splitText(match.index);
          current = refNode.splitText(match[0].length);
          var button = document.createElement("button");
          button.type = "button";
          button.className = "scripture-ref";
          button.setAttribute("data-analyze-ref", match[0].replace("–", "-"));
          button.title = "Analyze " + match[0];
          button.textContent = match[0];
          refNode.parentNode.replaceChild(button, refNode);
        }
      });

      return count;
    }
  };
}());
