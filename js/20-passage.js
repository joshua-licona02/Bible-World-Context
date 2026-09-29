(function () {
  "use strict";

  var WIKI_API = "https://en.wikipedia.org/w/api.php";
  var BIBLE_API = "https://bible.helloao.org/api/";

  var SKIP_HEADINGS = /^(text|textual witnesses|parashot|see also|references|notes|citations|bibliography|external links|further reading|sources|explanatory notes|footnotes|jewish|christian|historical english)$/i;
  var ABOUT_HEADINGS = /structure|summary|outline|contents|composition|authorship|dating|date|historical (context|background|setting)|background|setting|themes?|theology|purpose|overview|general presentation|genre|audience|places/i;
  var LEGACY_HEADINGS = /influence|interpretation|reception|legacy|uses? in|in (judaism|christianity|islam|the new testament)|liturgy|liturgical|hermeneutics|impact|significance|music|in (art|culture|literature|popular culture)|commemorat|tradition/i;
  // Articles that merely contain the phrase (TV episode lists, character lists) are not evidence of influence.
  var TRIVIAL_CITATION = /^list of|episodes|characters|\((tv|television) series\)|\(film\)|\(video game\)|\(disambiguation\)|season \d|\(band\)|wrestl/i;

  // Where each kind of material comes from, shown next to it so readers can weigh it.
  var SOURCES = {
    gill: {
      label: "Baptist commentary",
      detail: "John Gill, Exposition of the Old and New Testaments (1746–1766). Gill was a Particular Baptist pastor in London."
    },
    tyndale: {
      label: "Evangelical study notes",
      detail: "Tyndale Open Study Notes (Tyndale House Publishers, CC BY-SA)."
    },
    crossref: {
      label: "Scripture cross-references",
      detail: "OpenBible.info cross-references, ranked by how often readers connect the passages."
    },
    wikipedia: {
      label: "General reference",
      detail: "Wikipedia. Secular, community-edited reference; useful for history, but verify interpretive claims."
    },
    openalex: {
      label: "Academic scholarship",
      detail: "OpenAlex index of published scholarship. Mixed perspectives, including critical views."
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

  // ---------- Free Use Bible API: translations, commentaries, cross-references ----------

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

  function fetchChapter(translation, code, chapter, signal) {
    return APP.http.getJson(BIBLE_API + translation + "/" + code + "/" + chapter + ".json", { signal: signal }).then(function (data) {
      var items = [];
      (data.chapter.content || []).forEach(function (item) {
        if (item.type === "heading") {
          items.push({ type: "heading", text: clean(flattenContent(item.content)) });
        } else if (item.type === "verse") {
          items.push({ type: "verse", verse: item.number, text: clean(flattenContent(item.content)).replace(/\n/g, " ") });
        }
      });
      return { translation: data.translation.name, items: items };
    });
  }

  // Commentary chapter as { verseNumber: "comment" }.
  function fetchCommentary(id, code, chapter, signal) {
    return APP.http.getJson(BIBLE_API + "c/" + id + "/" + code + "/" + chapter + ".json", { signal: signal }).then(function (data) {
      var verses = {};
      (data.chapter.content || []).forEach(function (item) {
        if (item.type === "verse") {
          verses[item.number] = (item.content || []).map(clean).filter(Boolean);
        }
      });
      return { introduction: clean(data.chapter.introduction || ""), verses: verses };
    });
  }

  // Tyndale book introductions come as one file; headings are short title lines between blank lines.
  function fetchTyndaleIntro(code, signal) {
    return APP.http.getJson(BIBLE_API + "c/tyndale/books.json", { signal: signal }).then(function (data) {
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

  function fetchCrossRefs(code, chapter, start, end, signal) {
    return APP.http.getJson(BIBLE_API + "d/open-cross-ref/" + code + "/" + chapter + ".json", { signal: signal }).then(function (data) {
      var totals = {};
      (data.chapter.content || []).forEach(function (item) {
        if (start && (item.verse < start || item.verse > end)) {
          return;
        }
        (item.references || []).forEach(function (ref) {
          if (ref.book === code && ref.chapter === chapter) {
            return;
          }
          var key = ref.book + " " + ref.chapter + ":" + ref.verse + (ref.endVerse ? "-" + ref.endVerse : "");
          if (!totals[key]) {
            totals[key] = { book: ref.book, chapter: ref.chapter, verse: ref.verse, endVerse: ref.endVerse || ref.verse, score: 0 };
          }
          totals[key].score += ref.score || 0;
        });
      });

      return Object.keys(totals).map(function (key) {
        return totals[key];
      }).sort(function (a, b) {
        return b.score - a.score;
      }).slice(0, 10);
    });
  }

  // Fills in the text of cross-references, reading each referenced chapter once.
  function attachRefText(refs, translation, signal) {
    var chapters = {};
    refs.forEach(function (ref) {
      chapters[ref.book + "/" + ref.chapter] = true;
    });

    return Promise.all(Object.keys(chapters).slice(0, 10).map(function (key) {
      var parts = key.split("/");
      return fetchChapter(translation, parts[0], Number(parts[1]), signal).then(function (text) {
        chapters[key] = text;
      }).catch(function (error) {
        if (APP.http.isAbort(error)) {
          throw error;
        }
        chapters[key] = null;
      });
    })).then(function () {
      return refs.map(function (ref) {
        var chapterText = chapters[ref.book + "/" + ref.chapter];
        var name = bookFromCode(ref.book);
        return {
          reference: name + " " + ref.chapter + ":" + ref.verse + (ref.endVerse !== ref.verse ? "-" + ref.endVerse : ""),
          text: chapterText && chapterText.items ? chapterText.items.filter(function (item) {
            return item.type === "verse" && item.verse >= ref.verse && item.verse <= ref.endVerse;
          }).map(function (item) {
            return item.text;
          }).join(" ") : "",
          score: ref.score
        };
      });
    });
  }

  // Tyndale notes begin with their own range ("41:5-7 This taunt…"); keep the ones touching the focus verses.
  function tyndaleNotes(commentary, chapter, start, end) {
    if (!commentary) {
      return [];
    }
    var notes = [];
    Object.keys(commentary.verses).forEach(function (verse) {
      commentary.verses[verse].forEach(function (note) {
        // Ranges may run within the chapter ("41:5-7") or past it ("6:1–16:21", covering the rest of the chapter).
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

  function gillComments(commentary, start, end) {
    if (!commentary) {
      return [];
    }
    return Object.keys(commentary.verses).map(Number).filter(function (verse) {
      return !start || (verse >= start && verse <= end);
    }).sort(function (a, b) {
      return a - b;
    }).map(function (verse) {
      return { verse: verse, text: commentary.verses[verse].join("\n\n") };
    });
  }

  // ---------- Wikipedia: general reference ----------

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

  // Articles that quote the passage (hymns, cantatas, place names), minus trivial list/TV pages.
  function fetchCitations(phrase, signal) {
    return APP.http.getJson(APP.http.buildUrl(WIKI_API, {
      action: "query",
      format: "json",
      origin: "*",
      list: "search",
      srlimit: 25,
      srsearch: "\"" + phrase + "\""
    }), { signal: signal }).then(function (data) {
      var query = data.query || {};
      return {
        phrase: phrase,
        total: query.searchinfo ? query.searchinfo.totalhits : 0,
        items: (query.search || []).filter(function (item) {
          return !TRIVIAL_CITATION.test(item.title) && item.title !== phrase;
        }).slice(0, 10).map(function (item) {
          return {
            title: item.title,
            snippet: String(item.snippet || "").replace(/<[^>]+>/g, "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(),
            url: wikiUrl(item.title)
          };
        })
      };
    });
  }

  function sentences(text) {
    return String(text).split(/(?<=[.!?])\s+(?=[A-Z"“(])/);
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

  function legacySections(article) {
    if (!article) {
      return [];
    }
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

  // ---------- Further study (external, link-only) ----------

  function studyLinks(packet) {
    var slug = packet.book === "Song of Solomon" ? "songs" : packet.book.toLowerCase().replace(/ /g, "_");
    var chapter = packet.chapter || 1;
    var links = [
      {
        label: "John Gill's full exposition of " + (packet.chapter ? packet.book + " " + chapter : packet.book + " 1"),
        note: "Baptist · BibleHub",
        url: "https://biblehub.com/commentaries/gill/" + slug + "/" + chapter + ".htm"
      }
    ];

    if (packet.scope === "verse") {
      links.push({
        label: "Classic commentaries on " + packet.display,
        note: "Gill, Barnes, Spurgeon (Psalms), and others · BibleHub",
        url: "https://biblehub.com/commentaries/" + slug + "/" + chapter + "-" + packet.verseStart + ".htm"
      });
    }

    links.push({
      label: "Spurgeon's sermons on " + packet.display,
      note: "Baptist · Spurgeon Center, Midwestern Baptist Theological Seminary",
      url: "https://www.spurgeon.org/?s=" + encodeURIComponent(packet.display)
    });
    links.push({
      label: "The Baptist Faith and Message (2000)",
      note: "Southern Baptist Convention statement of faith, for doctrinal framing",
      url: "https://bfm.sbc.net/bfm2000/"
    });

    return links;
  }

  // ---------- Gathering ----------

  APP.passage = {
    sources: SOURCES,

    gather: function (reference, options, signal) {
      options = options || {};
      var translation = options.translation || "BSB";
      var scope = APP.model.scopeOf(reference);
      var book = reference.book.name;
      var code = APP.data.usfm[book];
      var chapter = reference.chapter;
      var start = reference.verseStart;
      var end = reference.verseEnd || start;
      var chapterName = chapter ? chapterTitle(book, chapter) : "";
      var citationPhrase = scope === "verse"
        ? chapterName + ":" + start + (end !== start ? "-" + end : "")
        : scope === "chapter" ? chapterName : "";

      var crossRefs = scope !== "book"
        ? settle(fetchCrossRefs(code, chapter, scope === "verse" ? start : 0, end, signal).then(function (refs) {
          return attachRefText(refs.slice(0, scope === "verse" ? 8 : 10), translation, signal);
        }))
        : Promise.resolve(null);

      return Promise.all([
        scope !== "book" ? settle(fetchChapter(translation, code, chapter, signal)) : Promise.resolve(null),
        scope !== "book" ? settle(fetchCommentary("john-gill", code, chapter, signal)) : Promise.resolve(null),
        scope !== "book" ? settle(fetchCommentary("tyndale", code, chapter, signal)) : Promise.resolve(null),
        settle(fetchTyndaleIntro(code, signal)),
        crossRefs,
        settle(fetchArticle(bookTitle(book), signal)),
        scope !== "book" ? settle(fetchArticle(chapterName, signal)) : Promise.resolve(null),
        citationPhrase ? settle(fetchCitations(citationPhrase, signal)) : Promise.resolve(null),
        settle(scholarship(book, scope === "book" ? "" : chapterName, signal))
      ]).then(function (results) {
        var text = results[0];
        var passage = null;

        if (text) {
          var contextRange = scope === "verse" ? { first: Math.max(1, start - 3), last: end + 3 } : null;
          passage = {
            translation: text.translation,
            items: text.items.filter(function (item) {
              if (!contextRange) {
                return true;
              }
              return item.type === "verse" && item.verse >= contextRange.first && item.verse <= contextRange.last;
            }).map(function (item) {
              item.focus = item.type === "verse" && (scope !== "verse" || (item.verse >= start && item.verse <= end));
              return item;
            })
          };
        }

        var tyndaleIntro = results[3];
        var bookArticle = results[5];
        var chapterArticle = results[6];
        var packet = {
          scope: scope,
          display: reference.display,
          book: book,
          chapter: chapter,
          verseStart: start,
          verseEnd: end,
          translation: translation,
          passage: passage,
          gill: gillComments(results[1], scope === "verse" ? start : 0, end),
          gillIntro: results[1] ? results[1].introduction : "",
          notes: tyndaleNotes(results[2], chapter, scope === "verse" ? start : 0, end),
          tyndaleIntro: tyndaleIntro,
          setting: tyndaleSection(tyndaleIntro, /^setting$/i),
          message: tyndaleSection(tyndaleIntro, /meaning and message|message/i),
          interpreting: tyndaleSection(tyndaleIntro, /^interpreting/i),
          crossRefs: results[4] || [],
          bookArticle: bookArticle,
          bookAbout: aboutSections(bookArticle),
          chapterArticle: chapterArticle,
          placement: scope !== "book" ? placement(bookArticle, chapter) : [],
          verseNotes: scope === "verse" ? verseNotes(chapterArticle, start, end) : [],
          legacy: legacySections(scope === "book" ? bookArticle : chapterArticle)
            .concat(scope === "book" ? [] : legacySections(bookArticle).slice(0, 2)),
          citations: results[7],
          works: results[8] || []
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

    // Condensed material for the model prompt, grouped and labeled by source perspective.
    promptMaterial: function (packet) {
      if (!packet) {
        return { commentary: "[Unavailable.]", reference: "[Unavailable.]", scripture: "[Unavailable.]", reception: "[Unavailable.]" };
      }

      var truncate = APP.utils.truncate;
      var commentary = [];
      var scopeLimit = packet.scope === "verse" ? 1800 : 900;

      packet.notes.slice(0, packet.scope === "verse" ? 6 : 10).forEach(function (note) {
        commentary.push("[Tyndale study note " + note.range + "] " + truncate(note.text, 500));
      });
      packet.gill.slice(0, packet.scope === "verse" ? 3 : 4).forEach(function (comment) {
        commentary.push("[John Gill, Baptist, on verse " + comment.verse + "] " + truncate(comment.text, scopeLimit));
      });
      if (packet.setting) {
        commentary.push("[Tyndale book introduction: Setting] " + truncate(packet.setting.text, 900));
      }
      if (packet.interpreting) {
        commentary.push("[Tyndale book introduction: " + packet.interpreting.heading + "] " + truncate(packet.interpreting.text, 900));
      }
      if (packet.message) {
        commentary.push("[Tyndale book introduction: Meaning and Message] " + truncate(packet.message.text, 900));
      }
      if (packet.scope === "book" && packet.tyndaleIntro) {
        packet.tyndaleIntro.sections.filter(function (section) {
          return /authorship|author|date/i.test(section.heading);
        }).forEach(function (section) {
          commentary.push("[Tyndale book introduction: " + section.heading + "] " + truncate(section.text, 700));
        });
      }

      var reference = [];
      packet.verseNotes.forEach(function (note) {
        reference.push("[Wikipedia, " + note.heading + "] " + truncate(note.text, 500));
      });
      if (packet.chapterArticle) {
        reference.push("[Wikipedia chapter overview] " + truncate(packet.chapterArticle.intro, 500));
      }
      if (packet.scope === "book" && packet.bookArticle) {
        reference.push("[Wikipedia book overview] " + truncate(packet.bookArticle.intro, 600));
      }

      var scripture = packet.crossRefs.slice(0, 8).map(function (ref) {
        return "- " + ref.reference + (ref.text ? ": " + truncate(ref.text, 220) : "");
      });

      var reception = packet.legacy.slice(0, 3).map(function (item) {
        return "- [Wikipedia] " + item.heading + ": " + truncate(item.text, 500);
      });
      if (packet.citations && packet.citations.items.length) {
        reception.push("- Works that quote or reference the passage: " + packet.citations.items.map(function (item) {
          return item.title;
        }).join("; ") + ".");
      }
      packet.works.slice(0, 5).forEach(function (work) {
        reception.push("- [Scholarship] " + work.title + (work.meta ? " (" + work.meta + ")" : ""));
      });

      return {
        commentary: commentary.join("\n") || "[No commentary found.]",
        reference: reference.join("\n") || "[No general-reference notes found.]",
        scripture: scripture.join("\n") || "[No cross-references found.]",
        reception: reception.join("\n") || "[No reception evidence collected.]"
      };
    }
  };

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

  function passageHtml(packet) {
    if (!packet.passage || !packet.passage.items.length) {
      return '<p class="field-help">The passage text could not be loaded.</p>';
    }

    var body = packet.passage.items.map(function (item) {
      if (item.type === "heading") {
        return '<span class="passage-heading">' + esc(item.text) + "</span>";
      }
      return '<span class="verse' + (item.focus ? " verse-focus" : "") + '"><sup>' + item.verse + "</sup>" + esc(item.text) + "</span>";
    }).join(" ");

    return '<blockquote class="passage-text' + (packet.scope === "chapter" ? " passage-chapter" : "") + '">' + body + "</blockquote>" +
      '<p class="field-help">' + esc(packet.passage.translation) + ", via the Free Use Bible API" +
      (packet.scope === "verse" ? ". Surrounding verses are dimmed for context." : ".") + "</p>";
  }

  function notesHtml(notes, limit) {
    return '<ul class="note-list">' + notes.slice(0, limit).map(function (note) {
      return "<li><strong>" + esc(note.range) + "</strong> " + esc(note.text) + "</li>";
    }).join("") + "</ul>";
  }

  function gillHtml(comments, limit, perComment) {
    return comments.slice(0, limit).map(function (comment) {
      return '<div class="gill-comment"><strong>Verse ' + comment.verse + ".</strong>" + paragraphs(comment.text, perComment) + "</div>";
    }).join("");
  }

  function linksHtml(links) {
    return '<ul class="evidence-list">' + links.map(function (link) {
      return '<li><a class="source-link" href="' + esc(link.url) + '" target="_blank" rel="noopener noreferrer">' + esc(link.label) + "</a>" +
        ' <span class="muted">— ' + esc(link.note) + "</span></li>";
    }).join("") + "</ul>";
  }

  function refsHtml(refs) {
    return '<ul class="crossref-list">' + refs.map(function (ref) {
      return '<li><button type="button" class="link-button" data-analyze-ref="' + esc(ref.reference) + '" title="Analyze this passage">' +
        esc(ref.reference) + "</button>" + (ref.text ? ' <span class="crossref-text">' + esc(APP.utils.truncate(ref.text, 240)) + "</span>" : "") + "</li>";
    }).join("") + "</ul>";
  }

  function wikipediaHtml(packet) {
    var parts = [];
    if (packet.scope === "verse" && packet.verseNotes.length) {
      packet.verseNotes.forEach(function (note) {
        parts.push("<h5>" + esc(note.heading) + "</h5>" + paragraphs(note.text, 1200));
      });
    }
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

      if (packet.scope === "verse") {
        if (packet.notes.length) {
          parts.push(details("Study notes on " + packet.display, notesHtml(packet.notes, 8) + sourceNote("tyndale"), true, "tyndale"));
        }
        if (packet.gill.length) {
          parts.push(details("Commentary on " + packet.display, gillHtml(packet.gill, 4, 3000) + sourceNote("gill"), true, "gill"));
        }
      }

      if (packet.scope === "chapter") {
        if (packet.notes.length) {
          parts.push(details("Study notes through " + packet.display, notesHtml(packet.notes, 40) + sourceNote("tyndale"), true, "tyndale"));
        }
        if (packet.gill.length) {
          parts.push(details("Verse-by-verse commentary on " + packet.display, (packet.gillIntro ? paragraphs(packet.gillIntro, 1500) : "") +
            gillHtml(packet.gill, 60, 900) + sourceNote("gill"), false, "gill"));
        }
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

    buildSoWhat: function (packet, analysisText, fromModel) {
      var parts = [];

      if (analysisText) {
        parts.push('<div class="ai-output">' + (fromModel ? APP.utils.renderMarkdown(analysisText) : APP.utils.textToParagraphs(analysisText)) + "</div>");
      }

      if (!packet) {
        return parts.join("");
      }

      var evidence = [];

      if (packet.crossRefs.length) {
        evidence.push('<div class="passage-block"><h4>Echoes through Scripture ' + badge("crossref") + "</h4>" +
          '<p class="field-help">Passages most often connected to ' + esc(packet.display) + ". Select one to study it.</p>" +
          refsHtml(packet.crossRefs) + "</div>");
      }

      if (packet.message) {
        evidence.push('<div class="passage-block"><h4>The book\'s message ' + badge("tyndale") + "</h4>" +
          paragraphs(packet.message.text, 1400) + "</div>");
      }

      if (packet.citations && packet.citations.items.length) {
        evidence.push('<div class="passage-block"><h4>Cultural footprint ' + badge("wikipedia") + "</h4>" +
          '<p class="field-help">Hymns, music, art, and places that quote or reference "' + esc(packet.citations.phrase) +
          '" (list pages and TV listings excluded).</p><ul class="evidence-list">' +
          packet.citations.items.slice(0, 8).map(function (item) {
            return '<li><a class="source-link" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">' + esc(item.title) + "</a>" +
              (item.snippet ? ' <span class="muted">— ' + esc(APP.utils.truncate(item.snippet, 140)) + "</span>" : "") + "</li>";
          }).join("") + "</ul></div>");
      }

      if (packet.legacy.length) {
        evidence.push('<div class="passage-block"><h4>Interpretation history ' + badge("wikipedia") + "</h4>" +
          packet.legacy.slice(0, 4).map(function (item) {
            return details(item.heading + " — " + item.source, paragraphs(item.text, 1800), false);
          }).join("") + "</div>");
      }

      if (packet.works.length) {
        evidence.push('<div class="passage-block"><h4>Scholarship ' + badge("openalex") + '</h4><ul class="evidence-list">' +
          packet.works.map(function (work) {
            var url = APP.utils.safeUrl(work.url);
            return "<li>" + (url ? '<a class="source-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(work.title) + "</a>" : esc(work.title)) +
              (work.meta ? ' <span class="muted">' + esc(work.meta) + "</span>" : "") + "</li>";
          }).join("") + "</ul></div>");
      }

      if (evidence.length) {
        parts.push('<details class="passage-details evidence-group"' + (fromModel ? "" : " open") + "><summary>Evidence behind this section</summary>" +
          evidence.join("") + "</details>");
      }

      return parts.join("") || '<p class="muted">No influence or reception evidence was found for this passage.</p>';
    },

    // Links names in model output that match collected evidence, so backed examples stand out.
    linkEvidence: function (container, packet) {
      if (!container || !packet) {
        return 0;
      }

      var items = [];
      if (packet.citations) {
        packet.citations.items.forEach(function (item) {
          // "Apocalypse (Dürer)" must not shrink to the generic word "Apocalypse".
          var short = item.title.replace(/,\s*BWV.*$/, "").replace(/\s*\([^)]*\)$/, "");
          items.push({ name: short.split(" ").length >= 2 ? short : item.title, url: item.url });
        });
      }
      packet.works.forEach(function (work) {
        items.push({ name: work.title, url: APP.utils.safeUrl(work.url) });
      });

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

      // Scripture references the model cites become buttons that open that passage here.
      var refPattern = /\b([1-3]\s)?(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation)\s(\d{1,3}):(\d{1,3})(?:[–-](\d{1,3}))?\b/;
      var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      var textNodes = [];
      var textNode;
      while ((textNode = walker.nextNode())) {
        if (!textNode.parentElement.closest("a, button")) {
          textNodes.push(textNode);
        }
      }
      textNodes.forEach(function (nodeToScan) {
        var current = nodeToScan;
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
