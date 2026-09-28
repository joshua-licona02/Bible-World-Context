(function () {
  "use strict";

  APP.clean = {
    normalizeReference: function (value) {
      return String(value || "")
        .trim()
        .replace(/[–—]/g, "-")
        .replace(/\s+/g, " ")
        .replace(/\.$/, "");
    },

    normalizeBookKey: function (value) {
      return String(value || "")
        .toLowerCase()
        .replace(/\./g, "")
        .replace(/\s+/g, " ")
        .trim();
    },

    normalizePassageText: function (value) {
      return String(value || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim()
        .slice(0, APP.config.maxPassageLength);
    },

    parseUrlLines: function (value) {
      return String(value || "")
        .split(/\r?\n/)
        .map(function (line) {
          return line.trim();
        })
        .filter(function (line) {
          return /^https?:\/\//i.test(line);
        })
        .slice(0, APP.config.maxSourceUrls);
    }
  };
}());