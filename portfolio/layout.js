// Camera exports and resizing can differ by a few pixels (1200x800 vs 1200x802).
// Group ratios independently of collection order so swaps preserve slot heights.
window.portfolioLayoutRatios = function (images) {
  const ratios = images.map(({ width, height }) =>
    Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0 ? width / height : null);
  const groups = new Map();
  let anchor;
  for (const ratio of [...new Set(ratios.filter(value => value !== null))].sort((a, b) => a - b)) {
    // Compare to the anchor, not the previous member, to avoid tolerance drift.
    if (anchor === undefined || ratio / anchor - 1 > 0.003) anchor = ratio;
    groups.set(ratio, anchor);
  }
  return ratios.map(ratio => groups.get(ratio) ?? null);
};

// Shared by the public gallery and the local editor, at every column count.
window.layoutPortfolio = function (gallery) {
  const works = [...gallery.children];
  const images = works.map(work => work.querySelector('img'));
  const ratios = window.portfolioLayoutRatios(images.map(image => ({
    width: Number(image.getAttribute('width')), height: Number(image.getAttribute('height'))
  })));
  images.forEach((image, index) => {
    if (ratios[index] === null) return;
    image.style.aspectRatio = String(ratios[index]);
    image.style.objectFit = 'contain';
  });
  const columns = getComputedStyle(gallery).gridTemplateColumns.split(" ").length;
  gallery.classList.toggle("is-masonry", columns > 1);
  if (columns === 1) {
    works.forEach((work) => work.style.removeProperty("grid-row-end"));
    return;
  }
  const styles = getComputedStyle(gallery);
  const gap = parseFloat(styles.columnGap);
  const rowHeight = parseFloat(styles.gridAutoRows);
  const heights = works.map((work) => work.getBoundingClientRect().height);
  works.forEach((work, index) => {
    work.style.gridRowEnd = `span ${Math.ceil((heights[index] + gap) / rowHeight)}`;
  });
};
