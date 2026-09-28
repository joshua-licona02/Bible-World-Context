(function () {
  "use strict";

  var ERA = "(BCE|BC|CE|AD)";
  var ORDINAL_WORDS = {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
    eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13,
    fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18,
    nineteenth: 19, twentieth: 20
  };

  var STOPWORDS = (
    "a an the what which who whom whose when where why how was were is are be been being " +
    "happening happened happen going on in at of for from to during while around about between and or " +
    "did do does world worlds event events history historical timeline time times period era year years " +
    "show me tell list give else other elsewhere same then there their this that these those with by as " +
    "into over under like ce bce bc ad meanwhile anything something things any all across compare " +
    "comparison vs versus happen occurring occurred going context approximately circa c roughly"
  ).split(" ").reduce(function (map, word) {
    map[word] = true;
    return map;
  }, {});

  // [canonical region, finer place label, pattern]. Order matters: specific places first.
  var REGION_RULES = [
    ["West Asia / Near East", "Levant", /\b(levant\w*|jud(a)?ea\w*|judah\w*|israel\w*|jerusalem|samaria\w*|galilee|palestin\w*|phoenicia\w*|tyre|sidon|philistin\w*|canaan\w*|edom\w*|moab\w*|ammon\w*|nabatae\w*|damascus|syria\w*|antioch|hasmon\w*|herod\w*|maccab\w*|yehud)\b/i],
    ["West Asia / Near East", "Mesopotamia", /\b(mesopotamia\w*|babylon\w*|assyria\w*|nineveh|sumer\w*|akkad\w*|chaldea\w*|uruk|nebuchadnezzar)\b/i],
    ["West Asia / Near East", "Persia", /\b(persia\w*|achaemenid\w*|parthia\w*|arsacid\w*|sasanian\w*|sassanid\w*|medes|median empire|elam\w*|iran\w*|cyrus|darius|xerxes)\b/i],
    ["West Asia / Near East", "Anatolia", /\b(anatolia\w*|asia minor|lydia\w*|hittite\w*|phrygia\w*|cappadocia\w*|pontus|galatia\w*|ephesus|bithynia|armenia\w*|urartu\w*|cilicia\w*)\b/i],
    ["West Asia / Near East", "Arabia", /\b(arabia\w*|sheba|sabae\w*|himyar\w*|yemen\w*)\b/i],
    ["Nile Valley", "Egypt", /\b(egypt\w*|pharaoh\w*|ptolem\w*|nile|alexandria|memphis|thebes|cleopatra)\b/i],
    ["Nile Valley", "Nubia", /\b(nubia\w*|kush|kushite\w*|meroe|meroitic|napata)\b/i],
    ["North Africa", "Maghreb", /\b(carthag\w*|punic|numidia\w*|cyren\w*|libya\w*|mauretania\w*|berber\w*)\b/i],
    ["Horn of Africa", "Aksum", /\b(aksum\w*|axum\w*|ethiopia\w*|eritrea\w*|punt|somali\w*)\b/i],
    ["West Africa", "West Africa", /\b(nok culture|ghana empire|mali empire|songhai|sahel|niger river|djenn[eé])\b/i],
    ["East Africa", "East Africa", /\b(swahili|zanzibar|kenya\w*|tanzania\w*|great zimbabwe|azania)\b/i],
    ["Japan and Korea", "Japan", /\b(japan\w*|yayoi|jomon|j[oō]mon|kofun|yamato|himiko)\b/i],
    ["Japan and Korea", "Korea", /\b(korea\w*|goguryeo|baekje|silla|gojoseon|gaya confederacy)\b/i],
    ["East Asia", "China", /\b(china|chinese|han dynasty|western han|eastern han|qin dynasty|zhou dynasty|shang dynasty|xin dynasty|wang mang|luoyang|chang'?an|spring and autumn|warring states|confuci\w*|laozi|guangwu|three kingdoms)\b/i],
    ["Central Asia", "Central Asia", /\b(bactria\w*|sogdia\w*|scythia\w*|saka|sarmatia\w*|xiongnu|yuezhi|silk road|afghanistan|ferghana|dayuan|mongol\w*)\b/i],
    ["South Asia", "India", /\b(india\w*|maurya\w*|ashoka|magadha|gandhara\w*|gupta\w*|satavahana\w*|shunga|kanishka|kushan\w*|buddha|buddhis\w*|jain\w*|vedic|tamil\w*|chola\w*|pandya\w*|sri lanka\w*|ceylon|pakistan\w*)\b/i],
    ["Southeast Asia", "Southeast Asia", /\b(vietnam\w*|funan|champa|cambodia\w*|khmer|thailand|burma|myanmar|java\w*|sumatra\w*|malay\w*|philippin\w*|dong son|srivijaya)\b/i],
    ["Mediterranean Europe", "Greece", /\b(greece|greek\w*|athen\w*|sparta\w*|macedon\w*|hellen\w*|corinth\w*|crete|cretan|delphi|olympi\w*|alexander the great|thrac\w*)\b/i],
    ["Mediterranean Europe", "Rome", /\b(rome|roman\w*|italy|italian|etruscan\w*|sicily|syracuse|augustus|tiberius|caligula|claudius|nero|vespasian|trajan|julius caesar|praetorian|pompey|byzant\w*|constantinople)\b/i],
    ["Mediterranean Europe", "Iberia", /\b(hispania|iberia\w*|spain|spanish|lusitania\w*|portugal)\b/i],
    ["Western Europe", "Gaul and Britain", /\b(gaul\w*|gallic|france|frank\w*|britain|british|britons?|britannia|celt\w*|belgae|druid\w*|ireland|irish|hallstatt|la t[eè]ne)\b/i],
    ["Northern Europe", "Northern Europe", /\b(germani\w*|germanic|scandinavia\w*|norse|viking\w*|denmark|danish|sweden|norway|baltic|jastorf|nordic)\b/i],
    ["Eastern Europe", "Eastern Europe", /\b(dacia\w*|slav\w*|pannonia\w*|danube|black sea|crimea\w*|bosporan|russia\w*|ukrain\w*|poland|polish)\b/i],
    ["Mesoamerica", "Mesoamerica", /\b(maya\w*|olmec\w*|zapotec\w*|teotihuacan|aztec\w*|mexic\w*|monte alb[aá]n|mesoamerica\w*|toltec\w*|izapa)\b/i],
    ["North America", "North America", /\b(adena|hopewell|ancestral puebloan\w*|anasazi|puebloan\w*|mississippian|cahokia|inuit|iroquois|native american\w*|poverty point)\b/i],
    ["Andes", "Andes", /\b(andes|andean|chav[ií]n|paracas|nazca|nasca|moche|tiwanaku|wari|inca\w*|peru\w*|bolivia\w*|norte chico|caral)\b/i],
    ["Amazonia", "Amazonia", /\b(amazonia\w*|amazon basin|marajoara)\b/i],
    ["South America", "South America", /\b(south america\w*|chile\w*|argentin\w*|brazil\w*|colombia\w*|venezuela\w*)\b/i],
    ["Polynesia", "Polynesia", /\b(polynesia\w*|samoa\w*|tonga\w*|hawai\w*|tahiti\w*|m[aā]ori|new zealand|easter island|rapa nui)\b/i],
    ["Melanesia", "Melanesia", /\b(melanesia\w*|lapita|fiji\w*|new guinea|vanuatu|solomon islands)\b/i],
    ["Micronesia", "Micronesia", /\b(micronesia\w*|guam|mariana islands|palau)\b/i],
    ["Australia", "Australia", /\b(australia\w*|aborigin\w*|torres strait)\b/i]
  ];

  // Heading-only fallbacks used by chronicle pages ("By place" subsections).
  var GENERIC_HEADINGS = [
    [/^europe$/i, "Europe", "Europe"],
    [/^(asia|near east|middle east|west asia|western asia)$/i, "West Asia / Near East", "Asia"],
    [/^(east asia|far east)$/i, "East Asia", "Asia"],
    [/^(south asia|indian subcontinent)$/i, "South Asia", "Asia"],
    [/^(americas?|north america)$/i, "North America", "North America"],
    [/^oceania$/i, "Oceania", "Oceania"],
    [/^africa$/i, null, "Africa"]
  ];

  // Rough coordinate boxes, checked in order, for items that carry coordinates but no place words.
  var COORD_RULES = [
    ["Nile Valley", function (lat, lon) { return lat >= 21.5 && lat <= 31.7 && lon >= 24.5 && lon <= 34.2; }],
    ["North Africa", function (lat, lon) {
      var inBand = lat >= 19 && lon >= -18 && lon <= 25;
      return inBand && (lat < 35.95 || (lon > -1.5 && lon < 11.5 && lat < 37.4));
    }],
    ["West Asia / Near East", function (lat, lon) { return lat >= 12 && lat <= 42.5 && lon >= 26 && lon <= 63; }],
    ["Japan and Korea", function (lat, lon) { return lat >= 30 && lat <= 46 && lon >= 124 && lon <= 146; }],
    ["East Asia", function (lat, lon) { return lat >= 18 && lat <= 54 && lon >= 92 && lon <= 135; }],
    ["South Asia", function (lat, lon) { return lat >= 5 && lat <= 37 && lon >= 60 && lon <= 92; }],
    ["Central Asia", function (lat, lon) { return lat >= 35 && lat <= 56 && lon >= 46 && lon <= 92; }],
    ["Southeast Asia", function (lat, lon) { return lat >= -11 && lat <= 28 && lon >= 92 && lon <= 141; }],
    ["Horn of Africa", function (lat, lon) { return lat >= -2 && lat <= 18 && lon >= 36 && lon <= 52; }],
    ["Mediterranean Europe", function (lat, lon) { return lat >= 35 && lat <= 47 && lon >= -10 && lon <= 30; }],
    ["Western Europe", function (lat, lon) { return lat >= 42 && lat <= 61 && lon >= -11 && lon <= 8; }],
    ["Northern Europe", function (lat, lon) { return lat >= 53 && lat <= 72 && lon >= 5 && lon <= 32; }],
    ["Eastern Europe", function (lat, lon) { return lat >= 44 && lat <= 70 && lon >= 20 && lon <= 60; }],
    ["West Africa", function (lat, lon) { return lat >= 4 && lat <= 25 && lon >= -18 && lon <= 16; }],
    ["East Africa", function (lat, lon) { return lat >= -12 && lat <= 5 && lon >= 28 && lon <= 42; }],
    ["Mesoamerica", function (lat, lon) { return lat >= 13 && lat <= 23 && lon >= -106 && lon <= -86; }],
    ["North America", function (lat, lon) { return lat >= 23 && lat <= 72 && lon >= -170 && lon <= -50; }],
    ["Andes", function (lat, lon) { return lat >= -40 && lat <= 5 && lon >= -82 && lon <= -65; }],
    ["Amazonia", function (lat, lon) { return lat >= -15 && lat <= 5 && lon >= -65 && lon <= -45; }],
    ["South America", function (lat, lon) { return lat >= -56 && lat <= 13 && lon >= -82 && lon <= -34; }],
    ["Australia", function (lat, lon) { return lat >= -45 && lat <= -10 && lon >= 112 && lon <= 155; }],
    ["Melanesia", function (lat, lon) { return lat >= -25 && lat <= 0 && lon >= 140 && lon <= 180; }],
    ["Micronesia", function (lat, lon) { return lat >= 0 && lat <= 22 && lon >= 130 && lon <= 175; }],
    ["Polynesia", function (lat, lon) { return lat >= -50 && lat <= 30 && (lon >= 170 || lon <= -130); }]
  ];

  var BIBLICAL_PATTERN = /\b(jesus|christ|apostles?|apostolic|paul the apostle|saint paul|st\.? paul|simon peter|saint peter|john the baptist|pontius pilate|pilate|herod\w*|disciples?|gospels?|pentecost|early church|judah\w*|jud(a)?ea\w*|israel\w*|jerusalem|samaria\w*|galilee|second temple|first temple|solomon'?s temple|king david|solomon|hezekiah|josiah|jeroboam|rehoboam|ahab|jezebel|jehu|elijah|elisha|isaiah|jeremiah|ezekiel|prophet daniel|book of daniel|ezra|nehemiah|zerubbabel|moses|exodus|abraham|hebrews?|jews|jewish|judaism|maccabe\w*|hasmon\w*|essene\w*|pharisee\w*|sadducee\w*|sanhedrin|synagogue\w*|torah|septuagint|qumran|dead sea scrolls|nebuchadnezzar|cyrus the great|babylonian (captivity|exile)|yehud)\b/i;

  var CATEGORY_RULES = [
    ["disaster", /\b(earthquakes?|floods?|flooding|famines?|plagues?|epidemics?|pandemic|fires?|eruptions?|erupts?|volcan\w*|droughts?|tsunami|pestilence)\b/i],
    ["conflict", /\b(battles?|sieges?|wars?|revolts?|rebellions?|rebels?|invad\w*|invasions?|conquer\w*|conquests?|defeat\w*|campaigns?|sack\w*|besieg\w*|army|armies|troops|legions?|massacres?|captur\w*|destroy\w*|destruction|uprisings?|raids?)\b/i],
    ["religion", /\b(temples?|priests?|gods?|goddess\w*|religio\w*|prophets?|church\w*|buddh\w*|confuci\w*|tao\w*|zoroastr\w*|cults?|worship\w*|christian\w*|jewish|judaism|jesus|apostles?|bishops?|pope|monaster\w*|scriptures?|crucifi\w*|synagogues?|sacred|rituals?)\b/i],
    ["science", /\b(astronom\w*|eclipses?|comets?|invent\w*|calendars?|mathemat\w*|medicine|physicians?|engineer\w*|scien\w*|geograph\w*)\b/i],
    ["culture", /\b(writes?|wrote|written|poets?|poetry|philosoph\w*|artists?|architect\w*|built|builds|construct\w*|literature|plays?|playwrights?|translat\w*|historians?|library|sculpt\w*|music\w*|theat\w*|compos\w*)\b/i],
    ["economy", /\b(trade|trading|coins?|coinage|tax\w*|silk|merchants?|commerce|currency|markets?|tribute)\b/i],
    ["politics", /\b(kings?|queens?|emperors?|empress|reign\w*|succeed\w*|succession|crowned|coronation|dynasty|consuls?|throne|annex\w*|provinces?|governors?|prefects?|appoint\w*|treaty|alliances?|found(?:s|ed|ing)?|establish\w*|rulers?|pharaoh|satraps?|tetrarch\w*|procurators?|assassinat\w*|abdicat\w*|usurp\w*)\b/i]
  ];

  var TOPIC_HEADINGS = [
    [/relig|church|philosophy/i, "religion"],
    [/science|technolog|astronom/i, "science"],
    [/art|culture|literature|architecture/i, "culture"],
    [/econom|commerce|trade/i, "economy"],
    [/disaster|nature|environment/i, "disaster"],
    [/war|military|conflict/i, "conflict"]
  ];

  var PROVIDER_WEIGHT = {
    curated: 0.8,
    wikidata: 0.78,
    encyclopedia: 0.75,
    chronicle: 0.62,
    web: 0.45,
    urls: 0.45,
    "llm-extract": 0.4,
    "llm-suggest": 0.3
  };

  var PRECISION_TOLERANCE = { day: 0, month: 0, year: 1, decade: 10, century: 100, millennium: 1000 };

  var HINTS = [
    [/\bcrucifi\w*|\bresurrection\b|\bpassion week\b/i, 29, 34, "the crucifixion period"],
    [/\bbirth of jesus\b|\bnativity\b/i, -6, 4, "the birth of Jesus"],
    [/\bpentecost\b|\bearly church\b/i, 30, 40, "the earliest church"],
    [/\bpauline\b|\bpaul\b/i, 45, 65, "the Pauline mission"],
    [/\b(destruction of the (second )?temple|jewish[- ]roman war|siege of jerusalem \(?70)/i, 66, 73, "the First Jewish-Roman War"],
    [/\bfall of samaria\b/i, -725, -720, "the fall of Samaria"],
    [/\b(babylonian (exile|captivity)|exile in babylon|daniel)\b/i, -605, -539, "the Babylonian exile"],
    [/\bfall of jerusalem\b/i, -590, -580, "the fall of Jerusalem"],
    [/\breturn from exile\b|\brebuild\w* the temple\b|\bezra\b|\bnehemiah\b/i, -539, -430, "the Persian-period return"],
    [/\bsolomon\b/i, -970, -930, "Solomon's reign"],
    [/\bking david\b|\bdavidic\b/i, -1010, -970, "David's reign"],
    [/\bexodus\b|\bmoses\b/i, -1550, -1200, "the Exodus traditions"],
    [/\babraham\b|\bpatriarch\w*\b/i, -2100, -1700, "the patriarchal narratives"],
    [/\bjesus\b|\bchrist\b/i, 27, 33, "the ministry of Jesus"]
  ];

  // Book names that are ordinary English words unless followed by a chapter number.
  var AMBIGUOUS_BOOKS = { Job: true, Mark: true, Acts: true, Numbers: true, Judges: true, Revelation: true, Lamentations: true, Exodus: true };

  function eraSign(era, fallbackEra) {
    var value = String(era || fallbackEra || "").toUpperCase();
    return value === "BC" || value === "BCE" ? -1 : 1;
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function hash(text) {
    var value = 5381;
    for (var index = 0; index < text.length; index += 1) {
      value = ((value << 5) + value + text.charCodeAt(index)) | 0;
    }
    return (value >>> 0).toString(36);
  }

  function tokens(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .split(/[^a-z0-9']+/)
      .filter(function (word) {
        return word.length > 2 && !STOPWORDS[word];
      });
  }

  function overlapCoefficient(a, b) {
    if (!a.length || !b.length) {
      return 0;
    }
    var setB = {};
    b.forEach(function (word) { setB[word] = true; });
    var shared = a.filter(function (word, index) {
      return setB[word] && a.indexOf(word) === index;
    }).length;
    return shared / Math.min(a.length, b.length);
  }

  function centuryRange(number, sign) {
    return sign < 0
      ? { start: -(number * 100), end: -((number - 1) * 100 + 1) }
      : { start: (number - 1) * 100 + 1, end: number * 100 };
  }

  APP.timeline = {
    precisionTolerance: PRECISION_TOLERANCE,
    providerWeight: PROVIDER_WEIGHT,

    depthSettings: {
      quick: { chroniclePages: 3, searchLimit: 10, searchVariants: 1, sparqlLimit: 0, scholarly: 5, gapFill: 6 },
      standard: { chroniclePages: 8, searchLimit: 20, searchVariants: 2, sparqlLimit: 150, scholarly: 8, gapFill: 10 },
      deep: { chroniclePages: 16, searchLimit: 40, searchVariants: 3, sparqlLimit: 300, scholarly: 15, gapFill: 16 }
    },

    regionToContinent: function (region) {
      var continents = APP.sources.continents;
      var match = null;
      Object.keys(continents).some(function (continent) {
        if (continents[continent].indexOf(region) !== -1) {
          match = continent;
          return true;
        }
        return false;
      });
      return match;
    },

    laneOrder: function () {
      var order = [];
      Object.keys(APP.sources.continents).forEach(function (continent) {
        APP.sources.continents[continent].forEach(function (region) {
          order.push(region);
        });
      });
      return order;
    },

    // ---------- Date parsing ----------

    ordinalRange: function (number, unit, sign) {
      if (unit === "millennium") {
        return sign < 0
          ? { start: -(number * 1000), end: -((number - 1) * 1000 + 1), precision: "millennium" }
          : { start: (number - 1) * 1000 + 1, end: number * 1000, precision: "millennium" };
      }
      var century = centuryRange(number, sign);
      century.precision = "century";
      return century;
    },

    decadeRange: function (decade, sign) {
      return sign < 0
        ? { start: -(decade + 9), end: -decade, precision: "decade" }
        : { start: Math.max(1, decade), end: decade + 9, precision: "decade" };
    },

    // Finds the first explicit date expression in free text. Returns null when none is present.
    parseDateText: function (text) {
      var value = String(text || "");
      var approximate = /\b(c\.|ca\.|circa|approx\w*|around|about|roughly)\s*$/i;
      var match;

      match = value.match(new RegExp("\\b(\\d{1,2})(?:st|nd|rd|th)\\s+(century|millennium)\\s*" + ERA + "?", "i")) ||
        value.match(new RegExp("\\b(" + Object.keys(ORDINAL_WORDS).join("|") + ")\\s+(century|millennium)\\s*" + ERA + "?", "i"));
      if (match) {
        var number = Number(match[1]) || ORDINAL_WORDS[match[1].toLowerCase()];
        var ordinal = APP.timeline.ordinalRange(number, match[2].toLowerCase(), eraSign(match[3]));
        ordinal.matched = match[0];
        ordinal.approximate = true;
        return ordinal;
      }

      match = value.match(new RegExp("\\b(?:" + ERA + "\\s*)?(\\d{1,4})\\s*" + ERA + "?\\s*(?:-|–|—|to|until|through|and)\\s*(?:" + ERA + "\\s*)?(\\d{1,4})\\s*" + ERA + "?", "i"));
      if (match) {
        var firstEra = match[1] || match[3];
        var secondEra = match[4] || match[6];
        var introduced = /\b(between|from|years?|during)\s*$/i.test(value.slice(0, match.index));
        if (firstEra || secondEra || introduced) {
          var first = Number(match[2]) * eraSign(firstEra || secondEra);
          var second = Number(match[5]) * eraSign(secondEra || firstEra);
          return {
            start: Math.min(first, second),
            end: Math.max(first, second),
            precision: "year",
            approximate: approximate.test(value.slice(0, match.index)),
            matched: match[0]
          };
        }
      }

      match = value.match(new RegExp("\\b(\\d{1,3}0)s\\s*" + ERA + "?\\b", "i"));
      if (match) {
        var decade = APP.timeline.decadeRange(Number(match[1]), eraSign(match[2]));
        decade.matched = match[0];
        decade.approximate = false;
        return decade;
      }

      match = value.match(new RegExp("\\b" + ERA + "\\s*(\\d{1,4})\\b|\\b(\\d{1,4})\\s*" + ERA + "\\b", "i"));
      if (match) {
        var year = match[2] ? Number(match[2]) * eraSign(match[1]) : Number(match[3]) * eraSign(match[4]);
        return {
          start: year,
          end: year,
          precision: "year",
          approximate: approximate.test(value.slice(0, match.index)),
          matched: match[0]
        };
      }

      match = value.match(/\b(?:in|year|around|circa|c\.)\s+(\d{3,4})\b/i);
      if (match) {
        return {
          start: Number(match[1]),
          end: Number(match[1]),
          precision: "year",
          approximate: /around|circa|c\./i.test(match[0]),
          matched: match[0]
        };
      }

      return null;
    },

    // Parses a leading chronicle date such as "16 March 597 BC:", "587/586 BC—", or "AD 30 –".
    parseLeadingDate: function (text, defaultEra) {
      var value = String(text || "").trim();
      var months = "(?:January|February|March|April|May|June|July|August|September|October|November|December)";
      var pattern = new RegExp(
        "^(c\\.\\s*|ca\\.\\s*|circa\\s+)?" +
        "(?:(?:\\d{1,2}\\s+)?" + months + "(?:\\s+\\d{1,2})?,?\\s+|" + months + "\\s+)?" +
        "(?:" + ERA + "\\s*)?(\\d{1,4})(?:\\s*[/–-]\\s*(\\d{1,4}))?\\s*" + ERA + "?" +
        "\\s*(?:[:—–]|-\\s)\\s*",
        "i"
      );
      // Checked first so "August 20 –" is read as a day within the heading's year, not as year 20.
      var monthOnly = value.match(new RegExp("^(" + months + "(?:\\s+\\d{1,2})?(?:\\s*[–-]\\s*\\d{1,2})?|\\d{1,2}\\s+" + months + "|" + months + " or " + months + ")\\s*[—–:-]\\s*", "i"));
      if (monthOnly) {
        return { year: null, rest: value.slice(monthOnly[0].length), dayLevel: true };
      }

      var match = value.match(pattern);
      if (!match) {
        return null;
      }

      var era = match[2] || match[5] || defaultEra;
      var sign = eraSign(era);
      var first = Number(match[3]) * sign;
      var second = match[4] ? Number(match[4]) * sign : first;

      return {
        year: Math.min(first, second),
        endYear: Math.max(first, second),
        approximate: Boolean(match[1] || match[4]),
        rest: value.slice(match[0].length),
        explicitEra: Boolean(match[2] || match[5])
      };
    },

    // Interprets a Wikipedia chronicle page or heading title as a year span.
    parseChronicleTitle: function (title) {
      var value = String(title || "").trim();
      var match = value.match(new RegExp("^(\\d{1,2})(?:st|nd|rd|th) (century|millennium)(?: " + ERA + ")?$", "i"));
      if (match) {
        return APP.timeline.ordinalRange(Number(match[1]), match[2].toLowerCase(), eraSign(match[3]));
      }

      match = value.match(new RegExp("^(?:" + ERA + " )?(\\d{1,3}0)s(?: " + ERA + ")?$", "i"));
      if (match) {
        return APP.timeline.decadeRange(Number(match[2]), eraSign(match[1] || match[3]));
      }

      match = value.match(new RegExp("^(?:" + ERA + " )?(\\d{1,4})(?: " + ERA + ")?$", "i"));
      if (match) {
        var year = Number(match[2]) * eraSign(match[1] || match[3]);
        return { start: year, end: year, precision: "year" };
      }

      return null;
    },

    // Wikidata JSON time: "+0030-04-05T00:00:00Z" / "-0589-00-00T00:00:00Z" (historical numbering, no year 0).
    parseWikidataTime: function (value) {
      if (!value || !value.time) {
        return null;
      }

      var match = String(value.time).match(/^([+-])(\d+)-/);
      if (!match) {
        return null;
      }

      var year = Number(match[2]) * (match[1] === "-" ? -1 : 1);
      var precisionCode = value.precision;
      var sign = year < 0 ? -1 : 1;
      var magnitude = Math.abs(year);

      if (precisionCode <= 6) {
        return APP.timeline.ordinalRange(Math.max(1, Math.ceil(magnitude / 1000)), "millennium", sign);
      }
      if (precisionCode === 7) {
        return APP.timeline.ordinalRange(Math.max(1, Math.ceil(magnitude / 100)), "century", sign);
      }
      if (precisionCode === 8) {
        return APP.timeline.decadeRange(Math.floor(magnitude / 10) * 10, sign);
      }

      return {
        start: year,
        end: year,
        precision: precisionCode >= 11 ? "day" : precisionCode === 10 ? "month" : "year"
      };
    },

    // WDQS SPARQL uses astronomical numbering (year 0 = 1 BCE); the app uses historical negatives.
    toAstronomical: function (year) {
      return year < 0 ? year + 1 : year;
    },

    fromAstronomical: function (year) {
      return year <= 0 ? year - 1 : year;
    },

    formatPrecision: function (event) {
      var label = APP.utils.formatRange(event.start, event.end);
      if (event.precision === "century" || event.precision === "millennium" || event.precision === "decade") {
        label += " (" + event.precision + ")";
      }
      return (event.approximate ? "c. " : "") + label;
    },

    // ---------- Classification ----------

    inferPlaces: function (text) {
      var found = [];
      REGION_RULES.forEach(function (rule) {
        if (rule[2].test(text)) {
          found.push({ region: rule[0], place: rule[1] });
        }
      });
      return found;
    },

    regionFromHeading: function (heading) {
      var value = String(heading || "").trim();
      var generic = GENERIC_HEADINGS.filter(function (rule) {
        return rule[0].test(value);
      })[0];

      if (generic) {
        return { region: generic[1], continent: generic[2], place: value };
      }

      var places = APP.timeline.inferPlaces(value);
      return places.length ? { region: places[0].region, place: value } : null;
    },

    topicFromHeading: function (heading) {
      var rule = TOPIC_HEADINGS.filter(function (item) {
        return item[0].test(heading || "");
      })[0];
      return rule ? rule[1] : null;
    },

    regionFromCoords: function (coords) {
      if (!coords) {
        return null;
      }
      var rule = COORD_RULES.filter(function (item) {
        return item[1](coords.lat, coords.lon);
      })[0];
      return rule ? rule[0] : null;
    },

    inferCategory: function (text) {
      var rule = CATEGORY_RULES.filter(function (item) {
        return item[1].test(text);
      })[0];
      return rule ? rule[0] : "other";
    },

    inferDomain: function (event) {
      var text = event.title + " " + event.summary;
      var nearEast = ["West Asia / Near East", "Nile Valley", "North Africa", "Mediterranean Europe"];

      if (event.start <= 150 && BIBLICAL_PATTERN.test(text)) {
        return "Biblical";
      }

      if (!event.regions.length || event.regions.some(function (region) { return nearEast.indexOf(region) !== -1; })) {
        return "World";
      }

      return "Regional";
    },

    // ---------- Event records ----------

    createEvent: function (raw) {
      var start = Number(raw.start);
      var end = raw.end === undefined || raw.end === null ? start : Number(raw.end);

      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return null;
      }

      var event = {
        id: raw.id || "e" + hash((raw.title || "") + "|" + start + "|" + (raw.provider || "")),
        title: APP.utils.truncate(String(raw.title || "Untitled event").trim(), 160),
        summary: String(raw.summary || "").trim(),
        start: Math.min(start, end),
        end: Math.max(start, end),
        precision: raw.precision || "year",
        approximate: Boolean(raw.approximate),
        regions: (raw.regions || []).slice(),
        places: (raw.places || []).slice(),
        continents: (raw.continents || []).slice(),
        category: raw.category || null,
        domain: raw.domain || null,
        coords: raw.coords || null,
        url: raw.url || "",
        articleTitle: raw.articleTitle || "",
        wikidataId: raw.wikidataId || "",
        links: raw.links || [],
        kind: raw.kind || "event",
        flags: raw.flags || [],
        provenance: raw.provenance || [{
          provider: raw.provider,
          label: raw.providerLabel || raw.provider,
          url: raw.sourceUrl || raw.url || "",
          title: raw.sourceTitle || ""
        }],
        confidence: 0
      };

      APP.timeline.enrich(event);
      return event;
    },

    enrich: function (event) {
      var text = event.title + " " + event.summary;

      if (!event.regions.length) {
        APP.timeline.inferPlaces(text).forEach(function (hit) {
          if (event.regions.indexOf(hit.region) === -1) {
            event.regions.push(hit.region);
          }
          if (event.places.indexOf(hit.place) === -1) {
            event.places.push(hit.place);
          }
        });
      }

      if (!event.regions.length) {
        var coordRegion = APP.timeline.regionFromCoords(event.coords);
        if (coordRegion) {
          event.regions.push(coordRegion);
        }
      }

      event.regions.forEach(function (region) {
        var continent = APP.timeline.regionToContinent(region);
        if (continent && event.continents.indexOf(continent) === -1) {
          event.continents.push(continent);
        }
      });

      event.category = event.category || APP.timeline.inferCategory(text);
      event.domain = event.domain || APP.timeline.inferDomain(event);
      event.confidence = APP.timeline.scoreConfidence(event);
      return event;
    },

    scoreConfidence: function (event) {
      var providers = {};
      event.provenance.forEach(function (item) {
        providers[item.provider] = true;
      });

      var names = Object.keys(providers);
      var base = names.reduce(function (best, name) {
        return Math.max(best, PROVIDER_WEIGHT[name] || 0.4);
      }, 0);
      var score = base + 0.08 * Math.max(0, names.length - 1);

      if (event.approximate) {
        score -= 0.06;
      }
      if (event.precision === "century") {
        score -= 0.1;
      }
      if (event.precision === "millennium") {
        score -= 0.15;
      }
      if (event.flags.indexOf("citation-needed") !== -1) {
        score -= 0.12;
      }
      if (event.flags.indexOf("unverified") !== -1) {
        score = Math.min(score, 0.25);
      }

      return APP.utils.clamp(Math.round(score * 100) / 100, 0.05, 0.97);
    },

    titleSimilarity: function (a, b) {
      return overlapCoefficient(tokens(a), tokens(b));
    },

    confidenceLabel: function (value) {
      return value >= 0.75 ? "High" : value >= 0.55 ? "Medium" : "Low";
    },

    tolerance: function (event) {
      return PRECISION_TOLERANCE[event.precision] === undefined ? 1 : PRECISION_TOLERANCE[event.precision];
    },

    isSameEvent: function (a, b) {
      if (a.wikidataId && a.wikidataId === b.wikidataId) {
        return true;
      }

      if (a.articleTitle && a.articleTitle === b.articleTitle) {
        return true;
      }

      var tolerance = Math.max(APP.timeline.tolerance(a), APP.timeline.tolerance(b), 2);
      var closeInTime = APP.utils.rangesOverlap(a.start - tolerance, a.end + tolerance, b.start, b.end);

      if (!closeInTime) {
        return false;
      }

      // A chronicle sentence linking to an article about a dated occurrence corroborates that article.
      var article = a.articleTitle ? a : b.articleTitle ? b : null;
      var sentence = article === a ? b : a;
      if (article && article.kind === "event" && sentence.links.slice(0, 4).indexOf(article.articleTitle) !== -1) {
        return true;
      }

      var tokensA = tokens(a.title);
      var tokensB = tokens(b.title);
      return tokensA.length >= 2 && tokensB.length >= 2 && overlapCoefficient(tokensA, tokensB) >= 0.8;
    },

    combine: function (target, incoming) {
      incoming.provenance.forEach(function (item) {
        var exists = target.provenance.some(function (existing) {
          return existing.provider === item.provider && existing.url === item.url;
        });
        if (!exists) {
          target.provenance.push(item);
        }
      });

      // An article-level record redefines the event (title below), so its dates must come with it.
      var adoptsArticle = Boolean(incoming.articleTitle && !target.articleTitle);

      if (adoptsArticle || APP.timeline.tolerance(incoming) < APP.timeline.tolerance(target)) {
        target.start = incoming.start;
        target.end = incoming.end;
        target.precision = incoming.precision;
        target.approximate = incoming.approximate;
      }

      // Prefer concise article titles over chronicle sentences.
      if (incoming.articleTitle && !target.articleTitle) {
        if (!target.summary || target.summary.length < target.title.length) {
          target.summary = target.title;
        }
        target.title = incoming.title;
        target.articleTitle = incoming.articleTitle;
        target.url = incoming.url || target.url;
      }

      if (incoming.summary.length > target.summary.length) {
        target.summary = incoming.summary;
      }

      ["regions", "places", "continents", "links"].forEach(function (field) {
        incoming[field].forEach(function (value) {
          if (target[field].indexOf(value) === -1) {
            target[field].push(value);
          }
        });
      });

      target.coords = target.coords || incoming.coords;
      target.wikidataId = target.wikidataId || incoming.wikidataId;

      // Corroboration by any verified record clears "unverified"; other flags accumulate.
      var incomingVerified = incoming.flags.indexOf("unverified") === -1;
      incoming.flags.forEach(function (flag) {
        if (target.flags.indexOf(flag) === -1 && flag !== "unverified") {
          target.flags.push(flag);
        }
      });
      if (incomingVerified) {
        target.flags = target.flags.filter(function (flag) {
          return flag !== "unverified";
        });
      }
      target.confidence = APP.timeline.scoreConfidence(target);
      return target;
    },

    // Adds incoming events to the collection, merging duplicates. Returns the number of new records.
    merge: function (collection, incoming) {
      var added = 0;

      incoming.forEach(function (event) {
        if (!event) {
          return;
        }

        var match = collection.filter(function (existing) {
          return APP.timeline.isSameEvent(existing, event);
        })[0];

        if (match) {
          APP.timeline.combine(match, event);
        } else {
          collection.push(event);
          added += 1;
        }
      });

      return added;
    },

    primaryLane: function (event, groupBy) {
      if (groupBy === "domain") {
        return event.domain;
      }
      if (groupBy === "category") {
        return event.category.charAt(0).toUpperCase() + event.category.slice(1);
      }
      if (groupBy === "source") {
        return event.provenance[0].label || event.provenance[0].provider;
      }
      if (event.regions.length) {
        return event.regions[0];
      }
      return event.continents.length ? event.continents[0] + " (general)" : "Unplaced";
    },

    applyFilters: function (events, filters) {
      var text = String(filters.text || "").toLowerCase().trim();

      return events.filter(function (event) {
        if (!APP.utils.rangesOverlap(event.start, event.end, filters.start, filters.end)) {
          return false;
        }
        if (filters.continent && filters.continent !== "All" && event.continents.indexOf(filters.continent) === -1) {
          return false;
        }
        if (filters.region && filters.region !== "All" &&
          event.regions.indexOf(filters.region) === -1 && event.places.indexOf(filters.region) === -1) {
          return false;
        }
        if (filters.domain && filters.domain !== "All" && event.domain !== filters.domain) {
          return false;
        }
        if (filters.category && filters.category !== "All" && event.category !== filters.category) {
          return false;
        }
        if (filters.minConfidence && event.confidence < filters.minConfidence) {
          return false;
        }
        if (!filters.showUnverified && event.flags.indexOf("unverified") !== -1) {
          return false;
        }
        if (text && (event.title + " " + event.summary + " " + event.regions.join(" ") + " " + event.places.join(" "))
          .toLowerCase().indexOf(text) === -1) {
          return false;
        }
        return true;
      }).sort(function (a, b) {
        return a.start - b.start || APP.timeline.tolerance(a) - APP.timeline.tolerance(b) || b.confidence - a.confidence;
      });
    },

    // Picks a period from search-ranked keyword results: anchor on the best-ranked, reasonably narrow
    // dated item, then widen only for other top results that sit close to it in time.
    deriveRange: function (rankedEvents) {
      var candidates = rankedEvents.filter(function (event) {
        return event.end - event.start <= 300;
      });
      var anchor = candidates.filter(function (event) {
        return event.kind === "event";
      })[0] || candidates[0];

      if (!anchor) {
        return null;
      }

      var anchorMid = (anchor.start + anchor.end) / 2;
      var start = anchor.start;
      var end = anchor.end;

      candidates.slice(0, 6).forEach(function (event) {
        var mid = (event.start + event.end) / 2;
        var precise = PRECISION_TOLERANCE[event.precision] !== undefined && PRECISION_TOLERANCE[event.precision] <= 10;
        if (event !== anchor && precise && event.kind !== "lifespan" && event.end - event.start <= 150 && Math.abs(mid - anchorMid) <= 60) {
          start = Math.min(start, event.start);
          end = Math.max(end, event.end);
        }
      });

      var pad = Math.max(5, Math.round((end - start) * 0.15), Math.ceil((30 - (end - start)) / 2));
      return { start: Math.round(start - pad), end: Math.round(end + pad) };
    },

    // ---------- Search planning ----------

    detectBibleHint: function (query) {
      var reference = APP.model.parseReference(query);
      if (reference.valid && reference.chapter) {
        var era = APP.data.eras[reference.book.eraId];
        return { start: era.start, end: era.end, label: reference.display + " (" + era.label + ")" };
      }

      var hint = HINTS.filter(function (item) {
        return item[0].test(query);
      })[0];
      if (hint) {
        return { start: hint[1], end: hint[2], label: hint[3] };
      }

      var book = APP.data.books.slice().sort(function (a, b) {
        return b.name.length - a.name.length;
      }).filter(function (item) {
        var pattern = new RegExp("\\b" + escapeRegex(item.name) + "\\b" + (AMBIGUOUS_BOOKS[item.name] ? "\\s+\\d" : ""));
        return pattern.test(query);
      })[0];
      if (book) {
        var bookEra = APP.data.eras[book.eraId];
        return { start: bookEra.start, end: bookEra.end, label: book.name + " (" + bookEra.label + ")" };
      }

      return null;
    },

    extractKeywords: function (text) {
      var seen = {};
      return String(text || "")
        .replace(/[?!.,;:"“”()]/g, " ")
        .split(/\s+/)
        .filter(function (word) {
          var lower = word.toLowerCase().replace(/'s$/, "");
          if (!lower || STOPWORDS[lower] || /^\d+$/.test(lower) || seen[lower]) {
            return false;
          }
          seen[lower] = true;
          return true;
        })
        .join(" ")
        .trim();
    },

    buildPlan: function (input) {
      var query = String(input.query || "").trim();
      var notes = [];
      var start = input.start;
      var end = input.end;
      var rangeSource = "";
      var remaining = query;
      var bibleReference = APP.model.parseReference(query);

      if (Number.isFinite(start) && Number.isFinite(end)) {
        rangeSource = "your start and end years";
      } else {
        var parsed = bibleReference.valid ? null : APP.timeline.parseDateText(query);
        if (parsed) {
          start = parsed.start;
          end = parsed.end;
          remaining = query.replace(parsed.matched, " ");
          rangeSource = "the date \"" + parsed.matched.trim() + "\" in your question";
        } else {
          var hint = query ? APP.timeline.detectBibleHint(query) : null;
          if (hint) {
            start = hint.start;
            end = hint.end;
            rangeSource = hint.label;
          } else {
            start = null;
            end = null;
          }
        }
      }

      if (Number.isFinite(start) && Number.isFinite(end) && start > end) {
        var swap = start;
        start = end;
        end = swap;
        notes.push("Start and end years were swapped so the range runs forward in time.");
      }

      var keywords = bibleReference.valid && bibleReference.chapter ? "" : APP.timeline.extractKeywords(remaining);
      var focusRegions = [];
      APP.timeline.inferPlaces(query).forEach(function (hit) {
        if (focusRegions.indexOf(hit.region) === -1) {
          focusRegions.push(hit.region);
        }
      });

      if (rangeSource) {
        notes.unshift("Date range taken from " + rangeSource + ".");
      } else if (keywords) {
        notes.unshift("No dates given; the range will be inferred from keyword results.");
      }

      if (focusRegions.length) {
        notes.push("Regions mentioned: " + focusRegions.join(", ") + ".");
      }

      return {
        valid: Boolean(keywords || rangeSource),
        error: "Enter a question, keywords, a Bible reference, or a start and end year.",
        query: query,
        keywords: keywords,
        start: Number.isFinite(start) ? start : null,
        end: Number.isFinite(end) ? end : null,
        continent: input.continent || "All",
        region: input.region || "All",
        focusRegions: focusRegions,
        depth: input.depth || "standard",
        notes: notes,
        planner: "local"
      };
    },

    hasRange: function (plan) {
      return plan.start !== null && plan.end !== null;
    }
  };
}());
