(function () {
  "use strict";

  APP.data = {};

  APP.data.eras = {
    patriarchs: {
      label: "Patriarchal Period",
      start: -2100,
      end: -1700,
      summary: "The narratives are set in a world of extended households, trade routes, city-states, and the older kingdoms of Mesopotamia and Egypt."
    },
    exodus: {
      label: "Exodus and Wilderness Period",
      start: -1550,
      end: -1200,
      summary: "Israel's foundational deliverance and covenant traditions are set against the late Bronze Age world, when Egypt was a major regional power."
    },
    settlement: {
      label: "Settlement and Judges Period",
      start: -1250,
      end: -1050,
      summary: "Israel is portrayed as a tribal confederation living among Canaanite and neighboring cultures after the late Bronze Age transition."
    },
    unitedMonarchy: {
      label: "United Monarchy",
      start: -1050,
      end: -930,
      summary: "The narratives of Saul, David, and Solomon describe centralized kingship, Jerusalem-centered worship, diplomacy, and state formation."
    },
    dividedKingdom: {
      label: "Divided Kingdoms",
      start: -930,
      end: -722,
      summary: "Israel and Judah existed as smaller kingdoms between larger regional powers, with prophets addressing worship, justice, loyalty, and political insecurity."
    },
    assyrianCrisis: {
      label: "Assyrian Crisis and Judah",
      start: -750,
      end: -586,
      summary: "Assyrian expansion, the fall of the northern kingdom, Judean reforms, and later Babylonian pressure form the setting of much prophetic literature."
    },
    exile: {
      label: "Babylonian Exile",
      start: -605,
      end: -539,
      summary: "Judean displacement under Babylon raised urgent questions of covenant identity, worship, grief, justice, memory, and hope."
    },
    persian: {
      label: "Persian Period",
      start: -539,
      end: -332,
      summary: "Persian imperial rule enabled returning communities to rebuild local religious and civic life under imperial administration."
    },
    hellenistic: {
      label: "Hellenistic Period",
      start: -332,
      end: -63,
      summary: "Greek language, institutions, trade, and political culture spread widely after Alexander's conquests."
    },
    roman: {
      label: "Roman Judea and Early Imperial Period",
      start: -63,
      end: 70,
      summary: "Roman rule, Herodian client kings, taxation, pilgrimage, Jewish diversity, and Greek-speaking urban culture shaped the New Testament setting."
    },
    earlyChurch: {
      label: "Early Church and Apostolic Mission",
      start: 30,
      end: 100,
      summary: "The Jesus movement expanded from Judea through the Roman world, navigating Jewish and Gentile identity, worship, ethics, civic pressure, and mission."
    }
  };

  APP.data.books = [
    ["Genesis", "Old Testament", "patriarchs"],
    ["Exodus", "Old Testament", "exodus"],
    ["Leviticus", "Old Testament", "exodus"],
    ["Numbers", "Old Testament", "exodus"],
    ["Deuteronomy", "Old Testament", "exodus"],
    ["Joshua", "Old Testament", "settlement"],
    ["Judges", "Old Testament", "settlement"],
    ["Ruth", "Old Testament", "settlement"],
    ["1 Samuel", "Old Testament", "unitedMonarchy"],
    ["2 Samuel", "Old Testament", "unitedMonarchy"],
    ["1 Kings", "Old Testament", "dividedKingdom"],
    ["2 Kings", "Old Testament", "assyrianCrisis"],
    ["1 Chronicles", "Old Testament", "unitedMonarchy"],
    ["2 Chronicles", "Old Testament", "assyrianCrisis"],
    ["Ezra", "Old Testament", "persian"],
    ["Nehemiah", "Old Testament", "persian"],
    ["Esther", "Old Testament", "persian"],
    ["Job", "Old Testament", "patriarchs"],
    ["Psalms", "Old Testament", "unitedMonarchy"],
    ["Proverbs", "Old Testament", "unitedMonarchy"],
    ["Ecclesiastes", "Old Testament", "unitedMonarchy"],
    ["Song of Solomon", "Old Testament", "unitedMonarchy"],
    ["Isaiah", "Old Testament", "assyrianCrisis"],
    ["Jeremiah", "Old Testament", "exile"],
    ["Lamentations", "Old Testament", "exile"],
    ["Ezekiel", "Old Testament", "exile"],
    ["Daniel", "Old Testament", "exile"],
    ["Hosea", "Old Testament", "dividedKingdom"],
    ["Joel", "Old Testament", "persian"],
    ["Amos", "Old Testament", "dividedKingdom"],
    ["Obadiah", "Old Testament", "exile"],
    ["Jonah", "Old Testament", "assyrianCrisis"],
    ["Micah", "Old Testament", "assyrianCrisis"],
    ["Nahum", "Old Testament", "assyrianCrisis"],
    ["Habakkuk", "Old Testament", "exile"],
    ["Zephaniah", "Old Testament", "assyrianCrisis"],
    ["Haggai", "Old Testament", "persian"],
    ["Zechariah", "Old Testament", "persian"],
    ["Malachi", "Old Testament", "persian"],
    ["Matthew", "New Testament", "roman"],
    ["Mark", "New Testament", "roman"],
    ["Luke", "New Testament", "roman"],
    ["John", "New Testament", "roman"],
    ["Acts", "New Testament", "earlyChurch"],
    ["Romans", "New Testament", "earlyChurch"],
    ["1 Corinthians", "New Testament", "earlyChurch"],
    ["2 Corinthians", "New Testament", "earlyChurch"],
    ["Galatians", "New Testament", "earlyChurch"],
    ["Ephesians", "New Testament", "earlyChurch"],
    ["Philippians", "New Testament", "earlyChurch"],
    ["Colossians", "New Testament", "earlyChurch"],
    ["1 Thessalonians", "New Testament", "earlyChurch"],
    ["2 Thessalonians", "New Testament", "earlyChurch"],
    ["1 Timothy", "New Testament", "earlyChurch"],
    ["2 Timothy", "New Testament", "earlyChurch"],
    ["Titus", "New Testament", "earlyChurch"],
    ["Philemon", "New Testament", "earlyChurch"],
    ["Hebrews", "New Testament", "earlyChurch"],
    ["James", "New Testament", "earlyChurch"],
    ["1 Peter", "New Testament", "earlyChurch"],
    ["2 Peter", "New Testament", "earlyChurch"],
    ["1 John", "New Testament", "earlyChurch"],
    ["2 John", "New Testament", "earlyChurch"],
    ["3 John", "New Testament", "earlyChurch"],
    ["Jude", "New Testament", "earlyChurch"],
    ["Revelation", "New Testament", "earlyChurch"]
  ].map(function (item) {
    return {
      name: item[0],
      testament: item[1],
      eraId: item[2]
    };
  });

  APP.data.aliases = {
    "gen": "Genesis", "ge": "Genesis",
    "exo": "Exodus", "ex": "Exodus",
    "lev": "Leviticus", "lv": "Leviticus",
    "num": "Numbers", "nm": "Numbers",
    "deut": "Deuteronomy", "dt": "Deuteronomy",
    "josh": "Joshua", "judg": "Judges",
    "1 sam": "1 Samuel", "1sam": "1 Samuel",
    "2 sam": "2 Samuel", "2sam": "2 Samuel",
    "1 kgs": "1 Kings", "1ki": "1 Kings",
    "2 kgs": "2 Kings", "2ki": "2 Kings",
    "1 chr": "1 Chronicles", "2 chr": "2 Chronicles",
    "neh": "Nehemiah", "est": "Esther",
    "ps": "Psalms", "psalm": "Psalms",
    "prov": "Proverbs", "eccl": "Ecclesiastes",
    "song": "Song of Solomon", "sos": "Song of Solomon",
    "isa": "Isaiah", "jer": "Jeremiah", "lam": "Lamentations",
    "ezek": "Ezekiel", "dan": "Daniel",
    "hos": "Hosea", "obad": "Obadiah", "jon": "Jonah",
    "mic": "Micah", "nah": "Nahum", "hab": "Habakkuk",
    "zeph": "Zephaniah", "hag": "Haggai", "zech": "Zechariah",
    "matt": "Matthew", "mt": "Matthew",
    "mk": "Mark", "lk": "Luke", "jn": "John",
    "rom": "Romans", "1 cor": "1 Corinthians", "2 cor": "2 Corinthians",
    "gal": "Galatians", "eph": "Ephesians", "phil": "Philippians",
    "col": "Colossians", "heb": "Hebrews", "jas": "James",
    "1 pet": "1 Peter", "2 pet": "2 Peter",
    "1 jn": "1 John", "2 jn": "2 John", "3 jn": "3 John",
    "rev": "Revelation"
  };
}());