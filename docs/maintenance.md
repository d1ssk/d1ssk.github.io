# Personal site maintenance

Run preview commands from the repository root.

The site is built with plain HTML, CSS, and JavaScript, with no framework, dependencies, or build step.

The homepage uses a warm editorial layout with a serif name and system sans-serif text and project headings. On wider screens, interactive projects appear in the left column and Photography & More, with a portfolio image, appears on the right. Smaller screens use one column, with a larger name and smaller project headings and introduction to keep the hierarchy clear. GitHub is linked from the footer. The homepage layout is entirely CSS and needs no JavaScript.

The Photography & More [portfolio](../portfolio) contains photography and art. Its pages, styles, scripts, and display images all live inside `portfolio/`, so it can later become a separate repository. See the [portfolio maintenance guide](../portfolio/MAINTENANCE.md) for adding works and migration instructions.

## Local preview

From the repository root, run:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a browser.

## Search Console and sitemaps

Use the verified URL-prefix property `https://d1ssk.github.io/`. After deploying
all participating sites, submit `https://d1ssk.github.io/sitemap-index.xml` once.
There is no need to submit each child sitemap separately.

- `sitemap.xml` lists this repository's public pages: the homepage and
  `/portfolio/`. Update it when adding or removing a public page. Gallery images,
  viewer state, templates, and local editing tools are not separate entries.
- `sitemap-index.xml` references this sitemap and the Physics Olio, Decoding GPT,
  Chordscape, and Cosmic Scale Explorer sitemaps. Keep the list aligned when adding
  or removing a hosted project.
- `robots.txt` advertises the index at the host root and allows crawling.
  Project-local robots files cannot configure crawling for this host.
- Score Palette is hosted at `score-pallete.streamlit.app`, outside this property.

Decoding GPT already generates `sitemap-index.xml` and `sitemap-0.xml` with Astro.
The host index references its **URL sitemap** (`decoding-gpt/sitemap-0.xml`)
directly, avoiding nested sitemap indexes. If Astro later splits it into more
`sitemap-N.xml` files, add each generated URL sitemap to the host index.
Physics Olio continues generating `interactive-physics-olio/sitemap.xml` from its
English and Japanese publication sources. Chordscape and Cosmic Scale Explorer
copy their checked-in `public/sitemap.xml` into the production build; each lists
its single app entry URL, without UI-state query strings or fragments.

All entries use absolute HTTPS production URLs. No build timestamp is presented
as a content modification date. Keep verification methods used by Search Console
in place; this sitemap configuration does not replace ownership verification.

Deploy the project sitemaps before the host index. Check that each referenced XML
URL returns HTTP 200 and the expected XML (not an HTML fallback), then submit the
host index and inspect the processing status in Search Console. Sitemap inclusion
helps discovery but does not guarantee indexing.

References: [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
and [sitemap indexes](https://developers.google.com/search/docs/crawling-indexing/sitemaps/large-sitemaps).
