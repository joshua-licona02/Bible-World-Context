(function () {
  "use strict";

  APP.utils = {
    escapeHtml: function (value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    },

    textToParagraphs: function (text) {
      var paragraphs = String(text || "")
        .split(/\n{2,}/)
        .filter(function (item) {
          return item.trim().length > 0;
        })
        .map(function (item) {
          return "<p>" + APP.utils.escapeHtml(item).replace(/\n/g, "<br>") + "</p>";
        });

      return paragraphs.length ? paragraphs.join("") : "<p>No content available.</p>";
    },

    clamp: function (value, min, max) {
      return Math.min(Math.max(value, min), max);
    },

    sortBy: function (items, field) {
      return items.slice().sort(function (a, b) {
        return Number(a[field]) - Number(b[field]);
      });
    },

    uniqueBy: function (items, field) {
      var seen = {};
      return items.filter(function (item) {
        var key = item[field];
        if (seen[key]) {
          return false;
        }
        seen[key] = true;
        return true;
      });
    },

    formatYear: function (year) {
      if (year < 0) {
        return Math.abs(year) + " BCE";
      }

      if (year === 0) {
        return "1 BCE / 1 CE";
      }

      return year + " CE";
    },

    formatRange: function (start, end) {
      return start === end
        ? APP.utils.formatYear(start)
        : APP.utils.formatYear(start) + " – " + APP.utils.formatYear(end);
    },

    truncate: function (text, maxLength) {
      var value = String(text || "");
      return value.length <= maxLength
        ? value
        : value.slice(0, maxLength - 1).trim() + "…";
    },

    rangesOverlap: function (startA, endA, startB, endB) {
      return Number(startA) <= Number(endB) && Number(endA) >= Number(startB);
    },

    // Minimal Markdown for model output: text is escaped first, then a small safe subset is formatted.
    renderMarkdown: function (text) {
      var html = [];
      var listOpen = false;
      var paragraph = [];

      function inline(value) {
        return APP.utils.escapeHtml(value)
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
          .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
          .replace(/\[((?:[ES]\d+)(?:\s*,\s*[ES]\d+)*)\]/g, function (match, refs) {
            return refs.split(/\s*,\s*/).map(function (ref) {
              return '<button type="button" class="cite-ref" data-ref="' + ref + '">' + ref + "</button>";
            }).join("");
          });
      }

      function flushParagraph() {
        if (paragraph.length) {
          html.push("<p>" + inline(paragraph.join(" ")) + "</p>");
          paragraph = [];
        }
      }

      function closeList() {
        if (listOpen) {
          html.push("</ul>");
          listOpen = false;
        }
      }

      String(text || "").split(/\r?\n/).forEach(function (rawLine) {
        var line = rawLine.trim();
        // A line that is entirely bold ("**Effect on the community**") is used as a sub-heading by many models.
        var boldLine = line.match(/^\*\*([^*]+?)\*\*:?$/);
        var heading = line.match(/^(#{1,4})\s+(.*)$/) || (boldLine ? [line, "###", boldLine[1]] : null);
        var bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);

        if (!line) {
          flushParagraph();
          closeList();
        } else if (heading) {
          flushParagraph();
          closeList();
          html.push(heading[1].length <= 2 ? "<h4>" + inline(heading[2]) + "</h4>" : "<h5>" + inline(heading[2]) + "</h5>");
        } else if (bullet) {
          flushParagraph();
          if (!listOpen) {
            html.push("<ul>");
            listOpen = true;
          }
          html.push("<li>" + inline(bullet[1]) + "</li>");
        } else {
          closeList();
          paragraph.push(line);
        }
      });

      flushParagraph();
      closeList();
      return html.join("");
    },

    safeUrl: function (url) {
      return /^https?:\/\//i.test(String(url || "")) ? String(url) : "";
    },

    downloadFile: function (filename, content, type) {
      var blob = new Blob([content], { type: type });
      var link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.setTimeout(function () {
        URL.revokeObjectURL(link.href);
        link.remove();
      }, 0);
    },

    getSelectedValues: function (selectElement) {
      return Array.prototype.slice.call(selectElement.options)
        .filter(function (option) {
          return option.selected;
        })
        .map(function (option) {
          return option.value;
        });
    }
  };
}());