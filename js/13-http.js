(function () {
  "use strict";

  var memoryCache = {};
  var queue = [];
  var active = 0;

  function readCache(key) {
    if (memoryCache[key]) {
      return memoryCache[key];
    }

    try {
      var stored = window.sessionStorage.getItem("bwc-cache:" + key);
      if (stored) {
        memoryCache[key] = JSON.parse(stored);
        return memoryCache[key];
      }
    } catch (error) {
      // Storage can be unavailable in private windows or file previews.
    }

    return null;
  }

  function writeCache(key, value) {
    memoryCache[key] = value;

    try {
      var serialized = JSON.stringify(value);
      if (serialized.length < APP.config.maxCachedResponseChars) {
        window.sessionStorage.setItem("bwc-cache:" + key, serialized);
      }
    } catch (error) {
      // Quota or availability failures only disable persistence, not the request.
    }
  }

  function pump() {
    while (active < APP.config.httpConcurrency && queue.length) {
      var job = queue.shift();
      active += 1;

      job.task()
        .then(job.resolve, job.reject)
        .finally(function () {
          active -= 1;
          pump();
        });
    }
  }

  function delay(ms, signal) {
    return new Promise(function (resolve, reject) {
      var timer = window.setTimeout(resolve, ms);

      if (signal) {
        signal.addEventListener("abort", function () {
          window.clearTimeout(timer);
          reject(APP.http.abortError());
        }, { once: true });
      }
    });
  }

  function isRetryableStatus(status) {
    return status === 429 || status === 502 || status === 503 || status === 504;
  }

  APP.http = {
    abortError: function () {
      var error = new Error("Request cancelled.");
      error.name = "AbortError";
      return error;
    },

    isAbort: function (error) {
      return Boolean(error && error.name === "AbortError");
    },

    // Runs tasks under a shared concurrency ceiling so public APIs are not flooded.
    schedule: function (task) {
      return new Promise(function (resolve, reject) {
        queue.push({ task: task, resolve: resolve, reject: reject });
        pump();
      });
    },

    buildUrl: function (base, params) {
      var query = Object.keys(params)
        .filter(function (key) {
          return params[key] !== undefined && params[key] !== null && params[key] !== "";
        })
        .map(function (key) {
          return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
        })
        .join("&");

      return base + (base.indexOf("?") === -1 ? "?" : "&") + query;
    },

    // fetch() with timeout, cancellation, retry with backoff, and session caching for GETs.
    request: function (url, options) {
      options = options || {};

      var method = options.method || "GET";
      var responseType = options.responseType || "json";
      var timeoutMs = options.timeoutMs || APP.config.httpTimeoutMs;
      var retries = options.retries === undefined ? 2 : options.retries;
      var cacheKey = method === "GET" && options.cache !== false ? responseType + ":" + url : null;
      var cached = cacheKey ? readCache(cacheKey) : null;

      if (cached) {
        return Promise.resolve(cached);
      }

      function attempt(attemptNumber) {
        if (options.signal && options.signal.aborted) {
          return Promise.reject(APP.http.abortError());
        }

        var controller = new AbortController();
        var timedOut = false;
        var timer = window.setTimeout(function () {
          timedOut = true;
          controller.abort();
        }, timeoutMs);

        function forwardAbort() {
          controller.abort();
        }

        if (options.signal) {
          options.signal.addEventListener("abort", forwardAbort, { once: true });
        }

        return fetch(url, {
          method: method,
          headers: options.headers,
          body: options.body,
          credentials: "omit",
          signal: controller.signal
        }).then(function (response) {
          if (!response.ok) {
            var httpError = new Error("HTTP " + response.status + " from " + new URL(url).host + ".");
            httpError.status = response.status;
            httpError.retryAfter = Number(response.headers.get("Retry-After")) || 0;
            throw httpError;
          }

          return responseType === "text" ? response.text() : response.json();
        }).catch(function (error) {
          if (timedOut) {
            var timeoutError = new Error("Timed out after " + Math.round(timeoutMs / 1000) + "s contacting " + new URL(url).host + ".");
            timeoutError.retryable = true;
            throw timeoutError;
          }

          if (options.signal && options.signal.aborted) {
            throw APP.http.abortError();
          }

          if (error instanceof TypeError) {
            error.retryable = true;
          }

          throw error;
        }).finally(function () {
          window.clearTimeout(timer);
          if (options.signal) {
            options.signal.removeEventListener("abort", forwardAbort);
          }
        }).catch(function (error) {
          var retryable = error.retryable || isRetryableStatus(error.status);

          if (!retryable || attemptNumber >= retries || APP.http.isAbort(error)) {
            throw error;
          }

          var backoff = error.retryAfter
            ? Math.min(error.retryAfter * 1000, 8000)
            : 600 * Math.pow(2, attemptNumber);

          return delay(backoff, options.signal).then(function () {
            return attempt(attemptNumber + 1);
          });
        });
      }

      return APP.http.schedule(function () {
        return attempt(0);
      }).then(function (result) {
        if (cacheKey) {
          writeCache(cacheKey, result);
        }
        return result;
      });
    },

    getJson: function (url, options) {
      return APP.http.request(url, options);
    },

    getText: function (url, options) {
      var merged = Object.assign({}, options || {}, { responseType: "text" });
      return APP.http.request(url, merged);
    }
  };
}());
