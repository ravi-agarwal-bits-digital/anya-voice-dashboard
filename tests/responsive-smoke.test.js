const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/dashboard.css', 'utf8');

for (const breakpoint of ['max-width:900px', 'max-width:720px', 'max-width:560px']) {
  assert(css.includes(`@media screen and (${breakpoint})`), `Missing responsive breakpoint: ${breakpoint}`);
}

assert(css.includes('#kpiPanel{width:100vw!important;max-width:100vw!important;}'), 'KPI drawer must fit mobile width');
assert(css.includes('#userSearchResult.profile-drawer{width:100vw!important;max-width:100vw!important;}'), 'Profile drawer must fit mobile width');
assert(css.includes('overflow-x:auto!important'), 'Responsive horizontal controls need overflow handling');
assert(css.includes('#reportView .direction-switch'), 'Direction filter needs a responsive layout rule');
assert(css.includes('#resetAllFilters'), 'Reset-all-filters control needs responsive styling');
assert(html.includes('id="resetAllFilters"'), 'Reset-all-filters control is missing from the dashboard');
assert(html.includes('id="searchMobile"'), 'Mobile lead search control is missing');
assert(html.includes('id="kpiPanel"'), 'KPI drawer is missing');
assert(html.includes('id="userSearchResult"'), 'Profile drawer is missing');

console.log('Responsive smoke tests passed');
