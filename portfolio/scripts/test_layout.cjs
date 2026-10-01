// Run: node portfolio/scripts/test_layout.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({
  window: {},
  getComputedStyle: gallery => ({
    gridTemplateColumns: Array(gallery.columns).fill(`${gallery.width}px`).join(' '),
    columnGap: '24', gridAutoRows: '8',
  }),
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../layout.js'), 'utf8'), context);
const { portfolioLayoutRatios: ratios, layoutPortfolio: layout } = context.window;
const image = (width, height) => ({ width, height });
const near = [image(1200, 800), image(1200, 801), image(1200, 802), image(2400, 1600)];
assert.equal(new Set(ratios(near)).size, 1, 'small export differences must allow swaps');
assert.equal(new Set(ratios([image(1200, 859), image(1200, 860)])).size, 1, 'custom ratios also work');
assert.equal(new Set(ratios([image(1200, 800), image(1200, 830), image(1200, 900), image(800, 1200)])).size, 4);
assert.equal(new Set(ratios([image(1000, 1000), image(1002, 1000), image(1004, 1000)])).size, 2,
  'nearby ratios must not form an unlimited tolerance chain');
assert.deepEqual(Array.from(ratios([image(0, 800), image(NaN, 800), image(800, -1), image('1200', 800)])),
  [null, null, null, null]);

// Regression against actual catalog data, including the 1200x802 exports.
const catalog = id => JSON.parse(fs.readFileSync(path.join(__dirname, `../assets/works/${id}/info.json`), 'utf8')).image;
assert.equal(new Set(ratios(['dsc02072', 'dsc00633-2', 'dsc00776'].map(catalog))).size, 1);

// Exercise the shared layout at widths near row-span rounding boundaries.
// A tolerated swap must leave every slot height and row span unchanged,
// including single-column layout and after switching preview column counts.
for (const columns of [3, 2, 1]) {
  for (const width of [239.5, 300, 371, 600]) {
    const dimensions = [near[0], image(1200, 675), image(800, 1200), near[2], image(1200, 830)];
    const gallery = { columns, width, classList: { toggle() {} } };
    gallery.children = dimensions.map(dimension => {
      const img = { style: {}, getAttribute: key => dimension[key] };
      return {
        querySelector: () => img,
        style: { removeProperty() { delete this.gridRowEnd; } },
        getBoundingClientRect: () => ({ height: width / Number(img.style.aspectRatio) }),
      };
    });
    layout(gallery);
    const geometry = () => gallery.children.map(card => [card.getBoundingClientRect().height, card.style.gridRowEnd]);
    const before = geometry();
    [gallery.children[0], gallery.children[3]] = [gallery.children[3], gallery.children[0]];
    layout(gallery);
    assert.deepEqual(geometry(), before);
    assert.ok(gallery.children.every(card => card.querySelector().style.objectFit === 'contain'));
  }
}
console.log('PASS: ratio tolerance, actual catalog, rejection of distinct ratios, stable swap slot geometry.');
