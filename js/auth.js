
// ===== SECURITY CONFIG =====
const SECURITY = {
  // SHA-256 hash of the access password — generate a new one with the sha256() fn below, never store the plaintext here
  PASSWORD_HASH: "7c1466118dea24f6b18e2df487245b062b86232bff0ab6d978e8a46f9e36855a",
  // Session timeout in minutes
  SESSION_TIMEOUT_MINS: 720,
  // Mask phone numbers in display. Off: the dashboard is password-gated, so counsellors need the
  // full number on screen to act on a lead. (CSV export was always full-number regardless.)
  MASK_PHONES: false
};

// Generate SHA-256 hash
async function sha256(text){
  const encoder=new TextEncoder();
  const data=encoder.encode(text);
  const hash=await crypto.subtle.digest('SHA-256',data);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// Password login
async function checkPassword(){
  const pwd=document.getElementById('loginPassword').value;
  if(!pwd){document.getElementById('loginError').textContent='Please enter a password.';return;}
  
  const hash=await sha256(pwd);
  
  if(hash===SECURITY.PASSWORD_HASH){
    window.DECRYPT_PASSPHRASE=pwd;
    sessionStorage.setItem('auth_user','password_user');
    sessionStorage.setItem('auth_time',Date.now().toString());
    sessionStorage.setItem('auth_method','password');
    sessionStorage.setItem('dk',pwd); // session-only, for decryption on this device while browser open
    unlockDashboard('password_user');
  } else {
    document.getElementById('loginError').textContent='Incorrect password.';
    document.getElementById('loginPassword').value='';
  }
}

// Unlock dashboard
function unlockDashboard(user){
  document.getElementById('loginGate').style.display='none';
  document.getElementById('dashboardContent').style.display='block';
  startSessionTimer();
  // Load data only after auth (gated), and only once per session
  if(!window.DATA_LOADED){
    autoLoadLatestExcel();
  }
}

// Session timeout
let sessionTimer;
let activityListenersBound=false;
function startSessionTimer(){
  clearInterval(sessionTimer);
  const timeout=SECURITY.SESSION_TIMEOUT_MINS*60*1000;
  
  // Bind activity listeners only once (avoid stacking on repeated unlocks)
  if(!activityListenersBound){
    const resetTimer=()=>{sessionStorage.setItem('auth_time',Date.now().toString());};
    ['click','keydown','scroll','mousemove'].forEach(e=>document.addEventListener(e,resetTimer,{passive:true}));
    activityListenersBound=true;
  }
  
  sessionTimer=setInterval(()=>{
    const authTime=Number(sessionStorage.getItem('auth_time')||0);
    if(Date.now()-authTime>timeout){
      lockDashboard();
    }
  },30000); // check every 30s
}

function lockDashboard(){
  clearInterval(sessionTimer);
  sessionStorage.clear();
  document.getElementById('loginGate').style.display='flex';
  document.getElementById('dashboardContent').style.display='none';
  document.getElementById('loginError').textContent='Session expired. Please log in again.';
}

// Phone masking
// ===== Phone classification & country-aware formatting =====
// Common international dialing codes (after the 00 prefix) → country
const COUNTRY_CODES=[
  ["1","🇺🇸","US/Canada"],["44","🇬🇧","UK"],["971","🇦🇪","UAE"],["65","🇸🇬","Singapore"],
  ["61","🇦🇺","Australia"],["49","🇩🇪","Germany"],["33","🇫🇷","France"],["60","🇲🇾","Malaysia"],
  ["966","🇸🇦","Saudi Arabia"],["974","🇶🇦","Qatar"],["973","🇧🇭","Bahrain"],["968","🇴🇲","Oman"],
  ["64","🇳🇿","New Zealand"],["81","🇯🇵","Japan"],["86","🇨🇳","China"],["852","🇭🇰","Hong Kong"],
  ["353","🇮🇪","Ireland"],["31","🇳🇱","Netherlands"],["41","🇨🇭","Switzerland"],["46","🇸🇪","Sweden"],
  ["7","🇷🇺","Russia"],["27","🇿🇦","South Africa"],["254","🇰🇪","Kenya"],["234","🇳🇬","Nigeria"]
];
// Returns {intl:bool, flag, country, cc, national}
function classifyPhone(raw){
  // Strip spaces, dashes, parens, dots — keep leading + and digits
  let p=String(raw||'').trim().replace(/[\s\-().]/g,'');
  // A single leading 0 before a 10-digit Indian mobile (STD style: 09876543210)
  if(/^0[6-9]\d{9}$/.test(p)) p=p.slice(1);
  // Bare 10-digit Indian mobile (starts 6/7/8/9)
  if(/^[6-9]\d{9}$/.test(p)) return {intl:false,flag:"🇮🇳",country:"India",cc:"91",national:p};
  // 12-digit starting 91 (India with code, no +)
  if(/^91[6-9]\d{9}$/.test(p)) return {intl:false,flag:"🇮🇳",country:"India",cc:"91",national:p.slice(2)};
  // +91...
  if(/^\+?91[6-9]\d{9}$/.test(p)) return {intl:false,flag:"🇮🇳",country:"India",cc:"91",national:p.replace(/^\+?91/,'')};
  // 00-prefixed international
  if(/^00\d+/.test(p)){
    const rest=p.slice(2);
    // 0091... = India dialed internationally
    if(/^91[6-9]\d{9}$/.test(rest)) return {intl:false,flag:"🇮🇳",country:"India",cc:"91",national:rest.slice(2)};
    for(const [cc,flag,country] of COUNTRY_CODES){
      if(rest.startsWith(cc)) return {intl:true,flag,country,cc,national:rest.slice(cc.length)};
    }
    return {intl:true,flag:"🌍",country:"International",cc:"",national:rest};
  }
  // +<code> international
  if(/^\+\d+/.test(p)){
    const rest=p.slice(1);
    for(const [cc,flag,country] of COUNTRY_CODES){
      if(rest.startsWith(cc) && cc!=="91") return {intl:true,flag,country,cc,national:rest.slice(cc.length)};
    }
    return {intl:true,flag:"🌍",country:"International",cc:"",national:rest};
  }
  // Unknown shape — treat as international/unknown, don't guess India
  return {intl:true,flag:"🌍",country:"Unknown",cc:"",national:p};
}

function maskNational(n){
  const p=String(n||'');
  if(!SECURITY.MASK_PHONES)return p;
  if(p.length<6)return p;
  return p.slice(0,4)+'****'+p.slice(-2);
}

// Display with country code + flag, masked national part
function maskPhone(phone){
  const c=classifyPhone(phone);
  const cc=c.cc?("+"+c.cc+" "):"";
  return `${cc}${maskNational(c.national)}`;
}
// Full (unmasked) display for CSV — country code + full number, with flag stripped
function fullPhone(phone){
  const c=classifyPhone(phone);
  const cc=c.cc?("+"+c.cc):"";
  return `${cc}${c.national}`;
}

// Check existing session on load
function checkExistingSession(){
  const authTime=Number(sessionStorage.getItem('auth_time')||0);
  const authUser=sessionStorage.getItem('auth_user');
  const timeout=SECURITY.SESSION_TIMEOUT_MINS*60*1000;
  
  if(authUser && (Date.now()-authTime)<timeout){
    window.DECRYPT_PASSPHRASE=sessionStorage.getItem('dk')||'';
    unlockDashboard(authUser);
    return true;
  }
  return false;
}

// Init: check session after full page load (both script blocks parsed)
window.addEventListener('DOMContentLoaded',()=>{
  checkExistingSession();
});
