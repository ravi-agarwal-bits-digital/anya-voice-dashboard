const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/dashboard.css', 'utf8');

assert(css.includes('grid-template-columns:minmax(86px,auto) minmax(0,1fr) auto'), 'Demand outcomes must reserve visible columns for count, label and percentage');
assert(css.includes('.fstep-meter'), 'Demand outcomes proportional meter styling is missing');

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
assert(html.includes('id="campaignFilterSearch"') && html.includes('id="campaignLeaderboardSearch"'), 'Campaign search controls are missing');
assert(css.includes('.campaign-leaderboard-head') && css.includes('.campaign-leaderboard-search'), 'Campaign leaderboard search needs responsive styling');
assert(html.includes('id="kpiPanel"'), 'KPI drawer is missing');
assert(html.includes('id="userSearchResult"'), 'Profile drawer is missing');

console.log('Responsive smoke tests passed');
