# Bible-World-Context

A local-first research explorer that places Biblical passages alongside Biblical events, world history, and region-specific developments.

## Features

- **Context analysis** — enter a Bible reference (e.g. `Daniel 6`, `1 Kings 18:20-39`) to see its historical era, a swimlane timeline, regional comparison, and event tables. Optional AI synthesis.
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

Click **AI settings** in the top bar to choose the provider, server URL, and model. Installed Ollama models are detected automatically. API keys (for hosted services) are kept in memory only and never saved.

## Notes

Dates are approximate unless supported by the collected evidence. Regional coverage depends on the public sources and is not a complete record of world history. AI output should be checked against the linked sources.
