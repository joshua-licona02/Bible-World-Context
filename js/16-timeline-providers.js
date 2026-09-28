(function () {
  "use strict";

  var WIKI_API = "https://en.wikipedia.org/w/api.php";
  var WIKIDATA_API = "https://www.wikidata.org/w/api.php";
  var WDQS = "https://query.wikidata.org/sparql";
  var OPENALEX = "https://api.openalex.org/works";

  var CONTINENT_QIDS = {
    Q48: "Asia",
    Q15: "Africa",
    Q46: "Europe",
    Q49: "North America",
    Q18: "South America",
    Q538: "Oceania",
    Q55643: "Oceania"
  };

  // Search phrasing for canonical regions when the user supplied no keywords.
  var REGION_SEARCH_TERMS = {
    "West Asia / Near East": "Near East",
    "East Asia": "China",
    "South Asia": "India",
    "Central Asia": "Central Asia",
    "Southeast Asia": "Southeast Asia",
    "Japan and Korea": "Japan Korea",
    "Nile Valley": "Egypt",
    "North Africa": "North Africa",
    "Horn of Africa": "Aksum Ethiopia",
    "Mediterranean Europe": "Roman Greece",
    "Mesoamerica": "Mesoamerica",
    "Andes": "Andes"
  };

  var NOISE_DESCRIPTION = /^(year|decade|century|millennium|calendar year|leap year|common year)\b|language|alphabet|writing system|script\b|currency|unit of|given name|family name|surname|taxon|genus|species|typeface|wikimedia|school of (thought|philosophy)/i;

  function wikiUrl(title) {
    return "https://en.wikipedia.org/wiki/" + encodeURIComponent(String(title).replace(/ /g, "_"));
  }

  function ordinal(number) {
    var suffixes = ["th", "st", "nd", "rd"];
    var remainder = number % 100;
    return number + (suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0]);
  }

  function yearTitle(year) {
    return year < 0 ? -year + " BC" : "AD " + Math.max(1, year);
  }

  function unitIndex(year, size) {
    return year < 0 ? -Math.ceil(-year / size) : Math.ceil(Math.max(1, year) / size);
  }

  function unitTitles(start, end, size, noun) {
    var titles = [];
    for (var index = unitIndex(start, size); index <= unitIndex(end, size); index += 1) {
      if (index !== 0) {
        titles.push(ordinal(Math.abs(index)) + " " + noun + (index < 0 ? " BC" : ""));
      }
    }
    return titles;
  }

  function centuryLabel(year) {
    var index = unitIndex(year, 100);
    return ordinal(Math.abs(index)) + " century" + (index < 0 ? " BC" : "");
  }

  function sample(items, count) {
    if (items.length <= count) {
      return items;
    }
    var step = items.length / count;
    var picked = [];
    for (var index = 0; index < count; index += 1) {
      picked.push(items[Math.floor(index * step)]);
    }
    return picked;
  }

  function wikiQuery(params, signal) {
    return APP.http.getJson(APP.http.buildUrl(WIKI_API, Object.assign({
      format: "json",
      formatversion: 2,
      origin: "*"
    }, params)), { signal: signal });
  }

  function textOf(node) {
    return String(node ? node.textContent : "")
      .replace(/\[\d+\]|\[citation needed\]|\[[a-z]\]/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function ownText(li) {
    var clone = li.cloneNode(true);
    Array.prototype.forEach.call(clone.querySelectorAll("ul, ol, sup, .reference, .noprint"), function (node) {
      node.remove();
    });
    return textOf(clone);
  }

  function linkTitles(li) {
    var titles = [];
    Array.prototype.forEach.call(li.querySelectorAll(":scope > a[href^='/wiki/'], :scope > i > a[href^='/wiki/'], :scope > b > a[href^='/wiki/']"), function (anchor) {
      var title = decodeURIComponent(anchor.getAttribute("href").slice(6)).split("#")[0].replace(/_/g, " ");
      if (title.indexOf(":") === -1 && !APP.timeline.parseChronicleTitle(title) && titles.indexOf(title) === -1) {
        titles.push(title);
      }
    });
    return titles.slice(0, 6);
  }

  function firstSentence(text) {
    var sentence = text.split(/(?<=[.;])\s+(?=[A-Z])/)[0];
    return APP.utils.truncate(sentence, 120);
  }

  // ---------- Wikipedia chronicle pages ----------

  // Decade articles: "580s BC", "30s", "0s"; century-boundary decades carry "(decade)", e.g. "500s BC (decade)".
  function decadeTitle(year) {
    var decade = Math.floor(Math.abs(year) / 10) * 10;
    var suffix = decade > 0 && decade % 100 === 0 ? " (decade)" : "";
    return year < 0 ? decade + "s BC" + suffix : decade + "s" + suffix;
  }

  // Picks the finest page granularity that fits the page budget: years, then decades, centuries, millennia.
  function chronicleCandidates(plan, cap) {
    var span = plan.end - plan.start + 1;
    var titles = [];
    var year;

    if (span <= 12) {
      for (year = plan.start; year <= plan.end; year += 1) {
        if (year !== 0) {
          titles.push(yearTitle(year));
        }
      }
      return titles;
    }

    for (year = plan.start; year <= plan.end; year += year < 0 && year > -10 ? 1 : 5) {
      var title = decadeTitle(year === 0 ? 1 : year);
      if (titles.indexOf(title) === -1) {
        titles.push(title);
      }
    }
    if (titles.indexOf(decadeTitle(plan.end)) === -1) {
      titles.push(decadeTitle(plan.end));
    }
    if (titles.length <= cap) {
      return titles;
    }

    var centuries = unitTitles(plan.start, plan.end, 100, "century");
    return centuries.length <= cap ? centuries : unitTitles(plan.start, plan.end, 1000, "millennium");
  }

  // Ancient single-year titles redirect to decade pages; resolve so each page is fetched once.
  function resolveTitles(titles, signal) {
    var batches = [];
    for (var index = 0; index < titles.length; index += 50) {
      batches.push(titles.slice(index, index + 50));
    }

    return Promise.all(batches.map(function (batch) {
      return wikiQuery({
        action: "query",
        redirects: 1,
        prop: "pageprops",
        ppprop: "disambiguation",
        titles: batch.join("|")
      }, signal);
    })).then(function (responses) {
      var resolved = [];

      responses.forEach(function (data, batchIndex) {
        var query = data.query || {};
        var map = {};
        (query.normalized || []).concat(query.redirects || []).forEach(function (item) {
          map[item.from] = item.to;
        });
        var existing = {};
        (query.pages || []).forEach(function (page) {
          if (!page.missing && !page.invalid && !(page.pageprops && page.pageprops.disambiguation !== undefined)) {
            existing[page.title] = true;
          }
        });

        batches[batchIndex].forEach(function (title) {
          var target = title;
          while (map[target] && map[target] !== target) {
            target = map[target];
          }
          if (existing[target] && resolved.indexOf(target) === -1) {
            resolved.push(target);
          }
        });
      });

      return resolved;
    });
  }

  function parseChronicleHtml(html, pageTitle) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var root = doc.body;
    var pageRange = APP.timeline.parseChronicleTitle(pageTitle);
    var events = [];

    Array.prototype.forEach.call(root.querySelectorAll("style, script, .mw-editsection, .reflist, .navbox, .metadata, figure, .thumb, table, .gallery"), function (node) {
      node.remove();
    });

    var walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    var h2 = "";
    var headings = [];
    var node;

    while ((node = walker.nextNode())) {
      var tag = node.tagName;

      if (tag === "H2") {
        h2 = textOf(node);
        headings = [];
        continue;
      }
      if (tag === "H3" || tag === "H4" || tag === "H5") {
        var level = Number(tag.charAt(1)) - 3;
        headings = headings.slice(0, level);
        headings[level] = textOf(node);
        continue;
      }
      if (tag !== "LI" || !/events|trends|by place|by topic/i.test(h2) || /births|deaths|significant people/i.test(h2)) {
        continue;
      }

      var own = ownText(node);
      var hasChildren = Boolean(node.querySelector("ul, ol"));
      if (hasChildren && own.length < 60) {
        continue;
      }

      var parentLi = node.parentElement ? node.parentElement.closest("li") : null;
      var prefix = parentLi ? ownText(parentLi) : "";
      var text = prefix && prefix.length < 60 ? prefix + " – " + own : own;
      if (own.length < 12) {
        continue;
      }

      var headingRange = null;
      var regionHint = null;
      var topic = null;
      headings.forEach(function (heading) {
        if (!heading || /^by (place|topic)$/i.test(heading)) {
          return;
        }
        var asRange = APP.timeline.parseChronicleTitle(heading.replace(/\s+AD$/i, "").replace(/^(\d+)\s+(BC|BCE)$/i, "$1 BC"));
        if (asRange) {
          headingRange = asRange;
          return;
        }
        topic = APP.timeline.topicFromHeading(heading) || topic;
        regionHint = APP.timeline.regionFromHeading(heading) || regionHint;
      });

      var context = headingRange || pageRange;
      if (!context) {
        continue;
      }

      var defaultEra = context.end < 0 ? "BC" : "AD";
      var lead = APP.timeline.parseLeadingDate(text, defaultEra);
      var start = context.start;
      var end = context.end;
      var precision = context.precision;
      var approximate = false;
      var body = text;

      if (lead && lead.year !== null && pageRange &&
        lead.year >= pageRange.start - 10 && lead.endYear <= pageRange.end + 10) {
        start = lead.year;
        end = lead.endYear;
        precision = "year";
        approximate = lead.approximate;
        body = lead.rest;
      } else if (lead && lead.dayLevel) {
        body = lead.rest;
      }

      body = body.replace(/^[—–:\-\s]+/, "");
      if (body.length < 12) {
        continue;
      }

      approximate = approximate || /\((approximate|possible) date\)|\bc\.\s*\d|\bcirca\b|\bapproximately\b/i.test(body);

      var flags = [];
      if (node.querySelector(".Template-Fact") || /citation needed/i.test(node.textContent)) {
        flags.push("citation-needed");
      }

      events.push({
        title: firstSentence(body),
        summary: body,
        start: start,
        end: end,
        precision: precision,
        approximate: approximate,
        regions: regionHint && regionHint.region ? [regionHint.region] : [],
        places: regionHint && regionHint.place ? [regionHint.place] : [],
        continents: regionHint && regionHint.continent ? [regionHint.continent] : [],
        category: topic,
        links: linkTitles(node),
        flags: flags,
        provider: "chronicle",
        providerLabel: "Wikipedia chronicle",
        sourceUrl: wikiUrl(pageTitle),
        sourceTitle: pageTitle
      });
    }

    return events;
  }

  // ---------- Wikipedia search + Wikidata dates ----------

  function bestClaim(claims) {
    var usable = (claims || []).filter(function (claim) {
      return claim.rank !== "deprecated" && claim.mainsnak && claim.mainsnak.datavalue;
    });
    var preferred = usable.filter(function (claim) {
      return claim.rank === "preferred";
    });
    return (preferred.length ? preferred : usable)[0] || null;
  }

  function claimTime(entity, property) {
    var claim = bestClaim(entity.claims && entity.claims[property]);
    if (!claim) {
      return null;
    }
    var range = APP.timeline.parseWikidataTime(claim.mainsnak.datavalue.value);
    if (range) {
      range.approximate = Boolean(claim.qualifiers && claim.qualifiers.P1480);
    }
    return range;
  }

  function entityDates(entity) {
    var point = claimTime(entity, "P585");
    if (point) {
      return { range: point, kind: "event" };
    }

    var start = claimTime(entity, "P580");
    var end = claimTime(entity, "P582");
    if (start || end) {
      return { range: merged(start || end, end || start), kind: "event" };
    }

    var inception = claimTime(entity, "P571");
    var dissolved = claimTime(entity, "P576");
    if (inception) {
      return { range: merged(inception, dissolved || inception), kind: "entity" };
    }

    var birth = claimTime(entity, "P569");
    var death = claimTime(entity, "P570");
    if (birth && death) {
      return { range: merged(birth, death), kind: "lifespan" };
    }

    var earliest = claimTime(entity, "P1319");
    var latest = claimTime(entity, "P1326");
    if (earliest || latest) {
      var range = merged(earliest || latest, latest || earliest);
      range.approximate = true;
      return { range: range, kind: "event" };
    }

    return null;

    function merged(first, second) {
      var coarse = APP.timeline.precisionTolerance[first.precision] >= APP.timeline.precisionTolerance[second.precision]
        ? first
        : second;
      return {
        start: first.start,
        end: Math.max(first.start, second.end),
        precision: coarse.precision,
        approximate: Boolean(first.approximate || second.approximate)
      };
    }
  }

  function fetchEntities(ids, signal) {
    var batches = [];
    for (var index = 0; index < ids.length; index += 25) {
      batches.push(ids.slice(index, index + 25));
    }

    return Promise.all(batches.map(function (batch) {
      return APP.http.getJson(APP.http.buildUrl(WIKIDATA_API, {
        action: "wbgetentities",
        format: "json",
        origin: "*",
        props: "claims",
        ids: batch.join("|")
      }), { signal: signal });
    })).then(function (responses) {
      var entities = {};
      responses.forEach(function (data) {
        Object.assign(entities, data.entities || {});
      });
      return entities;
    });
  }

  function searchPages(query, limit, signal) {
    var offsets = [];
    for (var offset = 0; offset < limit; offset += 20) {
      offsets.push(offset);
    }

    return Promise.all(offsets.map(function (offset) {
      return wikiQuery({
        action: "query",
        generator: "search",
        gsrsearch: query,
        gsrlimit: Math.min(20, limit - offset),
        gsroffset: offset,
        prop: "extracts|pageprops|coordinates",
        exintro: 1,
        explaintext: 1,
        exsentences: 3,
        exlimit: "max",
        ppprop: "wikibase_item|disambiguation",
        colimit: "max"
      }, signal).catch(function () {
        return {};
      });
    })).then(function (responses) {
      var pages = [];
      responses.forEach(function (data) {
        pages = pages.concat(data.query && data.query.pages ? data.query.pages : []);
      });
      return pages.sort(function (a, b) {
        return a.index - b.index;
      });
    });
  }

  function pagesToRecords(pages, entities, providerId, providerLabel) {
    var events = [];
    var sources = [];

    pages.forEach(function (page) {
      if (page.pageprops && page.pageprops.disambiguation !== undefined) {
        return;
      }

      var qid = page.pageprops && page.pageprops.wikibase_item;
      var entity = qid ? entities[qid] : null;
      var dates = entity ? entityDates(entity) : null;
      var coordsClaim = entity ? bestClaim(entity.claims && entity.claims.P625) : null;
      var coords = page.coordinates && page.coordinates[0]
        ? { lat: page.coordinates[0].lat, lon: page.coordinates[0].lon }
        : coordsClaim
          ? { lat: coordsClaim.mainsnak.datavalue.value.latitude, lon: coordsClaim.mainsnak.datavalue.value.longitude }
          : null;
      var continents = [];

      ((entity && entity.claims && entity.claims.P30) || []).forEach(function (claim) {
        var id = claim.mainsnak.datavalue && claim.mainsnak.datavalue.value.id;
        if (CONTINENT_QIDS[id] && continents.indexOf(CONTINENT_QIDS[id]) === -1) {
          continents.push(CONTINENT_QIDS[id]);
        }
      });

      sources.push({
        sourceType: "Encyclopedia article",
        title: page.title,
        excerpt: page.extract || "",
        url: wikiUrl(page.title),
        provider: providerId
      });

      if (!dates) {
        return;
      }

      events.push({
        title: page.title,
        summary: page.extract || "",
        start: dates.range.start,
        end: dates.range.end,
        precision: dates.range.precision,
        approximate: dates.range.approximate,
        coords: coords,
        continents: continents,
        category: dates.kind === "lifespan" ? "people" : null,
        kind: dates.kind,
        url: wikiUrl(page.title),
        articleTitle: page.title,
        wikidataId: qid,
        provider: providerId,
        providerLabel: providerLabel,
        sourceUrl: wikiUrl(page.title),
        sourceTitle: page.title
      });
    });

    return { events: events, sources: sources };
  }

  function lookupArticles(query, limit, signal) {
    return searchPages(query, limit, signal).then(function (pages) {
      var ids = pages
        .map(function (page) {
          return page.pageprops && page.pageprops.wikibase_item;
        })
        .filter(Boolean);

      return (ids.length ? fetchEntities(ids, signal) : Promise.resolve({})).then(function (entities) {
        return pagesToRecords(pages, entities, "encyclopedia", "Wikipedia + Wikidata");
      });
    });
  }

  function withinPlan(plan, record) {
    if (!APP.timeline.hasRange(plan)) {
      return true;
    }
    var pad = Math.max(5, Math.round((plan.end - plan.start) * 0.1));
    return APP.utils.rangesOverlap(record.start, record.end, plan.start - pad, plan.end + pad);
  }

  function regionTerm(plan) {
    var region = plan.region !== "All" ? plan.region : plan.focusRegions[0];
    return region ? REGION_SEARCH_TERMS[region] || region : "";
  }

  function toEvents(records) {
    return records.map(APP.timeline.createEvent).filter(Boolean);
  }

  // ---------- Provider registry ----------

  var providers = [
    {
      id: "curated",
      label: "Curated dataset",
      description: "Built-in Biblical and world reference events.",
      needs: "range",
      defaultOn: true,
      run: function (plan, api) {
        var lanes = APP.timeline.laneOrder();
        var records = APP.sources.getLocalEvents(plan.start, plan.end, "All", "All").map(function (event) {
          return {
            id: "curated-" + event.id,
            title: event.title,
            summary: event.detail,
            start: event.start,
            end: event.end,
            precision: "year",
            approximate: true,
            regions: event.regions.filter(function (region) { return lanes.indexOf(region) !== -1; }),
            places: event.regions.filter(function (region) { return lanes.indexOf(region) === -1; }),
            continents: event.continents,
            domain: event.domain,
            provider: "curated",
            providerLabel: "Curated dataset"
          };
        });
        api.emit(toEvents(records), []);
        return Promise.resolve({ message: records.length + " curated records" });
      }
    },
    {
      id: "chronicle",
      label: "Wikipedia chronicles",
      description: "Year, decade, and century pages with events organized by place.",
      needs: "range",
      defaultOn: true,
      run: function (plan, api) {
        var cap = api.depth.chroniclePages;
        var candidates = chronicleCandidates(plan, cap);

        api.progress("Resolving " + candidates.length + " chronicle page titles");

        return resolveTitles(candidates, api.signal).then(function (pages) {
          var chosen = sample(pages, cap);
          var total = 0;
          var done = 0;

          return Promise.all(chosen.map(function (title) {
            return wikiQuery({
              action: "parse",
              page: title,
              prop: "text",
              redirects: 1,
              disableeditsection: 1,
              disablelimitreport: 1,
              disabletoc: 1
            }, api.signal).then(function (data) {
              var records = parseChronicleHtml(data.parse ? data.parse.text : "", data.parse ? data.parse.title : title)
                .filter(function (record) {
                  return APP.utils.rangesOverlap(record.start, record.end, plan.start, plan.end);
                });
              total += records.length;
              done += 1;
              api.progress("Read " + done + " of " + chosen.length + " pages");
              api.emit(toEvents(records), [{
                sourceType: "Wikipedia chronicle",
                title: title,
                excerpt: records.length + " dated entries in range.",
                url: wikiUrl(title),
                provider: "chronicle"
              }]);
            }).catch(function (error) {
              if (APP.http.isAbort(error)) {
                throw error;
              }
              done += 1;
            });
          })).then(function () {
            var skipped = pages.length - chosen.length;
            return {
              message: total + " entries from " + chosen.length + " page(s)" +
                (skipped > 0 ? "; " + skipped + " more page(s) available at a deeper depth" : "")
            };
          });
        });
      }
    },
    {
      id: "encyclopedia",
      label: "Wikipedia + Wikidata",
      description: "Keyword search, with dates, precision, and coordinates from Wikidata.",
      needs: "keywords",
      defaultOn: true,
      run: function (plan, api) {
        var queries = [];
        var term = regionTerm(plan);

        if (plan.keywords) {
          queries.push(plan.keywords);
          (plan.extraQueries || []).forEach(function (query) {
            queries.push(query);
          });
          if (APP.timeline.hasRange(plan)) {
            queries.push(plan.keywords + " " + centuryLabel(Math.round((plan.start + plan.end) / 2)));
          }
        } else if (term && APP.timeline.hasRange(plan)) {
          queries.push(term + " " + centuryLabel(Math.round((plan.start + plan.end) / 2)));
          queries.push(term + " history " + centuryLabel(plan.start));
        }

        queries = queries.filter(function (query, index) {
          return queries.indexOf(query) === index;
        }).slice(0, api.depth.searchVariants + (plan.extraQueries || []).length);

        if (!queries.length) {
          return Promise.resolve({ message: "Skipped: add keywords or a region to search articles", skipped: true });
        }

        var eventCount = 0;
        return Promise.all(queries.map(function (query, index) {
          var limit = index === 0 ? api.depth.searchLimit : Math.ceil(api.depth.searchLimit / 2);
          return lookupArticles(query, limit, api.signal).then(function (result) {
            var kept = result.events.filter(function (record) {
              return withinPlan(plan, record) && !(record.kind !== "lifespan" && record.end - record.start > 1500);
            });
            eventCount += kept.length;
            api.emit(toEvents(kept), result.sources.slice(0, 8), { ranked: index === 0 });
          });
        })).then(function () {
          return { message: eventCount + " dated articles from " + queries.length + " search(es)" };
        });
      }
    },
    {
      id: "wikidata",
      label: "Wikidata dated events",
      description: "Structured battles, sieges, treaties, and other dated occurrences. Slower.",
      needs: "range",
      defaultOn: true,
      run: function (plan, api) {
        var span = plan.end - plan.start;
        if (!api.depth.sparqlLimit) {
          return Promise.resolve({ message: "Skipped at quick depth", skipped: true });
        }
        if (span > 400) {
          return Promise.resolve({ message: "Skipped: range wider than 400 years", skipped: true });
        }

        function literal(year, endOfYear) {
          var astronomical = APP.timeline.toAstronomical(year);
          var digits = String(Math.abs(astronomical));
          while (digits.length < 4) {
            digits = "0" + digits;
          }
          return "\"" + (astronomical < 0 ? "-" : "") + digits + (endOfYear ? "-12-31" : "-01-01") + "T00:00:00Z\"^^xsd:dateTime";
        }

        var query = [
          "SELECT ?item ?itemLabel ?itemDescription ?date ?precision ?endDate ?coord ?article WHERE {",
          "  VALUES ?prop { p:P585 p:P580 }",
          "  ?item ?prop ?statement . ?statement psv:P585|psv:P580 ?value .",
          "  ?value wikibase:timeValue ?date ; wikibase:timePrecision ?precision .",
          "  FILTER(?date >= " + literal(plan.start, false) + " && ?date <= " + literal(plan.end, true) + ")",
          "  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .",
          "  OPTIONAL { ?item wdt:P582 ?endDate }",
          "  OPTIONAL { ?item wdt:P625 ?coord }",
          "  SERVICE wikibase:label { bd:serviceParam wikibase:language \"en\". }",
          "} LIMIT " + api.depth.sparqlLimit
        ].join("\n");

        api.progress("Querying Wikidata (can take 10–40s)");

        return APP.http.getJson(APP.http.buildUrl(WDQS, { query: query, format: "json" }), {
          signal: api.signal,
          timeoutMs: 55000,
          // WDQS gateways sometimes 502 on cold queries; a retry usually hits its result cache.
          retries: 1
        }).then(function (data) {
          var seen = {};
          var records = [];

          (data.results ? data.results.bindings : []).forEach(function (row) {
            var qid = row.item.value.split("/").pop();
            var label = row.itemLabel ? row.itemLabel.value : "";
            var description = row.itemDescription ? row.itemDescription.value : "";

            if (seen[qid] || /^list of|^Q\d+$/i.test(label) || APP.timeline.parseChronicleTitle(label) || NOISE_DESCRIPTION.test(description)) {
              return;
            }
            seen[qid] = true;

            var match = row.date.value.match(/^(-?)(\d+)-/);
            var precisionCode = Number(row.precision.value);
            var astronomical = Number(match[2]) * (match[1] ? -1 : 1);
            // Coarse precisions keep the stored magnitude; year-level values are shifted to historical numbering.
            var year = precisionCode >= 9 ? APP.timeline.fromAstronomical(astronomical) : astronomical;
            var range = APP.timeline.parseWikidataTime({
              time: (year < 0 ? "-" : "+") + Math.abs(year) + "-00-00T00:00:00Z",
              precision: precisionCode
            });
            var point = row.coord ? row.coord.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/) : null;
            var articleTitle = decodeURIComponent(row.article.value.split("/wiki/")[1] || "").replace(/_/g, " ");
            var endMatch = row.endDate ? row.endDate.value.match(/^(-?)(\d+)-/) : null;
            var endYear = endMatch ? APP.timeline.fromAstronomical(Number(endMatch[2]) * (endMatch[1] ? -1 : 1)) : null;

            records.push({
              title: articleTitle || label,
              summary: description ? description.charAt(0).toUpperCase() + description.slice(1) + "." : "",
              start: range.start,
              end: endYear !== null && endYear >= range.start && endYear - range.start <= 400 ? endYear : range.end,
              precision: range.precision,
              coords: point ? { lat: Number(point[2]), lon: Number(point[1]) } : null,
              url: row.article.value,
              articleTitle: articleTitle,
              wikidataId: qid,
              kind: "event",
              provider: "wikidata",
              providerLabel: "Wikidata",
              sourceUrl: row.item.value,
              sourceTitle: label
            });
          });

          api.emit(toEvents(records), []);
          return { message: records.length + " structured events" };
        });
      }
    },
    {
      id: "scholarly",
      label: "OpenAlex scholarship",
      description: "Peer-reviewed works and books for further reading (not plotted).",
      needs: "any",
      defaultOn: true,
      run: function (plan, api) {
        var query = plan.keywords ||
          [regionTerm(plan), APP.timeline.hasRange(plan) ? centuryLabel(Math.round((plan.start + plan.end) / 2)) : ""].join(" ").trim();

        if (!query) {
          return Promise.resolve({ message: "Skipped: no topic to search", skipped: true });
        }

        return searchScholarship(query, api.depth.scholarly, api.signal).then(function (sources) {
          api.emit([], sources);
          return { message: sources.length + " works" };
        });
      }
    },
    {
      id: "web",
      label: "Web search (SearXNG)",
      description: "Your own SearXNG instance with JSON output enabled.",
      needs: "any",
      defaultOn: false,
      run: function (plan, api) {
        var endpoint = String(api.options.searxEndpoint || "").replace(/\/+$/, "");
        if (!endpoint) {
          return Promise.resolve({ message: "Skipped: set a SearXNG URL", skipped: true });
        }

        var query = (plan.keywords || plan.query) +
          (APP.timeline.hasRange(plan) ? " " + APP.utils.formatRange(plan.start, plan.end) : "") + " history";

        return APP.http.getJson(APP.http.buildUrl(endpoint + "/search", {
          q: query,
          format: "json",
          language: "en"
        }), { signal: api.signal, retries: 1 }).then(function (data) {
          var sources = (data.results || []).slice(0, api.depth.searchLimit).map(function (result) {
            return {
              sourceType: "Web search",
              title: result.title || result.url,
              excerpt: result.content || "",
              url: result.url,
              provider: "web"
            };
          });
          api.emit([], sources);
          return { message: sources.length + " web results" };
        });
      }
    },
    {
      id: "urls",
      label: "Your URLs",
      description: "Public pages you listed (the site must allow cross-origin reads).",
      needs: "any",
      defaultOn: true,
      hidden: true,
      run: function (plan, api) {
        var urls = api.options.urls || [];
        if (!urls.length) {
          return Promise.resolve({ message: "No URLs provided", skipped: true });
        }

        return Promise.all(urls.map(function (url) {
          return APP.research.fetchPublicUrl(url).then(function (source) {
            source.provider = "urls";
            source.fullText = source.excerpt;
            return source;
          }).catch(function (error) {
            return {
              sourceType: "URL unavailable",
              title: url,
              excerpt: "Could not read this page (it may block cross-origin access). " + error.message,
              url: url,
              provider: "urls"
            };
          });
        })).then(function (sources) {
          api.emit([], sources);
          return { message: sources.length + " page(s) read" };
        });
      }
    }
  ];

  function reconstructAbstract(index) {
    if (!index) {
      return "";
    }
    var words = [];
    Object.keys(index).forEach(function (word) {
      index[word].forEach(function (position) {
        words[position] = word;
      });
    });
    return words.join(" ").replace(/\s+/g, " ").trim();
  }

  function searchScholarship(query, limit, signal) {
    return APP.http.getJson(APP.http.buildUrl(OPENALEX, {
      search: query,
      per_page: limit,
      select: "id,display_name,publication_year,doi,cited_by_count,authorships,primary_location,abstract_inverted_index,open_access"
    }), { signal: signal }).then(function (data) {
      return (data.results || []).map(function (work) {
        var authors = (work.authorships || []).slice(0, 3).map(function (item) {
          return item.author && item.author.display_name;
        }).filter(Boolean);
        var venue = work.primary_location && work.primary_location.source
          ? work.primary_location.source.display_name
          : "";

        return {
          sourceType: "Scholarship",
          title: work.display_name,
          excerpt: APP.utils.truncate(reconstructAbstract(work.abstract_inverted_index), 700),
          meta: [
            authors.join(", ") + ((work.authorships || []).length > 3 ? " et al." : ""),
            work.publication_year,
            venue,
            work.cited_by_count ? "cited " + work.cited_by_count + "×" : ""
          ].filter(Boolean).join(" · "),
          url: work.doi || (work.open_access && work.open_access.oa_url) || work.id,
          provider: "scholarly"
        };
      });
    });
  }

  APP.timelineProviders = {
    list: providers,

    get: function (id) {
      return providers.filter(function (provider) {
        return provider.id === id;
      })[0];
    },

    lookupArticles: lookupArticles,
    searchScholarship: searchScholarship,
    parseChronicleHtml: parseChronicleHtml,
    wikiUrl: wikiUrl,

    // Full plain-text article body for deep dives (TextExtracts caps exchars, so truncate locally).
    fetchArticleText: function (title, signal) {
      return wikiQuery({
        action: "query",
        prop: "extracts",
        explaintext: 1,
        redirects: 1,
        titles: title
      }, signal).then(function (data) {
        var page = data.query && data.query.pages && data.query.pages[0];
        return page && page.extract ? APP.utils.truncate(page.extract, 9000) : "";
      });
    }
  };
}());
