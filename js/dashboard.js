


function getStickyTopOffset(){
  const nav=document.querySelector('.exec-sidebar');
  if(window.innerWidth<=900 && nav && nav.offsetParent!==null){
    return Math.min(Math.max(nav.offsetHeight+12,96),150);
  }
  // Desktop: the slim filter bar is pinned, so land sections just below it (measured).
  const fb=document.querySelector('#filterBar');
  if(fb && window.innerWidth>900 && getComputedStyle(fb).position==='sticky' && fb.offsetParent!==null){
    return fb.offsetHeight+20;
  }
  return 24;
}
function scrollToWithStickyOffset(el, behavior='smooth'){
  if(!el)return;
  const y=el.getBoundingClientRect().top+window.pageYOffset-getStickyTopOffset();
  window.scrollTo({top:Math.max(0,y),behavior});
}
function updateMobileNavShadow(){
  document.body.classList.toggle('mobile-nav-scrolled',window.innerWidth<=900 && window.scrollY>8);
}
function toggleSideGroup(group){
  // Manual, sticky collapse/expand only. Groups never auto-collapse -- the sidebar simply scrolls
  // internally if the full map is taller than the viewport, which stays predictable while you
  // scroll past it (the earlier auto-fit kept re-collapsing groups, which was confusing).
  group.classList.toggle('open');
}

function syncSidebarActive(forceId){
  const links=[...document.querySelectorAll('.side-link')];
  if(!links.length)return;
  const setActive=(id)=>{
    links.forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+id));
    // Highlight the group that owns the active section, so location is clear even when the
    // group is collapsed (its links are hidden).
    document.querySelectorAll('.side-group').forEach(g=>{
      const lbl=g.querySelector('.side-group-label');
      if(lbl)lbl.classList.toggle('active-group',!!g.querySelector('.side-link[href="#'+id+'"]'));
    });
    const activeLink=document.querySelector('.side-link[href="#'+id+'"]');
    const activeGroup=activeLink&&activeLink.closest('.side-group');
    if(activeGroup)activeGroup.classList.add('open');
  };
  if(forceId){setActive(forceId);return;}
  const report=document.getElementById('reportView');
  if(!report || report.offsetParent===null){setActive('sec-overview');return;}
  const targets=links.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if(window.scrollY<80){setActive('sec-overview');return;}
  let best='sec-overview', bestDist=Infinity;
  for(const el of targets){
    const rect=el.getBoundingClientRect();
    // A section that has fully scrolled past (bottom at/above the viewport top) must not stay
    // "closest" just because nothing else has come into range yet -- several sections between the
    // linked ones (e.g. Call Flow Overview, Outbound Connect Performance) have no sidebar link of
    // their own, so without this guard the last linked section above them stays stuck highlighted
    // for the entire scroll distance through that unlinked stretch.
    if(rect.bottom<=0)continue;
    const dist=Math.abs(rect.top-135);
    if(rect.top<=220 && dist<bestDist){bestDist=dist;best=el.id;}
  }
  setActive(best);
}
window.addEventListener('DOMContentLoaded',()=>{
  applyReducedAiControlVisibility();
  const links=[...document.querySelectorAll('.side-link')];
  links.forEach(a=>a.addEventListener('click',e=>{
    const el=document.querySelector(a.getAttribute('href'));
    if(el){
      e.preventDefault();
      scrollToWithStickyOffset(el);
      syncSidebarActive(el.id);
    }
  }));
  document.querySelectorAll('.side-group-label').forEach(lbl=>{
    lbl.addEventListener('click',()=>{const g=lbl.closest('.side-group');if(g)toggleSideGroup(g);});
  });
  // Throttle scroll/resize work to one update per animation frame -- syncSidebarActive reads
  // layout for every section, so running it on every raw scroll event caused jank.
  let viewportTicking=false;
  const onViewportChange=()=>{
    if(viewportTicking)return;
    viewportTicking=true;
    requestAnimationFrame(()=>{viewportTicking=false;syncSidebarActive();updateMobileNavShadow();});
  };
  window.addEventListener('scroll',onViewportChange,{passive:true});
  window.addEventListener('resize',onViewportChange,{passive:true});
  const directionSwitch=document.getElementById('directionSwitch');
  if(directionSwitch){
    directionSwitch.addEventListener('click',e=>{
      const btn=e.target.closest('.dir-btn[data-dir]');
      if(!btn)return;
      e.preventDefault();
      setDirectionFilter(btn.dataset.dir||'all');
    });
    updateDirectionButtons();
  }
  syncSidebarActive('sec-overview');
  updateMobileNavShadow();
});

const C={teal:"#247858",green:"#247858",amber:"#b08a3c",coral:"#a33a3a",gold:"#b08a3c",blue:"#3f6ba8",hot:"#a33a3a",warm:"#b7791f",cold:"#7b8798",indigo:"#5b47d6",line:"#dce4ef",muted:"#667085",cream:"#0b1f3a"};
// Keep this view switch aligned with the body class in index.html. The hidden sections and
// dynamic fields remain in the source so the reduced view can be restored without rebuilding logic.
function reducedAiViewEnabled(){
  return !!(document.body&&document.body.classList&&document.body.classList.contains('dashboard-reduced-ai-view'));
}
function applyReducedAiControlVisibility(){
  if(!reducedAiViewEnabled()||!document.querySelectorAll)return;
  document.querySelectorAll('option[data-hide-in-reduced-view="true"]').forEach(option=>option.remove());
}
const METRIC_DEFINITIONS=Object.freeze({
  'Enquiries':'Final unique Call-ID conversation records in the active dashboard scope.',
  'Unique leads':'Distinct normalized lead phone numbers represented by those final records.',
  'Callbacks':'Final records carrying the callback signal; a call can also be Hot or an attention signal.',
  'Hot leads':'Final records classified as Hot by the lead-temperature field.',
  'AI confidence':'Average model confidence across final conversation records.',
  'Attention signals':'Final records flagged as frustrated or requiring review.',
  'Dials placed':'Final unique dial-level records, including failed and initiated attempts.',
  'Connect rate':'Connected dial-level records divided by all dial-level records in scope.',
  'Distinct-number reach':'Distinct normalized numbers with at least one connected dial.',
  'Advisory minutes':'Billed minutes from connected conversation records only.',
  'Estimated operating cost':'Advisory minutes multiplied by the dashboard operating-rate assumption.',
  'India / International':'Final conversation records grouped by normalized phone geography.',
  'Average enquiry duration':'Average duration across final conversation records.',
  'Quality pass rate':'Green review-band records divided by final conversation records.'
});
function metricDefinition(label){return METRIC_DEFINITIONS[label]||'Computed from final records in the active dashboard scope.';}
const $=id=>document.getElementById(id);
let RECORDS=[], SRC="";

const dz=$("dropZone"),fi=$("fileInput");
dz.onclick=()=>fi.click();
fi.onchange=e=>{if(e.target.files[0])handle(e.target.files[0]);};
["dragover","dragenter"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add("over");}));
["dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove("over");}));
dz.addEventListener("drop",e=>{if(e.dataTransfer.files[0])handle(e.dataTransfer.files[0]);});
if($("reloadBtn"))$("reloadBtn").onclick=()=>{$("reportView").style.display="none";$("uploadView").style.display="flex";$("err").textContent="";fi.value="";};

function setDashboardLoadingMessage(message){
  const text=document.querySelector('#dataLoading p');
  if(text)text.textContent=message;
}

// NOTE: Data loads only AFTER successful auth — see unlockDashboard() → autoLoadLatestExcel()
window.DATA_LOADED=false;

function setDashboardLoading(){
  const loading=$("dataLoading"), placeholder=$("dataPlaceholder"), shell=$("mainShell"), wrap=$("mainWrap");
  document.body.classList.add("dashboard-loading");
  document.body.classList.remove("dashboard-ready","dashboard-placeholder");
  if(shell)shell.style.setProperty("display","none","important");
  if(wrap)wrap.style.setProperty("display","none","important");
  if(placeholder)placeholder.style.display="none";
  if(loading)loading.style.display="flex";
  setDashboardLoadingMessage('Downloading latest data…');
}
function setDashboardReady(){
  const loading=$("dataLoading"), placeholder=$("dataPlaceholder"), shell=$("mainShell"), wrap=$("mainWrap");
  document.body.classList.add("dashboard-ready");
  document.body.classList.remove("dashboard-loading","dashboard-placeholder");
  if(loading)loading.style.display="none";
  if(placeholder)placeholder.style.display="none";
  if(shell){shell.style.removeProperty("display");shell.style.display="grid";}
  if(wrap){wrap.style.removeProperty("display");wrap.style.display="block";}
}
function setDashboardPlaceholder(title,msg){
  const loading=$("dataLoading"), placeholder=$("dataPlaceholder"), shell=$("mainShell"), wrap=$("mainWrap");
  document.body.classList.add("dashboard-placeholder");
  document.body.classList.remove("dashboard-loading","dashboard-ready");
  if(loading)loading.style.display="none";
  if(shell)shell.style.setProperty("display","none","important");
  if(wrap)wrap.style.setProperty("display","none","important");
  if(placeholder)placeholder.style.display="flex";
  if($("dataPlaceholderTitle"))$("dataPlaceholderTitle").textContent=title||"No data published";
  if($("dataPlaceholderMsg"))$("dataPlaceholderMsg").innerHTML=msg||"No dataset has been published yet.<br><br>Once an Excel file is published, this dashboard will load the latest available dataset.";
}
function fetchWithTimeout(url,options={},timeoutMs=15000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  return fetch(url,{...options,signal:controller.signal}).finally(()=>clearTimeout(timer));
}
const DATA_FETCH_TIMEOUT_MS=180000;

function autoLoadLatestExcel(){
  setDashboardLoading();
  loadPublicationFreshness();

  // Revalidate on every visit, but allow the browser to reuse the encrypted body when unchanged.
  // `no-store` forced the full and continually-growing workbook to download on every page load.
  fetchWithTimeout('data/voice_analytics.xlsx',{cache:'no-cache'},DATA_FETCH_TIMEOUT_MS)
    .then(r=>{
      if(r.ok)return r.arrayBuffer();
      throw new Error('File not found');
    })
    .then(async buf=>{
      const bytes=new Uint8Array(buf);
      let fileBytes=bytes;
      // Detect encryption magic header "ANYAENC1"
      if(isEncrypted(bytes)){
        try{
          setDashboardLoadingMessage('Decrypting secure data…');
          fileBytes=await decryptData(bytes,window.DECRYPT_PASSPHRASE||'');
        }catch(e){
          setDashboardPlaceholder('Data locked','Could not decrypt the published data file. Please re-enter the dashboard password and try again.');
          if($('loginError'))$('loginError').textContent='Could not decrypt data — wrong password. Please re-enter.';
          if($('loginGate'))$('loginGate').style.display='flex';
          if($('dashboardContent'))$('dashboardContent').style.display='none';
          sessionStorage.removeItem('dk');sessionStorage.removeItem('auth_user');
          return;
        }
      }
      setDashboardLoadingMessage('Reading workbook…');
      await processWorkbookBytes(fileBytes,'voice_analytics.xlsx');
    })
    .catch(err=>{
      const timedOut=err && err.name==='AbortError';
      setDashboardPlaceholder(
        timedOut?'Data load timed out':'No data published',
        timedOut
          ? 'The dashboard waited for the latest voice export but the request did not complete. Please check that <b>data/voice_analytics.xlsx</b> is reachable, then refresh or click Check Again.'
          : 'No voice export was found at <b>data/voice_analytics.xlsx</b>.<br><br>Once the Excel file is published in that path, this dashboard will load it automatically.'
      );
    });
}

function loadPublicationFreshness(){
  fetchWithTimeout('data/voice_analytics.xlsx.meta.json',{cache:'no-cache'},10000)
    .then(r=>r.ok?r.json():Promise.reject(new Error('Metadata unavailable')))
    .then(meta=>{
      const el=$("publicationFreshness"),raw=meta.publishedAt||meta.published_at||meta.generatedAt;
      const date=raw?new Date(raw):null;
      if(!el||!date||Number.isNaN(date.getTime()))return;
      el.textContent=`Published ${new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(date)}`;
      el.title=`Latest dataset published ${date.toLocaleString('en-IN')}`;
    }).catch(()=>{});
}

// ===== AES-256-GCM decryption (matches admin encryption) =====
// IMPORTANT: The published encrypted data file uses the original legacy magic
// header "AANYAENC1". This is an internal file signature, not visible branding.
// Keep both headers supported so older and newer admin exports continue to load.
const ENC_MAGIC_OPTIONS=["AANYAENC1","ANYAENC1"];
function encryptedMagic(bytes){
  for(const magic of ENC_MAGIC_OPTIONS){
    if(bytes.length<magic.length)continue;
    let ok=true;
    for(let i=0;i<magic.length;i++){
      if(bytes[i]!==magic.charCodeAt(i)){ok=false;break;}
    }
    if(ok)return magic;
  }
  return null;
}
function isEncrypted(bytes){return !!encryptedMagic(bytes);}
async function deriveKey(passphrase,salt){
  const baseKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2',salt,iterations:150000,hash:'SHA-256'},
    baseKey,{name:'AES-GCM',length:256},false,['decrypt']
  );
}
async function decryptData(bytes,passphrase){
  // Layout: [magic][16 salt][12 iv][...ciphertext]
  const magic=encryptedMagic(bytes);
  if(!magic)throw new Error('Encrypted data header not recognized');
  const off=magic.length;
  const salt=bytes.slice(off,off+16);
  const iv=bytes.slice(off+16,off+28);
  const ct=bytes.slice(off+28);
  const key=await deriveKey(passphrase,salt);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ct);
  return new Uint8Array(plain);
}

function retryDataLoad(){
  window.DATA_LOADED=false;
  autoLoadLatestExcel();
}
function workbookWorkerTimeout(bytes){
  const megabytes=Math.max(1,Math.ceil(Number(bytes?.byteLength||0)/1048576));
  return Math.min(300000,Math.max(60000,megabytes*3000));
}
function parseWorkbookOnMainThread(bytes){
  const wb=XLSX.read(bytes,{type:'array',cellDates:true,dense:true});
  return chooseWorkbookRows(wb);
}
function parseWorkbookInWorker(bytes){
  return new Promise((resolve,reject)=>{
    let worker;
    try{worker=new Worker('js/workbook-worker.js');}catch(error){reject(error);return;}
    let settled=false;
    const finish=(callback,value)=>{if(settled)return;settled=true;clearTimeout(timer);worker.terminate();callback(value);};
    const timer=setTimeout(()=>finish(reject,new Error('Workbook worker timed out.')),workbookWorkerTimeout(bytes));
    worker.onerror=event=>finish(reject,new Error(event.message||'Workbook worker failed.'));
    worker.onmessage=event=>{
      try{
        const result=event.data||{};
        if(!result.ok){finish(reject,new Error(result.error||'Workbook worker could not parse the file.'));return;}
        finish(resolve,chooseWorkbookCandidates(result.sheets||[]));
      }catch(error){finish(reject,error);}
    };
    const buffer=bytes.byteOffset===0&&bytes.byteLength===bytes.buffer.byteLength
      ?bytes.buffer
      :bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
    // Do not transfer ownership: retaining the bytes allows a safe main-thread fallback on worker errors.
    try{worker.postMessage({bytes:buffer});}catch(error){finish(reject,error);}
  });
}
async function parseWorkbookBytes(bytes){
  if(typeof Worker!=='function')return parseWorkbookOnMainThread(bytes);
  try{return await parseWorkbookInWorker(bytes);}
  catch(error){
    console.warn('Workbook worker unavailable; using main-thread fallback:',error);
    return parseWorkbookOnMainThread(bytes);
  }
}
async function processWorkbookBytes(bytes,sourceName){
  if($('err'))$('err').textContent='';
  if(typeof XLSX==='undefined'){
    setDashboardPlaceholder('Spreadsheet engine unavailable','The spreadsheet parser did not load. Please check internet/CDN access and refresh the dashboard.');
    return;
  }
  try{
    setDashboardLoadingMessage('Parsing workbook…');
    const chosen=await parseWorkbookBytes(bytes);
    if(!chosen){setDashboardPlaceholder('No records found','The workbook loaded, but no worksheet contains rows. Please publish an export with call records.');return;}
    setDashboardLoadingMessage(`Preparing dashboard from ${chosen.rows.length.toLocaleString()} rows…`);
    const rows=dedupeRowsByCallId(chosen.rows);
    const allCalls=rows.map((r,i)=>rowToRecord(r)).filter(r=>r && r.d);
    ALL_DIALS=allCalls;                              // dial-level universe (incl. failed/initiated)
    RECORDS=allCalls.filter(isConversationRecord);   // conversation universe -- every existing analytic
    SRC=sourceName;
    if(!RECORDS.length){
      const headers=Object.keys(rows[0]||{}).slice(0,12).join(', ');
      setDashboardPlaceholder('No valid call records','The export loaded from <b>'+esc(chosen.name)+'</b>, but the dashboard could not identify a valid call date column.<br><br><b>Columns seen:</b> '+esc(headers||'none'));
      return;
    }
    boot();
  }catch(err){setDashboardPlaceholder('Could not process data','The Excel file was found, but the dashboard could not process it.<br><br><b>Reason:</b> '+esc(err.message||String(err)));}
}
function handle(file){
  const rd=new FileReader();
  rd.onerror=()=>setDashboardPlaceholder('Could not read data','The Excel file could not be read by the browser. Please replace the published file and try again.');
  rd.onload=e=>processWorkbookBytes(new Uint8Array(e.target.result),file.name);
  rd.readAsArrayBuffer(file);
}

let FILTERED_RECORDS=[];
let ALL_RECORDS_BACKUP=[];
let ALL_DIALS=[]; // dial-level universe: every unique call incl. failed/initiated dials. Used only by the
                  // outbound connectivity analysis. RECORDS stays the conversation universe (completed calls)
                  // so lead/quality/intent metrics are never diluted by non-connecting dials.
let SELECTED_DIRECTION="all";
let SELECTED_CAMPAIGN="all"; // 'all' or an exact Campaign name; scopes the whole dashboard when set
let renderGeneration=0;

function recordDateBounds(records){
  let min=null,max=null;
  for(const record of records||[]){
    const d=record&&record.d;
    if(!d)continue;
    if(min===null||d<min)min=d;
    if(max===null||d>max)max=d;
  }
  return{min,max};
}

function quickFilter(type){
  const{min:dataMin,max:dataMax}=recordDateBounds(ALL_RECORDS_BACKUP);
  if(!dataMax){return;}

  const parseISO=s=>{const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d);};
  const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  // Real calendar "now" — quick ranges are relative to the actual current date.
  // If a range has no data (e.g. Today but data ends earlier), the empty-state shows honestly.
  const today=new Date();today.setHours(0,0,0,0);
  let from=new Date(today),to=new Date(today);

  switch(type){
    case 'today':break;
    case 'yesterday':from.setDate(from.getDate()-1);to.setDate(to.getDate()-1);break;
    case 'week':from.setDate(from.getDate()-6);break;        // last 7 calendar days
    case 'month':from.setDate(from.getDate()-29);break;      // last 30 calendar days
    case 'all':from=parseISO(dataMin);to=parseISO(dataMax);break;
  }

  $("filterFromDate").value=fmt(from);
  $("filterToDate").value=fmt(to);
  $("customFilterPanel").style.display="none";
  applyFilters();
  updateFilterButtons(type);
}

function resetAllFilters(){
  const source=ALL_DIALS.length?ALL_DIALS:ALL_RECORDS_BACKUP;
  const{min,max}=recordDateBounds(source);
  SELECTED_DIRECTION='all';
  SELECTED_CAMPAIGN='all';
  if(min)$('filterFromDate').value=min;
  if(max)$('filterToDate').value=max;
  const campaign=$('campaignFilter');if(campaign)campaign.value='all';
  const custom=$('customFilterPanel');if(custom)custom.style.display='none';
  const search=$('searchMobile');if(search)search.value='';
  closeUserSearch();
  clearLedgerFilters();
  applyFilters();
  updateFilterButtons('all');
  updateDirectionButtons();
  updateCampaignFilterVisibility();
}

function toggleCustomFilter(){
  const panel=$("customFilterPanel");
  panel.style.display=panel.style.display==="none"?"flex":"none";
}

function applyCustomFilter(){
  applyFilters();
  $("customFilterPanel").style.display="none";
  updateFilterButtons("custom");
}

function updateFilterButtons(active){
  ["today","yesterday","week","month","all","custom"].forEach(b=>{
    const btn=$("btn-"+b);
    if(btn){
      const on=b===active;
      btn.classList.toggle('filter-active',on);
      btn.setAttribute('aria-pressed',on?'true':'false');
      btn.style.background=on?"linear-gradient(135deg,var(--navy),var(--navy2))":"#fff";
      btn.style.color=on?"#fff":"var(--navy)";
      btn.style.borderColor=on?"var(--navy)":"var(--line)";
      btn.style.boxShadow=on?"0 10px 22px rgba(11,31,58,.14)":"none";
    }
  });
  const range=$('selectedDateRange');
  if(range){
    range.classList.toggle('range-active',!!active && active!=='all');
  }
}


// The Management readout is a normal in-flow section -- "visible" means "on screen right now", same
// scroll-based check every other section-highlight decision in the dashboard already uses.
function isManagementSummaryVisible(){
  const el=$('sec-overview');
  if(!el)return false;
  const rect=el.getBoundingClientRect();
  const vh=window.innerHeight||document.documentElement.clientHeight||0;
  return rect.top<vh*0.72 && rect.bottom>120;
}
function focusManagementSummary(){
  const el=$('sec-overview');
  if(!el)return;
  scrollToWithStickyOffset(el);
  syncSidebarActive('sec-overview');
  el.classList.remove('summary-focus');
  void el.offsetWidth;
  el.classList.add('summary-focus');
  setTimeout(()=>{if(el)el.classList.remove('summary-focus');},1400);
}
// Run a batch of paint steps a few per animation frame instead of all in one frame, so no single
// frame is a long freeze and sections pop in progressively. Guarded by renderGeneration: if a newer
// render (e.g. another filter toggle) starts, the stale batch stops immediately.
function runPaintChunks(generation, thunks, done){
  let i=0;
  const step=()=>{
    if(generation!==renderGeneration)return;
    const end=Math.min(i+3, thunks.length);
    for(;i<end;i++){ try{thunks[i]();}catch(e){console.warn('paint chunk error:',e);} }
    if(i<thunks.length){requestAnimationFrame(step);} else if(done){done();}
  };
  requestAnimationFrame(step);
}
function applyFilters(){
  const generation=++renderGeneration;
  CB_RENDER_LIMIT=50; // each filter change starts the callback list capped again (keeps toggles fast)
  const keepManagementSummaryVisible=isManagementSummaryVisible();
  updateDirectionButtons();
  const fromDate=$("filterFromDate").value;
  const toDate=$("filterToDate").value;

  // Show selected date range
  if(fromDate && toDate){
    const from=new Date(fromDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
    const to=new Date(toDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
    $("dateRangeText").textContent=`${from} → ${to}`;
    $("selectedDateRange").style.display="block";
  }else if(fromDate){
    const from=new Date(fromDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
    $("dateRangeText").textContent=`From ${from}`;
    $("selectedDateRange").style.display="block";
  }else if(toDate){
    const to=new Date(toDate).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
    $("dateRangeText").textContent=`Until ${to}`;
    $("selectedDateRange").style.display="block";
  }else{
    $("selectedDateRange").style.display="none";
  }

  FILTERED_RECORDS=ALL_RECORDS_BACKUP.filter(r=>{
    if(!r.d) return false;
    if(fromDate && r.d<fromDate) return false;
    if(toDate && r.d>toDate) return false;
    if(SELECTED_DIRECTION!=='all' && normalizeDirection(r.direction)!==SELECTED_DIRECTION) return false;
    if(SELECTED_CAMPAIGN!=='all' && (r.campaign||'')!==SELECTED_CAMPAIGN) return false;
    return true;
  });

  RECORDS=FILTERED_RECORDS;
  invalidateLedgerRepeatCache();
  clearLedgerScope(false);
  renderHeaderMeta(RECORDS);
  const o=aggregate(RECORDS);
  // Paint the top-of-page essentials synchronously so the filter feels instant...
  paintHealth(o);paintManagementBrief();paintFunnel(o);paintTempQual(o);paintDurBands(o);paintConfDist(o);paintConfImpact(o);

  // Trigger KPI and verdict animations
  document.querySelectorAll('.kpi').forEach(kpi=>{
    kpi.classList.remove('pulse');
    setTimeout(()=>kpi.classList.add('pulse'),10);
  });
  const verdict=document.querySelector('.verdict');
  if(verdict){
    verdict.classList.remove('pulse');
    setTimeout(()=>verdict.classList.add('pulse'),10);
  }
  // ...then defer the heavier, mostly below-the-fold sections (outbound sweeps, campaign leaderboard,
  // anomaly decomposition, ledger) to the next frame, so applying a filter doesn't freeze the tab
  // while everything repaints at once.
  runPaintChunks(generation,[
    ()=>paintIntents(o),()=>paintMsgImpact(o),()=>dayChart(o.daily),()=>hourChart(o.hourly),
    ()=>paintFrustBreak(o),()=>paintFrustCost(o),()=>paintHottestLeads(RECORDS),()=>paintSerialCallers(RECORDS),
    ()=>paintBandBars(o),()=>paintGeo(o),()=>paintDirectionSplit(),()=>paintDirectionCompare(),
    ()=>paintOutboundPerf(),()=>paintOutboundCadence(),()=>paintCampaignSection(),()=>paintIntentQuality(RECORDS),
    ()=>paintAnomalyCards(),()=>renderExplorer(true),
    ()=>{try{paintCallbacks(RECORDS);}catch(e){console.warn("paintCallbacks error:",e);}}
  ],()=>setTimeout(()=>{if(keepManagementSummaryVisible)focusManagementSummary();else syncSidebarActive();},120));
  closeUserSearch();
}

let searchTimer;
function percentOf(value,total){return total?Math.round(Number(value||0)/total*100):0;}
function renderHeaderMeta(records){
  const meta=$("meta");
  if(!meta)return;
  if(!records.length){
    meta.innerHTML=`<div style="background:rgba(255,85,85,0.08);border:1px solid rgba(255,85,85,0.3);border-radius:6px;padding:5px 10px;font-size:11px;color:var(--hot)"><b>No calls match current view</b><span style="margin-left:8px;color:var(--muted)">${currentViewDescription()}</span></div>`;
    return;
  }
  const dts=records.map(r=>r.d).sort(),dmn=dts[0],dmx=dts[dts.length-1],tMins=sumBilledMinutes(records);
  meta.innerHTML=[["Period",dmn+" – "+dmx],["Calls",records.length+" calls"],["Avg. duration",Math.round(records.reduce((a,r)=>a+r.dur,0)/records.length)+"s avg"],["Minutes",tMins+" mins"],["Cost","₹"+tMins*5]].map(m=>`<div style="background:rgba(0,212,170,0.08);border:1px solid rgba(0,212,170,0.2);border-radius:6px;padding:5px 10px;font-size:11px;color:var(--teal);white-space:nowrap">${esc(m[0])} <b style="color:#e8e8e8">${esc(m[1])}</b></div>`).join("");
}
function phoneDigits(value){return String(value||'').replace(/\D/g,'').replace(/^00/,'');}
function phoneSearchVariants(value){
  const raw=phoneDigits(value),c=classifyPhone(value),normalized=phoneDigits((c.cc||'')+(c.national||'')),national=phoneDigits(c.national||'');
  return [...new Set([raw,normalized,national,raw.length>10?raw.slice(-10):'',raw.length===11&&raw[0]==='0'?raw.slice(1):''].filter(v=>v.length>=4))];
}
function resolveLeadSearch(query,rows=ALL_RECORDS_BACKUP){
  const qVariants=phoneSearchVariants(query),q=phoneDigits(query);
  if(!qVariants.length)return{calls:[],matches:[],ambiguous:false};
  const groups=new Map();
  (rows||[]).forEach(r=>{
    const variants=phoneSearchVariants(r.from);
    if(!variants.some(v=>qVariants.some(term=>v===term||v.endsWith(term)||term.endsWith(v))))return;
    const key=ledgerPhoneKey(r)||variants[0];if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
  });
  const matches=[...groups.entries()].map(([key,calls])=>({key,calls:calls.sort((a,b)=>b.ts-a.ts)}));
  const exact=matches.filter(m=>phoneSearchVariants(m.calls[0]?.from).includes(q));
  const chosen=exact.length===1?exact[0]:matches.length===1?matches[0]:null;
  return{calls:chosen?chosen.calls:[],matches,ambiguous:!chosen&&matches.length>1};
}
function debouncedSearch(val){
  clearTimeout(searchTimer);
  searchTimer=setTimeout(()=>searchUserByMobile(val),250);
}

function searchUserByMobile(mobile, source="search"){
  mobile=mobile.trim();
  // Hide results for empty/short input — but DON'T clear the input (user is still typing)
  if(!mobile||mobile.length<4){$("userSearchResult").style.display="none";return;}

  const resolved=resolveLeadSearch(mobile),userCalls=resolved.calls;
  const activeCalls=userCalls.filter(recordMatchesCurrentFilters);
  window.__profileCalls=userCalls;
  const pexp=$("profileExport"); if(pexp)pexp.style.display=userCalls.length?'inline-flex':'none';
  const pledger=$("profileLedger"); if(pledger)pledger.style.display=userCalls.length?'inline-flex':'none';
  if(resolved.ambiguous){
    $("userSearchResult").style.display="block";
    $("userSearchPhone").innerHTML=`<span style="color:var(--muted);font-size:13px">Multiple leads match “${esc(mobile)}”</span>`;
    $("userSearchStats").innerHTML=`<div class="profile-match-list">${resolved.matches.slice(0,8).map(m=>`<button type="button" onclick="openProfileForPhone(${jsArg(m.calls[0].from)},'search')">${esc(maskPhone(m.calls[0].from))} <span>${m.calls.length} call${m.calls.length===1?'':'s'}</span></button>`).join('')}</div>`;
    $("userSearchTimeline").innerHTML="";
    const note=$("profileSourceNote");if(note)note.textContent="More than one lead shares those digits. Select a match or enter more of the number.";
    revealUserProfile("search");return;
  }
  if(!userCalls.length){
    $("userSearchResult").style.display="block";
    $("userSearchPhone").innerHTML=`<span style="color:var(--muted);font-size:13px">No calls found for "${esc(mobile)}"</span>`;
    $("userSearchStats").innerHTML="";
    $("userSearchTimeline").innerHTML="";
    const note=$("profileSourceNote"); if(note) note.textContent="No matching profile found for the current search.";
    revealUserProfile("search");
    return;
  }

  // Calculate stats
  const frustrated=userCalls.filter(c=>c.frustrated).length;
  const avgConf=Math.round(userCalls.reduce((a,c)=>a+c.conf,0)/userCalls.length);
  const avgNeed=Math.round(userCalls.reduce((a,c)=>a+c.need,0)/userCalls.length);
  const totalDur=sumBilledMinutes(userCalls);
  const totalCost=totalDur*5;

  // Lead temperature breakdown
  const hot=userCalls.filter(c=>c.leadTemp==="Hot").length;
  const warm=userCalls.filter(c=>c.leadTemp==="Warm").length;
  const cold=userCalls.filter(c=>c.leadTemp==="Cold").length;

  // Determine overall lead type
  const hotRatio=hot/userCalls.length;
  let leadType="Cold", leadEmoji="Cold", leadColor="var(--cold)";
  if(hotRatio>=0.6){leadType="Hot";leadEmoji="Hot";leadColor="var(--hot)";}
  else if(hotRatio>=0.3){leadType="Warm";leadEmoji="Warm";leadColor="var(--warm)";}

  // Intent breakdown
  const intents={};
  userCalls.forEach(c=>{intents[c.intent]=(intents[c.intent]||0)+1;});
  const intentList=Object.entries(intents).sort((a,b)=>b[1]-a[1]).map(([i,cnt])=>`${esc(i)} (${cnt})`).join(" • ");

  // Engagement score
  const engagementScore=userCalls.length*2+frustrated*3+avgNeed*0.5;
  const engagement=engagementScore>20?"Very high":engagementScore>12?"High":"Normal";
  const reducedView=reducedAiViewEnabled();

  $("userSearchPhone").innerHTML=`<span style="font-family:'Inter',monospace;font-size:16px;font-weight:700">${esc(maskPhone(userCalls[0].from))}</span><span style="margin-left:12px;background:${leadColor};color:#fff;padding:2px 8px;border-radius:3px;font-size:11px;font-weight:600">${esc(leadType)}</span><span style="margin-left:8px">${directionPill(userCalls[0].direction)}</span>`;
  $("userSearchStats").innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
      <div><b>Calls:</b> ${userCalls.length}</div><div><b>View:</b> Full history · ${activeCalls.length} (${percentOf(activeCalls.length,userCalls.length)}%) in active view</div>
      <div><b>Engagement:</b> ${engagement}</div>
      <div><b>Duration:</b> ${totalDur} mins</div>
      <div><b>Total cost:</b> ₹${totalCost}</div>
      ${reducedView?'':`<div><b>Avg Confidence:</b> ${avgConf}%</div><div><b>Avg Need Score:</b> ${avgNeed}</div>`}
      <div style="grid-column:1/-1"><b>Lead tier:</b> Hot ${hot} (${percentOf(hot,userCalls.length)}%) | Warm ${warm} (${percentOf(warm,userCalls.length)}%) | Cold ${cold} (${percentOf(cold,userCalls.length)}%)</div>
      ${reducedView?'':`<div style="grid-column:1/-1"><b>Intents:</b> ${intentList}</div>`}
    </div>
  `;

  $("userSearchTimeline").innerHTML=userCalls.map((c,i)=>{
    const date=formatCallTime(c);
    return`<div class="profile-call-card" style="border-left:3px solid var(--line)">
      <div class="profile-call-head">
        <b>Call ${i+1} ${directionPill(c.direction)}</b>
        <span style="color:var(--muted)">${date}</span>
      </div>
      <div class="profile-call-meta">
        ${reducedView?`<b>Temp:</b> ${esc(c.leadTemp)}`:`<b>Intent:</b> ${esc(c.intent)} | <b>Temp:</b> ${esc(c.leadTemp)} | <b>Conf:</b> ${Math.round(c.conf)}% | <b>Need:</b> ${Math.round(c.need)}`}<br>
        <b>Duration:</b> ${formatDuration(c.dur)} | <b>Reason:</b> ${esc(c.cbReason)}<br>
        <b>Requested time:</b> ${esc(c.cbPreferred||"Not specified")}<br>
        <span class="profile-call-summary">${esc(c.summary)}</span>
      </div>
      ${transcriptToggle(c,'prof'+i)}
    </div>`;
  }).join("");

  $("userSearchResult").style.display="block";
  const note=$("profileSourceNote");
  if(note){
    const label=source==="callback"?"Opened from the Follow-up queue":source==="ledger"?"Opened from the Call ledger":source==="priority"?"Opened from the Follow-up queue":source==="repeat"?"Opened from Repeat engagement":source==="brief"?"Opened from the Executive summary":"Opened from mobile search";
    const scope=activeCalls.length===userCalls.length?'All calls are inside the active filters.':activeCalls.length?`${activeCalls.length} of ${userCalls.length} calls are inside the active filters.`:'This lead is outside the active filters.';
    note.textContent=label+`. Full call history is shown. ${scope} Active dashboard scope: ${activeFilterScopeLabel()}.`;
  }
  revealUserProfile(source);
}

function revealUserProfile(source){
  const el=$("userSearchResult");
  if(!el || el.style.display==="none")return;
  const overlay=$("profileOverlay");
  el.setAttribute("aria-hidden","false");
  if(overlay)overlay.setAttribute("aria-hidden","false");
  document.body.classList.add("profile-open");
  requestAnimationFrame(()=>{
    el.classList.add("profile-visible");
    if(source!=="silent"){
      el.classList.add("profile-flash");
      setTimeout(()=>el.classList.remove("profile-flash"),900);
    }
  });
}

// Collapsible transcript — hidden by default (PII), one tap to read
function transcriptToggle(c,uid){
  if(!c.trans||!c.trans.trim())return "";
  const tid="tr_"+uid;
  return `<div class="transcript-wrap">
    <button type="button" class="transcript-toggle" onclick="toggleTranscript('${tid}')" id="${tid}_btn">View transcript</button>
    <div id="${tid}" class="transcript-box" style="display:none">${formatTranscript(c.trans)}</div>
  </div>`;
}
function toggleTranscript(tid){
  const el=document.getElementById(tid),btn=document.getElementById(tid+"_btn");
  if(!el)return;
  if(el.style.display==="none"){
    el.style.display="block";
    if(btn){btn.textContent="Hide transcript";btn.classList.add('open');}
  }else{
    el.style.display="none";
    if(btn){btn.textContent="View transcript";btn.classList.remove('open');}
  }
}
// Format the turn-by-turn transcript with colored speaker labels
function formatTranscript(t){
  return esc(t).split(/\n+/).map(line=>{
    const m=line.match(/^(Assistant|User|Anya|Bot|Caller|Customer)\s*(\[[^\]]*\])?\s*:?(.*)$/i);
    if(m){
      const who=m[1],time=m[2]||"",rest=m[3]||"";
      const isUser=/user|caller|customer/i.test(who);
      const col=isUser?"var(--gold)":"var(--teal)";
      return `<div style="margin-bottom:5px"><b style="color:${col}">${who}</b> <span style="color:var(--faint)">${time}</span>${rest?":"+rest:""}</div>`;
    }
    return line.trim()?`<div style="margin-bottom:5px;color:var(--muted)">${line}</div>`:"";
  }).join("");
}

function markProfileSource(el){
  document.querySelectorAll('.profile-selected-source').forEach(n=>n.classList.remove('profile-selected-source'));
  if(el && el.classList)el.classList.add('profile-selected-source');
}

function handleDrawerCardKey(event){
  if(event.key==='Enter'||event.key===' '){
    event.preventDefault();
    event.currentTarget.click();
  }
}

function openProfileForPhone(phone,source='search',el=null){
  if(el)markProfileSource(el);
  const raw=String(phone||'').trim();
  if(!raw)return;
  const search=$('searchMobile');
  if(search)search.value=maskPhone(raw);
  searchUserByMobile(raw,source);
}

function closeUserSearch(){
  const el=$("userSearchResult"), overlay=$("profileOverlay");
  if(el){
    el.classList.remove("profile-visible","profile-flash");
    el.setAttribute("aria-hidden","true");
    setTimeout(()=>{ if(!el.classList.contains("profile-visible")) el.style.display="none"; },240);
  }
  if(overlay)overlay.setAttribute("aria-hidden","true");
  document.body.classList.remove("profile-open");
  const search=$("searchMobile"); if(search)search.value="";
  document.querySelectorAll('.profile-selected-source').forEach(n=>n.classList.remove('profile-selected-source'));
}


window.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    const profile=$("userSearchResult");
    if(profile && profile.classList.contains('profile-visible')) closeUserSearch();
    const kpi=$("kpiPanel");
    if(kpi && kpi.style.transform==='translateX(0px)') closeKpiPanel();
  }
});

function parseDateFull(v){
  if(v===null||v===undefined||v==='')return null;
  const pad=n=>String(Number(n)||0).padStart(2,'0');
  const out=(y,mo,d,h=0,m=0)=>({iso:`${Number(y)}-${pad(mo)}-${pad(d)}`,h:Number(h)||0,m:Number(m)||0});
  const fromDate=(dt,useUTC=false)=>{
    if(!(dt instanceof Date)||isNaN(dt.getTime()))return null;
    return useUTC
      ? out(dt.getUTCFullYear(),dt.getUTCMonth()+1,dt.getUTCDate(),dt.getUTCHours(),dt.getUTCMinutes())
      : out(dt.getFullYear(),dt.getMonth()+1,dt.getDate(),dt.getHours(),dt.getMinutes());
  };
  if(typeof v==='number' && isFinite(v)){
    const days=Math.floor(v-25569);
    const frac=v-Math.floor(v);
    const ms=days*86400*1000+Math.round(frac*86400*1000);
    return fromDate(new Date(ms),true);
  }
  if(v instanceof Date)return fromDate(v,false);
  const s=String(v||'').trim();
  if(!s)return null;
  let dm2=s.match(/(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/) || s.match(/([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}),?\s+(\d{4})/);
  if(dm2){
    const monthToken=isNaN(Number(dm2[1]))?dm2[1]:dm2[2];
    const dayToken=isNaN(Number(dm2[1]))?dm2[2]:dm2[1];
    const yearToken=dm2[3];
    const mo={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12}[monthToken.toLowerCase().slice(0,3)];
    if(!mo)return null;
    let h=0,m=0;
    const tm=s.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if(tm){h=Number(tm[1]);m=Number(tm[2])||0;const ap=(tm[3]||'').toLowerCase();if(ap==='pm'&&h<12)h+=12;if(ap==='am'&&h===12)h=0;}
    return out(yearToken,mo,dayToken,h,m);
  }
  dm2=s.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:\s+|T)?(\d{1,2})?:?(\d{2})?(?::\d{2})?\s*(AM|PM)?\b/i);
  if(dm2){
    let a=Number(dm2[1]),b=Number(dm2[2]),y=Number(dm2[3]);if(y<100)y+=2000;
    let day=a,mo=b;if(a<=12 && b>12){mo=a;day=b;}
    let h=Number(dm2[4]||0),m=Number(dm2[5]||0);const ap=(dm2[6]||'').toLowerCase();if(ap==='pm'&&h<12)h+=12;if(ap==='am'&&h===12)h=0;
    return out(y,mo,day,h,m);
  }
  dm2=s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::\d{2})?)?/);
  if(dm2)return out(dm2[1],dm2[2],dm2[3],dm2[4]||0,dm2[5]||0);
  const native=new Date(s);
  if(!isNaN(native.getTime()))return fromDate(native,false);
  return null;
}

function formatCallTime(rec){
  if(!rec.d)return "";
  const ampm=rec.h<12?"AM":"PM";
  const displayH=rec.h%12||12;
  const displayM=String(rec.m).padStart(2,"0");
  return `${rec.d}, ${String(displayH).padStart(2,"0")}:${displayM} ${ampm}`;
}

function formatCallTimeWithWeekday(rec){
  if(!rec.d)return "";
  const dateObj=new Date(rec.d);
  const day=dateObj.toLocaleDateString('en-IN',{weekday:'short',month:'short',day:'numeric'});
  const ampm=rec.h<12?"AM":"PM";
  const displayH=rec.h%12||12;
  const displayM=String(rec.m).padStart(2,"0");
  return `${day}, ${String(displayH).padStart(2,"0")}:${displayM} ${ampm}`;
}

function formatDuration(seconds){
  const mins=Math.floor(seconds/60);
  const secs=Math.round(seconds%60);
  return mins>0?`${mins}m ${secs}s`:`${secs}s`;
}

// Billing: provider charges per call, rounded UP to the next whole minute
// (e.g. Exotel/Twilio-style telecom billing) — a 10s call costs the same as
// a 55s call. Round each call first, then sum — never sum raw seconds across
// calls and round once. Zero-duration (missed) calls correctly bill 0 mins.
function billedMinutes(seconds){
  return Math.ceil(Number(seconds||0)/60);
}
function sumBilledMinutes(records){
  // Bill only calls that actually completed/connected (status = completed). Failed, initiated,
  // no-answer, voicemail etc. are never billed, even if the export logs a duration for them
  // (some "failed" rows do). billedMinutes(0)=0 keeps the ">0s" rule: a connected call with zero
  // talk time bills nothing. This is the single point every minutes/cost figure routes through.
  return (records||[]).reduce((a,r)=>a+(normalizeDisposition(r)==='connected'?billedMinutes(r.dur):0),0);
}

// XSS protection — escape any Excel-sourced string before injecting via innerHTML
function esc(s){
  return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// Encode a value first as a JavaScript string literal, then for a double-quoted HTML attribute.
// HTML escaping alone is not sufficient when workbook data is embedded in an inline handler.
function jsArg(value){
  return esc(JSON.stringify(String(value??'')));
}

function intentOf(t){
  t=t.toLowerCase();
  if(/payment|booking fee|block|cost|fee|emi|installment/.test(t))return "Payment";
  if(/admission|apply|application|enroll|registration/.test(t))return "Admission";
  if(/eligib|qualif|criteria|requirement|prerequisite/.test(t))return "Eligibility";
  if(/curriculum|syllabus|module|course content|subject/.test(t))return "Curriculum";
  if(/duration|how long|timeline|batch|start/.test(t))return "Duration";
  if(/placement|job|career|internship/.test(t))return "Career";
  if(/support|help|issue|problem|not working/.test(t))return "Support";
  return "General";
}


function titleCaseSmall(s){
  return String(s||'').replace(/\b\w/g,m=>m.toUpperCase());
}

function resolveCallbackWindow(row, transcript, summary, callIso){
  // Requested time is extracted from transcript/summary and normalized to an actual date + time when possible.
  // We deliberately do not invent a requested time when both date and timing are missing.
  // Returns {date, label}: `date` is a real Date (or null) and `label` is the display string.
  const months={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
  const monNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const weekdays={sunday:0,sun:0,monday:1,mon:1,tuesday:2,tue:2,tues:2,wednesday:3,wed:3,thursday:4,thu:4,thur:4,thurs:4,friday:5,fri:5,saturday:6,sat:6};
  const base=callIso?new Date(callIso+'T00:00:00'):new Date();
  function cleanText(v){return String(v||'').replace(/\s+/g,' ').trim();}
  function fmtDate(d){return `${String(d.getDate()).padStart(2,'0')} ${monNames[d.getMonth()]} ${d.getFullYear()}`;}
  function fmtTime(h,m){
    h=Number(h)||0;m=Number(m)||0;
    const ampm=h>=12?'PM':'AM';
    const hh=h%12||12;
    return `${hh}:${String(m).padStart(2,'0')} ${ampm}`;
  }
  function normalizeHour(h,ampm,contextAmpm){
    h=Number(h);let ap=(ampm||contextAmpm||'').toLowerCase();
    if(ap==='pm' && h<12)h+=12;
    if(ap==='am' && h===12)h=0;
    // If caller says "at 4" with no AM/PM, infer practical counselling hours.
    if(!ap){
      if(h>=1 && h<=7)h+=12; // 1-7 usually means afternoon/evening for callbacks
      if(h===12)h=12;
    }
    return h;
  }
  function resolveDate(scope){
    const s=scope.toLowerCase();
    if(/\bday after tomorrow\b/.test(s))return addDays(base,2);
    if(/\btomorrow\b/.test(s))return addDays(base,1);
    if(/\b(today|tonight)\b/.test(s))return new Date(base);
    const dm=s.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)[a-z]*\s*(\d{4})?\b/i);
    if(dm){
      const y=dm[3]?Number(dm[3]):base.getFullYear();
      let d=new Date(y,months[dm[2].toLowerCase()],Number(dm[1]));
      if(!dm[3] && d<base)d=new Date(y+1,months[dm[2].toLowerCase()],Number(dm[1]));
      return d;
    }
    const md=s.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
    if(md){
      let y=md[3]?Number(md[3]):base.getFullYear();
      if(y<100)y+=2000;
      let d=new Date(y,Number(md[2])-1,Number(md[1]));
      if(!md[3] && d<base)d=new Date(y+1,Number(md[2])-1,Number(md[1]));
      return d;
    }
    const wd=s.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/i);
    if(wd){
      const target=weekdays[wd[1].toLowerCase()];
      let diff=target-base.getDay();
      if(diff<0)diff+=7;
      return addDays(base,diff);
    }
    return null;
  }
  function extractTime(scope){
    const s=scope.toLowerCase().replace(/–/g,'-');
    const part=s.match(/\b(morning|afternoon|evening|night)\b/i);
    const range=s.match(/\b(?:from\s*)?(\d{1,2})(?::([0-5]\d))?\s*(am|pm)?\s*(?:to|-|till|until)\s*(\d{1,2})(?::([0-5]\d))?\s*(am|pm)\b/i);
    if(range){
      const ap2=range[6];
      const h1=normalizeHour(range[1],range[3],ap2),m1=range[2]||0;
      const h2=normalizeHour(range[4],range[6]),m2=range[5]||0;
      return `${fmtTime(h1,m1)} - ${fmtTime(h2,m2)}`;
    }
    const qualified=s.match(/\b(after|before|around|by)\s+(\d{1,2})(?::([0-5]\d))?\s*(am|pm)?\b/i);
    if(qualified){
      const h=normalizeHour(qualified[2],qualified[4]),m=qualified[3]||0;
      return `${qualified[1][0].toUpperCase()+qualified[1].slice(1)} ${fmtTime(h,m)}`;
    }
    const plain=s.match(/\b(?:at\s*)?(\d{1,2})(?::([0-5]\d))\s*(am|pm)\b/i)
      || s.match(/\b(?:at\s*)?(\d{1,2})\s*(am|pm)\b/i)
      || s.match(/\b(?:at|around|by)\s+(\d{1,2})(?::([0-5]\d))?\b/i);
    if(plain){
      const ampm=plain[3]||plain[2]||'';
      const min=(plain[2] && /^\d{2}$/.test(plain[2]))?plain[2]:0;
      const h=normalizeHour(plain[1],ampm);
      return fmtTime(h,min);
    }
    if(part){
      const p=part[1].toLowerCase();
      if(p==='morning')return '09:00 AM - 12:00 PM';
      if(p==='afternoon')return '12:00 PM - 04:00 PM';
      if(p==='evening')return '04:00 PM - 07:00 PM';
      if(p==='night')return '07:00 PM - 09:00 PM';
    }
    return '';
  }
  function candidateScopes(text){
    const clean=cleanText(text);
    if(!clean)return [];
    const scopes=[];
    const keyword=/(callback|call back|call me|please call|contact me|get back|follow\s*up|ring me|ring back|preferred|preference|available|free|time slot|slot)/ig;
    let m;
    while((m=keyword.exec(clean))!==null){
      const start=Math.max(0,m.index-130),end=Math.min(clean.length,m.index+210);
      scopes.push(clean.slice(start,end));
    }
    // Summary is short and useful; include whole clean text as a fallback.
    if(clean.length<=450)scopes.push(clean);
    return scopes;
  }
  const directKeys=[
    'Preferred Callback Date & Time','Preferred Callback Date Time','Preferred Call Back Date & Time','Preferred Call Back Date Time',
    'Preferred Callback','Callback Preferred Time','Callback Preference','Preferred Time Slot','Preferred Slot','Preferred Time',
    'Callback Time','Call Back Time','Preferred Callback Time','Preferred Callback Date','Callback Date'
  ];
  const direct=directKeys.map(k=>row&&row[k]!=null?cleanText(row[k]):'').filter(Boolean).join(' ');
  const sources=[direct, summary, transcript].filter(Boolean);
  for(const source of sources){
    for(const scope of candidateScopes(source)){
      const d=resolveDate(scope);
      const t=extractTime(scope);
      if(d && t)return{date:d,label:`${fmtDate(d)} · ${t}`};
      if(t)return{date:base,label:`${fmtDate(base)} · ${t}`};
      if(d)return{date:d,label:`${fmtDate(d)} · Time not specified`};
    }
  }
  return{date:null,label:'Not specified'};
}

function normFieldName(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');}
const FIELD_SCHEMA_CACHE=new Map();
function fieldSchema(row){
  const keys=Object.keys(row||{});
  const signature=keys.join('\u0000');
  let schema=FIELD_SCHEMA_CACHE.get(signature);
  if(!schema){
    schema=keys.map(k=>[k,normFieldName(k)]);
    // Workbooks normally have one schema. Keep a small bound for malformed/mixed inputs.
    if(FIELD_SCHEMA_CACHE.size>=32)FIELD_SCHEMA_CACHE.clear();
    FIELD_SCHEMA_CACHE.set(signature,schema);
  }
  return schema;
}
function pickField(row,aliases){
  for(const a of aliases){if(Object.prototype.hasOwnProperty.call(row,a))return row[a];}
  const normalized=fieldSchema(row);
  for(const a of aliases){
    const na=normFieldName(a);
    const hit=normalized.find(([k,nk])=>nk===na || nk.includes(na) || na.includes(nk));
    if(hit)return row[hit[0]];
  }
  return '';
}

function normalizeDirection(v){
  const raw=String(v||'').trim();
  const s=raw.toLowerCase().replace(/[_-]+/g,' ').replace(/[^a-z ]+/g,' ').replace(/\s+/g,' ').trim();
  if(!s)return 'unknown';
  if(s==='in'||s==='inbound'||s==='incoming'||s==='in call'||s==='incoming call')return 'inbound';
  if(s==='out'||s==='outbound'||s==='outgoing'||s==='out call'||s==='outgoing call')return 'outbound';
  if(/\bin\s*bound\b|\bincoming\b|\bin\s*call\b|\bcaller\s*initiated\b|\bcustomer\s*initiated\b/.test(s))return 'inbound';
  if(/\bout\s*bound\b|\boutgoing\b|\bout\s*call\b|\bagent\s*initiated\b|\bcounsellor\s*initiated\b|\bteam\s*initiated\b/.test(s))return 'outbound';
  return 'unknown';
}
function directionLabel(d){
  d=normalizeDirection(d);
  return d==='inbound'?'Inbound':d==='outbound'?'Outbound':'Unknown';
}
function directionClass(d){return normalizeDirection(d);}
function directionPill(d){const cls=directionClass(d);return `<span class="dir-pill ${cls}">${directionLabel(cls)}</span>`;}
function directionMix(calls){
  const n=calls&&calls.length?calls.length:0;
  if(!n)return '';
  const inbound=calls.filter(c=>normalizeDirection(c.direction)==='inbound').length;
  const outbound=calls.filter(c=>normalizeDirection(c.direction)==='outbound').length;
  const unknown=n-inbound-outbound;
  const parts=[];
  if(inbound)parts.push(`${directionPill('inbound')} <span>${inbound}</span>`);
  if(outbound)parts.push(`${directionPill('outbound')} <span>${outbound}</span>`);
  if(unknown)parts.push(`${directionPill('unknown')} <span>${unknown}</span>`);
  return parts.length?`<div class="direction-mix">${parts.join('')}</div>`:'';
}
function setDirectionFilter(dir, ev){
  if(ev && ev.preventDefault) ev.preventDefault();
  const normalized=(dir==='inbound'||dir==='outbound')?dir:'all';
  if(SELECTED_DIRECTION===normalized){
    updateDirectionButtons();
    return;
  }
  SELECTED_DIRECTION=normalized;
  // Campaigns are outbound-only, so a campaign filter is meaningless (and misleading) under Inbound.
  if(normalized==='inbound' && SELECTED_CAMPAIGN!=='all'){SELECTED_CAMPAIGN='all';const s=$('campaignFilter');if(s)s.value='all';}
  updateDirectionButtons();
  applyFilters();
}
function updateDirectionButtons(){
  const selected=SELECTED_DIRECTION||'all';
  const switcher=$('directionSwitch');
  if(switcher) switcher.setAttribute('data-direction',selected);
  document.body.setAttribute('data-direction-filter',selected);
  ['all','inbound','outbound'].forEach(d=>{
    const btn=$('dir-'+d);
    if(!btn)return;
    const on=selected===d;
    btn.classList.toggle('active',on);
    btn.setAttribute('aria-pressed',on?'true':'false');
    btn.dataset.active=on?'true':'false';
  });
  const current=$('directionCurrent');
  if(current){
    current.className='direction-current '+selected;
    current.textContent=currentDirectionLabel();
  }
  updateCampaignFilterVisibility();
}
// The campaign dropdown only makes sense for outbound; hide it under the Inbound view.
function updateCampaignFilterVisibility(){
  const sel=$('campaignFilter');if(!sel)return;
  const has=sel.options.length>1; // more than just the "All campaigns" default
  sel.style.display=(has && SELECTED_DIRECTION!=='inbound')?'':'none';
}
function setCampaignFilter(name){
  SELECTED_CAMPAIGN=name||'all';
  applyFilters();
}
// Populate the campaign dropdown from the campaigns present in the data (outbound only; inbound has none).
// Hidden entirely when the export carries no campaign column (older files), so nothing regresses.
function populateCampaignFilter(){
  const sel=$('campaignFilter');
  if(!sel)return;
  const counts={};
  ALL_DIALS.forEach(r=>{const c=(r.campaign||'').trim();if(c)counts[c]=(counts[c]||0)+1;});
  const names=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
  if(!names.length){sel.innerHTML='<option value="all">All campaigns</option>';SELECTED_CAMPAIGN='all';updateCampaignFilterVisibility();return;}
  sel.innerHTML=`<option value="all">All campaigns</option>`+
    names.map(n=>`<option value="${esc(n)}">${esc(n)} (${counts[n].toLocaleString()})</option>`).join('');
  if(SELECTED_CAMPAIGN!=='all' && !counts[SELECTED_CAMPAIGN])SELECTED_CAMPAIGN='all';
  sel.value=SELECTED_CAMPAIGN;
  updateCampaignFilterVisibility();
}
function recordMatchesDate(r){
  const fromDate=$('filterFromDate')?$('filterFromDate').value:'';
  const toDate=$('filterToDate')?$('filterToDate').value:'';
  if(!r.d)return false;
  if(fromDate && r.d<fromDate)return false;
  if(toDate && r.d>toDate)return false;
  return true;
}
function recordMatchesDirection(r){
  return SELECTED_DIRECTION==='all' || normalizeDirection(r.direction)===SELECTED_DIRECTION;
}
function recordMatchesCampaign(r){
  return SELECTED_CAMPAIGN==='all' || (r.campaign||'')===SELECTED_CAMPAIGN;
}
function recordMatchesCurrentFilters(r){return recordMatchesDate(r)&&recordMatchesDirection(r)&&recordMatchesCampaign(r);}
function currentDirectionLabel(){return SELECTED_DIRECTION==='all'?'All Calls':directionLabel(SELECTED_DIRECTION);}
function currentViewDescription(){
  const from=$('filterFromDate')&&$('filterFromDate').value;
  const to=$('filterToDate')&&$('filterToDate').value;
  let bits=[];
  bits.push(currentDirectionLabel());
  if(SELECTED_CAMPAIGN!=='all')bits.push('“'+SELECTED_CAMPAIGN+'”');
  if(from||to){
    const fmt=d=>{try{return new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});}catch(e){return d;}};
    if(from&&to)bits.push(fmt(from)+' to '+fmt(to));
    else if(from)bits.push('from '+fmt(from));
    else bits.push('until '+fmt(to));
  }else bits.push('all dates');
  return bits.join(' · ');
}
function emptyViewHtml(message){
  return `<div class="empty-view"><b>${esc(message||'No calls match current view')}</b><span>${esc(currentViewDescription())}</span></div>`;
}
function paintDirectionSplit(){
  const el=$('directionSummary');
  if(!el)return;
  const base=ALL_RECORDS_BACKUP.filter(recordMatchesDate);
  const n=base.length||0;
  const inbound=base.filter(r=>normalizeDirection(r.direction)==='inbound').length;
  const outbound=base.filter(r=>normalizeDirection(r.direction)==='outbound').length;
  const unknown=Math.max(0,n-inbound-outbound);
  // In the combined view, the comparison table below already owns the direction split.
  // Keep these cards only when a single direction needs a compact scope summary.
  if(SELECTED_DIRECTION==='all' && inbound && outbound){el.innerHTML='';return;}
  const card=(cls,label,val,note,pred,useRecordsBase)=>{
    const selectedClass=(cls==='all'&&SELECTED_DIRECTION==='all')||(cls===SELECTED_DIRECTION)?' selected':'';
    const baseRef=useRecordsBase?'RECORDS':'window.__dirBase';
    const click=pred?` onclick="openFilteredPanel('${esc(label)}',${pred},${baseRef})" style="cursor:pointer"`:'';
    return `<div class="direction-card ${cls}${selectedClass}"${click}><span class="dc-share">${n?Math.round(val/n*100):0}%</span><div class="dc-label">${label}</div><div class="dc-value">${val}</div><div class="dc-note">${note}</div></div>`;
  };
  window.__dirBase=base;
  const selected=currentDirectionLabel();
  el.innerHTML=card('all','Selected scope',RECORDS.length,`${selected} after active date and direction filters.`,()=>true,true)+
    card('inbound','Inbound',inbound,'Calls initiated by prospects/users within the selected date range.',r=>normalizeDirection(r.direction)==='inbound')+
    card('outbound','Outbound',outbound,'Calls initiated outward for follow-up, counselling, or engagement.',r=>normalizeDirection(r.direction)==='outbound')+
    (unknown?card('unknown','Unknown',unknown,'Direction missing or unmapped in the export. Included only in All Calls.',r=>{const d=normalizeDirection(r.direction);return d!=='inbound'&&d!=='outbound';}): '');
}

// ===== OUTBOUND CONNECT PERFORMANCE =====
// Classifies each call's outcome from the "Status"/"Call Status" export column (parsed into r.status
// but otherwise unused elsewhere in the dashboard). Falls back to call shape (duration/messages) when
// the status text is blank or doesn't match a known dialer vocabulary, so a missing/unfamiliar Status
// column degrades to "unknown" instead of a wrong bucket.
function normalizeDisposition(r){
  const s=String(r.status||'').toLowerCase();
  if(/voicemail|voice\s*mail|answering\s*machine|\bvm\b/.test(s))return 'voicemail';
  if(/no.?answer|unanswered|not\s*answered|no\s*response|missed|ring.?out/.test(s))return 'no_answer';
  if(/\bbusy\b/.test(s))return 'busy';
  // "initiated" = dial logged as started but no terminal outcome recorded (0 duration, no transcript).
  // It did not connect, so it sits on the not-connected side, but it is kept distinct from a true "failed"
  // because it flags a data-pipeline gap rather than a confirmed failed dial.
  if(/^initiated$|initiat|dialing|in.?progress|ringing/.test(s))return 'initiated';
  if(/fail|error|drop|reject|declin|invalid|do.?not.?call|\bdnc\b|blocked|congestion|cancel|disconnect/.test(s))return 'failed';
  if(/answer|connect|complete|success|\btalk/.test(s))return 'connected';
  if(!s){
    if(r.dur>=10 && (r.msg>0 || r.trans))return 'connected';
    if(r.dur===0)return 'no_answer';
  }
  return 'unknown';
}
function dispositionCounts(recs){
  const buckets={connected:0,no_answer:0,voicemail:0,busy:0,failed:0,initiated:0,unknown:0};
  recs.forEach(r=>{buckets[normalizeDisposition(r)]++;});
  return buckets;
}
// Outbound Connect Performance is scoped to outbound calls only, regardless of the All/Inbound/Outbound
// toggle — blending in inbound calls (which are connected by definition) would inflate the connect rate.
// Memoise the two expensive outbound slices of ALL_DIALS (50k+ rows) so the ~4 outbound paint
// functions in one render don't each re-filter from scratch. Keyed by the filter state that affects
// them (date range, campaign, and row count as a data-changed proxy), so the cache self-invalidates
// the instant any filter or the dataset changes. resetOutboundCaches() clears them on a fresh load.
let _obViewCache=null,_obViewSig=null,_obDateCache=null,_obDateSig=null;
function resetOutboundCaches(){_obViewCache=_obViewSig=_obDateCache=_obDateSig=null;}
function _dateSig(){const f=$('filterFromDate')?$('filterFromDate').value:'';const t=$('filterToDate')?$('filterToDate').value:'';return f+'|'+t+'|'+ALL_DIALS.length;}
function outboundRecordsInView(){
  // Dial-level: pulls from ALL_DIALS (incl. failed/initiated) so connect rate is real, not the ~100%
  // you'd get from completed-only conversation records. Respects the campaign filter too.
  const sig=_dateSig()+'|'+SELECTED_CAMPAIGN;
  if(_obViewSig===sig && _obViewCache)return _obViewCache;
  _obViewSig=sig;
  _obViewCache=ALL_DIALS.filter(r=>recordMatchesDate(r) && recordMatchesCampaign(r) && normalizeDirection(r.direction)==='outbound');
  return _obViewCache;
}
// Date-scoped outbound dials, ignoring the campaign filter — the campaign leaderboard shows every
// campaign side by side regardless of the active campaign selection.
function outboundDialsInDateView(){
  const sig=_dateSig();
  if(_obDateSig===sig && _obDateCache)return _obDateCache;
  _obDateSig=sig;
  _obDateCache=ALL_DIALS.filter(r=>recordMatchesDate(r) && normalizeDirection(r.direction)==='outbound');
  return _obDateCache;
}
function fmtDurLabel(sec){const m=Math.floor(sec/60),s=Math.round(sec%60);return `${m}m ${String(s).padStart(2,'0')}s`;}
function fmtDayLabel(iso){if(!iso)return '—';const p=String(iso).split('-');if(p.length<3)return String(iso);const mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return `${p[2]} ${mon[Number(p[1])-1]||''}`;}
function directionStats(dir){
  const recs=ALL_RECORDS_BACKUP.filter(r=>recordMatchesDate(r) && recordMatchesCampaign(r) && normalizeDirection(r.direction)===dir);
  const n=recs.length;
  const connected=recs.filter(r=>normalizeDisposition(r)==='connected').length;
  const hot=recs.filter(r=>r.leadTemp==='Hot').length;
  const green=recs.filter(r=>r.band==='Green').length;
  const avgDurSec=n?recs.reduce((a,r)=>a+r.dur,0)/n:0;
  const avgConf=n?recs.reduce((a,r)=>a+r.conf,0)/n:0;
  const unique=new Set(recs.map(ledgerPhoneKey).filter(Boolean)).size;
  const callbacks=recs.filter(r=>r.callback).length;
  return{n,unique,callbacks,callbackPct:n?Math.round(callbacks/n*100):0,connectPct:n?Math.round(connected/n*100):0,hotPct:n?Math.round(hot/n*100):0,avgDurSec,avgConf:Math.round(avgConf),greenPct:n?Math.round(green/n*100):0};
}
function outboundGlanceStats(){
  const dials=outboundRecordsInView(),n=dials.length,byPhone=groupByPhone(dials),groups=Object.values(byPhone);
  const isConn=r=>normalizeDisposition(r)==='connected';
  const connected=dials.filter(isConn),reached=groups.filter(calls=>calls.some(isConn));
  const unreachable=groups.filter(calls=>calls.length>=3&&!calls.some(isConn));
  const hotReached=reached.filter(calls=>calls.some(r=>isConn(r)&&r.leadTemp==='Hot'));
  return{dials,n,connected,reached,unreachable,hotReached,numbers:groups.length,
    connectPct:n?Math.round(connected.length/n*100):0,
    reachPct:groups.length?Math.round(reached.length/groups.length*100):0,
    failed:n-connected.length,failedPct:n?Math.round((n-connected.length)/n*100):0,
    avgDials:groups.length?(n/groups.length).toFixed(1):'0.0',
    hotReachPct:reached.length?Math.round(hotReached.length/reached.length*100):0};
}
function paintDirectionCompare(){
  const el=$('dirCompareTable');
  if(!el)return;
  const ib=directionStats('inbound'), ob=directionStats('outbound');
  window.__dirIn=ALL_RECORDS_BACKUP.filter(r=>recordMatchesDate(r)&&recordMatchesCampaign(r)&&normalizeDirection(r.direction)==='inbound');
  window.__dirOut=ALL_RECORDS_BACKUP.filter(r=>recordMatchesDate(r)&&recordMatchesCampaign(r)&&normalizeDirection(r.direction)==='outbound');
  if(!ib.n || !ob.n){el.innerHTML=emptyViewHtml('Not enough data in both directions to compare for this range.');return;}
  // Dial mechanics intentionally live in Outbound results. This table is only for a clean
  // inbound/outbound conversation comparison, avoiding repeated reach and failure metrics.
  const rows=[
    ['Unique people',`${ib.unique} callers`,`${ob.unique} leads dialled`,'()=>true'],
    ['Follow-up requests',`${ib.callbacks} (${ib.callbackPct}%)`,`${ob.callbacks} (${ob.callbackPct}%)`,'r=>r.callback'],
    ['Hot-lead rate',ib.hotPct+'%',ob.hotPct+'%',"r=>r.leadTemp==='Hot'"],
    ['Avg call duration',fmtDurLabel(ib.avgDurSec),fmtDurLabel(ob.avgDurSec),'()=>true'],
    ['Avg AI confidence',ib.avgConf+'%',ob.avgConf+'%','()=>true'],
    ['Quality pass rate (Green)',ib.greenPct+'%',ob.greenPct+'%',"r=>r.band==='Green'"]
  ];
  const visibleRows=reducedAiViewEnabled()
    ?rows.filter(r=>!['Avg AI confidence','Quality pass rate (Green)'].includes(r[0]))
    :rows;
  el.innerHTML=`<table class="opf-cmp-table direction-glance-table"><thead><tr><th>Metric</th>`+
    `<th><span class="opf-dirlabel"><span class="opf-dirdot opf-inbound"></span>Inbound (${ib.n})</span></th>`+
    `<th><span class="opf-dirlabel"><span class="opf-dirdot opf-outbound"></span>Outbound (${ob.n})</span></th></tr></thead>`+
    `<tbody>${visibleRows.map(r=>`<tr><td>${esc(r[0])}</td>`+
      `<td style="cursor:pointer" onclick="openFilteredPanel('${esc(r[0])} (Inbound)',${r[3]},window.__dirIn)">${esc(r[1])}</td>`+
      `<td style="cursor:pointer" onclick="openFilteredPanel('${esc(r[0])} (Outbound)',${r[3]},window.__dirOut)">${esc(r[2])}</td></tr>`).join('')}`+
    `</tbody></table>`;
}
function paintDispositionBreak(obRecs){
  const el=$('dispositionBreak');
  if(!el)return;
  const n=obRecs.length;
  if(!n){el.innerHTML=emptyViewHtml('No outbound calls in this range.');return;}
  const buckets=dispositionCounts(obRecs);
  const order=['connected','failed','initiated','no_answer','voicemail','busy','unknown'];
  const labels={connected:'Connected',failed:'Failed',initiated:'Initiated · no outcome logged',no_answer:'No answer',voicemail:'Voicemail',busy:'Busy',unknown:'Unknown'};
  const colors={connected:C.teal,failed:C.hot,initiated:C.warm,no_answer:C.coral,voicemail:C.indigo,busy:C.blue,unknown:C.muted};
  el.innerHTML=order.filter(k=>buckets[k]>0).map(k=>{
    const pct=Math.round(buckets[k]/n*100);
    return `<div style="margin-bottom:14px;cursor:pointer" onclick="openFilteredPanel('${esc(labels[k])} (outbound)',r=>normalizeDisposition(r)==='${k}',window.__obRecs)"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span>${labels[k]}</span><b>${buckets[k]} (${pct}%)</b></div><div style="background:#0c121b;border-radius:5px;height:8px;overflow:hidden"><div style="background:${colors[k]};height:100%;width:${pct}%"></div></div></div>`;
  }).join('');
}
function paintRedialCurve(obRecs){
  const el=$('redialCurve');
  if(!el)return;
  const byPhone=groupByPhone(obRecs);
  // Per-attempt-number success rate (every dial that was anyone's Nth call, connected or not) is a
  // different question from "of leads we do reach, which try got there" -- both are tracked here so
  // the one panel answers "keep redialing?" and "how many tries does it usually take?" together,
  // instead of spreading them across separate charts.
  const buckets=[{n:0,c:0,durSum:0,durN:0,recs:[]},{n:0,c:0,durSum:0,durN:0,recs:[]},{n:0,c:0,durSum:0,durN:0,recs:[]},{n:0,c:0,durSum:0,durN:0,recs:[]}];
  const firstSuccessBuckets=[0,0,0,0];
  let everConnected=0,neverReached=0,neverReachedAttempts=0;
  Object.values(byPhone).forEach(calls=>{
    const sorted=calls.slice().sort((a,b)=>a.ts-b.ts);
    let firstConnectIdx=-1;
    sorted.forEach((c,i)=>{
      const bi=Math.min(i,3);
      buckets[bi].n++;
      buckets[bi].recs.push(c);
      if(normalizeDisposition(c)==='connected'){
        buckets[bi].c++;
        buckets[bi].durSum+=Number(c.dur||0);
        buckets[bi].durN++;
        if(firstConnectIdx===-1)firstConnectIdx=i;
      }
    });
    if(firstConnectIdx>-1){everConnected++;firstSuccessBuckets[Math.min(firstConnectIdx,3)]++;}
    else{neverReached++;neverReachedAttempts+=sorted.length;}
  });
  if(!buckets.some(b=>b.n)){el.innerHTML=emptyViewHtml('No outbound attempts in this range.');return;}
  window.__redialBuckets=buckets.map(b=>b.recs);
  const labels=['Attempt 1','Attempt 2','Attempt 3','Attempt 4+'];
  const rows=buckets.map((b,i)=>{
    const connectPct=b.n?Math.round(b.c/b.n*100):0;
    const sharePct=everConnected?Math.round(firstSuccessBuckets[i]/everConnected*100):0;
    const avgDur=b.durN?fmtDurLabel(b.durSum/b.durN):'&mdash;';
    return `<tr style="cursor:pointer" onclick="openFilteredPanel('${labels[i]} (outbound)',()=>true,window.__redialBuckets[${i}])"><td>${labels[i]}</td><td class="tabular">${b.n}</td>`+
      `<td><div class="opf-rate-cell"><b class="tabular">${connectPct}%</b><div class="opf-rate-bar"><div style="width:${connectPct}%"></div></div></div></td>`+
      `<td class="tabular">${everConnected?sharePct+'%':'&mdash;'}</td>`+
      `<td class="tabular">${avgDur}</td></tr>`;
  }).join('');
  const neverLine=neverReached
    ?`<div class="cap" style="margin-top:12px;font-size:12px">${neverReached} lead${neverReached>1?'s':''} never reached in this range, averaging ${(neverReachedAttempts/neverReached).toFixed(1)} attempt${neverReachedAttempts===neverReached?'':'s'} before dialing stopped.</div>`
    :'';
  el.innerHTML=`<div style="overflow-x:auto"><table class="opf-cmp-table"><thead><tr>`+
    `<th>Attempt</th><th>Dials</th><th>Connect rate</th><th>Share of eventual connects</th><th>Avg duration (connected)</th>`+
    `</tr></thead><tbody>${rows}</tbody></table></div>${neverLine}`;
}
function paintDialHeatmap(obRecs){
  const el=$('dialHeatmap');
  if(!el)return;
  const dayNames=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const blockDefs=[[0,4],[4,8],[8,12],[12,16],[16,20],[20,24]];
  const blockLabels=blockDefs.map(b=>`${String(b[0]).padStart(2,'0')}-${String(b[1]).padStart(2,'0')}`);
  const grid=dayNames.map(()=>blockDefs.map(()=>({n:0,connected:0,recs:[]})));
  obRecs.forEach(r=>{
    if(!r.d)return;
    const parts=r.d.split('-').map(Number);
    const wd=(new Date(parts[0],parts[1]-1,parts[2]).getDay()+6)%7; // 0=Mon..6=Sun
    const bi=blockDefs.findIndex(b=>r.h>=b[0] && r.h<b[1]);
    if(bi<0)return;
    grid[wd][bi].n++;
    grid[wd][bi].recs.push(r);
    if(normalizeDisposition(r)==='connected')grid[wd][bi].connected++;
  });
  window.__heatmapCells=grid;
  // Name the single best window (highest connect rate among cells with enough volume to trust).
  const bwEl=$('bestWindowNote');
  if(bwEl){
    const totalDials=grid.reduce((a,row)=>a+row.reduce((b,c)=>b+c.n,0),0);
    // Ignore thin cells: a one-off high % on a handful of dials is noise, not a schedule to commit to.
    const minVol=Math.max(30,Math.round(totalDials*0.003));
    let best=null;
    grid.forEach((row,ri)=>row.forEach((c,bi)=>{
      if(c.n<minVol)return;
      const pct=c.connected/c.n;
      if(!best||pct>best.pct)best={pct,ri,bi,n:c.n};
    }));
    bwEl.innerHTML=best
      ?`<span class="opf-bestwin-dot"></span>Best reliable window: <b>${dayNames[best.ri]} ${blockLabels[best.bi]}</b> — <b>${Math.round(best.pct*100)}%</b> connect rate across ${best.n.toLocaleString()} dials. Front-load dialing here. (Thin cells with few dials are excluded.)`
      :'';
    bwEl.style.display=best?'flex':'none';
  }
  const stops=[[231,236,243],[201,214,232],[147,174,208],[77,106,153],[36,58,94],[11,31,58]];
  function heatColor(pct){
    const t=Math.max(0,Math.min(1,pct/75));
    const idx=t*(stops.length-1),i0=Math.floor(idx),i1=Math.min(stops.length-1,i0+1),f=idx-i0;
    const c0=stops[i0],c1=stops[i1];
    return `rgb(${Math.round(c0[0]+(c1[0]-c0[0])*f)},${Math.round(c0[1]+(c1[1]-c0[1])*f)},${Math.round(c0[2]+(c1[2]-c0[2])*f)})`;
  }
  let html='<div></div>'+blockLabels.map(l=>`<div class="opf-hdr">${l}</div>`).join('');
  dayNames.forEach((day,ri)=>{
    html+=`<div class="opf-rowlabel">${day}</div>`;
    grid[ri].forEach((cell,bi)=>{
      if(!cell.n){html+='<div class="opf-heatcell opf-heatcell-empty">–</div>';return;}
      const pct=Math.round(cell.connected/cell.n*100);
      html+=`<div class="opf-heatcell" style="background:${heatColor(pct)};color:${pct>45?'#fff':'#0b1f3a'};cursor:pointer" title="${cell.n} dials -- click for details" onclick="openFilteredPanel('${day} ${blockLabels[bi]} (outbound)',()=>true,window.__heatmapCells[${ri}][${bi}].recs)">${pct}%</div>`;
    });
  });
  el.innerHTML=html;
}
// ===== DIAL TIMING VS YIELD =====
// One row per hour-block (or weekday): dial volume, connect rate, and hot-lead rate among connected calls.
// Answers "are we dialing hardest into the windows that don't connect / don't convert?"
let DIAL_TIMING_VIEW='hour'; // 'hour' | 'weekday'
function setDialTimingView(v){DIAL_TIMING_VIEW=v;paintDialTiming(window.__obRecs||[]);}
function paintDialTiming(dials){
  const el=$('dialTiming'),ctrl=$('dialTimingControls'),note=$('dialTimingNote');
  if(!el)return;
  if(!dials.length){if(ctrl)ctrl.innerHTML='';if(note)note.style.display='none';el.innerHTML=emptyViewHtml('No outbound dials in this range.');return;}
  const isHour=DIAL_TIMING_VIEW==='hour';
  const blockDefs=[[0,4],[4,8],[8,12],[12,16],[16,20],[20,24]];
  const blockLabels=blockDefs.map(b=>`${String(b[0]).padStart(2,'0')}:00–${String(b[1]).padStart(2,'0')}:00`);
  const dayNames=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const buckets=(isHour?blockLabels:dayNames).map(lb=>({label:lb,dials:0,conn:0,hot:0,recs:[]}));
  dials.forEach(r=>{
    let idx=-1;
    if(isHour){idx=blockDefs.findIndex(b=>r.h>=b[0]&&r.h<b[1]);}
    else if(r.d){const p=r.d.split('-').map(Number);idx=(new Date(p[0],p[1]-1,p[2]).getDay()+6)%7;}
    if(idx<0)return;
    const bk=buckets[idx];bk.dials++;bk.recs.push(r);
    if(normalizeDisposition(r)==='connected'){bk.conn++;if(r.leadTemp==='Hot')bk.hot++;}
  });
  const active=buckets.filter(b=>b.dials>0);
  if(!active.length){el.innerHTML=emptyViewHtml('No timed outbound dials in this range.');return;}
  window.__dtBuckets=buckets.map(b=>b.recs);
  const totalDials=dials.length,maxDials=Math.max(...buckets.map(b=>b.dials),1);
  if(ctrl)ctrl.innerHTML=[['hour','By hour block'],['weekday','By weekday']]
    .map(t=>`<button type="button" class="${DIAL_TIMING_VIEW===t[0]?'on':''}" onclick="setDialTimingView('${t[0]}')">${t[1]}</button>`).join('');
  // Insight: heaviest-volume window vs the best-connecting reliable window
  const floor=Math.max(30,Math.round(totalDials*0.02));
  const heaviest=active.slice().sort((a,b)=>b.dials-a.dials)[0];
  const bestConn=active.filter(b=>b.dials>=floor).sort((a,b)=>(b.conn/b.dials)-(a.conn/a.dials))[0];
  if(note){
    const hConn=Math.round(heaviest.conn/heaviest.dials*100),bConn=bestConn?Math.round(bestConn.conn/bestConn.dials*100):0;
    if(bestConn && bestConn.label!==heaviest.label && bConn-hConn>=6){
      note.style.display='flex';
      note.innerHTML=`<span class="opf-bestwin-dot" style="background:var(--burgundy)"></span>Most dials land in <b>${esc(heaviest.label)}</b> (${Math.round(heaviest.dials/totalDials*100)}% of volume) which connects at just <b>${hConn}%</b> — <b>${esc(bestConn.label)}</b> connects at <b>${bConn}%</b>. Shift volume toward the better window.`;
    }else{note.style.display='none';}
  }
  const rows=buckets.map((b,i)=>{
    if(!b.dials)return '';
    const connPct=Math.round(b.conn/b.dials*100),hotPct=b.conn?Math.round(b.hot/b.conn*100):0;
    return `<tr class="iq-row" onclick="openFilteredPanel('${esc(b.label)} (outbound dials)',()=>true,window.__dtBuckets[${i}])">`+
      `<td><span class="iq-name">${esc(b.label)}</span></td>`+
      `<td class="num">${b.dials.toLocaleString()}<div class="iq-sub">${Math.round(b.dials/totalDials*100)}% of dials</div></td>`+
      `<td><div class="iq-barwrap iq-vol"><div class="iq-bartrack"><div class="iq-barfill" style="width:${Math.round(b.dials/maxDials*100)}%"></div></div></div></td>`+
      `<td><div class="iq-barwrap iq-hot"><div class="iq-bartrack"><div class="iq-barfill" style="width:${connPct}%"></div></div><span class="iq-barval">${connPct}%</span></div></td>`+
      `<td class="num iq-hidecol"><b>${hotPct}%</b></td></tr>`;
  }).join('');
  el.innerHTML=`<div style="overflow-x:auto"><table class="iq-table"><thead><tr>`+
    `<th>${isHour?'Hour block (IST)':'Weekday'}</th><th class="num">Dials</th><th>Volume</th><th>Connect rate</th><th class="num iq-hidecol">Hot rate (of connected)</th>`+
    `</tr></thead><tbody>${rows}</tbody></table></div>`;
}
function paintOutboundPerf(){
  const secPerf=$('sec-outbound-perf'), secHidden=$('sec-outbound-perf-hidden');
  if(SELECTED_DIRECTION==='inbound'){
    if(secPerf)secPerf.style.display='none';
    if(secHidden)secHidden.style.display='block';
    return;
  }
  if(secPerf)secPerf.style.display='';
  if(secHidden)secHidden.style.display='none';
  const scopeNote=$('outboundScopeNote');
  if(scopeNote)scopeNote.style.display=(SELECTED_DIRECTION==='all')?'inline-flex':'none';

  const obRecs=outboundRecordsInView();
  const n=obRecs.length;
  const kpiEl=$('outboundPerfKpis');
  if(!n){
    if(kpiEl)kpiEl.innerHTML=emptyViewHtml('No outbound dials in this range.');
    ['outboundFunnel','unreachableList'].forEach(id=>{if($(id))$(id).innerHTML=emptyViewHtml('No outbound dials in this range.');});
    window.__obRecs=obRecs;
    paintDispositionBreak(obRecs);paintRedialCurve(obRecs);paintDialHeatmap(obRecs);paintDialTiming(obRecs);
    return;
  }
  const buckets=dispositionCounts(obRecs);
  const connectPct=Math.round(buckets.connected/n*100);
  // Per-number reach: a number counts as reached if it EVER connected, across all its dials.
  const byPhone=groupByPhone(obRecs);
  const numbers=Object.values(byPhone);
  const numbersTotal=numbers.length;
  const isConn=c=>normalizeDisposition(c)==='connected';
  const reachedNumbers=numbers.filter(calls=>calls.some(isConn));
  const numbersReached=reachedNumbers.length;
  const reachPct=numbersTotal?Math.round(numbersReached/numbersTotal*100):0;
  // Unreachable: dialed 3+ times, never once connected -- wasted-effort hit-list.
  const unreachable=numbers.filter(calls=>calls.length>=3 && !calls.some(isConn))
    .map(calls=>calls.slice().sort((a,b)=>a.ts-b.ts)).sort((a,b)=>b.length-a.length);
  const connectedRecs=obRecs.filter(isConn);
  const numbersHot=numbers.filter(calls=>calls.some(c=>isConn(c)&&c.leadTemp==='Hot')).length;
  const avgDials=numbersTotal?(n/numbersTotal).toFixed(1):'0.0';
  window.__obRecs=obRecs;
  window.__obConnected=connectedRecs;
  window.__obHot=connectedRecs.filter(r=>r.leadTemp==='Hot');
  window.__obUnreached=[].concat(...unreachable);
  window.__obFailed=obRecs.filter(r=>normalizeDisposition(r)!=='connected');
  if(kpiEl)kpiEl.innerHTML=[
    ["good",connectPct+"%","Connect rate ("+buckets.connected+" of "+n+" dials)","window.__obRecs",r=>normalizeDisposition(r)==='connected'],
    ["good",reachPct+"%","Numbers reached ("+numbersReached+" of "+numbersTotal+")","window.__obConnected",()=>true],
    ["hot",unreachable.length,"Unreachable numbers (3+ dials, 0 connects)","window.__obUnreached",()=>true],
    ["neut",numbersHot,"Hot leads reached","window.__obHot",()=>true]
  ].map(c=>`<div class="kpi ${c[0]}" onclick="openFilteredPanel('${esc(c[2])}',${c[4]},${c[3]})" style="cursor:pointer" title="Click for details"><div class="b"></div><span style="position:absolute;top:8px;right:10px;font-size:11px;color:var(--faint)">⊕</span><div class="v">${c[1]}</div><div class="l">${c[2]}</div></div>`).join("");

  paintOutboundFunnel(n,buckets.connected,buckets.failed,buckets.initiated,window.__obHot.length,numbersTotal,numbersReached,numbersHot);
  paintDispositionBreak(obRecs);
  paintUnreachableList(unreachable,avgDials);
  paintRedialCurve(obRecs);
  paintDialHeatmap(obRecs);
  paintDialTiming(obRecs);
}
// Outbound conversion funnel: dials placed -> numbers reached -> connected conversations -> hot leads.
// Shows exactly where outbound effort leaks on the way to a convertible lead.
function paintOutboundFunnel(totalDials,connectedDials,failedDials,initiatedDials,hotCalls,numbersTotal,numbersReached,numbersHot){
  const el=$('outboundFunnel');
  if(!el)return;
  // Dial/call-level and monotonic: every dial placed -> the ones that connected -> the hot leads among them.
  // The big drop from dials to connected IS the failed-call leakage, shown explicitly so wasted effort is visible.
  // Each step also shows the DISTINCT-NUMBER count beneath the dial/call count, so the effect of redialling the
  // same number (which inflates the raw dial/call totals) is visible right in the funnel.
  const steps=[
    ['Dials placed',totalDials,C.blue,'window.__obRecs',numbersTotal,'distinct numbers dialed'],
    ['Connected',connectedDials,C.teal,'window.__obConnected',numbersReached,'distinct numbers reached'],
    ['Hot-lead calls',hotCalls,C.gold||'#b08a3c','window.__obHot',numbersHot,'distinct hot leads']
  ];
  const max=totalDials||1;
  const stepHtml=(s,i)=>{
    const pct=Math.round(s[1]/max*100);
    const ofPrev=i>0&&steps[i-1][1]?Math.round(s[1]/steps[i-1][1]*100):100;
    const numSub=(s[4]!=null)?`<div style="font-size:10.5px;color:var(--faint);font-weight:700;margin-top:2px">${Number(s[4]).toLocaleString()} ${s[5]}</div>`:'';
    return `<div class="opf-funnel-step" onclick="openFilteredPanel('${esc(s[0])} (outbound)',()=>true,${s[3]})" title="Click for details">`+
      `<div class="opf-funnel-label">${esc(s[0])}${numSub}</div>`+
      `<div class="opf-funnel-track"><div class="opf-funnel-fill" style="width:${Math.max(pct,3)}%;background:${s[2]}">${s[1].toLocaleString()}</div></div>`+
      `<div class="opf-funnel-pct">${i===0?'100%':ofPrev+'% of prev'}</div></div>`;
  };
  const notConnected=totalDials-connectedDials;
  const initNote=initiatedDials?` · ${initiatedDials.toLocaleString()} no outcome`:'';
  const leak=`<div class="opf-funnel-leak" onclick="openFilteredPanel('Failed / unconnected dials (outbound)',()=>true,window.__obFailed)" title="Click for the failed dials">`+
    `<div></div><div><span class="opf-leak-x">✕</span> <b>${notConnected.toLocaleString()}</b> dials never connected <span class="opf-leak-sub">(${failedDials.toLocaleString()} failed${initNote})</span></div></div>`;
  el.innerHTML=stepHtml(steps[0],0)+leak+stepHtml(steps[1],1)+stepHtml(steps[2],2);
}
// Wasted-effort hit-list: numbers dialed repeatedly that never connected. Each row opens its own dials.
function paintUnreachableList(unreachable,avgDials){
  const el=$('unreachableList');
  if(!el)return;
  if(!unreachable.length){el.innerHTML=emptyViewHtml('No number was dialed 3+ times without connecting — reach discipline looks healthy.');return;}
  const wastedDials=unreachable.reduce((a,calls)=>a+calls.length,0);
  window.__unreachGroups=unreachable;
  const top=unreachable.slice(0,8);
  const rows=top.map((calls,i)=>{
    const ph=maskPhone(calls[0].from);
    return `<tr style="cursor:pointer" onclick="openFilteredPanel('${esc(ph)} — ${calls.length} dials, never connected',()=>true,window.__unreachGroups[${i}])"><td>${esc(ph)}</td><td class="tabular">${calls.length}</td><td class="tabular">${fmtDayLabel(calls[calls.length-1].d)}</td></tr>`;
  }).join('');
  el.innerHTML=`<div class="opf-hit-summary"><b>${unreachable.length.toLocaleString()}</b> numbers dialed 3+ times, never once connected — <b>${wastedDials.toLocaleString()}</b> wasted dials (avg ${avgDials} dials per number overall). Stop-calling / switch-to-SMS candidates.</div>`+
    `<div class="opf-hit-actions"><button type="button" onclick="openFilteredPanel('All repeatedly unreachable dials',()=>true,window.__obUnreached)">View all dials</button><button type="button" onclick="exportUnreachableCSV()">Export complete CSV</button></div>`+
    `<div style="overflow-x:auto"><table class="opf-cmp-table"><thead><tr><th>Number</th><th>Dials</th><th>Last tried</th></tr></thead><tbody>${rows}</tbody></table></div>`+
    (unreachable.length>top.length?`<div class="cap" style="margin-top:8px;font-size:11.5px">Showing top ${top.length} by dial count. ${(unreachable.length-top.length).toLocaleString()} more are included in View all dials and Export complete CSV.</div>`:'');
}
function exportUnreachableCSV(){
  const groups=window.__unreachGroups||[];
  if(!groups.length){alert('No repeatedly unreachable numbers to export.');return;}
  let csv='Phone,Country,Dial Count,First Tried,Last Tried,Campaigns,Latest Status,Filter Scope\n';
  groups.forEach(calls=>{
    const sorted=calls.slice().sort((a,b)=>a.ts-b.ts),first=sorted[0],last=sorted[sorted.length-1],country=classifyPhone(first.from).country;
    const campaigns=[...new Set(sorted.map(r=>String(r.campaign||'').trim()).filter(Boolean))].join(' | ');
    csv+=[fullPhone(first.from),escCSV(country),sorted.length,escCSV(formatCallTime(first)),escCSV(formatCallTime(last)),escCSV(campaigns),escCSV(last.status),escCSV(`${activeFilterScopeLabel()} · Repeatedly unreachable`)].join(',')+'\n';
  });
  downloadCSV('repeatedly_unreachable_'+csvDateStamp()+'.csv',csv);
}

// ===== OUTBOUND CADENCE & CAPACITY =====
// Concurrency: each completed call occupies [ts, ts+dur]; peak overlap = channels in use. System-wide
// (both directions) since a line is shared, date-filtered but not direction-filtered.
function concurrencyStats(){
  const recs=ALL_RECORDS_BACKUP.filter(r=>recordMatchesDate(r) && recordMatchesCampaign(r) && r.dur>0);
  if(!recs.length)return null;
  const events=[];
  recs.forEach(r=>{events.push([r.ts,1]);events.push([r.ts+r.dur,-1]);});
  events.sort((a,b)=>a[0]-b[0]||b[1]-a[1]);
  let cur=0,peak=0,peakT=0;const hourPeak=new Array(24).fill(0);
  for(const [t,d] of events){
    cur+=d;
    if(d===1){const h=new Date(t*1000).getHours();if(cur>hourPeak[h])hourPeak[h]=cur;}
    if(cur>peak){peak=cur;peakT=t;}
  }
  return {peak,peakT,hourPeak,n:recs.length};
}
function paintConcurrency(){
  const kpiEl=$('concKpis'),chart=$('concChart'),axis=$('concAxis');
  if(!kpiEl)return;
  const s=concurrencyStats();
  if(!s){kpiEl.innerHTML=emptyViewHtml('No completed calls with duration in this range.');if(chart)chart.innerHTML='';if(axis)axis.innerHTML='';return;}
  const busiestHour=s.hourPeak.indexOf(Math.max(...s.hourPeak));
  const chLow=Math.ceil(s.peak*1.3),chHigh=Math.ceil(s.peak*1.5);
  const peakDate=new Date(s.peakT*1000);
  const mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const hh=h=>`${String(h).padStart(2,'0')}:00`;
  kpiEl.innerHTML=[
    ['neut',s.peak,`Peak simultaneous calls · ${peakDate.getDate()} ${mon[peakDate.getMonth()]}, ${hh(peakDate.getHours())}`],
    ['good','~'+chLow+'–'+chHigh,'Recommended channels (peak + ring-time headroom)'],
    ['hot',hh(busiestHour)+'–'+hh((busiestHour+1)%24),'Busiest hour — size capacity for this']
  ].map(c=>`<div class="kpi ${c[0]}"><div class="b"></div><div class="v">${c[1]}</div><div class="l">${c[2]}</div></div>`).join('');
  const maxc=Math.max(...s.hourPeak,s.peak,1);
  if(chart)chart.innerHTML=`<div class="conc-need" style="bottom:${s.peak/maxc*100}%"><span>peak ${s.peak}</span></div>`+
    s.hourPeak.map((v,h)=>`<div class="conc-col ${h>=9&&h<21?'biz':''}"><div class="cn">${v||''}</div><div class="cbar" style="height:${v/maxc*100}%"></div></div>`).join('');
  if(axis)axis.innerHTML=s.hourPeak.map((v,h)=>`<div class="ct">${h%3===0?String(h).padStart(2,'0'):''}</div>`).join('');
}
// Cadence: per outbound number, the ordered attempt sequence -> compliance vs the 4-attempt / 5h / 9-9 rule.
function outboundNumberSequences(){
  const byPhone=groupByPhone(outboundRecordsInView());
  return Object.values(byPhone).map(c=>c.slice().sort((a,b)=>a.ts-b.ts));
}
function paintCadenceCompliance(){
  const el=$('cadenceScorecard'),note=$('cadenceNote');
  if(!el)return;
  const nums=outboundNumberSequences();
  const dials=outboundRecordsInView();
  if(!nums.length){el.innerHTML=emptyViewHtml('No outbound dials in this range.');if(note)note.style.display='none';return;}
  const over=nums.filter(c=>c.length>4);
  const maxAtt=Math.max(...nums.map(c=>c.length));
  let gtot=0,lt1=0,g46=0;
  nums.forEach(c=>{for(let i=1;i<c.length;i++){const g=(c[i].ts-c[i-1].ts)/3600;gtot++;if(g<1)lt1++;if(g>=4&&g<=6)g46++;}});
  const inWin=dials.filter(r=>r.h>=9&&r.h<21);
  const outWin=dials.filter(r=>!(r.h>=9&&r.h<21));
  const lt1Pct=gtot?Math.round(lt1/gtot*100):0, g46Pct=gtot?Math.round(g46/gtot*100):0, inWinPct=dials.length?Math.round(inWin.length/dials.length*100):0;
  window.__overCapCalls=[].concat(...over);
  window.__offWinCalls=outWin;
  const overPct=Math.round(over.length/nums.length*100);
  const rules=[
    {name:'Max 4 attempts per number',sub:'1 initial + 3 retries',target:'&le; 4 dials',
     actual:`${overPct}% exceed · max ${maxAtt}`,status:overPct>10?'fail':overPct>2?'warn':'pass',
     drill:over.length?["Numbers dialed more than 4 times","window.__overCapCalls"]:null},
    {name:'~5-hour interval between retries',sub:'no rapid re-dialing',target:'gap &asymp; 5h',
     actual:`${lt1Pct}% fire &lt;1h · ${g46Pct}% at 4&ndash;6h`,status:lt1Pct>30?'fail':lt1Pct>15?'warn':'pass',drill:null},
    {name:'Dial only within 9am&ndash;9pm',sub:'no off-hours calls',target:'100% in-window',
     actual:`${inWinPct}% in · ${outWin.length.toLocaleString()} outside`,status:inWinPct>=99?'pass':inWinPct>=90?'warn':'fail',
     drill:outWin.length?["Dials placed outside 9am–9pm","window.__offWinCalls"]:null}
  ];
  el.innerHTML=rules.map(r=>{
    const st=r.status==='pass'?'✓ On policy':r.status==='warn'?'⚠ Leaking':'✗ Not followed';
    const actCell=r.drill
      ?`<div class="rule-col clickable" onclick="openFilteredPanel('${esc(r.drill[0])}',()=>true,${r.drill[1]})"><div class="rk">Actual</div><div class="rv sm">${r.actual}</div></div>`
      :`<div class="rule-col"><div class="rk">Actual</div><div class="rv sm">${r.actual}</div></div>`;
    return `<div class="rule"><div><div class="rule-name">${r.name}</div><div class="rule-sub">${r.sub}</div></div>`+
      `<div class="rule-col"><div class="rk">Target</div><div class="rv">${r.target}</div></div>`+
      actCell+`<div><span class="rstatus ${r.status}">${st}</span></div></div>`;
  }).join('');
  const fails=rules.filter(r=>r.status!=='pass').length;
  if(note){
    if(fails){note.style.display='flex';note.style.background='rgba(163,58,58,.05)';note.style.borderColor='rgba(163,58,58,.3)';
      note.innerHTML=`<span class="opf-bestwin-dot" style="background:var(--burgundy)"></span><span><b>The policy is sound; the gap is enforcement.</b> ${overPct}% of numbers exceed the 4-attempt cap (max ${maxAtt}), ${lt1Pct}% of retries fire within an hour instead of ~5, and ${outWin.length.toLocaleString()} dials land outside 9&ndash;9. Tightening the dialer to your own rule would cut waste and lift connect rate.</span>`;
    }else{note.style.display='none';}
  }
}
function paintRetryEconomics(){
  const reachEl=$('reachBars'),gapEl=$('gapBars'),recoEl=$('retryReco');
  if(!reachEl)return;
  const nums=outboundNumberSequences();
  const isConn=c=>normalizeDisposition(c)==='connected';
  const reach=[0,0,0,0,0,0];let ever=0;
  nums.forEach(c=>{for(let i=0;i<c.length;i++){if(isConn(c[i])){reach[Math.min(i,5)]++;ever++;break;}}});
  if(!ever){reachEl.innerHTML=emptyViewHtml('No connected outbound calls in this range.');if(gapEl)gapEl.innerHTML='';if(recoEl)recoEl.innerHTML='';return;}
  const cum=[];let run=0;reach.forEach(v=>{run+=v;cum.push(Math.round(run/ever*100));});
  const labels=['Attempt 1','By attempt 2','By attempt 3','By attempt 4','By attempt 5','By attempt 6+'];
  // cap = first attempt index reaching >=80% cumulative
  const capIdx=cum.findIndex(v=>v>=80);
  reachEl.innerHTML=labels.map((lb,i)=>{
    const isCap=i===capIdx;const col=isCap?'var(--gold)':'var(--navy)';
    return `<div class="brow"><div class="blbl">${lb}${isCap?' <span style="color:var(--gold);font-size:10px;font-weight:800">← cap</span>':''}</div><div class="btrack"><div class="bfill" style="width:${cum[i]}%;background:${col}">${cum[i]}%</div></div></div>`;
  }).join('');
  const gapB={lt1:[0,0],b14:[0,0],b46:[0,0],gt6:[0,0]};
  nums.forEach(c=>{for(let i=1;i<c.length;i++){const g=(c[i].ts-c[i-1].ts)/3600;const k=g<1?'lt1':g<4?'b14':g<=6?'b46':'gt6';gapB[k][1]++;if(isConn(c[i]))gapB[k][0]++;}});
  const gapRows=[['&lt;1 hour','lt1','var(--burgundy)'],['1&ndash;4 hours','b14','var(--amber)'],['4&ndash;6 hours','b46','var(--sage)'],['&gt;6 hours','gt6','var(--blue)']];
  const gpct=k=>gapB[k][1]?Math.round(gapB[k][0]/gapB[k][1]*100):0;
  const gmax=Math.max(...['lt1','b14','b46','gt6'].map(gpct),1);
  if(gapEl)gapEl.innerHTML=gapRows.map(g=>{const p=gpct(g[1]);
    return `<div class="brow" style="cursor:default"><div class="blbl">${g[0]}</div><div class="btrack"><div class="bfill" style="width:${Math.round(p/gmax*100)}%;background:${g[2]}">${p}%</div></div></div>`;
  }).join('');
  if(recoEl){
    const capN=capIdx>=0?capIdx+1:6, capPct=capIdx>=0?cum[capIdx]:100;
    const bestGap=['b46','gt6','b14','lt1'].reduce((a,b)=>gpct(b)>gpct(a)?b:a);
    const bestLbl={lt1:'under 1h',b14:'1–4h',b46:'4–6h',gt6:'over 6h'}[bestGap];
    recoEl.innerHTML=`<b>What the data says:</b> cap at <b>${capN} attempt${capN>1?'s':''}</b> — that already reaches <b>${capPct}%</b> of everyone you'll ever connect with; beyond it is mostly waste. The best-connecting gap is <b>${bestLbl}</b> (${gpct(bestGap)}%) versus just ${gpct('lt1')}% for a &lt;1h rapid redial — so spacing retries ~5h earns its keep. Fewer dials, higher connect rate, lower concurrency load.`;
  }
}
function paintOutboundCadence(){
  const sec=$('sec-outbound-cadence'),hidden=$('sec-outbound-cadence-hidden');
  if(SELECTED_DIRECTION==='inbound'){
    if(sec)sec.style.display='none';if(hidden)hidden.style.display='block';return;
  }
  if(sec)sec.style.display='';if(hidden)hidden.style.display='none';
  const scope=$('cadenceScopeNote');if(scope)scope.style.display=(SELECTED_DIRECTION==='all')?'inline-flex':'none';
  paintConcurrency();
  paintCadenceCompliance();
  paintRetryEconomics();
}

// ===== CAMPAIGN PERFORMANCE & FAILURE DIAGNOSTICS =====
let CAMPAIGN_SORT='dials'; // 'dials' | 'connect' | 'reach' | 'hot'
function setCampaignSort(k){CAMPAIGN_SORT=k;paintCampaignLeaderboard();}
// Per-campaign outbound stats over the current DATE view (not scoped to the campaign filter -- the
// leaderboard's whole point is to compare every campaign side by side).
function campaignStats(){
  const dials=outboundDialsInDateView();
  const byC={};
  dials.forEach(r=>{
    const c=(r.campaign||'').trim()||'(no campaign)';
    const b=byC[c]||(byC[c]={dials:0,connected:0,numbers:{}});
    b.dials++;
    const conn=normalizeDisposition(r)==='connected';
    if(conn)b.connected++;
    const num=r.from||'?';
    // Track per-UNIQUE-number status so conversion isn't inflated by redialling the same lead:
    // reached = ever connected; hot = ever produced a connected Hot call.
    const st=b.numbers[num]||(b.numbers[num]={reached:false,hot:false});
    if(conn){st.reached=true;if(r.leadTemp==='Hot')st.hot=true;}
  });
  return Object.entries(byC).map(([campaign,b])=>{
    const nums=Object.values(b.numbers);
    const numsTotal=nums.length;
    const reached=nums.filter(s=>s.reached).length;
    const numbersHot=nums.filter(s=>s.hot).length;
    return {campaign,dials:b.dials,connectPct:b.dials?Math.round(b.connected/b.dials*100):0,
      reachPct:numsTotal?Math.round(reached/numsTotal*100):0,
      // Hot % = share of REACHED numbers that ever went hot (per-lead conversion, not per-call).
      hotPct:reached?Math.round(numbersHot/reached*100):0,numbers:numsTotal,reached,numbersHot};
  });
}
function paintCampaignLeaderboard(){
  const el=$('campaignLeaderboard');if(!el)return;
  const rows=campaignStats();
  if(!rows.length){el.innerHTML=emptyViewHtml('No outbound campaigns in this range.');return;}
  const keyMap={dials:'dials',connect:'connectPct',reach:'reachPct',hot:'hotPct'};
  const sk=keyMap[CAMPAIGN_SORT]||'dials';
  rows.sort((a,b)=>b[sk]-a[sk]||b.dials-a.dials);
  window.__campaignRows={};
  const base=outboundDialsInDateView();
  rows.forEach(x=>{window.__campaignRows[x.campaign]=base.filter(r=>((r.campaign||'').trim()||'(no campaign)')===x.campaign);});
  const maxHot=Math.max(...rows.map(r=>r.hotPct),1);
  const th=(k,lbl)=>`<th class="num camp-sortable ${CAMPAIGN_SORT===k?'camp-sorted':''}" onclick="setCampaignSort('${k}')">${lbl}${CAMPAIGN_SORT===k?' ▾':''}</th>`;
  el.innerHTML=`<div style="overflow-x:auto"><table class="iq-table"><thead><tr><th>Campaign</th>${th('dials','Dials')}${th('connect','Connect %')}${th('reach','Reach %')}${th('hot','Hot %')}</tr></thead><tbody>`+
    rows.map(x=>`<tr class="iq-row" onclick="openFilteredPanel(${jsArg(`${x.campaign} (outbound)`)},()=>true,window.__campaignRows[${jsArg(x.campaign)}])">`+
      `<td><span class="iq-name">${esc(x.campaign)}</span><div class="iq-sub">${x.numbers.toLocaleString()} numbers dialed</div></td>`+
      `<td class="num">${x.dials.toLocaleString()}</td>`+
      `<td class="num">${x.connectPct}%</td>`+
      `<td class="num">${x.reachPct}%</td>`+
      `<td class="num"><div class="iq-barwrap iq-hot" style="justify-content:flex-end;min-width:0"><div class="iq-bartrack" style="max-width:64px;flex:0 0 64px"><div class="iq-barfill" style="width:${Math.round(x.hotPct/maxHot*100)}%"></div></div><span class="iq-barval">${x.hotPct}%</span></div></td></tr>`).join('')+
    `</tbody></table></div>`+
    `<div class="cap" style="margin-top:10px;font-size:11.5px"><b>Dials</b> = attempts placed · <b>Connect %</b> = share of dials that connected (per-dial) · <b>Reach %</b> = distinct numbers ever reached · <b>Hot %</b> = of the numbers reached, the share that produced a hot lead — counted <b>once per number</b>, so redialling the same lead doesn't inflate it.</div>`;
}
const SIP_LABEL={'603':'Declined by callee (SIP 603)','480':'Temporarily unavailable (480)','486':'Busy (486)','408':'No answer / timeout (408)','404':'Number not found (404)','403':'Forbidden (403)','500':'Server error (500)','503':'Service unavailable (503)','502':'Bad gateway (502)'};
function failureReasonLabel(r){
  if(r.failReason && r.failReason!=='None' && r.failReason!=='')return r.failReason.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  if(r.sipCode && r.sipCode!=='None' && r.sipCode!=='')return SIP_LABEL[r.sipCode]||('SIP / Hangup '+r.sipCode);
  return null;
}
function paintFailureBreakdown(){
  const el=$('failureBreakdown'),cov=$('failureCoverage');if(!el)return;
  if(cov)cov.style.display='none'; // everything is rendered inside #failureBreakdown, in order
  const dials=outboundRecordsInView();
  const failed=dials.filter(r=>normalizeDisposition(r)!=='connected');
  if(!failed.length){el.innerHTML=emptyViewHtml('No failed outbound dials in this range.');return;}
  // A failed dial to a number you EVENTUALLY reached cost you nothing; a failed dial to a number you
  // NEVER reached is a real lost lead. Split them so the two are never conflated -- and diagnose only
  // the ones that actually mattered.
  const reached=new Set();
  dials.forEach(r=>{if(normalizeDisposition(r)==='connected')reached.add(r.from||'?');});
  const lost=failed.filter(r=>!reached.has(r.from||'?'));
  const recovered=failed.filter(r=>reached.has(r.from||'?'));
  window.__failLost=lost;window.__failRecovered=recovered;
  if(!lost.length){el.innerHTML=`<div class="cap" style="margin-top:6px">Every failed outbound dial in this view eventually reached its number.</div>`;return;}
  const groups={};let coded=0;
  lost.forEach(r=>{const l=failureReasonLabel(r);if(l){coded++;groups[l]=(groups[l]||0)+1;}});
  const uncoded=lost.length-coded;
  window.__failGroups={};
  Object.keys(groups).forEach(l=>{window.__failGroups[l]=lost.filter(r=>failureReasonLabel(r)===l);});
  window.__failUncoded=lost.filter(r=>!failureReasonLabel(r));
  const note=`<div class="opf-bestwin" style="background:#f8fafc;border-color:var(--line)"><span class="opf-bestwin-dot" style="background:var(--gold)"></span><span><b>${coded.toLocaleString()}</b> of these ${lost.length.toLocaleString()} lost dials carry a diagnosed code (${Math.round(coded/lost.length*100)}%). Telephony coding is newer, so older campaigns are mostly uncoded — coverage grows as fresh campaigns dial.</span></div>`;
  const entries=Object.entries(groups).sort((a,b)=>b[1]-a[1]);
  const topEntries=entries.slice(0,7);
  const otherReasons=entries.slice(7).flatMap(([label])=>window.__failGroups[label]||[]).concat(window.__failUncoded);
  if(otherReasons.length){
    window.__failGroups['Other reasons']=otherReasons;
    topEntries.push(['Other reasons',otherReasons]);
  }
  const max=Math.max(...topEntries.map(e=>Array.isArray(e[1])?e[1].length:e[1]),1);
  const colorFor=l=>/declin/i.test(l)?C.hot:/unavail|busy|no.?answer|timeout/i.test(l)?C.warm:C.cold;
  const bars=topEntries.map(([l,bucket])=>{
    const n=Array.isArray(bucket)?bucket.length:bucket;
    return `<div style="margin-bottom:13px;cursor:pointer" onclick="openFilteredPanel(${jsArg(`${l} (lost dials)`)},()=>true,window.__failGroups[${jsArg(l)}])"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span>${esc(l)}</span><b>${n.toLocaleString()} (${Math.round(n/lost.length*100)}%)</b></div><div style="background:#eef2f7;border-radius:5px;height:8px;overflow:hidden"><div style="background:${colorFor(l)};height:100%;width:${Math.round(n/max*100)}%"></div></div></div>`;
  }).join('');
  const lostSummary=`<div class="opf-bestwin" style="background:#f8fafc;border-color:var(--line)"><span class="opf-bestwin-dot" style="background:var(--hot)"></span><span><b>${lost.length.toLocaleString()}</b> outbound dials were never followed by a successful reach. Click a reason to inspect the underlying calls.</span></div>`;
  el.innerHTML=lostSummary+note+`<div class="subh" style="margin:14px 0 10px">Top reasons</div>`+bars;
}
function paintCampaignSection(){
  const sec=$('sec-campaigns'),hidden=$('sec-campaigns-hidden');
  if(SELECTED_DIRECTION==='inbound'){if(sec)sec.style.display='none';if(hidden)hidden.style.display='block';return;}
  if(sec)sec.style.display='';if(hidden)hidden.style.display='none';
  const scope=$('campaignScopeNote');if(scope)scope.style.display=(SELECTED_DIRECTION==='all')?'inline-flex':'none';
  paintCampaignLeaderboard();
  paintFailureBreakdown();
}

// ===== ANOMALY DETECTION — "WHAT MOVED, AND WHY" =====
// Splits the current view into an earlier and a recent half, measures each key metric's change, and
// attributes it. For hot-rate it runs a mix-vs-within-topic decomposition so "different demand" is not
// mistaken for "genuine conversion change". Only emits a card when a change (or a notable non-change) is real.
function paintAnomalyCards(){
  const el=$('anomalyCards');
  if(!el)return;
  const recs=ALL_RECORDS_BACKUP.filter(recordMatchesCurrentFilters).filter(r=>r.d).slice().sort((a,b)=>a.d<b.d?-1:1);
  const days=[...new Set(recs.map(r=>r.d))];
  if(recs.length<40 || days.length<4){
    el.innerHTML=`<div class="anom stable" style="grid-column:1/-1"><span class="anom-tag">Not enough history</span><h3>Widen the date range to surface trends</h3><div class="anom-why">Auto-attribution needs at least a few days of calls on each side to compare. Select a broader range (or All) and this fills in.</div></div>`;
    return;
  }
  const mid=days[Math.floor(days.length/2)];
  const early=recs.filter(r=>r.d<mid), late=recs.filter(r=>r.d>=mid);
  const rate=(sub,pred)=>sub.length?sub.filter(pred).length/sub.length*100:0;
  const hotE=rate(early,r=>r.leadTemp==='Hot'), hotL=rate(late,r=>r.leadTemp==='Hot');
  const redE=rate(early,r=>r.band==='Red'), redL=rate(late,r=>r.band==='Red');
  const confE=early.reduce((a,r)=>a+Number(r.conf||0),0)/(early.length||1), confL=late.reduce((a,r)=>a+Number(r.conf||0),0)/(late.length||1);
  const cards=[];
  // 1) Hot-rate change with mix vs within-topic decomposition
  const hotDelta=Math.round(hotL-hotE);
  if(Math.abs(hotDelta)>=3){
    const intents=[...new Set(recs.map(r=>r.intent||'General'))];
    const shr=(sub,k)=>sub.length?sub.filter(r=>(r.intent||'General')===k).length/sub.length:0;
    const irate=(sub,k)=>{const s=sub.filter(r=>(r.intent||'General')===k);return s.length?s.filter(r=>r.leadTemp==='Hot').length/s.length:0;};
    let mix=0,within=0;
    intents.forEach(k=>{const eS=shr(early,k),lS=shr(late,k),eR=irate(early,k),lR=irate(late,k);mix+=(lS-eS)*eR;within+=lS*(lR-eR);});
    const mixPts=Math.round(mix*1000)/10, withinPts=Math.round(within*1000)/10;
    const drivers=intents.map(k=>({k,d:Math.round((irate(late,k)-irate(early,k))*100),lS:shr(late,k)}))
      .filter(x=>x.lS>=0.05).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d)).slice(0,2)
      .map(x=>`${esc(x.k)} ${x.d>=0?'+':''}${x.d}pts`).join(', ');
    const genuine=Math.abs(withinPts)>=Math.abs(mixPts);
    cards.push({cls:hotDelta>=0?'pos':'watch',tag:genuine?(hotDelta>=0?'Genuine improvement':'Genuine decline'):'Demand-mix shift',
      title:hotDelta>=0?`Hot-lead rate is ${genuine?'genuinely rising':'up — but it\'s a demand-mix shift'}`:`Hot-lead rate is ${genuine?'genuinely falling':'down — driven by demand mix'}`,
      metric:`${Math.round(hotE)}% → ${Math.round(hotL)}% <span style="font-size:13px">${hotDelta>=0?'▲':'▼'} ${Math.abs(hotDelta)} pts</span>`,
      why:`Decomposed: <b>${withinPts>=0?'+':''}${withinPts} pts</b> from the same topics converting differently${drivers?` (${drivers})`:''}, <b>${mixPts>=0?'+':''}${mixPts} pts</b> from a shift in what people call about. ${genuine?'The change is real conversion movement within topics, not just a different call mix.':'This is mostly a change in demand mix, not conversation quality.'} Bot confidence ${Math.round(confE)} → ${Math.round(confL)}.`});
  }
  // 2) Stability card — QA held flat while hot-rate moved (prevents false alarms)
  if(Math.abs(hotDelta)>=3 && Math.abs(redL-redE)<3 && Math.abs(confL-confE)<3){
    cards.push({cls:'stable',tag:'What did NOT change',
      title:'Conversation quality is stable — not a QA problem',
      metric:`Red-band ${Math.round(redE)}%→${Math.round(redL)}% <span style="font-size:13px">■ flat</span>`,
      why:`Despite the hot-rate move, Red-band QA (${Math.round(redE)}% → ${Math.round(redL)}%) and bot confidence (${Math.round(confE)} → ${Math.round(confL)}) barely shifted. The movement is in <b>lead temperature</b> (who was reached), not bot performance — so a "quality drop" alert here would be a false alarm.`});
  }
  // 3) Volume card
  const eDays=[...new Set(early.map(r=>r.d))].length||1, lDays=[...new Set(late.map(r=>r.d))].length||1;
  const evpd=early.length/eDays, lvpd=late.length/lDays;
  if(evpd>0 && Math.abs(lvpd-evpd)/evpd>=0.5){
    const up=lvpd>evpd, pct=Math.round(Math.abs(lvpd-evpd)/evpd*100);
    cards.push({cls:up?'opp':'watch',tag:'Volume shift',
      title:`Daily call volume ${up?'scaled up':'dropped'} ${pct}%`,
      metric:`${Math.round(evpd)} → ${Math.round(lvpd)}/day <span style="font-size:13px">${up?'▲':'▼'} ${pct}%</span>`,
      why:`Average calls/day moved from <b>${Math.round(evpd)}</b> to <b>${Math.round(lvpd)}</b>. ${up?'Scaling reaches more leads but can pull in lower-intent contacts and spike concurrency — watch connect rate and channel load.':'Lower volume — check whether it is intentional pacing or a dialer/supply issue.'}`});
  }
  if(!cards.length){
    cards.push({cls:'stable',tag:'Steady',title:'No material shifts this period',
      metric:`Hot ${Math.round(hotL)}% · Red ${Math.round(redL)}% · Conf ${Math.round(confL)}`,
      why:`Hot-lead rate, QA band and confidence all held within a few points of the prior period. Nothing needs attention from a trend standpoint right now.`});
  }
  el.innerHTML=cards.slice(0,4).map(c=>`<div class="anom ${c.cls}"><span class="anom-tag">${c.tag}</span><h3>${c.title}</h3><div class="anom-metric">${c.metric}</div><div class="anom-why">${c.why}</div></div>`).join('');
}

// Requested follow-ups are signals extracted from conversations. This dashboard does not know task
// assignment or completion, so it deliberately shows readiness rather than a misleading SLA.
let CB_TIME_FILTER='all'; // 'all' | 'timed' | 'unscheduled'
function callbackHasRequestedTime(calls){
  return calls.some(r=>r.cbPreferred&&r.cbPreferred!=='Not specified');
}
function paintFollowUpReadiness(byPhone,recs){
  const el=$('cbReadiness');
  if(!el)return;
  const groups=Object.values(byPhone);
  const timed=groups.filter(callbackHasRequestedTime).length;
  const unscheduled=groups.length-timed;
  const chip=(key,label,count)=>{
    const active=CB_TIME_FILTER===key;
    return `<button type="button" class="follow-up-readiness-chip${active?' follow-up-readiness-active':''}" data-readiness="${key}" aria-pressed="${active}"><span class="follow-up-readiness-n">${count}</span><span>${esc(label)}</span></button>`;
  };
  el.innerHTML=`<div class="follow-up-readiness-title">Follow-up readiness</div><div class="follow-up-readiness-strip">${chip('all','All leads',groups.length)}${chip('timed','Requested time',timed)}${chip('unscheduled','Needs scheduling',unscheduled)}</div><div class="cap follow-up-readiness-note">Requested time is detected from the conversation. It is not a task-completion or SLA status.</div>`;
  el.querySelectorAll('.follow-up-readiness-chip').forEach(btn=>{
    btn.onclick=()=>{
      const key=btn.dataset.readiness;
      CB_TIME_FILTER=(CB_TIME_FILTER===key)?'all':key;
      paintCallbacks(recs);
    };
  });
}

function scoreSheetRows(rows,name){
  if(!rows||!rows.length)return 0;
  const headers=Object.keys(rows[0]||{}).map(normFieldName).join('|');
  let score=0;
  if(/voice|export/i.test(name||''))score+=8;
  ['createdat','date','timestamp','calltime'].forEach(k=>{if(headers.includes(k))score+=4;});
  ['fulltranscript','transcript','summary','from','phone','mobile','duration','confidence','needscore'].forEach(k=>{if(headers.includes(k))score+=2;});
  const sample=rows.slice(0,25);
  const validDates=sample.filter(r=>parseDateFull(pickField(r,['Created At (IST)','Created At','Timestamp','Call Time','Call Date','Date','Started At','Start Time','created_at']))).length;
  score+=validDates*3;
  return score;
}
function chooseWorkbookCandidates(candidates){
  const scored=(candidates||[]).filter(candidate=>candidate&&candidate.rows?.length).map(candidate=>({
    name:candidate.name,
    rows:candidate.rows,
    score:scoreSheetRows(candidate.rows,candidate.name)
  }));
  scored.sort((a,b)=>b.score-a.score);
  return scored[0]||null;
}
function chooseWorkbookRows(wb){
  return chooseWorkbookCandidates((wb.SheetNames||[]).map(name=>({
    name,
    rows:XLSX.utils.sheet_to_json(wb.Sheets[name],{defval:'',raw:false})
  })));
}


const INBOUND_LEAD_PHONE_FIELDS=['From','Caller','Caller Number','Source','Source Number','Phone','Phone Number','Mobile','Mobile Number','Contact','Contact Number','User Phone','Customer Phone','Lead Phone','Student Phone'];
const OUTBOUND_LEAD_PHONE_FIELDS=['To','Recipient','Recipient Number','Destination','Destination Number','Dialed Number','Callee','Callee Number','Customer Phone','Lead Phone','Student Phone','Phone','Phone Number','Mobile','Mobile Number','Contact','Contact Number','User Phone'];
const GENERIC_LEAD_PHONE_FIELDS=['Lead Phone','Student Phone','Customer Phone','Mobile','Mobile Number','Phone','Phone Number','Contact','Contact Number','User Phone','From','To','Caller','Caller Number','Recipient','Destination','Callee'];
function isUsablePhoneCandidate(v){
  const s=String(v||'').trim();
  const digits=s.replace(/\D/g,'');
  if(!s||!digits||digits.length<6)return false;
  if(/^0+$/.test(digits))return false;
  if(/^1+$|^9+$|^12345/.test(digits))return false;
  return true;
}
function firstUsablePhone(row,aliases){
  for(const a of aliases){
    const v=pickField(row,[a]);
    if(isUsablePhoneCandidate(v))return String(v).trim();
  }
  return '';
}
function resolveLeadPhone(row,direction){
  const dir=normalizeDirection(direction);
  if(dir==='outbound'){
    // In outbound exports, From is usually the BITS/system dialer number and To is the actual learner/lead.
    return firstUsablePhone(row,OUTBOUND_LEAD_PHONE_FIELDS) || firstUsablePhone(row,INBOUND_LEAD_PHONE_FIELDS) || 'unknown';
  }
  if(dir==='inbound'){
    // In inbound exports, From is the learner/lead and To is usually the BITS receiving number.
    return firstUsablePhone(row,INBOUND_LEAD_PHONE_FIELDS) || firstUsablePhone(row,OUTBOUND_LEAD_PHONE_FIELDS) || 'unknown';
  }
  return firstUsablePhone(row,GENERIC_LEAD_PHONE_FIELDS) || 'unknown';
}

function rowCallId(row){return String(pickField(row,['Call ID','CallId','ID','Conversation ID','Session ID'])||'').trim();}
// Lifecycle precedence: one dial can be logged multiple times under the same Call ID as it advances
// (e.g. "initiated" then "failed", or "initiated" then "completed"). Higher rank = more advanced/terminal.
function rowStatusRank(row){
  const s=String(pickField(row,['Status','Call Status'])||'').toLowerCase();
  return s==='completed'?3:s==='failed'?2:s==='initiated'?1:0;
}
const DEDUPE_COMPLETENESS_FIELDS=['Lead Temp.','Review Band','Bot Conf.','Need Score','Summary','Full Transcript','Campaign','Campaign ID','Failure Stage','Failure Reason','Failure Detail','SIP / Hangup Code','Hangup Cause'];
function rowCompletenessScore(row){
  return DEDUPE_COMPLETENESS_FIELDS.reduce((n,key)=>n+(String(pickField(row,[key])??'').trim()?1:0),0);
}
function rowLifecycleTime(row){
  const dt=parseDateFull(pickField(row,['Created At (IST)','Created At','Timestamp','Call Time','Call Date','Date','Started At','Start Time','created_at','createdAt']));
  return dt?Date.parse(`${dt.iso}T${String(dt.h).padStart(2,'0')}:${String(dt.m).padStart(2,'0')}:00`):0;
}
function preferLifecycleRow(candidate,previous){
  const rankDelta=rowStatusRank(candidate)-rowStatusRank(previous);
  if(rankDelta)return rankDelta>0;
  const timeDelta=rowLifecycleTime(candidate)-rowLifecycleTime(previous);
  if(timeDelta)return timeDelta>0;
  return rowCompletenessScore(candidate)>=rowCompletenessScore(previous);
}
function dedupeRowsByCallId(rows){
  // Collapse each Call ID to its most-advanced lifecycle row so one call = one row. Rows with no Call ID
  // (older/other exports) are passed through untouched, preserving prior single-row-per-call behaviour.
  const byId=new Map(); const noId=[];
  for(const row of rows){
    const cid=rowCallId(row);
    if(!cid){noId.push(row);continue;}
    const prev=byId.get(cid);
    if(!prev || preferLifecycleRow(row,prev))byId.set(cid,row);
  }
  return [...byId.values(),...noId];
}
function isConversationRecord(r){
  // A conversation is a call that actually connected. Failed/initiated dials carry no lead/quality
  // fields, so they are kept out of RECORDS (they live in ALL_DIALS for connectivity analysis only).
  // Blank/unknown status keeps prior behaviour: older exports had no Status column and every row counted.
  const s=String(r.status||'').toLowerCase();
  return s!=='failed' && s!=='initiated';
}

function rowToRecord(r){
  const dtStr=pickField(r,['Created At (IST)','Created At','Timestamp','Call Time','Call Date','Date','Started At','Start Time','created_at','createdAt']);
  const dt=parseDateFull(dtStr);
  const trans=String(pickField(r,['Full Transcript','Transcript','Call Transcript','Conversation Transcript','Conversation','Messages','Dialogue'])||'');
  const excelSummary=String(pickField(r,['Summary','Call Summary','Conversation Summary','AI Summary','Synopsis'])||'').trim();
  let summary=excelSummary;
  if(!summary){const cleanTrans=trans.replace(/\s+/g,' ').trim();summary=cleanTrans.length>120?cleanTrans.slice(0,120)+'...':cleanTrans;}
  const bodyText=(trans+' '+summary).trim();
  const direction=normalizeDirection(pickField(r,['Direction','direction','Call Direction','CallDirection','Type','Call Type','call_direction','direction_type','Inbound/Outbound']));
  const rawFrom=String(pickField(r,['From','Caller','Caller Number','Source','Source Number'])||'').trim();
  const rawTo=String(pickField(r,['To','Recipient','Recipient Number','Destination','Destination Number','Dialed Number','Callee','Callee Number'])||'').trim();
  const leadPhone=resolveLeadPhone(r,direction);
  const intent=intentOf(bodyText);
  const callbackReq=/callback|call me|call back|please call|ring me|ring back|contact me|get back|follow.{0,5}up/i.test(bodyText);
  const need=Number(pickField(r,['Need Score','Need','Lead Need Score','NeedScore']))||0;
  const frustrated=/frustrat|angry|upset|annoyed|waited|promised.*not|multiple.*time|already.*called|no.*response|not.*working|disappoint|useless|terrible|worst|complaint/i.test(bodyText);
  const low=bodyText.toLowerCase();
  let cbReason='Follow-up needed';
  if(/payment|fee|cost|emi|installment/.test(low))cbReason='Payment clarification';
  else if(/admission|apply|process|enrol|form/.test(low))cbReason='Admission assistance';
  else if(/programme|program|course|curriculum|batch/.test(low))cbReason='Programme info';
  else if(/result|mark|grade|certificate/.test(low))cbReason='Results/Certificate';
  else if(/access|login|portal|enrolled|student/.test(low))cbReason='Account access';
  else if(/technical|audio|connection|quality|issue/.test(low))cbReason='Technical support';
  else if(/eligib|qualify|require/.test(low))cbReason='Eligibility check';
  const dateObj=dt?new Date(Number(dt.iso.split('-')[0]),Number(dt.iso.split('-')[1])-1,Number(dt.iso.split('-')[2]),dt.h,dt.m,0):new Date();
  const cbWindow=resolveCallbackWindow(r,trans,summary,dt?dt.iso:null);
  return{
    d:dt?dt.iso:null,h:dt?dt.h:0,m:dt?dt.m:0,
    callId:String(pickField(r,['Call ID','CallId','ID','Conversation ID','Session ID'])||''),ts:Math.floor(dateObj.getTime()/1000),
    dur:Number(pickField(r,['Duration (s)','Duration','Duration Seconds','Duration(s)','Call Duration']))||0,
    msg:Number(pickField(r,['Messages','Message Count','Total Messages','Turns']))||0,
    status:String(pickField(r,['Status','Call Status'])||'').toLowerCase(),leadTemp:String(pickField(r,['Lead Temp.','Lead Temp','Lead Temperature','Lead Tier','Temperature'])||'').trim(),
    conf:Number(pickField(r,['Bot Conf.','Bot Conf','Bot Confidence','AI Confidence','Confidence','Model Confidence']))||0,need,
    band:String(pickField(r,['Review Band','QA Band','Quality Band','Review'])||'').trim(),direction,intent,callback:callbackReq,cbReason,cbPreferred:cbWindow.label,cbPreferredDate:cbWindow.date,frustrated,summary,
    campaign:String(pickField(r,['Campaign','Campaign Name'])||'').trim(),
    campaignId:String(pickField(r,['Campaign ID','CampaignId'])||'').trim(),
    failStage:String(pickField(r,['Failure Stage'])||'').trim(),
    failReason:String(pickField(r,['Failure Reason'])||'').trim(),
    failDetail:String(pickField(r,['Failure Detail'])||'').trim(),
    sipCode:String(pickField(r,['SIP / Hangup Code','SIP/Hangup Code','SIP Code','Hangup Code'])||'').trim(),
    hangupCause:String(pickField(r,['Hangup Cause'])||'').trim(),
    from:leadPhone,leadPhone,rawFrom,rawTo,trans
  };
}

function aggregate(recs){
  const o={n:recs.length,hot:0,warm:0,cold:0,callbacks:0,
    totalDur:0,totalMsg:0,avgConf:0,avgNeed:0,green:0,amber:0,red:0,india:0,intl:0,
    hourly:{},daily:{},intent:{},durBands:{},confBands:{}};
  const confQual={Hot:{conf:0,need:0,n:0},Warm:{conf:0,need:0,n:0},Cold:{conf:0,need:0,n:0}};
  const msgQual=[[],[],[]]; // <5msg, 5-20msg, >20msg
  // Hot-lead conversion grouped by Anya confidence band (low/mid/high)
  const confConv={low:{hot:0,n:0},mid:{hot:0,n:0},high:{hot:0,n:0}};
  recs.forEach(r=>{
    if(r.leadTemp==="Hot")o.hot++;else if(r.leadTemp==="Warm")o.warm++;else o.cold++;
    if(r.callback)o.callbacks++;
    if(classifyPhone(r.from).intl)o.intl++;else o.india++;
    o.totalDur+=r.dur;o.totalMsg+=r.msg;o.avgConf+=r.conf;o.avgNeed+=r.need;
    if(r.band==="Green")o.green++;else if(r.band==="Amber")o.amber++;else if(r.band==="Red")o.red++;
    o.hourly[r.h]=(o.hourly[r.h]||0)+1;
    o.daily[r.d]=(o.daily[r.d]||0)+1;
    o.intent[r.intent]=(o.intent[r.intent]||0)+1;
    const db=r.dur<30?"<30s":r.dur<60?"30-60s":r.dur<120?"1-2m":r.dur<180?"2-3m":"3m+";
    o.durBands[db]=(o.durBands[db]||0)+1;
    const cb=Math.round(r.conf/20)*20;o.confBands[cb]=(o.confBands[cb]||0)+1;
    if(r.leadTemp in confQual){confQual[r.leadTemp].conf+=r.conf;confQual[r.leadTemp].need+=r.need;confQual[r.leadTemp].n++;}
    if(r.msg<5)msgQual[0].push(r.leadTemp);else if(r.msg<=20)msgQual[1].push(r.leadTemp);else msgQual[2].push(r.leadTemp);
    // Confidence conversion bands
    const cband=r.conf<50?"low":r.conf<80?"mid":"high";
    confConv[cband].n++;if(r.leadTemp==="Hot")confConv[cband].hot++;
  });
  o.avgConf=o.n?o.avgConf/o.n:0;o.avgNeed=o.n?o.avgNeed/o.n:0;
  o.confQual=confQual;
  o.confConv=confConv;
  o.msgQual=msgQual.map(m=>{const h=m.length?(m.filter(x=>x==="Hot").length/m.length)*100:0;return{hot:h,n:m.length};});
  return o;
}

function healthScore(o){
  if(!o.n)return 0;
  const hotPct=(o.hot/o.n)*100,confPct=o.avgConf,greenPct=(o.green/o.n)*100;
  return Math.round(.4*hotPct+.3*confPct+.3*greenPct);
}

function gradeOf(s){
  if(s>=80)return["A",C.green,"Excellent — calls convert to hot leads, high confidence, quality holds."];
  if(s>=70)return["B",C.teal,"Strong — solid conversion to hot leads with good QA."];
  if(s>=60)return["C",C.gold,"Mixed — decent Anya confidence but conversion could improve."];
  if(s>=50)return["D",C.amber,"Needs work — Anya confidence is decent but lead capture is weak."];
  return["F",C.coral,"Critical — low conversion or Anya confidence issues."];
}

let CB_FILTERS=new Set(); // empty = show all; otherwise show only selected intents
let CB_RENDER_LIMIT=50;   // cap callback CARDS rendered at once; "Show more" raises it. The count above stays exact.
function paintCallbacks(recs){
  const cbCount=$("cbCount"),cbList=$("cbList"),cbFilters=$("cbFilters");
  if(!cbCount||!cbList||!cbFilters){console.warn("paintCallbacks: missing DOM elements");return;}
  const cbsAll=recs.filter(r=>r.callback);
  const readiness=$('cbReadiness');
  if(!cbsAll.length){cbCount.textContent="0 leads";cbList.innerHTML=emptyViewHtml("No requested follow-ups detected");cbFilters.innerHTML="";cbFilters.removeAttribute("data-active");if(readiness)readiness.innerHTML="";return;}
  const allByPhone=groupByPhone(cbsAll);
  paintFollowUpReadiness(allByPhone,recs);
  const byPhone=Object.fromEntries(Object.entries(allByPhone).filter(([,calls])=>CB_TIME_FILTER==='all'||(CB_TIME_FILTER==='timed'?callbackHasRequestedTime(calls):!callbackHasRequestedTime(calls))));
  const cbs=Object.values(byPhone).flat();
  if(!cbs.length){cbCount.textContent="0 leads";cbList.innerHTML=emptyViewHtml("No follow-ups match the selected readiness filter");cbFilters.innerHTML="";cbFilters.removeAttribute("data-active");return;}

  // Build multi-select intent filter chips (All + each intent)
  const intents=[...new Set(cbs.map(r=>r.intent))].sort();
  const showAll=CB_FILTERS.size===0;
  const allChip=`<button class="cbfilt ${showAll?"on":""}" aria-pressed="${showAll?"true":"false"}" data-filt="__all__">All</button>`;
  const intentChips=intents.map(i=>`<button class="cbfilt ${CB_FILTERS.has(i)?"on":""}" aria-pressed="${CB_FILTERS.has(i)?"true":"false"}" data-filt="${esc(i)}">${esc(i)}</button>`).join("");
  cbFilters.setAttribute("data-active",showAll?"all":"filtered");
  cbFilters.innerHTML=allChip+intentChips;
  cbFilters.querySelectorAll(".cbfilt").forEach(b=>b.onclick=()=>{
    const f=b.dataset.filt;
    if(f==="__all__"){
      CB_FILTERS.clear(); // reset to show everything
    }else{
      if(CB_FILTERS.has(f))CB_FILTERS.delete(f);else CB_FILTERS.add(f); // toggle this intent
    }
    paintCallbacks(recs);
  });

  // Filter and sort — empty set = all, otherwise match any selected intent
  const filtered={};
  Object.entries(byPhone).forEach(([ph,calls])=>{
    const filtered_calls=CB_FILTERS.size===0?calls:calls.filter(r=>CB_FILTERS.has(r.intent));
    if(filtered_calls.length>0){
      filtered[ph]=filtered_calls.sort((a,b)=>a.ts-b.ts);
    }
  });

  const visibleCallbackCount=Object.values(filtered).reduce((sum,arr)=>sum+arr.length,0);
  const visibleLeadCount=Object.keys(filtered).length;
  cbCount.textContent=`${visibleLeadCount} lead${visibleLeadCount===1?'':'s'} · ${visibleCallbackCount} request${visibleCallbackCount===1?'':'s'}`;

  // Cap the number of callback CARDS rendered (each card renders all of its calls, incl. hidden
  // "more" requests, so rendering every group at once was the single biggest filter-lag cost on
  // large datasets). The count above is still exact; "Show more" raises the cap for this view.
  const cbEntries=Object.entries(filtered).sort((a,b)=>b[1].length-a[1].length);
  const cbShown=cbEntries.slice(0,CB_RENDER_LIMIT);
  const cbHidden=cbEntries.length-cbShown.length;
  cbList.innerHTML=cbShown.map(([ph,calls])=>{
    const phoneKey=ph.replace(/\W/g,'_');
    const totalDur=sumBilledMinutes(calls);

    const renderCall=(c)=>`
      <div style="padding:10px;background:#ffffff;border-radius:6px;border-left:2px solid var(--teal);margin-bottom:6px;font-size:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><b style="color:var(--teal)">${formatCallTime(c)}</b>${directionPill(c.direction)}</div>
          <span style="color:var(--muted)">${formatDuration(c.dur)}</span>
        </div>
        <div style="color:var(--muted);margin-bottom:4px">${reducedAiViewEnabled()?'':`Conf ${Math.round(c.conf)}% | Need ${Math.round(c.need)} | `}${esc(c.cbReason)}</div>
        <div class="callback-preferred ${(!c.cbPreferred || c.cbPreferred==='Not specified')?'unspecified':''}"><span>Requested time</span><b>${esc(c.cbPreferred||'No time requested')}</b></div>
        ${c.summary?`<div style="color:#344054;line-height:1.6;border-top:1px solid var(--line2);padding-top:7px;margin-top:6px;font-size:12px">${esc(c.summary)}</div>`:""}
      </div>`;

    const latest=calls[calls.length-1]; // most recent (calls sorted ASC so last = newest)
    const rest=calls.slice(0,-1);       // everything except most recent
    const moreCount=rest.length;

    const moreSection=moreCount>0?`
      <div id="more_${phoneKey}" style="display:none">${rest.slice().reverse().map(renderCall).join("")}</div>
      <div class="inline-nonprofile-action" onclick="event.stopPropagation();const el=document.getElementById('more_${phoneKey}');const btn=document.getElementById('btn_${phoneKey}');if(el.style.display==='none'){el.style.display='block';btn.textContent='▲ Show less';}else{el.style.display='none';btn.textContent='▼ +${moreCount} more request${moreCount>1?'s':''}'}"
        id="btn_${phoneKey}"
        role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}"
        style="padding:7px;color:var(--teal);font-size:10px;text-align:center;cursor:pointer;border-top:1px solid #1a2332;margin-top:4px;user-select:none;border-radius:4px">
        ▼ +${moreCount} more request${moreCount>1?"s":""}
      </div>`:"";

    return`<div data-profile-source="callback" class="drawer-click-card callback-click-card" role="button" tabindex="0" onkeydown="handleDrawerCardKey(event)" onclick="openProfileForPhone(${jsArg(ph)},'callback',this)" style="background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:14px;margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:16px">
          <b style="font-family:'Inter',monospace;font-size:12px;color:var(--cream)">${esc(maskPhone(ph))}</b>
          <span style="font-size:10px;color:var(--teal);font-weight:600">${totalDur} mins</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end"><button type="button" class="profile-link-btn" onclick="event.stopPropagation();openProfileForPhone(${jsArg(ph)},'callback',this.closest('[data-profile-source]')||this)">Open profile</button><span style="background:var(--hot);color:#fff;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:800">${calls.length} request${calls.length>1?"s":""}</span></div>
      </div>
      ${directionMix(calls)}
      <div class="drawer-action-hint">Click anywhere on this follow-up card to open the full profile</div>
      ${renderCall(latest)}
      ${moreSection}
    </div>`;
  }).join("")+(cbHidden>0?`<div id="cbShowMore" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}" style="padding:12px;text-align:center;cursor:pointer;color:var(--teal);font-weight:800;font-size:12px;border:1px dashed var(--line);border-radius:10px;background:#fff">Show more — ${cbHidden.toLocaleString()} more lead${cbHidden>1?'s':''}</div>`:"");
  if(cbHidden>0){const mb=$("cbShowMore");if(mb)mb.onclick=()=>{CB_RENDER_LIMIT+=100;paintCallbacks(recs);};}
}



function parseIsoLocalDate(iso){
  if(!iso)return null;
  const parts=String(iso).split('-').map(Number);
  if(parts.length<3||parts.some(n=>!Number.isFinite(n)))return null;
  return new Date(parts[0],parts[1]-1,parts[2]);
}
function isoFromDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function addDays(d,days){const x=new Date(d);x.setDate(x.getDate()+days);return x;}
// Management Summary always reflects the main dashboard's current date filter -- no separate period
// picker to keep in sync with it.
function currentBriefRange(){
  const from=$('filterFromDate')?$('filterFromDate').value:'';
  const to=$('filterToDate')?$('filterToDate').value:'';
  return{from,to};
}
function previousRangeFor(fromIso,toIso){
  const from=parseIsoLocalDate(fromIso),to=parseIsoLocalDate(toIso);
  if(!from||!to)return null;
  const ms=24*60*60*1000;
  const days=Math.max(1,Math.round((to-from)/ms)+1);
  const prevTo=addDays(from,-1);
  const prevFrom=addDays(prevTo,-days+1);
  return{from:isoFromDate(prevFrom),to:isoFromDate(prevTo),days};
}
function recordsInRange(fromIso,toIso){
  return (ALL_RECORDS_BACKUP||[]).filter(r=>{
    if(!r.d)return false;
    if(fromIso && r.d<fromIso)return false;
    if(toIso && r.d>toIso)return false;
    if(SELECTED_DIRECTION!=='all' && normalizeDirection(r.direction)!==SELECTED_DIRECTION)return false;
    if(!recordMatchesCampaign(r))return false;
    return true;
  });
}
function keyForBriefLead(r){
  const key=(typeof ledgerPhoneKey==='function')?ledgerPhoneKey(r):String(r&&r.from||'').replace(/\D/g,'');
  return key&&key.length>=6?key:'';
}
function uniqueLeadCount(recs){return new Set(recs.map(keyForBriefLead).filter(Boolean)).size;}
function serialLeadCount(recs){
  const m=new Map();
  recs.forEach(r=>{const k=keyForBriefLead(r);if(k)m.set(k,(m.get(k)||0)+1);});
  return [...m.values()].filter(n=>n>=2).length;
}
function topIntentFor(recs){
  const m={};recs.forEach(r=>{m[r.intent]=(m[r.intent]||0)+1;});
  const top=Object.entries(m).sort((a,b)=>b[1]-a[1])[0];
  return top?{name:top[0],count:top[1]}:{name:'None',count:0};
}
function briefPack(recs){
  const mins=sumBilledMinutes(recs);
  return{n:recs.length,mins,cost:mins*5,unique:uniqueLeadCount(recs),callbacks:recs.filter(r=>r.callback).length,hot:recs.filter(r=>r.leadTemp==='Hot').length,serial:serialLeadCount(recs),friction:recs.filter(r=>r.frustrated).length,avgConf:recs.length?Math.round(recs.reduce((a,r)=>a+Number(r.conf||0),0)/recs.length):0,topIntent:topIntentFor(recs)};
}
function pctBrief(num,den){return den?Math.round(num/den*100):0;}
function deltaClass(cur,prev){if(cur>prev)return'up';if(cur<prev)return'down';return'flat';}
function deltaPctText(cur,prev){
  if(!prev&&cur)return'+100%';
  if(!prev&&!cur)return'0%';
  const pct=Math.round(((cur-prev)/prev)*100);
  return `${pct>0?'+':''}${pct}%`;
}
function paintManagementBrief(){
  if(!$('sec-overview'))return;
  const range=currentBriefRange();
  const recs=recordsInRange(range.from,range.to);
  const prevRange=previousRangeFor(range.from,range.to);
  const prev=prevRange?recordsInRange(prevRange.from,prevRange.to):[];
  const cur=briefPack(recs),old=briefPack(prev);
  const dateLabel=range.from&&range.to?(range.from===range.to?range.from:`${range.from} to ${range.to}`):currentViewDescription();
  const summary=$('briefSummary'),kpis=$('briefKpis');
  if(!cur.n){
    if(summary)summary.innerHTML=`No enquiries found for <b>${esc(dateLabel)}</b> in the ${esc(currentDirectionLabel())} view. Try a different date range or direction.`;
    if(kpis)kpis.innerHTML='';
    return;
  }
  const cbPct=pctBrief(cur.callbacks,cur.n),hotPct=pctBrief(cur.hot,cur.n);
  const serialPhrase=cur.serial?`${cur.serial} repeat lead${cur.serial>1?'s':''}`:'no repeat callers';
  if(summary){
    summary.innerHTML=reducedAiViewEnabled()
      ?`For <b>${esc(dateLabel)}</b>, ${esc(currentDirectionLabel())} is summarized below as an operating view. The main action areas are callback demand and the follow-up queue; the period showed <b>${serialPhrase}</b>.`
      :`For <b>${esc(dateLabel)}</b>, ${esc(currentDirectionLabel())} recorded <b>${cur.n} enquiries</b> from <b>${cur.unique} unique leads</b>, with a compact quality score of <b>${healthScore(aggregate(recs))}/100</b>. Callback demand stood at <b>${cur.callbacks}</b> requests (${cbPct}%), priority prospects were <b>${cur.hot}</b> (${hotPct}%), and the period showed <b>${serialPhrase}</b>. Top demand theme was <b>${esc(cur.topIntent.name)}</b>, with ${cur.friction} attention/friction signals for counsellor review.`;
  }
  const hasPrev=prev.length>0;
  // Bifurcate by direction so a leader can see the inbound/outbound mix behind each headline number
  // without having to flip the All/Inbound/Outbound toggle -- only meaningful in the "All calls" view,
  // since under a single-direction filter the split would trivially be 100/0.
  const showSplit=SELECTED_DIRECTION==='all';
  const curIn=showSplit?briefPack(recs.filter(r=>normalizeDirection(r.direction)==='inbound')):null;
  const curOut=showSplit?briefPack(recs.filter(r=>normalizeDirection(r.direction)==='outbound')):null;
  const kpiDefs=[
    ['good','Enquiries','n','count',()=>true],
    ['hot','Advisory minutes','mins','minutes',()=>true],
    ['hot','Estimated operating cost','cost','currency',()=>true],
    ['good','Unique leads','unique','ratio',()=>true],
    ['hot','Follow-up requests','callbacks','ratio',r=>r.callback],
    ['hot','Hot leads','hot','ratio',r=>r.leadTemp==='Hot']
  ];
  if(!reducedAiViewEnabled())kpiDefs.push(['good','AI confidence','avgConf','percent',()=>true],['neut','Attention signals','friction','ratio',r=>r.frustrated]);
  if(kpis)kpis.innerHTML=kpiDefs.map(([cls,label,key,format,pred])=>{
    const val=cur[key],prevVal=old[key];
    const fmt=(n,pack=cur)=>format==='percent'?n+'%':format==='minutes'?`${n} mins`:format==='currency'?`₹${n}`:format==='ratio'?`${n} <small>(${pctBrief(n,pack.n)}%)</small>`:n;
    const delta=hasPrev
      ?(()=>{const dc=deltaClass(val,prevVal),arrow=dc==='up'?'&uarr;':dc==='down'?'&darr;':'&rarr;';return `<div class="kpi-delta ${dc}">${arrow} ${esc(deltaPctText(val,prevVal))} vs previous period</div>`;})()
      :`<div class="kpi-delta flat">No prior-period data yet</div>`;
    const split=showSplit?`<div class="kpi-split"><span class="opf-dirdot opf-inbound"></span>${fmt(curIn[key],curIn)} in<span class="opf-dirdot opf-outbound"></span>${fmt(curOut[key],curOut)} out</div>`:'';
    return `<div class="kpi ${cls}" onclick="openFilteredPanel('${esc(label)}',${pred},window.__briefRecs)" style="cursor:pointer" title="${esc(metricDefinition(label))} Click for details" aria-label="${esc(label)}: ${esc(metricDefinition(label))}"><div class="b"></div><span style="position:absolute;top:8px;right:10px;font-size:11px;color:var(--faint)">⊕</span><div class="v">${fmt(val)}</div><div class="l">${esc(label)}</div>${delta}${split}</div>`;
  }).join('');
  window.__briefRecs=recs;
}
function printManagementBrief(){
  paintManagementBrief();
  setTimeout(()=>window.print(),80);
}

function boot(){
  if(!RECORDS.length){$("err").textContent="No valid call records found. Check your file format.";return;}
  window.DATA_LOADED=true;
  resetOutboundCaches();
  setDashboardReady();
  $("uploadView").style.display="none";$("reportView").style.display="block";window.scrollTo(0,0);setTimeout(()=>syncSidebarActive("sec-overview"),80);
  // Span the date range across ALL dials (incl. failed/initiated), so outbound connectivity for a day
  // with dials but no completed conversation is still inside the default range.
  const{min:dmin,max:dmax}=recordDateBounds(ALL_DIALS.length?ALL_DIALS:RECORDS);

  // Backup all records for filtering
  ALL_RECORDS_BACKUP=[...RECORDS];
  FILTERED_RECORDS=[...RECORDS];

  // Set date filter defaults
  $("filterFromDate").value=dmin;
  $("filterToDate").value=dmax;
  updateFilterButtons("all");
  updateDirectionButtons();
  populateCampaignFilter();

  // Match the filtered header on first load so the top context never changes shape.
  renderHeaderMeta(RECORDS);
  const o=aggregate(RECORDS);
  // Paint the top essentials first so the dashboard appears fast, then let the heavier sections
  // fill in on the next frame instead of blocking the initial render all at once.
  paintHealth(o);paintManagementBrief();paintFunnel(o);paintTempQual(o);paintDurBands(o);paintConfDist(o);paintConfImpact(o);
  const generation=++renderGeneration;
  CB_RENDER_LIMIT=50;
  runPaintChunks(generation,[
    ()=>paintIntents(o),()=>paintMsgImpact(o),()=>dayChart(o.daily),()=>hourChart(o.hourly),
    ()=>paintFrustBreak(o),()=>paintFrustCost(o),()=>paintHottestLeads(RECORDS),()=>paintSerialCallers(RECORDS),
    ()=>paintBandBars(o),()=>paintGeo(o),()=>paintDirectionSplit(),()=>paintDirectionCompare(),
    ()=>paintOutboundPerf(),()=>paintOutboundCadence(),()=>paintCampaignSection(),()=>paintIntentQuality(RECORDS),
    ()=>paintAnomalyCards(),()=>renderExplorer(true),
    ()=>{try{paintCallbacks(RECORDS);}catch(e){console.warn("paintCallbacks error:",e);}},
    ()=>{$("foot").innerHTML=reducedAiViewEnabled()
      ?`<b>Methodology.</b> Computed from Voice Export (${o.n} final unique Call-ID records). Operational totals and percentages are computed live from this session's data.`
      :`<b>Methodology.</b> Computed from Voice Export (${o.n} calls). Lead temp = Hot/Warm/Cold classification. Anya Conf. = model's confidence scores. Need Score = customer intent/urgency. Review Band = Green/Amber/Red QA classification. Intent mined from transcript. All conversions/percentages computed live from this session's data.`;}
  ],()=>setTimeout(()=>syncSidebarActive(),120));
}

function paintHealth(o){
  const s=healthScore(o);const[g,col,verdict]=gradeOf(s);
  const R=66,circ=2*Math.PI*R,frac=.75,track=`${frac*circ} ${circ}`,val=`${s/100*frac*circ} ${circ}`;
  $("gauge").innerHTML=`<svg viewBox="0 0 170 170" width="170" height="170">
    <g transform="rotate(135 85 85)"><circle cx="85" cy="85" r="${R}" fill="none" stroke="#e5eaf2" stroke-width="13" stroke-linecap="round" stroke-dasharray="${track}"/>
    <circle cx="85" cy="85" r="${R}" fill="none" stroke="${col}" stroke-width="13" stroke-linecap="round" stroke-dasharray="${val}" style="transition:stroke-dasharray .9s cubic-bezier(.2,.8,.2,1)"/></g>
    <text x="85" y="83" text-anchor="middle" fill="${C.cream}" font-family="Source Serif 4" font-size="42" font-weight="900">${s}</text>
    <text x="85" y="105" text-anchor="middle" fill="${C.muted}" font-family="Inter" font-size="10">QUALITY</text></svg>`;
  $("heroText").innerHTML=`<h3>Quality signal</h3><div class="verdict">${verdict}</div><p style="color:var(--muted);font-size:14px;max-width:680px;margin-top:8px">Composite of priority-prospect conversion (${o.n?Math.round(o.hot/o.n*100):0}%), AI confidence (${Math.round(o.avgConf)}%), and quality pass rate (${o.n?Math.round(o.green/o.n*100):0}%).</p>`;
}

function paintKPIs(o){
  const pct=a=>o.n?Math.round(a/o.n*100):0;
  const totalMins=sumBilledMinutes(RECORDS);
  const totalCost=totalMins*5;
  const avgDurMins=o.n?Math.floor(o.totalDur/o.n/60):0;
  const avgDurSecs=o.n?Math.round((o.totalDur/o.n)%60):0;
  const avgMsg=o.n?Math.round(o.totalMsg/o.n):0;
  // 4th field = drill-down key -- every KPI here is now a count/set over the same "all" record set,
  // even the averages (minutes, cost, duration), so clicking any of them shows what it was computed from.
  // Operational headline row. The follow-up queue and AI confidence intentionally live in the Management
  // Summary just below (with period-over-period trend + inbound/outbound split), so they're not repeated
  // here -- this row stays volume/cost/quality to avoid the top of the dashboard saying the same thing twice.
  const cards=[
    ["neut",o.n,"Total enquiries","all"],
    ["hot",totalMins+" mins","Advisory minutes","all"],
    ["hot","₹"+totalCost,"Estimated operating cost","all"],
    ["good",o.india+" India · "+o.intl+" International","India / International","geo"],
    ["good",avgDurMins+"m "+avgDurSecs+"s","Average enquiry duration","all"]
  ];
  if(!reducedAiViewEnabled())cards.push(["good",pct(o.green)+"%","Quality pass rate","green"]);
  $("kpis").innerHTML=cards.map(c=>{
    const definition=metricDefinition(c[2]);
    const clickable=c[3]?`onclick="openKpiPanel('${c[3]}')" style="cursor:pointer" title="${esc(definition)} Click for details" aria-label="${esc(c[2])}: ${esc(definition)}"`: `title="${esc(definition)}" aria-label="${esc(c[2])}: ${esc(definition)}"`;
    const arrow=c[3]?`<span style="position:absolute;top:8px;right:10px;font-size:11px;color:var(--faint)">⊕</span>`:"";
    return `<div class="kpi ${c[0]}" ${clickable}><div class="b"></div>${arrow}<div class="v">${c[1]}</div><div class="l">${c[2]}</div></div>`;
  }).join("");
}

// Smooth-scroll to a section and briefly highlight it
function jumpToSection(id){
  const el=document.getElementById(id);
  if(!el)return;
  scrollToWithStickyOffset(el);
  el.style.transition='box-shadow .3s';
  el.style.boxShadow='0 0 0 3px rgba(176,138,60,.26)';
  setTimeout(()=>{el.style.boxShadow='';},1500);
}

// ===== KPI DRILL-DOWN SIDEBAR =====
// Shared by the handful of hardcoded keys below (openKpiPanel) and by openFilteredPanel, which every
// other chart/bar/KPI across the dashboard calls directly with its own predicate -- one panel
// implementation, so every clickable number opens the same "here are the actual calls" view.
function closeKpiPanel(){
  $("kpiPanel").style.transform='translateX(100%)';
  $("kpiOverlay").style.display='none';
}
function activeFilterScopeLabel(){return currentViewDescription();}
function drawerScopeHtml(label='Dashboard scope'){
  return `<div class="drawer-scope-note"><b>${esc(label)}:</b> ${esc(activeFilterScopeLabel())}</div>`;
}
// Standard record -> CSV used by every drawer/section export, so a downloaded file always has the
// same columns wherever it came from. Phone is full (unmasked) for actioning the lead.
function recordsToCSV(rows,scopeLabel=activeFilterScopeLabel()){
  let csv='Call ID,Phone,Country,Direction,Call Time,Campaign,Status,Duration (mins),Lead Temp,Follow-up Requested,Requested Time,Intent,Failure Reason,Summary,Filter Scope\n';
  rows.forEach(r=>{
    const c=classifyPhone(r.from);
    csv+=[escCSV(r.callId),fullPhone(r.from),escCSV(c.country),escCSV(directionLabel(r.direction)),escCSV(formatCallTime(r)),
      escCSV(r.campaign),escCSV(r.status),Math.round(r.dur/60*10)/10,escCSV(r.leadTemp),r.callback?'Yes':'No',
      escCSV(r.cbPreferred||'Not specified'),escCSV(r.intent),escCSV(r.failReason),escCSV(r.summary),escCSV(scopeLabel)].join(',')+'\n';
  });
  return csv;
}
function slugForFile(s){return String(s||'export').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50)||'export';}
// Exports whatever record set the drill-down drawer is currently showing.
function exportPanelCSV(){
  const rows=window.__panelRows||[];
  if(!rows.length){alert("Nothing to export in this view.");return;}
  const scope=activeFilterScopeLabel();
  downloadCSV(slugForFile(window.__panelTitle)+'__'+slugForFile(scope)+'_'+csvDateStamp()+'.csv',recordsToCSV(rows,scope));
}
// Exports the calls shown in the lead-profile drawer.
function exportProfileCSV(){
  const rows=window.__profileCalls||[];
  if(!rows.length){alert("No calls to export for this lead.");return;}
  const scope=`Full lead history; active dashboard scope: ${activeFilterScopeLabel()}`;
  downloadCSV('lead_'+slugForFile(fullPhone(rows[0].from))+'__full-history_'+csvDateStamp()+'.csv',recordsToCSV(rows,scope));
}
function showKpiPanel(title,bodyHtml,rows){
  $("kpiPanelTitle").textContent=title;
  $("kpiPanelBody").innerHTML=drawerScopeHtml()+bodyHtml;
  window.__panelTitle=title;
  window.__panelRows=Array.isArray(rows)?rows:[];
  const btn=$("kpiPanelExport");
  if(btn)btn.style.display=window.__panelRows.length?'inline-flex':'none';
  const ledgerBtn=$("kpiPanelLedger");
  if(ledgerBtn)ledgerBtn.style.display=window.__panelRows.length?'inline-flex':'none';
  $("kpiOverlay").style.display='block';
  $("kpiPanel").style.transform='translateX(0)';
}
function openPanelInLedger(){
  const rows=window.__panelRows||[];if(!rows.length)return;
  LEDGER_SCOPE={title:window.__panelTitle||'Selected records',rows:rows.slice()};
  closeKpiPanel();clearLedgerFilters(false);renderExplorer(true);scrollToWithStickyOffset($('sec-explorer'),'auto');
}
function openProfileInLedger(){
  const rows=window.__profileCalls||[];if(!rows.length)return;
  LEDGER_SCOPE={title:`Lead ${maskPhone(rows[0].from)}`,rows:rows.slice()};
  closeUserSearch();clearLedgerFilters(false);renderExplorer(true);scrollToWithStickyOffset($('sec-explorer'),'auto');
}
function statsGridHtml(stats){
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">${stats.map(s=>`<div style="background:#f8fafc;border:1px solid var(--line);border-radius:8px;padding:12px"><div style="font-size:20px;font-weight:800;font-family:'Source Serif 4',serif;color:var(--teal)">${s[1]}</div><div style="font-size:10px;color:var(--muted);margin-top:2px">${esc(String(s[0]))}</div></div>`).join("")}</div>`;
}
function recordListHtml(rows){
  if(!rows.length)return emptyViewHtml("No calls match this selection");
  const sorted=rows.slice().sort((a,b)=>b.ts-a.ts).slice(0,100);
  return `<div style="font-size:11px;color:var(--muted);margin-bottom:8px">${rows.length} record${rows.length!==1?'s':''}${rows.length>100?' (showing latest 100)':''}</div>`+
    sorted.map(r=>{
      const tempCol=r.leadTemp==="Hot"?C.hot:r.leadTemp==="Warm"?C.warm:C.cold;
      return `<div onclick="closeKpiPanel();explorerOpen(${jsArg(r.from)})" style="padding:10px;border-bottom:1px solid var(--line);cursor:pointer;font-size:11px" onmouseover="this.style.background='#f6f8fc'" onmouseout="this.style.background=''">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px"><b style="font-family:'Inter',monospace;color:var(--cream)">${esc(maskPhone(r.from))}</b><span style="color:${tempCol};font-weight:600">${esc(r.leadTemp||"—")}</span></div>
        <div style="color:var(--muted);font-size:10px">${reducedAiViewEnabled()?'':esc(r.intent)+' · '}${formatDuration(r.dur)}${reducedAiViewEnabled()?'':' · Conf '+Math.round(r.conf)+'%'} · ${formatCallTime(r)}</div>
        ${r.summary?`<div style="color:var(--faint);font-size:10px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.summary)}</div>`:""}
      </div>`;
    }).join("");
}
function defaultDrillStats(rows){
  const n=rows.length;
  if(!n)return[["Matching calls",0]];
  const avgConf=Math.round(rows.reduce((a,r)=>a+r.conf,0)/n);
  const avgNeed=Math.round(rows.reduce((a,r)=>a+r.need,0)/n);
  const ratio=v=>`${v} (${percentOf(v,n)}%)`,hot=rows.filter(r=>r.leadTemp==="Hot").length,callbacks=rows.filter(r=>r.callback).length,intl=rows.filter(r=>classifyPhone(r.from).intl).length;
  const stats=[["Matching calls",n],["Follow-up queue",ratio(hot)],["Callbacks",ratio(callbacks)],["International",ratio(intl)]];
  if(!reducedAiViewEnabled())stats.splice(1,0,["Avg confidence",avgConf+"%"],["Avg need",avgNeed]);
  return stats;
}
// The one function nearly every chart/bar/KPI across the dashboard calls on click: filter down to the
// exact calls behind a number and show them. baseRows defaults to the current filtered view (RECORDS);
// pass a different base (e.g. outboundRecordsInView()) when the chart itself is scoped differently.
function openFilteredPanel(title,predicate,baseRows){
  const rows=(baseRows||RECORDS).filter(predicate);
  showKpiPanel(title, statsGridHtml(defaultDrillStats(rows)) + recordListHtml(rows), rows);
}
function openKpiPanel(key){
  // Build the record set + title for each drill-down key
  let title="",rows=[],stats=[];
  if(key==="all"){title="All Calls";rows=RECORDS.slice();}
  else if(key==="hot"){title="Follow-up queue";rows=RECORDS.filter(r=>r.leadTemp==="Hot");}
  else if(key==="green"){title="Quality-pass calls (Green)";rows=RECORDS.filter(r=>r.band==="Green");}
  else if(key==="geo"){title="Reach by geography";rows=RECORDS.filter(r=>classifyPhone(r.from).intl);} // intl records listed; india summarized in stats
  else if(key==="conf"){title="Assistant confidence";rows=RECORDS.slice();}

  const n=RECORDS.length||1;
  // Stat blocks per key
  if(key==="all"){
    const mins=sumBilledMinutes(RECORDS);
    const ratio=v=>`${v} (${percentOf(v,RECORDS.length)}%)`;
    stats=[["Total enquiries",RECORDS.length],["Total minutes",mins],["Follow-up queue",ratio(RECORDS.filter(r=>r.leadTemp==="Hot").length)],["Callbacks",ratio(RECORDS.filter(r=>r.callback).length)],["International",ratio(RECORDS.filter(r=>classifyPhone(r.from).intl).length)]];
    if(!reducedAiViewEnabled())stats.splice(3,0,["Attention signals",ratio(RECORDS.filter(r=>r.frustrated).length)]);
  }else if(key==="hot"){
    const h=rows;const avgC=h.length?Math.round(h.reduce((a,r)=>a+r.conf,0)/h.length):0;
    const callbacks=h.filter(r=>r.callback).length,intl=h.filter(r=>classifyPhone(r.from).intl).length;
    stats=[["Follow-up queue",`${h.length} (${percentOf(h.length,n)}%)`],["With callback",`${callbacks} (${percentOf(callbacks,h.length)}%)`],["International",`${intl} (${percentOf(intl,h.length)}%)`]];
    if(!reducedAiViewEnabled())stats.splice(1,0,["Avg confidence",avgC+"%"]);
  }else if(key==="green"){
    stats=[["Green (pass)",RECORDS.filter(r=>r.band==="Green").length],["Amber",RECORDS.filter(r=>r.band==="Amber").length],["Red",RECORDS.filter(r=>r.band==="Red").length],["Pass rate",Math.round(RECORDS.filter(r=>r.band==="Green").length/n*100)+"%"]];
  }else if(key==="geo"){
    const india=RECORDS.filter(r=>!classifyPhone(r.from).intl).length;
    const intl=rows.length;
    const byC={};rows.forEach(r=>{const c=classifyPhone(r.from);byC[c.country]=(byC[c.country]||0)+1;});
    stats=[["India",`${india} (${percentOf(india,n)}%)`],["International",`${intl} (${percentOf(intl,n)}%)`],...Object.entries(byC).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,`${v} (${percentOf(v,intl)}% of international)`])];
  }else if(key==="conf"){
    const cc={low:0,mid:0,high:0};RECORDS.forEach(r=>{cc[r.conf<50?"low":r.conf<80?"mid":"high"]++;});
    const avgC=Math.round(RECORDS.reduce((a,r)=>a+r.conf,0)/n);
    stats=[["Avg confidence",avgC+"%"],["High (≥80%)",`${cc.high} (${percentOf(cc.high,n)}%)`],["Mid (50-79%)",`${cc.mid} (${percentOf(cc.mid,n)}%)`],["Low (<50%)",`${cc.low} (${percentOf(cc.low,n)}%)`]];
  }

  const listHtml=key!=="conf"
    ?recordListHtml(rows)
    :`<p style="font-size:12px;color:var(--muted);line-height:1.6">Anya's confidence is the model's certainty in its answers. Higher confidence strongly correlates with hot leads — see the "Call outcomes by confidence" panel in Section 02 for the conversion breakdown.</p>`;
  showKpiPanel(title, statsGridHtml(stats)+listHtml, key!=="conf"?rows:[]);
}

function paintFunnel(o){
  if(!o.n){$("funnel").innerHTML=emptyViewHtml("No calls available for this view");return;}
  const pct=a=>Math.round(a/o.n*100);
  const F=[
    [o.n,"Calls started","#5a9bd8",100,()=>true],
    [o.callbacks,"Follow-up requested — intent signal",C.teal,Math.round(o.callbacks/o.n*60)+24,r=>r.callback],
    [o.hot,"Hot leads (conversion)",C.hot,Math.round(o.hot/o.n*60)+30,r=>r.leadTemp==='Hot'],
    [o.warm,"Warm (nurture)",C.warm,Math.round(o.warm/o.n*50)+20,r=>r.leadTemp==='Warm'],
    [o.cold,"Cold (low intent)",C.cold||"#5a7a9a",Math.round(o.cold/o.n*40)+12,r=>r.leadTemp!=='Hot'&&r.leadTemp!=='Warm']
  ];
  let h="";F.forEach((f,i)=>{h+=`<div class="fstep" style="background:${f[2]};width:${f[3]}%;cursor:pointer" onclick="openFilteredPanel('${esc(f[1])}',${f[4]})"><span class="fn">${f[0]}</span><span class="ft">${f[1]}</span><span class="fp">${pct(f[0])}%</span></div>`;});
  $("funnel").innerHTML=h;
}

function paintTempQual(o){
  const temps=[["Hot",o.confQual.Hot],["Warm",o.confQual.Warm],["Cold",o.confQual.Cold]];
  $("tempQual").innerHTML=temps.map(t=>{const e=t[1];const c=e.n?Math.round(e.conf/e.n):0,n=e.n?Math.round(e.need/e.n):0;return `<div style="margin-bottom:16px;cursor:pointer" onclick="openFilteredPanel('${t[0]} leads',r=>r.leadTemp==='${t[0]}')"><div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px"><span><b>${t[0]}</b> (${e.n} calls)</span><span style="color:var(--muted)">Conf <b>${c}%</b> · Need <b>${n}</b></span></div><div style="background:#0c121b;border-radius:5px;height:12px;overflow:hidden"><div style="background:${C.teal};height:100%;width:${Math.min(c/100*100,100)}%"></div></div></div>`;}).join("");
}

function paintConfDist(o){
  const sorted=Object.entries(o.confBands).sort((a,b)=>Number(a[0])-Number(b[0]));
  if(!sorted.length){$("confDist").innerHTML=`<div style="color:var(--faint);text-align:center;padding:20px;font-size:12.5px">No confidence data in this range.</div>`;return;}
  const max=Math.max(...sorted.map(d=>d[1]),1);
  $("confDist").innerHTML=sorted.map(d=>`<div style="margin-bottom:14px;cursor:pointer" onclick="openFilteredPanel('${d[0]}% confidence band',r=>Math.round(r.conf/20)*20===${Number(d[0])})"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span>${d[0]}% confidence</span><b>${d[1]} calls</b></div><div style="background:#0c121b;border-radius:5px;height:8px"><div style="background:linear-gradient(90deg,${C.teal},${C.green});height:100%;width:${d[1]/max*100}%"></div></div></div>`).join("");
}

function paintConfImpact(o){
  const cc=o.confConv;
  if(!cc||(cc.low.n+cc.mid.n+cc.high.n)===0){$("confImpact").innerHTML=`<div style="color:var(--faint);text-align:center;padding:30px">No data in this range.</div>`;return;}
  const pct=b=>b.n?Math.round(b.hot/b.n*100):0;
  const row=(label,band,col,pred)=>`<div style="padding:11px 0;border-bottom:1px solid var(--line);cursor:pointer" onclick="openFilteredPanel('${label.replace(/&lt;|&gt;/g,'')}',${pred})">
    <div style="font-size:13.5px;display:flex;justify-content:space-between;margin-bottom:5px"><span>${label} <span style="color:var(--faint)">(${band.n} calls)</span></span><b style="color:${col}">${pct(band)}% hot</b></div>
    <div style="background:#0c121b;border-radius:5px;height:6px"><div style="background:${col};height:100%;border-radius:5px;width:${pct(band)}%"></div></div>
  </div>`;
  $("confImpact").innerHTML=row("Low confidence (&lt;50%)",cc.low,C.muted,"r=>r.conf<50")+row("Mid confidence (50-80%)",cc.mid,C.teal,"r=>r.conf>=50&&r.conf<80")+row("High confidence (&gt;80%)",cc.high,C.green,"r=>r.conf>=80");
}

function paintIntents(o){
  const sorted=Object.entries(o.intent).filter(d=>d[1]>0).sort((a,b)=>b[1]-a[1]);
  if(!sorted.length){$("intents").innerHTML=`<div style="color:var(--faint);text-align:center;padding:20px;font-size:12.5px">No intent data in this range.</div>`;return;}
  $("intents").innerHTML=sorted.map(d=>`<div class="intitem" style="cursor:pointer" onclick="openFilteredPanel('${esc(d[0])} theme',r=>r.intent==='${esc(d[0]).replace(/'/g,"\\'")}')"><span class="in">${esc(d[0])}</span><span class="ct">${d[1]}</span></div>`).join("");
}

// ===== CONVERSION QUALITY BY INTENT =====
// For each mined intent, how the reached calls convert (hot-lead rate) vs. dead-end (red band / frustrated).
// "Hot leads produced" = the actual hot-lead count each intent contributes (volume x hot rate), so a rare
// but high-converting topic and a high-volume workhorse are both visible. Reflects current date+direction view.
let INTENT_Q_SORT='produced'; // 'produced' | 'hotPct' | 'n'
function setIntentQSort(k){INTENT_Q_SORT=k;paintIntentQuality(RECORDS);}
function paintIntentQuality(recs){
  const el=$('intentQuality'),ctrl=$('intentQualityControls');
  if(!el)return;
  const total=recs.length;
  if(!total){if(ctrl)ctrl.innerHTML='';el.innerHTML=emptyViewHtml('No calls in this view.');return;}
  // Count per UNIQUE LEAD, not per call: a number that discussed a topic counts once for that topic
  // (deduping redials/repeat calls), and is "hot" for the topic if any of its calls on that topic
  // went hot. A lead that discussed several topics counts under each — so this answers "of the leads
  // who asked about X, how many converted" without a repeatedly-dialled number inflating the rate.
  const byPhone=groupByPhone(recs);
  const totalLeads=Object.keys(byPhone).length;
  const g={};
  Object.values(byPhone).forEach(calls=>{
    const seen={};
    calls.forEach(c=>{(seen[c.intent||'General']||(seen[c.intent||'General']=[])).push(c);});
    Object.entries(seen).forEach(([k,kc])=>{
      const b=g[k]||(g[k]={intent:k,n:0,hot:0,red:0,frust:0,confSum:0,needSum:0});
      b.n++;
      if(kc.some(c=>c.leadTemp==='Hot'))b.hot++;
      if(kc.some(c=>c.band==='Red'))b.red++;
      if(kc.some(c=>c.frustrated))b.frust++;
      b.confSum+=kc.reduce((a,c)=>a+Number(c.conf||0),0)/kc.length;
      b.needSum+=kc.reduce((a,c)=>a+Number(c.need||0),0)/kc.length;
    });
  });
  let arr=Object.values(g).map(b=>({intent:b.intent,n:b.n,share:Math.round(b.n/totalLeads*100),
    hotPct:Math.round(b.hot/b.n*100),redPct:Math.round(b.red/b.n*100),
    conf:Math.round(b.confSum/b.n),need:Math.round(b.needSum/b.n),frustPct:Math.round(b.frust/b.n*100),
    produced:b.hot}));
  const floor=Math.max(10,Math.round(totalLeads*0.01));
  const hotLeadsTotal=Object.values(byPhone).filter(calls=>calls.some(c=>c.leadTemp==='Hot')).length;
  const overallHotPct=totalLeads?Math.round(hotLeadsTotal/totalLeads*100):0;
  const gem=arr.filter(x=>x.n>=floor).slice().sort((a,b)=>b.hotPct-a.hotPct)[0];
  // Dead-zone: a high-volume intent converting at well under half the overall hot rate.
  const deadCut=Math.max(5,Math.round(overallHotPct*0.5));
  const dead=arr.filter(x=>x.hotPct<deadCut && x.share>=15).sort((a,b)=>b.n-a.n)[0];
  arr.sort((a,b)=>b[INTENT_Q_SORT]-a[INTENT_Q_SORT]||b.n-a.n);
  window.__iqGroups={};
  arr.forEach(x=>{window.__iqGroups[x.intent]=recs.filter(r=>(r.intent||'General')===x.intent);});
  const maxHot=Math.max(...arr.map(x=>x.hotPct),1),maxRed=Math.max(...arr.map(x=>x.redPct),1);
  if(ctrl)ctrl.innerHTML=[['produced','Hot leads produced'],['hotPct','Hot-lead rate'],['n','Volume']]
    .map(t=>`<button type="button" class="${INTENT_Q_SORT===t[0]?'on':''}" onclick="setIntentQSort('${t[0]}')">${t[1]}</button>`).join('');
  const insight=(gem||dead)?`<div class="iq-insight">`+
    (gem?`<div class="iq-ins gem"><div class="t">Highest-converting topic</div><div class="h">${esc(gem.intent)} — ${gem.hotPct}% hot</div><div class="d"><b>${gem.n.toLocaleString()} leads</b> (${gem.share}% of all leads), converting at <b>${gem.hotPct}%</b> with avg confidence ${gem.conf} and need ${gem.need}. Prioritise routing these to a counsellor.</div></div>`:'')+
    (dead?`<div class="iq-ins dead"><div class="t">Conversion dead-zone</div><div class="h">${esc(dead.intent)} — ${dead.hotPct}% hot</div><div class="d"><b>${dead.n.toLocaleString()} leads</b> (${dead.share}% of all leads) but only <b>${dead.hotPct}% hot</b>, ${dead.redPct}% red-band, ${dead.frustPct}% frustrated. A big share of reach spent where little converts.</div></div>`:'')+
    `</div>`:'';
  const rows=arr.map(x=>{
    const chip=gem&&x.intent===gem.intent?'<span class="iq-chip gem">TOP</span>':dead&&x.intent===dead.intent?'<span class="iq-chip dead">DEAD-ZONE</span>':'';
    return `<tr class="iq-row" onclick="openFilteredPanel('${esc(x.intent)} — conversion',()=>true,window.__iqGroups['${esc(x.intent).replace(/'/g,"\\'")}'])">`+
      `<td><span class="iq-name">${esc(x.intent)}</span>${chip}<div class="iq-sub">${x.frustPct}% frustrated · avg need ${x.need}</div></td>`+
      `<td class="num">${x.n.toLocaleString()}<div class="iq-sub">${x.share}% of all leads</div></td>`+
      `<td><div class="iq-barwrap iq-hot"><div class="iq-bartrack"><div class="iq-barfill" style="width:${Math.round(x.hotPct/maxHot*100)}%"></div></div><span class="iq-barval">${x.hotPct}%</span></div></td>`+
      `<td class="iq-hidecol"><div class="iq-barwrap iq-red"><div class="iq-bartrack"><div class="iq-barfill" style="width:${Math.round(x.redPct/maxRed*100)}%"></div></div><span class="iq-barval">${x.redPct}%</span></div></td>`+
      `<td class="num iq-hidecol">${x.conf}</td>`+
      `<td class="num"><span class="iq-produced">${x.produced.toLocaleString()}</span></td></tr>`;
  }).join('');
  el.innerHTML=insight+`<div style="overflow-x:auto"><table class="iq-table"><thead><tr>`+
    `<th>Intent</th><th class="num">Leads</th><th>Hot-lead rate</th><th class="iq-hidecol">Red-band rate</th><th class="num iq-hidecol">Avg conf.</th><th class="num">Hot leads produced</th>`+
    `</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function paintDurBands(o){
  const order={"3m+":0,"2-3m":1,"1-2m":2,"30-60s":3,"<30s":4};
  const sorted=Object.entries(o.durBands).filter(d=>d[1]).sort((a,b)=>(order[a[0]]??9)-(order[b[0]]??9));
  if(!sorted.length){$("durBands").innerHTML=`<div style="color:var(--faint);text-align:center;padding:20px">No duration data.</div>`;return;}
  const max=Math.max(...sorted.map(d=>d[1]),1);
  const col={"<30s":C.muted,"30-60s":C.blue,"1-2m":C.teal,"2-3m":C.amber,"3m+":C.hot};
  const durPred={"<30s":"r=>r.dur<30","30-60s":"r=>r.dur>=30&&r.dur<60","1-2m":"r=>r.dur>=60&&r.dur<120","2-3m":"r=>r.dur>=120&&r.dur<180","3m+":"r=>r.dur>=180"};
  $("durBands").innerHTML=sorted.map(d=>`<div style="margin-bottom:13px;cursor:pointer" onclick="openFilteredPanel('${d[0]} duration',${durPred[d[0]]})"><div style="font-size:12.5px;margin-bottom:5px;display:flex;justify-content:space-between"><span>${d[0]}</span><b>${d[1]} calls</b></div><div style="background:#0c121b;border-radius:5px;height:8px"><div style="background:${col[d[0]]||C.teal};height:100%;width:${d[1]/max*100}%"></div></div></div>`).join("");
}

function paintMsgImpact(o){
  if(!o.msgQual||!o.msgQual[0]||!o.msgQual[0].n){$("msgImpact").innerHTML=`<div style="color:var(--faint);text-align:center;padding:30px">Insufficient data in this range.</div>`;return;}
  const h0=o.msgQual[0].hot||0;
  const h1=o.msgQual[1]?.hot||0;
  const h2=o.msgQual[2]?.hot||0;
  $("msgImpact").innerHTML=`<div style="padding:11px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;cursor:pointer" onclick="openFilteredPanel('Short conversations (&lt;5 msg)',r=>r.msg<5)"><span style="font-size:13px">Short (&lt;5 msg)</span><b style="color:${C.muted}">${Math.round(h0)}% hot</b></div>
    <div style="padding:11px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;cursor:pointer" onclick="openFilteredPanel('Medium conversations (5-20 msg)',r=>r.msg>=5&&r.msg<=20)"><span style="font-size:13px">Medium (5-20 msg)</span><b style="color:${C.teal}">${Math.round(h1)}% hot</b></div>
    <div style="padding:11px 0;display:flex;justify-content:space-between;cursor:pointer" onclick="openFilteredPanel('Long conversations (&gt;20 msg)',r=>r.msg>20)"><span style="font-size:13px">Long (&gt;20 msg)</span><b style="color:${C.hot}">${Math.round(h2)}% hot</b></div>`;
}

function dayChart(daily){
  const entries=Object.entries(daily).sort((a,b)=>a[0]<b[0]?-1:1);const W=520,H=260,P={l:30,r:14,t:18,b:46};
  if(!entries.length){$("dayChart").innerHTML=`<div style="color:var(--faint);text-align:center;padding:40px;font-size:12.5px">No call data in this range.</div>`;return;}
  const max=Math.max(...entries.map(e=>e[1]),5);const bw=(W-P.l-P.r)/entries.length,y=v=>H-P.b-(v/max)*(H-P.t-P.b);
  let gy="";for(let i=0;i<=max;i+=Math.ceil(max/4)){gy+=`<line x1="${P.l}" y1="${y(i)}" x2="${W-P.r}" y2="${y(i)}" stroke="${C.line}"/><text x="${P.l-6}" y="${y(i)+3}" fill="${C.muted}" font-size="9" text-anchor="end" font-family="Inter">${i}</text>`;}
  // Smart x-labels: for long ranges, label every Nth day so they don't overlap or vanish
  const step=entries.length<=7?1:entries.length<=14?2:entries.length<=31?Math.ceil(entries.length/8):Math.ceil(entries.length/6);
  const bars=entries.map((d,i)=>{
    const bx=P.l+i*bw+bw*0.15,w=Math.max(3,bw*0.7),h=(d[1]/max)*(H-P.t-P.b);
    const showLbl=(i%step===0)||i===entries.length-1;
    const lbl=showLbl?`<text x="${bx+w/2}" y="${H-P.b+14}" fill="${C.muted}" font-size="8.5" text-anchor="middle" font-family="Inter" transform="rotate(35 ${bx+w/2} ${H-P.b+14})">${d[0].slice(5)}</text>`:"";
    const valLbl=entries.length<=14?`<text x="${bx+w/2}" y="${y(d[1])-6}" fill="${C.cream}" font-size="9.5" text-anchor="middle" font-family="Inter">${d[1]}</text>`:"";
    return `<rect x="${bx}" y="${y(d[1])}" width="${w}" height="${Math.max(0,h)}" rx="2" fill="${C.teal}" style="cursor:pointer" onclick="showChartDetail('day','${d[0]}',${d[1]})"><title>${d[0]}: ${d[1]} calls</title></rect>${valLbl}${lbl}`;
  }).join("");
  $("dayChart").innerHTML=`<svg class="chart" viewBox="0 0 ${W} ${H}">${gy}${bars}</svg><div id="dayDetail" style="margin-top:8px;font-size:11px;color:var(--teal);min-height:16px;text-align:center"></div>`;
}

function hourChart(hourly){
  const W=520,H=240,P={l:30,r:14,t:16,b:28};const vals=[];for(let h=0;h<24;h++)vals.push(hourly[h]||0);
  if(vals.every(v=>v===0)){$("hourChart").innerHTML=`<div style="color:var(--faint);text-align:center;padding:40px;font-size:12.5px">No call data in this range.</div>`;return;}
  const max=Math.max(...vals,4);const x=h=>P.l+(h/23)*(W-P.l-P.r),y=v=>H-P.b-(v/max)*(H-P.t-P.b);
  const pts=vals.map((v,h)=>`${x(h)},${y(v)}`).join(" ");const area=`M${x(0)},${H-P.b} L${pts} L${x(23)},${H-P.b} Z`;
  let gy="";for(let i=0;i<=max;i+=Math.ceil(max/4)){gy+=`<line x1="${P.l}" y1="${y(i)}" x2="${W-P.r}" y2="${y(i)}" stroke="${C.line}"/><text x="${P.l-6}" y="${y(i)+3}" fill="${C.muted}" font-size="9" text-anchor="end" font-family="Inter">${i}</text>`;}
  let gx="";[0,4,8,12,16,20,23].forEach(h=>{gx+=`<text x="${x(h)}" y="${H-10}" fill="${C.muted}" font-size="9" text-anchor="middle" font-family="Inter">${h===0?'12a':h<12?h+'a':h===12?'12p':(h-12)+'p'}</text>`;});
  // Larger tappable hit-areas (invisible) over each point for mobile
  const dots=vals.map((v,h)=>`<circle cx="${x(h)}" cy="${y(v)}" r="14" fill="transparent" style="cursor:pointer" onclick="showChartDetail('hour',${h},${v})"></circle><circle cx="${x(h)}" cy="${y(v)}" r="3.5" fill="${C.teal}" style="pointer-events:none"><title>${h%12||12}${h<12?'AM':'PM'}: ${v} calls</title></circle>`).join("");
  $("hourChart").innerHTML=`<svg class="chart" viewBox="0 0 ${W} ${H}">${gy}${gx}<defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.teal}" stop-opacity="0.35"/><stop offset="1" stop-color="${C.teal}" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#hg)"/><polyline points="${pts}" fill="none" stroke="${C.teal}" stroke-width="2" style="pointer-events:none"/>${dots}</svg><div id="hourDetail" style="margin-top:8px;font-size:11px;color:var(--teal);min-height:16px;text-align:center"></div>`;
}

// Tap-to-reveal detail under the charts
function showChartDetail(type,key,val){
  if(type==='day'){
    const el=$("dayDetail");if(!el)return;
    const dt=new Date(key);const wd=isNaN(dt)?"":dt.toLocaleDateString('en-IN',{weekday:'long'});
    el.innerHTML=`Date <b>${key}</b>${wd?" ("+wd+")":""} — <b>${val}</b> call${val!==1?'s':''}`;
    openFilteredPanel(`${key} calls`,r=>r.d===key);
  }else{
    const el=$("hourDetail");if(!el)return;
    const h=key;const label=`${h%12||12}:00 ${h<12?'AM':'PM'} – ${(h+1)%12||12}:00 ${(h+1)<12||(h+1)===24?'AM':'PM'}`;
    el.innerHTML=`Hour <b>${label}</b> — <b>${val}</b> call${val!==1?'s':''}`;
    openFilteredPanel(`${label} calls`,r=>r.h===h);
  }
}

function paintBandBars(o){
  const tot=o.green+o.amber+o.red;
  if(!tot){$("bandBars").innerHTML=`<div style="color:var(--faint);text-align:center;padding:20px;font-size:12.5px">No review band data in this range.</div>`;return;}
  const data=[{l:"Green (pass)",v:o.green,c:C.green,b:"Green"},{l:"Amber (review)",v:o.amber,c:C.amber,b:"Amber"},{l:"Red (fail)",v:o.red,c:C.hot,b:"Red"}];
  $("bandBars").innerHTML=data.map(d=>`<div style="margin-bottom:15px;cursor:pointer" onclick="openFilteredPanel('${d.l}',r=>r.band==='${d.b}')"><div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px"><span>${d.l}</span><b>${Math.round(d.v/tot*100)}% · ${d.v}</b></div><div style="background:#0c121b;border-radius:5px;height:9px"><div style="background:${d.c};height:100%;width:${d.v/tot*100}%"></div></div></div>`).join("");
}

function paintGeo(o){
  const tot=o.india+o.intl;
  if(!tot){$("geoSplit").innerHTML=`<div style="color:var(--faint);text-align:center;padding:20px;font-size:12.5px">No data in this range.</div>`;$("geoCountries").innerHTML="";return;}
  // Adaptive: with no international leads, collapse to a single domestic line and drop the (empty)
  // country breakdown, so an all-India view isn't a half-empty section. The full split + country
  // breakdown returns automatically the moment any international lead appears.
  if(o.intl===0){
    $("geoSplit").innerHTML=`<div style="display:flex;justify-content:space-between;align-items:baseline;font-size:13.5px;cursor:pointer" onclick="openFilteredPanel('India leads',r=>!classifyPhone(r.from).intl)"><span>All domestic (India)</span><b>100% · ${o.india.toLocaleString()} · 0 international</b></div>`;
    $("geoCountries").innerHTML=`<div style="color:var(--faint);font-size:12.5px;padding:6px 0">No international leads in this range — the country breakdown appears here when international leads are present.</div>`;
    return;
  }
  const split=[{l:"India",v:o.india,c:C.teal,intl:false},{l:"International",v:o.intl,c:C.warm,intl:true}];
  $("geoSplit").innerHTML=split.map(d=>`<div style="margin-bottom:15px;cursor:pointer" onclick="openFilteredPanel('${d.l} leads',r=>classifyPhone(r.from).intl===${d.intl})"><div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px"><span>${d.l}</span><b>${Math.round(d.v/tot*100)}% · ${d.v}</b></div><div style="background:#0c121b;border-radius:5px;height:9px"><div style="background:${d.c};height:100%;width:${d.v/tot*100}%"></div></div></div>`).join("");

  // International leads grouped by country
  const byCountry={};
  RECORDS.forEach(r=>{
    const c=classifyPhone(r.from);
    if(c.intl){const k=`${esc(c.country)}`;byCountry[k]=(byCountry[k]||0)+1;}
  });
  const entries=Object.entries(byCountry).sort((a,b)=>b[1]-a[1]);
  if(!entries.length){$("geoCountries").innerHTML=`<div style="color:var(--faint);text-align:center;padding:20px;font-size:12.5px">No international leads in this range.</div>`;return;}
  const max=Math.max(...entries.map(e=>e[1]),1);
  const intlTotal=entries.reduce((a,[,v])=>a+v,0);
  $("geoCountries").innerHTML=entries.map(([k,v])=>`<div style="margin-bottom:12px;cursor:pointer" onclick="openFilteredPanel('${k}',r=>esc(classifyPhone(r.from).country)==='${k}')"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span>${k}</span><b>${v} · ${percentOf(v,intlTotal)}%</b></div><div style="background:#0c121b;border-radius:5px;height:7px"><div style="background:${C.warm};height:100%;width:${v/max*100}%"></div></div></div>`).join("");
}

function exportGeo(){
  const intl=RECORDS.filter(r=>classifyPhone(r.from).intl);
  if(!intl.length){alert("No international leads to export in this range.");return;}
  const scope=`${activeFilterScopeLabel()} · International leads only`;
  downloadCSV('international_leads_'+csvDateStamp()+'.csv',recordsToCSV(intl.sort((a,b)=>b.ts-a.ts),scope));
}

// ===== CALL EXPLORER =====
const LEDGER_DEFAULT_STATE={search:"",sort:"time_desc",limit:50};
let LEDGER_STATE={search:"",filters:new Set(),sort:"time_desc",limit:50};
let LEDGER_SCOPE=null;
let EXPLORER_LIMIT=LEDGER_STATE.limit;
const LEDGER_FILTER_LABELS={hot:"Hot only",frustrated:"Attention only",callback:"Follow-up requested",intl:"International",india:"India",low_conf:"Low confidence",red_amber:"Red / Amber",has_transcript:"Has transcript",no_transcript:"No transcript",has_callback_window:"Requested time",serial:"Serial caller"};
// Chips within a group combine with OR; the groups themselves combine with AND (facet-search semantics),
// so e.g. "Hot" + "India" narrows to hot leads in India, while "Has transcript" + "No transcript" (same
// group) reads as either -- selecting a mutually-exclusive pair is equivalent to not filtering on it.
const LEDGER_FILTER_GROUPS={hot:"quality",low_conf:"quality",red_amber:"quality",frustrated:"signals",callback:"signals",has_callback_window:"signals",serial:"signals",india:"geo",intl:"geo",has_transcript:"trans",no_transcript:"trans"};
const LEDGER_SORT_LABELS={time_desc:"Newest first",priority_desc:"Priority first",callback_desc:"Callback first",time_asc:"Oldest first",dur_desc:"Longest duration",dur_asc:"Shortest duration",cost_desc:"Highest estimated call cost",cost_asc:"Lowest estimated call cost",conf_desc:"Highest confidence",low_conf:"Low confidence first",need_desc:"Highest need",intl_desc:"International first",repeat_desc:"Most repeated first"};

function syncLedgerControls(){
  const s=$("explorerSearch"), sort=$("explorerSort");
  if(s && s.value!==LEDGER_STATE.search)s.value=LEDGER_STATE.search;
  if(sort && sort.value!==LEDGER_STATE.sort)sort.value=LEDGER_STATE.sort;
  document.querySelectorAll("#explorerFilterChips .cbfilt").forEach(btn=>{
    const on=LEDGER_STATE.filters.has(btn.dataset.f);
    btn.classList.toggle("on",on);
    btn.setAttribute("aria-pressed",on?"true":"false");
  });
}

function updateLedgerState(partial={}, opts={}){
  const isLedgerNarrowingChange=(partial.filters!==undefined || partial.search!==undefined) && partial.sort===undefined;
  LEDGER_STATE={...LEDGER_STATE,...partial};
  if(partial.search!==undefined)LEDGER_STATE.search=String(partial.search||"");
  // Filters and search should narrow the ledger, not silently change the working order.
  // Operational default is always latest calls first unless the user explicitly chooses a special sort.
  if(isLedgerNarrowingChange)LEDGER_STATE.sort="time_desc";
  if(opts.reset!==false){LEDGER_STATE.limit=50;EXPLORER_LIMIT=50;}
  syncLedgerControls();
  renderExplorer(false);
}

function toggleLedgerFilter(key){
  const filters=new Set(LEDGER_STATE.filters);
  if(filters.has(key))filters.delete(key); else filters.add(key);
  updateLedgerState({filters});
}

function clearLedgerScope(render=true){LEDGER_SCOPE=null;if(render)renderExplorer(true);}
function clearLedgerFilters(clearScope=true){
  if(clearScope)LEDGER_SCOPE=null;
  LEDGER_STATE={search:"",filters:new Set(),sort:LEDGER_DEFAULT_STATE.sort,limit:LEDGER_DEFAULT_STATE.limit};
  EXPLORER_LIMIT=50;
  syncLedgerControls();
  renderExplorer(false);
}

let LEDGER_REPEAT_CACHE=null;
let LEDGER_REPEAT_CACHE_SOURCE=null;
let LEDGER_REPEAT_CACHE_LENGTH=-1;
function invalidateLedgerRepeatCache(){
  LEDGER_REPEAT_CACHE=null;
  LEDGER_REPEAT_CACHE_SOURCE=null;
  LEDGER_REPEAT_CACHE_LENGTH=-1;
}
function ledgerPhoneKey(r){
  const c=classifyPhone(r?.from);
  const normalized=String((c.cc||"")+(c.national||"")).replace(/\D/g,"");
  const raw=String(r?.from||"").replace(/\D/g,"");
  const key=normalized || raw;
  // Do not group blank/weak/unknown phone values as serial callers.
  // Short keys create false repeat groups and can make the ledger feel broken.
  return key && key.length>=6 ? key : "";
}
function ledgerRepeatMap(){
  if(LEDGER_REPEAT_CACHE && LEDGER_REPEAT_CACHE_SOURCE===RECORDS && LEDGER_REPEAT_CACHE_LENGTH===RECORDS.length){
    return LEDGER_REPEAT_CACHE;
  }
  const map=new Map();
  RECORDS.forEach(r=>{
    const key=ledgerPhoneKey(r);
    if(!key)return;
    const cur=map.get(key)||{count:0,latest:0};
    cur.count+=1;
    cur.latest=Math.max(cur.latest,Number(r.ts||0));
    map.set(key,cur);
  });
  LEDGER_REPEAT_CACHE=map;
  LEDGER_REPEAT_CACHE_SOURCE=RECORDS;
  LEDGER_REPEAT_CACHE_LENGTH=RECORDS.length;
  return map;
}
function ledgerRepeatInfo(r){
  const key=ledgerPhoneKey(r);
  if(!key)return {count:1,latest:Number(r?.ts||0)};
  const info=ledgerRepeatMap().get(key);
  return info||{count:1,latest:Number(r?.ts||0)};
}
function ledgerIsSerialCaller(r){return ledgerRepeatInfo(r).count>=2;}
function ledgerHasTranscript(r){return !!String(r?.trans||"").trim();}
function ledgerCallCost(r){return normalizeDisposition(r)==='connected'?billedMinutes(r?.dur)*5:0;}
function ledgerHasCallbackWindow(r){return !!(r?.cbPreferred && r.cbPreferred!=="Not specified");}
function ledgerPriorityScore(r){
  const tier=r.leadTemp==="Hot"?300:r.leadTemp==="Warm"?150:0;
  const attention=r.frustrated?70:0;
  const callback=r.callback?90:0;
  const intl=classifyPhone(r.from).intl?30:0;
  return tier+callback+attention+intl+Number(r.need||0)+(Number(r.conf||0)/10);
}
function ledgerSearchBlob(r){
  const c=classifyPhone(r.from);
  const rawPhone=String(r.from||"");
  const digits=rawPhone.replace(/\D/g,"");
  const normalizedPhone=(c.cc||"")+(c.national||"");
  return [
    rawPhone,digits,normalizedPhone,fullPhone(r.from),maskPhone(r.from),
    c.country,c.cc,c.flag,c.intl?"international":"india",
    directionLabel(r.direction),normalizeDirection(r.direction),
    r.intent,r.summary,r.leadTemp,r.band,r.status,
    r.callback?"callback follow up":"",r.frustrated?"attention frustrated issue":"",
    ledgerIsSerialCaller(r)?`serial repeat caller ${ledgerRepeatInfo(r).count} calls`:"",
    r.cbReason,r.cbPreferred,r.trans,
    String(Math.round(Number(r.conf||0))),String(Math.round(Number(r.need||0)))
  ].filter(Boolean).join(" ").toLowerCase();
}
function ledgerMatchesFilter(r, filt){
  const c=classifyPhone(r.from);
  if(filt==="hot")return r.leadTemp==="Hot";
  if(filt==="frustrated")return !!r.frustrated;
  if(filt==="callback")return !!r.callback;
  if(filt==="intl")return !!c.intl;
  if(filt==="india")return !c.intl;
  if(filt==="low_conf")return Number(r.conf||0)<50;
  if(filt==="red_amber")return /^(Red|Amber)$/i.test(String(r.band||""));
  if(filt==="has_transcript")return ledgerHasTranscript(r);
  if(filt==="no_transcript")return !ledgerHasTranscript(r);
  if(filt==="has_callback_window")return ledgerHasCallbackWindow(r);
  if(filt==="serial")return ledgerIsSerialCaller(r);
  return true;
}
function ledgerMatchesActiveFilters(r){
  if(!LEDGER_STATE.filters.size)return true;
  const byGroup={};
  LEDGER_STATE.filters.forEach(f=>{
    const g=LEDGER_FILTER_GROUPS[f]||f;
    (byGroup[g]=byGroup[g]||[]).push(f);
  });
  return Object.values(byGroup).every(fs=>fs.some(f=>ledgerMatchesFilter(r,f)));
}
function getExplorerRows(){
  const q=String(LEDGER_STATE.search||"").trim().toLowerCase();
  const sort=LEDGER_STATE.sort||"time_desc";
  let rows=(LEDGER_SCOPE?.rows||RECORDS).slice().filter(ledgerMatchesActiveFilters);
  if(q){
    const terms=q.split(/\s+/).filter(Boolean);
    rows=rows.filter(r=>{
      const blob=ledgerSearchBlob(r);
      return terms.every(t=>blob.includes(t));
    });
  }
  const sorters={
    time_desc:(a,b)=>b.ts-a.ts,
    priority_desc:(a,b)=>ledgerPriorityScore(b)-ledgerPriorityScore(a)||b.ts-a.ts,
    callback_desc:(a,b)=>(Number(!!b.callback)-Number(!!a.callback))||b.ts-a.ts,
    time_asc:(a,b)=>a.ts-b.ts,
    dur_desc:(a,b)=>(Number(b.dur||0)-Number(a.dur||0))||b.ts-a.ts,
    dur_asc:(a,b)=>(Number(a.dur||0)-Number(b.dur||0))||b.ts-a.ts,
    cost_desc:(a,b)=>ledgerCallCost(b)-ledgerCallCost(a)||b.ts-a.ts,
    cost_asc:(a,b)=>ledgerCallCost(a)-ledgerCallCost(b)||b.ts-a.ts,
    conf_desc:(a,b)=>(Number(b.conf||0)-Number(a.conf||0))||b.ts-a.ts,
    low_conf:(a,b)=>(Number(a.conf||0)-Number(b.conf||0))||b.ts-a.ts,
    need_desc:(a,b)=>(Number(b.need||0)-Number(a.need||0))||b.ts-a.ts,
    intl_desc:(a,b)=>(Number(classifyPhone(b.from).intl)-Number(classifyPhone(a.from).intl))||b.ts-a.ts,
    repeat_desc:(a,b)=>(ledgerRepeatInfo(b).count-ledgerRepeatInfo(a).count)||b.ts-a.ts
  };
  rows.sort(sorters[sort]||sorters.time_desc);
  return rows;
}
function ledgerChip(text,strong=false){
  return `<span style="display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border-radius:999px;border:1px solid ${strong?'rgba(176,138,60,.35)':'var(--line)'};background:${strong?'#fff7e8':'#f7f9fc'};color:${strong?'var(--navy)':'var(--muted)'};font-size:10.5px;font-weight:800">${esc(text)}</span>`;
}
function ledgerActiveFilterChip(key){
  return `<span class="ledger-achip">${esc(LEDGER_FILTER_LABELS[key]||key)}<b onclick="toggleLedgerFilter('${key}')" role="button" aria-label="Remove filter">&times;</b></span>`;
}
function updateLedgerChrome(total,shown){
  const chips=[];
  LEDGER_STATE.filters.forEach(f=>chips.push(ledgerActiveFilterChip(f)));
  chips.push(ledgerChip(LEDGER_SORT_LABELS[LEDGER_STATE.sort]||"Sorted"));
  if(LEDGER_STATE.search.trim())chips.push(ledgerChip(`Search: ${LEDGER_STATE.search.trim()}`,true));
  if(LEDGER_SCOPE)chips.push(`<span class="ledger-achip ledger-scope-chip">${esc(LEDGER_SCOPE.title)}<b onclick="clearLedgerScope()" role="button" aria-label="Return to all enquiries">&times;</b></span>`);
  chips.push(ledgerChip(currentViewDescription()));
  if($("ledgerActiveChips"))$("ledgerActiveChips").innerHTML=chips.join("");
  const active=LEDGER_STATE.search.trim()||LEDGER_STATE.filters.size||LEDGER_STATE.sort!==LEDGER_DEFAULT_STATE.sort;
  if($("ledgerClearBtn"))$("ledgerClearBtn").style.display=active?"inline-flex":"none";
  if($("explorerCount"))$("explorerCount").textContent=`Showing ${Math.min(shown,total)} of ${total} enquiries · ${LEDGER_SCOPE?LEDGER_SCOPE.title:RECORDS.length+' in selected dashboard view'}`;
}
function renderExplorer(resetLimit){
  if(!$("explorerList"))return;
  if(resetLimit){LEDGER_STATE.limit=50;EXPLORER_LIMIT=50;}
  syncLedgerControls();
  const rows=getExplorerRows();
  const shown=rows.slice(0,LEDGER_STATE.limit);
  updateLedgerChrome(rows.length,shown.length);
  if(!rows.length){
    const parts=[];
    if(LEDGER_STATE.filters.size)parts.push([...LEDGER_STATE.filters].map(f=>LEDGER_FILTER_LABELS[f]).join(" + "));
    if(LEDGER_STATE.search.trim())parts.push(`Search: “${LEDGER_STATE.search.trim()}”`);
    parts.push(currentViewDescription());
    $("explorerList").innerHTML=emptyViewHtml("No enquiries match " + parts.join(" · "));
    $("explorerMore").innerHTML="";
    return;
  }
  $("explorerList").innerHTML=shown.map(r=>{
    const tempCol=r.leadTemp==="Hot"?C.hot:r.leadTemp==="Warm"?C.warm:C.cold;
    const tags=[];
    if(r.callback)tags.push(`<span style="background:rgba(0,212,170,.12);color:var(--teal);padding:1px 6px;border-radius:3px;font-size:9px">Callback</span>`);
    if(ledgerHasCallbackWindow(r))tags.push(`<span style="background:#fff7e8;color:var(--gold);padding:1px 6px;border-radius:3px;font-size:9px">Window</span>`);
    const repeat=ledgerRepeatInfo(r);
    if(repeat.count>=2){
      const repeatLabel=repeat.count>=4?`${repeat.count} calls · high repeat`:`${repeat.count} calls · repeat`;
      tags.push(`<span style="background:#eef2ff;color:var(--navy);padding:1px 6px;border-radius:3px;font-size:9px">${esc(repeatLabel)}</span>`);
    }
    tags.unshift(directionPill(r.direction));
    return `<div onclick="markProfileSource(this);explorerOpen(${jsArg(r.from)})" style="padding:11px 12px;border-bottom:1px solid var(--line);cursor:pointer;display:grid;grid-template-columns:1fr auto;gap:6px;transition:background .15s" onmouseover="this.style.background='#f6f8fc'" onmouseout="this.style.background=''">
      <div style="min-width:0">
        <div style="font-size:12px;font-family:'Inter',monospace;color:var(--cream);margin-bottom:3px">${esc(maskPhone(r.from))}</div>
        <div style="font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.intent)} · ${esc(r.summary||"—")}</div>
        <div style="margin-top:4px;display:flex;gap:5px;flex-wrap:wrap">${tags.join("")}</div>
      </div>
      <div style="text-align:right;font-size:10px;color:var(--muted);white-space:nowrap">
        <div style="color:${tempCol};font-weight:600;font-size:11px">${esc(r.leadTemp||"—")}</div>
        <div>${formatDuration(r.dur)}</div>
        <div>Conf ${Math.round(r.conf)}%</div>
        <div style="color:var(--faint)">${formatCallTime(r)}</div>
      </div>
    </div>`;
  }).join("");
  $("explorerMore").innerHTML=rows.length>LEDGER_STATE.limit
    ?`<button onclick="LEDGER_STATE.limit+=50;EXPLORER_LIMIT=LEDGER_STATE.limit;renderExplorer(false)" style="padding:8px 18px;background:#f8fafc;border:1px solid var(--line);border-radius:6px;color:var(--teal);font-size:11px;cursor:pointer">Show more (${rows.length-LEDGER_STATE.limit} remaining)</button>`
    :"";
}

function explorerOpen(phone){
  const search=$("searchMobile"); if(search)search.value=maskPhone(phone);
  searchUserByMobile(phone,"ledger");
}

function exportExplorer(){
  const rows=getExplorerRows();
  if(!rows.length){alert("No calls to export in the current view.");return;}
  downloadCSV('call_ledger_'+csvDateStamp()+'.csv',recordsToCSV(rows,ledgerExportScope()));
}



function paintFrustBreak(o){
  const frustrated=RECORDS.filter(r=>r.frustrated);
  if(!frustrated.length){$("frustBreak").innerHTML="No frustrated calls detected.";return;}
  const causes={high_need:frustrated.filter(r=>r.need>75).length,callback_issue:frustrated.filter(r=>/callback|call.*back/i.test(r.trans)).length,access_issue:frustrated.filter(r=>/access|enrolled|student/i.test(r.trans)).length,technical:frustrated.filter(r=>/audio|technical|connection/i.test(r.trans)).length,other:0};
  causes.other=frustrated.length-(causes.high_need+causes.callback_issue+causes.access_issue+causes.technical);
  const labels={high_need:"High Intent/Need",callback_issue:"Callback/Follow-up",access_issue:"Access/Enrollment",technical:"Technical Issue",other:"Other"};
  const colors={high_need:C.hot,callback_issue:C.warm,access_issue:C.amber,technical:C.coral,other:C.muted};
  const preds={
    high_need:"r=>r.frustrated&&r.need>75",
    callback_issue:"r=>r.frustrated&&/callback|call.*back/i.test(r.trans)",
    access_issue:"r=>r.frustrated&&/access|enrolled|student/i.test(r.trans)",
    technical:"r=>r.frustrated&&/audio|technical|connection/i.test(r.trans)",
    other:"r=>r.frustrated&&!(r.need>75)&&!/callback|call.*back/i.test(r.trans)&&!/access|enrolled|student/i.test(r.trans)&&!/audio|technical|connection/i.test(r.trans)"
  };
  $("frustBreak").innerHTML=Object.entries(causes).filter(e=>e[1]>0).map(e=>{
    const pct=Math.round(e[1]/frustrated.length*100);
    return`<div style="margin-bottom:14px;cursor:pointer" onclick="openFilteredPanel('${labels[e[0]]} (attention)',${preds[e[0]]})"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span>${labels[e[0]]}</span><b>${e[1]} (${pct}%)</b></div><div style="background:#0c121b;border-radius:5px;height:8px;overflow:hidden"><div style="background:${colors[e[0]]};height:100%;width:${e[1]/frustrated.length*100}%"></div></div></div>`;
  }).join("");
}

function paintFrustCost(o){
  const frustrated=RECORDS.filter(r=>r.frustrated);
  const frustMinutes=sumBilledMinutes(frustrated);
  const frustCost=frustMinutes*5;
  $("frustCost").innerHTML=`<div style="cursor:pointer" onclick="openFilteredPanel('Attention-required calls',r=>r.frustrated)"><div style="font-size:32px;font-weight:900;color:var(--hot);margin-bottom:12px">₹${frustCost}</div><div style="font-size:12px;color:var(--muted);line-height:1.6"><b>${frustMinutes} minutes</b> of frustrated calls<br>${frustrated.length} calls × avg ${Math.round(frustrated[0]?.dur||0)}s<br><br><span style="color:var(--faint)">At ₹5/min cost</span></div></div>`;
}

// Shared helper: group records by phone number (built once, reused by all sections)
const _byPhoneCache=new WeakMap();
function groupByPhone(records){
  // Cached by array reference — the memoised outbound slices return stable references within a
  // render, so grouping the same set (done by several paint functions) only runs once. Records
  // arrays are read-only, so a cached grouping never goes stale.
  if(_byPhoneCache.has(records))return _byPhoneCache.get(records);
  const byPhone={};
  records.forEach(r=>{
    // Use the same normalized lead key as the profile drawer. Raw formatting differences such as
    // +91 99999… versus 9199999… must not split one lead's queue minutes/cost into separate cards.
    const ph=ledgerPhoneKey(r)||r.from||"unknown";
    if(!byPhone[ph])byPhone[ph]=[];
    byPhone[ph].push(r);
  });
  _byPhoneCache.set(records,byPhone);
  return byPhone;
}

function findSerialCallers(records){
  const byPhone=groupByPhone(records);
  const serial=Object.entries(byPhone).map(([ph,calls])=>{
    const frustrated=calls.filter(c=>c.frustrated);
    const general=calls.filter(c=>!c.frustrated);
    const totalDur=sumBilledMinutes(calls);
    return{phone:ph,total:calls.length,frustrated:frustrated.length,general:general.length,totalDur,calls:calls.sort((a,b)=>b.ts-a.ts)};
  }).filter(s=>s.total>=3).sort((a,b)=>b.total-a.total);
  return serial;
}

function paintHottestLeads(records){
  const byPhone=groupByPhone(records);

  const leads=Object.entries(byPhone).map(([ph,calls])=>{
    const hot=calls.filter(c=>c.leadTemp==="Hot").length;
    const warm=calls.filter(c=>c.leadTemp==="Warm").length;
    const cold=calls.filter(c=>c.leadTemp==="Cold").length;
    const frustrated=calls.filter(c=>c.frustrated).length;
    const avgConf=Math.round(calls.reduce((a,c)=>a+c.conf,0)/calls.length);
    const avgNeed=Math.round(calls.reduce((a,c)=>a+c.need,0)/calls.length);
    const totalDur=sumBilledMinutes(calls);

    // Lead score: Hot=3, Warm=2, Cold=1 + call frequency + need + confidence
    const leadScore=(hot*3+warm*2+cold)*2+calls.length*1.5+avgNeed*0.3+avgConf*0.2;

    const intents={};
    calls.forEach(c=>{intents[c.intent]=(intents[c.intent]||0)+1;});
    const topIntent=Object.entries(intents).sort((a,b)=>b[1]-a[1])[0];

    return{phone:ph,total:calls.length,hot,warm,cold,frustrated,avgConf,avgNeed,totalDur,leadScore,topIntent:topIntent?topIntent[0]:"General",calls:calls.sort((a,b)=>b.ts-a.ts)};
  }).sort((a,b)=>b.leadScore-a.leadScore).slice(0,50);

  if(!leads.length){$("hottestLeads").innerHTML="<div style='grid-column:1/-1;padding:20px;text-align:center;color:var(--faint);font-size:13px'>No leads found.</div>";return;}
  window.HOTTEST_LEADS=leads;

  $("hottestLeads").innerHTML=leads.map((l,i)=>{
    let typeEmoji="Cold",typeCol="var(--cold)";
    if(l.hot>=Math.ceil(l.total*0.6)){typeEmoji="Hot";typeCol="var(--hot)";}
    else if(l.hot>=Math.ceil(l.total*0.3)){typeEmoji="Warm";typeCol="var(--warm)";}
    const callback=l.calls.some(c=>c.callback);
    return`<article class="follow-up-card drawer-click-card" style="--card-accent:${typeCol}" role="button" tabindex="0" onkeydown="handleDrawerCardKey(event)" onclick="openProfileForPhone(${jsArg(l.phone)},'priority',this)">
      <div class="follow-up-card-head">
        <div><div class="follow-up-rank">Follow-up #${i+1}</div><b class="follow-up-phone">${esc(maskPhone(l.phone))}</b></div>
        <span class="follow-up-tier" style="color:${typeCol}">${typeEmoji}</span>
      </div>
      <div class="follow-up-card-stats">
        <div><b>${l.total}</b><span>Calls</span></div>
        <div><b>${l.totalDur}</b><span>Minutes</span></div>
        <div><b>₹${l.totalDur*5}</b><span>Cost</span></div>
      </div>
      <div class="follow-up-card-meta">${directionMix(l.calls)}${callback?'<span class="follow-up-callback">Follow-up requested</span>':''}</div>
      <div class="drawer-action-hint">Open full profile</div>
    </article>`;
  }).join("");
}

// Open a lead's full profile by index (keeps raw phone out of the DOM)
function openLeadProfile(i){
  const l=window.HOTTEST_LEADS&&window.HOTTEST_LEADS[i];
  if(!l)return;
  openProfileForPhone(l.phone,"priority");
}

function paintSerialCallers(records){
  const serial=findSerialCallers(records);
  if(!serial.length){$("serialCallers").innerHTML="<div style='grid-column:1/-1;padding:20px;text-align:center;color:var(--faint);font-size:13px'>No serial engagers (3+ calls).</div>";return;}

  $("serialCallers").innerHTML=serial.map((s,i)=>`
    <article class="repeat-engagement-card drawer-click-card" role="button" tabindex="0" onkeydown="handleDrawerCardKey(event)" onclick="markProfileSource(this);showSerialTimeline(${i})">
      <div class="repeat-engagement-card-head">
        <div><div class="repeat-engagement-eyebrow">Repeat engagement</div><b class="repeat-engagement-phone">${esc(maskPhone(s.phone))}</b></div>
        <span class="repeat-engagement-count">${s.total} calls</span>
      </div>
      <div class="repeat-engagement-stats">
        <div><b>${s.total}</b><span>Total calls</span></div>
        <div><b>${s.totalDur}</b><span>Minutes</span></div>
        <div><b>₹${s.totalDur*5}</b><span>Cost</span></div>
      </div>
      <div class="repeat-engagement-card-meta">${directionMix(s.calls)}</div>
      <div class="drawer-action-hint">Open profile timeline</div>
    </article>
  `).join("");
  window.SERIAL_CALLERS=serial;
}

function showSerialTimeline(idx){
  const s=window.SERIAL_CALLERS&&window.SERIAL_CALLERS[idx];
  if(!s)return;
  openProfileForPhone(s.phone,'repeat');
  const drawer=$('userSearchResult');
  if(drawer){
    const accordions=drawer.querySelectorAll('details.profile-accordion');
    if(accordions[1])accordions[1].open=true;
  }
}

// === CSV EXPORT FUNCTIONS ===
function directionMixText(calls){
  const n=calls&&calls.length?calls.length:0;if(!n)return '';
  const inbound=calls.filter(c=>normalizeDirection(c.direction)==='inbound').length;
  const outbound=calls.filter(c=>normalizeDirection(c.direction)==='outbound').length;
  const unknown=n-inbound-outbound;
  return [inbound?`Inbound ${inbound}`:'',outbound?`Outbound ${outbound}`:'',unknown?`Unknown ${unknown}`:''].filter(Boolean).join(' | ');
}

function downloadCSV(filename, csvContent){
  const blob=new Blob([csvContent],{type:'text/csv;charset=utf-8;'});
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  link.download=filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function escCSV(val){
  const s=String(val??'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/"/g,'""');
  return /[",\n]/.test(s)?`"${s}"`:s;
}
function csvDateStamp(){return new Date().toISOString().slice(0,10);}
function ledgerExportScope(){
  const parts=[activeFilterScopeLabel()];
  if(LEDGER_SCOPE?.title)parts.push(LEDGER_SCOPE.title);
  if(LEDGER_STATE.filters.size)parts.push([...LEDGER_STATE.filters].map(f=>LEDGER_FILTER_LABELS[f]||f).join(' + '));
  if(LEDGER_STATE.search.trim())parts.push(`Search: ${LEDGER_STATE.search.trim()}`);
  if(LEDGER_STATE.sort!==LEDGER_DEFAULT_STATE.sort)parts.push(LEDGER_SORT_LABELS[LEDGER_STATE.sort]||LEDGER_STATE.sort);
  return parts.join(' · ');
}

function exportHottestLeads(){
  if(!RECORDS.length){alert("No data to export in the current filter range.");return;}
  const byPhone=groupByPhone(RECORDS);
  const leads=Object.entries(byPhone).map(([ph,calls])=>{
    const hot=calls.filter(c=>c.leadTemp==="Hot").length;
    const warm=calls.filter(c=>c.leadTemp==="Warm").length;
    const cold=calls.filter(c=>c.leadTemp==="Cold").length;
    const totalDur=sumBilledMinutes(calls);
    const lastCall=calls.sort((a,b)=>b.ts-a.ts)[0];
    const followUpScore=(hot*3+warm*2+cold)*2+calls.length*1.5+Math.round(calls.reduce((a,c)=>a+Number(c.need||0),0)/calls.length)*0.3+Math.round(calls.reduce((a,c)=>a+Number(c.conf||0),0)/calls.length)*0.2;
    const tier=hot>=Math.ceil(calls.length*0.6)?'Hot':hot>=Math.ceil(calls.length*0.3)?'Warm':'Cold';
    return{ph,total:calls.length,tier,totalDur,followUpScore,callback:calls.some(c=>c.callback),directionMix:directionMixText(calls),lastCallTime:formatCallTime(lastCall),lastStatus:lastCall.status,lastSummary:lastCall.summary};
  }).sort((a,b)=>b.followUpScore-a.followUpScore).slice(0,50);

  let csv='Follow-up Rank,Phone,Lead Tier,Total Calls,Callback Requested,Direction Mix,Total Duration (mins),Total Cost (Rs),Last Call Time,Last Status,Last Summary,Filter Scope\n';
  leads.forEach((l,i)=>{csv+=[i+1,fullPhone(l.ph),escCSV(l.tier),l.total,l.callback?'Yes':'No',escCSV(l.directionMix),l.totalDur,l.totalDur*5,escCSV(l.lastCallTime),escCSV(l.lastStatus),escCSV(l.lastSummary),escCSV(`${activeFilterScopeLabel()} · Follow-up queue`)].join(',')+'\n';});
  downloadCSV('follow_up_queue_'+csvDateStamp()+'.csv',csv);
}

function exportSerialEngagers(){
  const serial=findSerialCallers(RECORDS);
  if(!serial.length){alert("No serial engagers (3+ calls) to export in this range.");return;}
  let csv='Phone,Direction Mix,Total Calls,Total Duration (mins),Total Cost (Rs),Last Call Time,Last Status,Last Summary,Filter Scope\n';
  serial.forEach(s=>{
    const lastCall=s.calls[0];
    csv+=[fullPhone(s.phone),escCSV(directionMixText(s.calls||[])),s.total,s.totalDur,s.totalDur*5,escCSV(formatCallTime(lastCall)),escCSV(lastCall.status),escCSV(lastCall.summary),escCSV(`${activeFilterScopeLabel()} · Repeat engagement`)].join(',')+'\n';
  });
  downloadCSV('repeat_engagement_'+csvDateStamp()+'.csv',csv);
}

function exportCallbacks(){
  const cbs=RECORDS.filter(r=>r.callback);
  if(!cbs.length){alert("No requested follow-ups to export for the current date and direction view.");return;}
  downloadCSV('requested_follow_ups_'+csvDateStamp()+'.csv',recordsToCSV(cbs.sort((a,b)=>b.ts-a.ts),`${activeFilterScopeLabel()} · Requested follow-ups`));
}
