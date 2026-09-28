(function () {
  "use strict";

  APP.sources = {};

  APP.sources.anchors = [
    {
      id: "patriarchs",
      label: "Patriarchal narratives",
      start: -2100,
      end: -1700,
      description: "A broad research window for the patriarchal settings represented in Genesis."
    },
    {
      id: "exodus",
      label: "Exodus and wilderness period",
      start: -1550,
      end: -1200,
      description: "A broad late Bronze Age window for Exodus and wilderness traditions."
    },
    {
      id: "david",
      label: "Davidic kingdom",
      start: -1010,
      end: -970,
      description: "Approximate reign window traditionally associated with David."
    },
    {
      id: "solomon",
      label: "Solomonic kingdom",
      start: -970,
      end: -930,
      description: "Approximate reign window traditionally associated with Solomon."
    },
    {
      id: "samaria",
      label: "Fall of Samaria",
      start: -725,
      end: -720,
      description: "A narrow research window around the Assyrian conquest of the northern kingdom."
    },
    {
      id: "jerusalem",
      label: "Fall of Jerusalem and exile",
      start: -590,
      end: -580,
      description: "A research window around Babylonian conquest and destruction of the First Temple."
    },
    {
      id: "return",
      label: "Persian return and rebuilding",
      start: -539,
      end: -430,
      description: "A Persian-period window for return, temple rebuilding, and restoration traditions."
    },
    {
      id: "birth-jesus",
      label: "Birth of Jesus",
      start: -6,
      end: 4,
      description: "A broad date window commonly used for research into the birth narratives."
    },
    {
      id: "ministry-jesus",
      label: "Public ministry of Jesus",
      start: 27,
      end: 33,
      description: "A broad research window for Jesus' public ministry in Roman Judea."
    },
    {
      id: "crucifixion",
      label: "Crucifixion and resurrection period",
      start: 29,
      end: 34,
      description: "An intentionally cautious research range for the crucifixion and resurrection period."
    },
    {
      id: "pentecost",
      label: "Early church and Pentecost",
      start: 30,
      end: 40,
      description: "A research window for the earliest Jerusalem-centered church."
    },
    {
      id: "paul",
      label: "Pauline mission period",
      start: 45,
      end: 65,
      description: "A broad research window for Paul's missionary activity and correspondence."
    },
    {
      id: "temple-destruction",
      label: "Destruction of the Second Temple",
      start: 66,
      end: 73,
      description: "A research window for the First Jewish-Roman War and destruction of Jerusalem."
    }
  ];

  APP.sources.continents = {
    "Africa": ["North Africa", "Nile Valley", "Horn of Africa", "West Africa", "East Africa"],
    "Asia": ["West Asia / Near East", "East Asia", "South Asia", "Central Asia", "Southeast Asia", "Japan and Korea"],
    "Europe": ["Europe", "Mediterranean Europe", "Northern Europe", "Western Europe", "Eastern Europe"],
    "North America": ["North America", "Mesoamerica"],
    "South America": ["South America", "Andes", "Amazonia"],
    "Oceania": ["Oceania", "Australia", "Melanesia", "Polynesia", "Micronesia"]
  };

  APP.sources.events = [
    {
      id: "patriarchal-narratives",
      domain: "Biblical",
      continents: ["Asia"],
      regions: ["West Asia / Near East", "Levant", "Mesopotamia", "Egypt"],
      start: -2100,
      end: -1700,
      title: "Patriarchal narratives",
      detail: "Genesis depicts Abraham's household and later patriarchal families moving through Canaan, Egypt, and Mesopotamian-connected regions."
    },
    {
      id: "exodus-covenant",
      domain: "Biblical",
      continents: ["Africa", "Asia"],
      regions: ["Nile Valley", "Sinai", "West Asia / Near East"],
      start: -1450,
      end: -1200,
      title: "Exodus, Sinai, and wilderness traditions",
      detail: "Israel's foundational deliverance, covenant, law, worship, and community traditions are located in the late Bronze Age setting."
    },
    {
      id: "davidic-kingdom",
      domain: "Biblical",
      continents: ["Asia"],
      regions: ["West Asia / Near East", "Levant"],
      start: -1010,
      end: -930,
      title: "Davidic and Solomonic kingdom",
      detail: "Jerusalem becomes the political and worship center in the narratives of the united monarchy."
    },
    {
      id: "samaria-fall",
      domain: "Biblical",
      continents: ["Asia"],
      regions: ["West Asia / Near East", "Levant"],
      start: -722,
      end: -722,
      title: "Fall of Samaria",
      detail: "The northern kingdom of Israel falls under Assyrian conquest, reshaping later Israelite and Judean identity."
    },
    {
      id: "jerusalem-fall",
      domain: "Biblical",
      continents: ["Asia"],
      regions: ["West Asia / Near East", "Levant", "Mesopotamia"],
      start: -586,
      end: -586,
      title: "Fall of Jerusalem and First Temple destruction",
      detail: "Babylon's conquest of Judah becomes a defining crisis behind exilic prophecy, lament, and restoration hopes."
    },
    {
      id: "return-rebuild",
      domain: "Biblical",
      continents: ["Asia"],
      regions: ["West Asia / Near East", "Levant", "Persia"],
      start: -539,
      end: -430,
      title: "Return, rebuilding, and restoration",
      detail: "Post-exilic literature addresses worship, identity, covenant renewal, and life under Persian rule."
    },
    {
      id: "jesus-ministry",
      domain: "Biblical",
      continents: ["Asia"],
      regions: ["West Asia / Near East", "Levant", "Roman Judea"],
      start: 27,
      end: 33,
      title: "Public ministry, crucifixion, and resurrection proclamation of Jesus",
      detail: "The Gospels portray Jesus ministering in Galilee and Judea under Roman rule."
    },
    {
      id: "early-church",
      domain: "Biblical",
      continents: ["Asia", "Europe", "Africa"],
      regions: ["West Asia / Near East", "Mediterranean Europe", "North Africa"],
      start: 30,
      end: 100,
      title: "Early church mission",
      detail: "Acts and the letters address communities across the Roman world as the Jesus movement expands."
    },

    {
      id: "egypt-new-kingdom",
      domain: "World",
      continents: ["Africa", "Asia"],
      regions: ["Nile Valley", "West Asia / Near East"],
      start: -1550,
      end: -1070,
      title: "Egyptian New Kingdom",
      detail: "Egypt was a major political and military power in the eastern Mediterranean and Near East."
    },
    {
      id: "bronze-collapse",
      domain: "World",
      continents: ["Asia", "Europe", "Africa"],
      regions: ["West Asia / Near East", "Mediterranean Europe", "Nile Valley"],
      start: -1200,
      end: -1150,
      title: "Late Bronze Age political collapse",
      detail: "Several eastern Mediterranean palace systems declined or collapsed, reshaping regional political and population patterns."
    },
    {
      id: "neo-assyria",
      domain: "World",
      continents: ["Asia"],
      regions: ["West Asia / Near East", "Mesopotamia", "Levant"],
      start: -911,
      end: -609,
      title: "Neo-Assyrian Empire",
      detail: "Assyria expanded through military campaigns, tribute systems, deportation, and provincial administration."
    },
    {
      id: "neo-babylon",
      domain: "World",
      continents: ["Asia"],
      regions: ["West Asia / Near East", "Mesopotamia", "Levant"],
      start: -626,
      end: -539,
      title: "Neo-Babylonian Empire",
      detail: "Babylon replaced Assyria as a dominant regional power and conquered Jerusalem in the early sixth century BCE."
    },
    {
      id: "achaemenid",
      domain: "World",
      continents: ["Asia", "Africa", "Europe"],
      regions: ["West Asia / Near East", "Central Asia", "Nile Valley", "Mediterranean Europe"],
      start: -539,
      end: -332,
      title: "Achaemenid Persian Empire",
      detail: "Persian imperial administration governed diverse populations through provinces, roads, tribute, local elites, and regional administration."
    },
    {
      id: "hellenistic",
      domain: "World",
      continents: ["Asia", "Europe", "Africa"],
      regions: ["West Asia / Near East", "Mediterranean Europe", "North Africa", "Central Asia"],
      start: -332,
      end: -63,
      title: "Hellenistic kingdoms and Greek cultural influence",
      detail: "Greek language, political institutions, trade, and cultural forms spread widely after Alexander's conquests."
    },
    {
      id: "roman-east",
      domain: "World",
      continents: ["Asia", "Europe", "Africa"],
      regions: ["West Asia / Near East", "Mediterranean Europe", "North Africa", "Roman Judea"],
      start: -63,
      end: 70,
      title: "Roman power in the eastern Mediterranean",
      detail: "Rome governed or influenced Judea and surrounding areas through provincial and client-king arrangements."
    },
    {
      id: "eastern-han",
      domain: "Regional",
      continents: ["Asia"],
      regions: ["East Asia", "China"],
      start: 25,
      end: 220,
      title: "Eastern Han dynasty",
      detail: "China was governed by the Eastern Han dynasty during the first and second centuries CE."
    },
    {
      id: "kushan",
      domain: "Regional",
      continents: ["Asia"],
      regions: ["Central Asia", "South Asia", "Gandhara", "Northwest India"],
      start: -100,
      end: 300,
      title: "Kushan-era political and trade networks",
      detail: "Kushan-era networks linked Central Asia, Gandhara, northwest India, and long-distance trade routes."
    },
    {
      id: "yayoi",
      domain: "Regional",
      continents: ["Asia"],
      regions: ["East Asia", "Japan and Korea", "Japan"],
      start: -300,
      end: 250,
      title: "Yayoi-period Japan",
      detail: "The Yayoi period is associated with settled rice agriculture, metalworking, and changing social organization in ancient Japan."
    },
    {
      id: "aksum",
      domain: "Regional",
      continents: ["Africa"],
      regions: ["Horn of Africa", "East Africa"],
      start: 100,
      end: 940,
      title: "Kingdom of Aksum",
      detail: "Aksum developed as an important Horn of Africa kingdom connected to Red Sea trade networks."
    },
    {
      id: "maya-preclassic",
      domain: "Regional",
      continents: ["North America"],
      regions: ["Mesoamerica"],
      start: -1000,
      end: 250,
      title: "Late Preclassic Mesoamerica",
      detail: "Mesoamerican societies developed increasingly complex settlements, ritual centers, and regional exchange networks."
    },
    {
      id: "andes-formative",
      domain: "Regional",
      continents: ["South America"],
      regions: ["Andes", "South America"],
      start: -1500,
      end: 500,
      title: "Andean formative traditions",
      detail: "Andean communities developed agricultural, ceremonial, and exchange traditions across diverse highland and coastal environments."
    },
    {
      id: "pacific-settlement",
      domain: "Regional",
      continents: ["Oceania"],
      regions: ["Oceania", "Melanesia", "Polynesia"],
      start: -1500,
      end: 500,
      title: "Pacific island settlement and exchange traditions",
      detail: "Oceanic communities maintained diverse maritime, settlement, and exchange traditions across island environments."
    }
  ];

  APP.sources.getLocalEvents = function (start, end, continent, region) {
    return APP.sources.events.filter(function (event) {
      var timeMatch = APP.utils.rangesOverlap(event.start, event.end, start, end);
      var continentMatch = continent === "All" || event.continents.indexOf(continent) !== -1;
      var regionMatch = region === "All" || event.regions.indexOf(region) !== -1;

      return timeMatch && continentMatch && regionMatch;
    });
  };
}());