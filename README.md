# d1ssk.github.io

Personal GitHub Pages site for [d1ssk.github.io](https://d1ssk.github.io/).

The site is built with plain HTML, CSS, and JavaScript, with no framework, dependencies, or build step.

The homepage groups projects and the photography portfolio under Links. On wider screens, the portfolio entry appears on the right, aligned with Interactive Physics Olio; smaller screens show all entries in one vertical list. GitHub is linked from the footer. On wider screens, `layout.js` measures the content and selects the largest heading sizes and spacing that fit the viewport, up to the original desktop sizes. Remaining height is distributed between project entries. It recalculates on resizing, font loading, and content changes. Body text and links keep their readable sizes; narrow screens can scroll naturally. CSS provides a fallback without JavaScript.

The Photography & More [portfolio](portfolio/) contains photography and art. Its pages, styles, scripts, and display images all live inside `portfolio/`, so it can later become a separate repository. See the [portfolio README](portfolio/README.md) for adding works and migration instructions.

## Local preview

From the repository root, run:

```bash
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in a browser.
