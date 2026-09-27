// Run: node portfolio/scripts/test_information.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({ window: {} });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../information.js'), 'utf8'), context);
const { portfolioInformation: visible, portfolioDetailVisible: detailVisible } = context.window;
assert.equal(detailVisible({ label: 'Captured' }), false);
assert.equal(detailVisible({ label: 'Captured', show: true }), true);
assert.equal(detailVisible({ label: 'ISO' }), true);
assert.equal(detailVisible({ label: 'ISO', show: false }), false);
const info = visible({
  title: ' Hidden title ', location: 'Tokyo', description: 'Hidden description',
  visibility: { title: false, description: false },
  details: [{ label: 'ISO', value: '100', show: false }, { label: 'Captured', value: 'today', show: true },
    { label: '画材', value: ' 鉛筆 ' }, { label: '', value: 'empty label' }, { label: 'Empty', value: '' }],
});
assert.equal(info.title, ''); assert.equal(info.description, ''); assert.equal(info.location, 'Tokyo');
assert.equal(JSON.stringify(info.details), JSON.stringify([{label:'Captured', value:'today'}, {label:'画材', value:'鉛筆'}]));
assert.equal(visible({ title: ' Visible ' }).title, 'Visible');
console.log('PASS: shared metadata visibility, defaults, explicit overrides, and empty fields.');
