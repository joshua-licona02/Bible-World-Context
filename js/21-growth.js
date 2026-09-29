(function () {
  "use strict";

  function wiki(title) {
    return { label: title + " (Wikipedia)", url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(title.replace(/ /g, "_")) };
  }

  function verse(reference, slug) {
    return { label: reference + " (Scripture text)", url: "https://biblehub.com/" + slug + ".htm" };
  }

  // Historical developments that shaped how Christianity began and spread. "happened" states the
  // history; "growth" states the connection to Christianity. "kind" separates documented history
  // from Scriptural threads that link an Old Testament era to the church.
  APP.growth = {
    factors: [
      {
        id: "abraham-nations",
        kind: "Scriptural thread",
        title: "The promise to bless all nations",
        start: -2100, end: -1700,
        regions: ["West Asia / Near East"],
        happened: "God's call of Abraham includes the promise that \"all the families of the earth\" will be blessed through him.",
        growth: "Paul calls this promise the gospel announced in advance to the Gentiles, and it grounds the church's mission beyond Israel to every nation.",
        scripture: ["Genesis 12:3", "Galatians 3:8"],
        source: verse("Genesis 12:3", "genesis/12-3")
      },
      {
        id: "passover",
        kind: "Scriptural thread",
        title: "The Exodus and the Passover",
        start: -1450, end: -1200,
        regions: ["Nile Valley", "West Asia / Near East"],
        happened: "Israel's deliverance from Egypt was remembered every year in the Passover meal.",
        growth: "Jesus's Last Supper was a Passover meal, and the first Christians explained his death through it (\"Christ, our Passover lamb\"). The feast also brought Jewish pilgrims to Jerusalem each year.",
        scripture: ["Exodus 12:14", "Luke 22:15", "1 Corinthians 5:7"],
        source: wiki("Passover")
      },
      {
        id: "alphabet",
        kind: "Historical",
        title: "The spread of the alphabet",
        start: -1050, end: -750,
        regions: ["West Asia / Near East", "Mediterranean Europe"],
        happened: "The Phoenician alphabet of about two dozen letters was used for Hebrew and, by the 8th century BC, adapted by the Greeks.",
        growth: "Alphabetic writing was far easier to learn than cuneiform or hieroglyphs. The Hebrew Scriptures and later the Greek New Testament were written in alphabets, which helped them be copied, read aloud, and circulated widely.",
        scripture: [],
        source: wiki("Phoenician alphabet")
      },
      {
        id: "davidic",
        kind: "Historical",
        title: "David's dynasty and Jerusalem",
        start: -1010, end: -930,
        regions: ["West Asia / Near East"],
        happened: "David made Jerusalem the capital of a united Israel, and his dynasty ruled Judah for about four centuries.",
        growth: "The promise of an everlasting Davidic king shaped later messianic hope. The New Testament presents Jesus as David's heir, and Jerusalem, David's city, is where the church began.",
        scripture: ["2 Samuel 7:16", "Luke 1:32", "Acts 1:8"],
        source: wiki("Kingdom of Israel (united monarchy)")
      },
      {
        id: "prophets",
        kind: "Historical",
        title: "The writing prophets",
        start: -760, end: -430,
        regions: ["West Asia / Near East"],
        happened: "From Amos and Isaiah in the 8th century BC to Malachi in the 5th, prophetic messages were preserved in writing.",
        growth: "These books supplied many of the passages the first Christians preached as fulfilled in Jesus, such as Bethlehem as the Messiah's birthplace and the suffering servant.",
        scripture: ["Micah 5:2", "Matthew 2:6", "Isaiah 53:5", "Acts 8:32"],
        source: wiki("Nevi'im")
      },
      {
        id: "samaritans",
        kind: "Historical",
        title: "Assyria's conquest of Israel and the Samaritans",
        start: -740, end: -700,
        regions: ["West Asia / Near East"],
        happened: "Assyria conquered the northern kingdom of Israel in 722 BC, deported many Israelites, and resettled others in the land. The Samaritan community's origins are traced to this region, though the details are debated.",
        growth: "Samaria became the church's first mission field beyond Judea. Jesus spoke with a Samaritan woman, and Philip's preaching there was the first step in the expansion Acts describes.",
        scripture: ["2 Kings 17:24", "John 4:39", "Acts 8:5", "Acts 1:8"],
        source: wiki("Samaritans")
      },
      {
        id: "diaspora",
        kind: "Historical",
        title: "The Babylonian exile and the Jewish diaspora",
        start: -597, end: -538,
        regions: ["West Asia / Near East", "Nile Valley", "Mediterranean Europe"],
        happened: "Babylon deported Judeans in 597 and 586 BC. Many stayed abroad even after the return, and Jewish communities spread across the Mediterranean world. The synagogue, whose origins are often traced to this era, became their center.",
        growth: "Diaspora synagogues gave the apostles a ready audience in city after city; Paul usually preached there first. Pilgrims from across the diaspora heard Peter at Pentecost and could carry the message home.",
        scripture: ["Acts 2:5", "Acts 13:5", "Acts 17:2"],
        source: wiki("Jewish diaspora")
      },
      {
        id: "cyrus",
        kind: "Historical",
        title: "Cyrus's decree and Persian rule",
        start: -539, end: -430,
        regions: ["West Asia / Near East"],
        happened: "After taking Babylon in 539 BC, Cyrus of Persia let deported peoples return and restore their temples, a policy echoed on the Cyrus Cylinder. Judeans rebuilt the temple, completed in 516 BC.",
        growth: "The return re-established Jerusalem and its temple, the setting of Jesus's ministry and of the first church. The public reading and teaching of the Law in this period (Nehemiah 8) foreshadows the synagogue preaching the apostles later used.",
        scripture: ["Ezra 1:2", "Isaiah 45:1", "Nehemiah 8:8"],
        source: wiki("Cyrus Cylinder")
      },
      {
        id: "koine",
        kind: "Historical",
        title: "Alexander's conquests and Koine Greek",
        // Runs through the New Testament era, when Koine was still the common tongue of the East.
        start: -334, end: 100,
        regions: ["Mediterranean Europe", "West Asia / Near East", "Nile Valley"],
        happened: "Alexander the Great conquered the Persian Empire (334–323 BC). His successors spread Greek language and city culture from Egypt to Central Asia.",
        growth: "Koine Greek became a common language across the eastern Mediterranean. The New Testament was written in it, so the Gospels and the apostles' letters could be read from Alexandria to Rome without translation.",
        scripture: ["John 19:20"],
        source: wiki("Koine Greek")
      },
      {
        id: "septuagint",
        kind: "Historical",
        title: "The Septuagint translation",
        // Translated from the 3rd century BC; still the church's Greek Old Testament through the first century.
        start: -280, end: 100,
        regions: ["Nile Valley", "Mediterranean Europe"],
        happened: "Jewish scholars in Alexandria translated the Hebrew Scriptures into Greek, beginning with the Torah in the 3rd century BC.",
        growth: "The Septuagint was the Bible of most early Christians and is often quoted in the New Testament. Greek-speaking Gentiles who attended synagogues already knew its promises when they heard the gospel.",
        scripture: ["Acts 8:28", "Acts 17:11"],
        source: wiki("Septuagint")
      },
      {
        id: "maccabees",
        kind: "Historical",
        title: "The Maccabean revolt",
        start: -167, end: -63,
        regions: ["West Asia / Near East"],
        happened: "Judeans revolted against the Seleucid king Antiochus IV after he outlawed Jewish worship. They rededicated the temple in 164 BC and won a century of self-rule under the Hasmoneans.",
        growth: "The revolt strengthened Jewish devotion to the temple and the Law and heightened hope for God's deliverer, the expectation Jesus's followers answered. Hanukkah, which commemorates it, is the setting of John 10.",
        scripture: ["John 10:22"],
        source: wiki("Maccabean Revolt")
      },
      {
        id: "god-fearers",
        kind: "Historical",
        title: "Gentile \"God-fearers\" in the synagogues",
        start: -100, end: 100,
        regions: ["Mediterranean Europe", "West Asia / Near East"],
        happened: "Many Gentiles attended synagogues and honored Israel's God without fully converting to Judaism.",
        growth: "They were among the earliest Gentile believers, a bridge from the synagogue to the wider city. Examples include Cornelius, Lydia, and the audiences Paul addressed.",
        scripture: ["Acts 10:2", "Acts 16:14", "Acts 13:16"],
        source: wiki("God-fearer")
      },
      {
        id: "rome-judea",
        kind: "Historical",
        title: "Rome takes control of Judea",
        start: -63, end: -4,
        regions: ["West Asia / Near East", "Mediterranean Europe"],
        happened: "Pompey captured Jerusalem in 63 BC. Judea became a Roman client state, ruled by Herod the Great from 37 BC.",
        growth: "Roman rule frames the Gospels: Augustus's census brings Joseph and Mary to Bethlehem, Herod rules at Jesus's birth, and Jesus is crucified, a Roman punishment, under the prefect Pontius Pilate.",
        scripture: ["Luke 2:1", "Matthew 2:1", "John 19:10"],
        source: wiki("Siege of Jerusalem (63 BC)")
      },
      {
        id: "pax-romana",
        kind: "Historical",
        title: "The Pax Romana and Roman roads",
        start: -27, end: 180,
        regions: ["Mediterranean Europe", "West Asia / Near East", "North Africa"],
        happened: "From Augustus onward the Mediterranean had two centuries of relative peace, piracy was suppressed, and paved roads such as the Via Egnatia linked the provinces.",
        growth: "Missionaries and letters could travel with unusual safety and speed. Paul's journeys followed Roman roads and sea lanes; Philippi and Thessalonica both lay on the Via Egnatia.",
        scripture: ["Acts 16:12", "Acts 17:1", "Galatians 4:4"],
        source: wiki("Pax Romana")
      },
      {
        id: "roman-law",
        kind: "Historical",
        title: "Roman law and citizenship",
        start: 45, end: 62,
        regions: ["Mediterranean Europe", "West Asia / Near East"],
        happened: "Roman citizens had legal protections, and governors often refused to judge disputes about Jewish religion. An inscription at Delphi dates the proconsul Gallio to about AD 51–52.",
        growth: "Paul used his citizenship to avoid flogging and to appeal to Caesar, which carried the gospel to Rome. Gallio's dismissal of charges in Corinth let the church there continue, and his dated term is a fixed point for Paul's chronology.",
        scripture: ["Acts 18:12", "Acts 22:25", "Acts 25:11"],
        source: wiki("Delphi Inscription")
      },
      {
        id: "claudius",
        kind: "Historical",
        title: "Claudius expels Jews from Rome",
        start: 49, end: 49,
        regions: ["Mediterranean Europe"],
        happened: "The Roman historian Suetonius reports that Claudius expelled Jews from Rome over disturbances \"at the instigation of Chrestus,\" commonly dated to about AD 49.",
        growth: "The expulsion brought Aquila and Priscilla to Corinth, where they worked with Paul and later taught Apollos. Many historians read \"Chrestus\" as an early garbled reference to disputes over Christ.",
        scripture: ["Acts 18:2", "Acts 18:26"],
        source: wiki("Claudius' expulsion of Jews from Rome")
      },
      {
        id: "nero",
        kind: "Historical",
        title: "The Great Fire of Rome and Nero's persecution",
        start: 64, end: 68,
        regions: ["Mediterranean Europe"],
        happened: "After the fire of AD 64, Nero blamed the Christians of Rome, and Tacitus records their execution.",
        growth: "Tacitus's account is one of the earliest non-Christian references to Christ and shows the church was already large in Rome. Early tradition places the deaths of Peter and Paul in this persecution.",
        scripture: ["1 Peter 4:12", "2 Timothy 4:6"],
        source: wiki("Great Fire of Rome")
      },
      {
        id: "temple-70",
        kind: "Historical",
        title: "The destruction of the Second Temple",
        start: 66, end: 73,
        regions: ["West Asia / Near East"],
        happened: "Rome crushed the Jewish revolt and destroyed Jerusalem and its temple in AD 70.",
        growth: "With the temple gone and Jerusalem's church scattered, Christianity grew as a distinct and increasingly Gentile movement centered on cities such as Antioch, Ephesus, and Rome. Christians saw the event in light of Jesus's warning.",
        scripture: ["Mark 13:2", "Luke 21:20"],
        source: wiki("Siege of Jerusalem (70 CE)")
      },
      {
        id: "imperial-cult",
        kind: "Historical",
        title: "Emperor worship in Asia Minor",
        start: 29, end: 120,
        regions: ["West Asia / Near East"],
        happened: "Cities of Asia Minor competed to honor emperors with temples and festivals, and pressure to take part grew under Domitian (AD 81–96).",
        growth: "Refusing to honor Caesar as divine set Christians apart and brought persecution. This is the background to the letters to the seven churches and to the martyr Antipas of Pergamum.",
        scripture: ["Revelation 2:13", "Revelation 13:15"],
        source: wiki("Roman imperial cult")
      },
      {
        id: "pliny",
        kind: "Historical",
        title: "Pliny's report on the Christians",
        start: 110, end: 113,
        regions: ["West Asia / Near East"],
        happened: "Pliny the Younger, governor of Bithynia-Pontus, wrote to Emperor Trajan asking how to handle the many Christians in his province.",
        growth: "His letter shows Christianity had spread through towns and countryside in northern Asia Minor within about eighty years of Jesus, a region addressed in 1 Peter.",
        scripture: ["1 Peter 1:1"],
        source: wiki("Pliny the Younger on Christians")
      }
    ],

    // Developments overlapping the passage's era, in chronological order.
    forRange: function (start, end) {
      return APP.growth.factors.filter(function (factor) {
        return APP.utils.rangesOverlap(factor.start, factor.end, start - 10, end + 10);
      }).sort(function (a, b) {
        return a.start - b.start;
      });
    }
  };
}());
