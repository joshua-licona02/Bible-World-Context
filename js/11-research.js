(function () {
  "use strict";

  APP.research = {
    wikipediaSearch: function (query, maxSources) {
      var url =
        "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*" +
        "&srlimit=" + encodeURIComponent(maxSources) +
        "&srsearch=" + encodeURIComponent(query);

      return fetch(url)
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Public search returned HTTP " + response.status + ".");
          }
          return response.json();
        })
        .then(function (data) {
          var results = data && data.query && data.query.search ? data.query.search : [];

          return results.map(function (item) {
            return {
              sourceType: "Public encyclopedia search",
              title: item.title,
              excerpt: String(item.snippet || "")
                .replace(/<[^>]+>/g, "")
                .replace(/\s+/g, " ")
                .trim(),
              url: "https://en.wikipedia.org/wiki/" + encodeURIComponent(item.title.replace(/ /g, "_"))
            };
          });
        });
    },

    fetchPublicUrl: function (url) {
      return fetch(url, {
        method: "GET",
        credentials: "omit"
      }).then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        return response.text();
      }).then(function (text) {
        var cleaned = String(text)
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/&amp;/gi, "&")
          .replace(/\s+/g, " ")
          .trim();

        return {
          sourceType: "User-provided public URL",
          title: url,
          excerpt: APP.utils.truncate(cleaned, APP.config.maxSourceTextLength),
          url: url
        };
      });
    },

    collect: function (request) {
      var tasks = [];
      var maxSources = request.maxSources;

      if (request.useSearch && request.query) {
        tasks.push(
          APP.research.wikipediaSearch(request.query, maxSources)
            .catch(function (error) {
              return [{
                sourceType: "Research warning",
                title: "Public search unavailable",
                excerpt: error.message,
                url: ""
              }];
            })
        );
      }

      request.urls.forEach(function (url) {
        tasks.push(
          APP.research.fetchPublicUrl(url)
            .catch(function (error) {
              return {
                sourceType: "URL unavailable",
                title: url,
                excerpt: "The browser could not read this source. The site may block cross-origin access, require authentication, or be unavailable. " + error.message,
                url: url
              };
            })
        );
      });

      if (!tasks.length) {
        return Promise.resolve([]);
      }

      return Promise.all(tasks).then(function (results) {
        var flattened = [];

        results.forEach(function (result) {
          if (Array.isArray(result)) {
            flattened = flattened.concat(result);
          } else {
            flattened.push(result);
          }
        });

        return APP.utils.uniqueBy(flattened, "url").slice(0, maxSources);
      });
    }
  };
}());