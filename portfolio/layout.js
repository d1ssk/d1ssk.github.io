// Shared by the public gallery and the local editor, at every column count.
window.layoutPortfolio = function (gallery) {
  const works = [...gallery.children];
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
