# Bible-World-Context

A local-first research explorer that shows Biblical history within world history, and how the events of the wider world shaped the beginning and growth of Christianity.

**Full documentation:** [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md): how everything works, the code, data sources, how AI is used, and how to extend it.

## Features

- **Context analysis** — enter a verse, chapter, or book (e.g. `Isaiah 41:10`, `Isaiah 41`, `Isaiah`) for detail at that level:
  - Passage text (BSB, KJV, NET, WEB; ESV and NIV with your own free API keys)
  - Tyndale study notes and book introductions, with each source labeled by perspective
  - **World Connections**: curated developments of the era (Koine Greek, the Septuagint, the Pax Romana, and more) and how they shaped Christianity's growth
  - The era's timeline, regional comparison, and optional AI synthesis with a Baptist (default), evangelical, or academic lens
- **Timeline search** — ask a question (e.g. *"What was happening in China and India during the Babylonian exile?"*), give keywords, or a year range. Results from multiple public sources are merged into one timeline with duplicates combined, confidence scores, and an evidence trail for every event.
  - Wikipedia year / decade / century chronicle pages (events by region)
  - Wikipedia search with Wikidata dates, precision, and coordinates
  - Wikidata structured dated events (SPARQL)
  - OpenAlex scholarship for further reading
  - Optional: your own SearXNG instance and public URLs
- **AI assistance (optional)** — works with [Ollama](https://ollama.com) or any OpenAI-compatible server (LM Studio, llama.cpp, vLLM, OpenRouter…):
  - Turns questions into targeted searches
  - Extracts dated events from web pages
  - Suggests missing events, keeping only those verified against Wikipedia/Wikidata
  - Per-event deep dives and cited period summaries
- Export timelines as CSV, Markdown, or JSON.

## Running

Double-click **`Start Bible World Context.bat`**. It serves the folder at <http://localhost:5510> (using Python) and opens
it in your browser; close the "Bible World Context server" window to stop it.

Opening `index.html` directly also works for Scripture, commentary, and history sources, but not for Ollama: pages opened
as files send `Origin: null`, which Ollama rejects. Serving from localhost avoids this without changing Ollama's settings.

## AI settings

Click **AI settings** in the top bar to choose the provider, server URL, and model. Installed Ollama models are detected automatically. A hosted AI provider's API key is kept in memory only and never saved.

The same dialog takes optional keys for licensed Bible translations: ESV (free at api.esv.org) and API.Bible (free at scripture.api.bible; includes the NIV only if your key is licensed for it). These keys are saved in this browser only.

## Notes

Dates are approximate unless supported by the collected evidence. Regional coverage depends on the public sources and is not a complete record of world history. AI output should be checked against the linked sources.
