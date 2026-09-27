# d1ssk.github.io

Personal GitHub Pages site for [d1ssk.github.io](https://d1ssk.github.io/).

The site is built with plain HTML, CSS, and JavaScript, with no framework, dependencies, or build step.

The homepage uses a warm editorial layout with a serif name and system sans-serif text and project headings. On wider screens, interactive projects appear in the left column and Photography & More, with a portfolio image, appears on the right. Smaller screens use one column, with a larger name and smaller project headings and introduction to keep the hierarchy clear. GitHub is linked from the footer. The homepage layout is entirely CSS and needs no JavaScript.

The Photography & More [portfolio](portfolio/) contains photography and art. Its pages, styles, scripts, and display images all live inside `portfolio/`, so it can later become a separate repository. See the [portfolio README](portfolio/README.md) for adding works and migration instructions.

## Local preview

From the repository root, run:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a browser.
