
const page = document.body.dataset.page;
const META = {
  overview:['Fraud Detection Overview','Executive view across UPI, Cards & Net Banking'],
  transactions:['Transactions','AI-scored transactions with analyst override for model retraining'],
  alerts:['Alerts & Notifications','System alerts from AI engines and thresholds'],
  insights:['Insights & Analytics','Model performance, reason codes and training data feedback'],
  settings:['Settings','Detection engine, notification and profile preferences']
};
const CHANS = ['UPI','Card','Net Banking'];
const REASONS = ['Velocity anomaly','New beneficiary','Unusual amount','Device mismatch','Geo-location delta','Mule ring linked','Behavioral drift','Off-hours txn','IP reputation low','MCC anomaly','Failed OTP recent','Synthetic ID pattern'];

function $(id){return document.getElementById(id)}
function sample(a,n){return [...a].sort(()=>.5-Math.random()).slice(0,n)}
function fmt(n){return Number(n).toLocaleString('en-IN')}
function rclass(r){return r>75?'high':r>45?'med':'low'}

function makeTxn(seedIndex){
  const risk = Math.floor(Math.random()*100);
  const aiDecision = risk >= 60 ? 'Rejected' : 'Approved';
  const idNum = seedIndex !== undefined ? (8842000 + seedIndex) : (8843000 + Math.floor(Math.random()*99999));
  return {
    id: 'TXN-' + idNum,
    time: new Date().toLocaleTimeString('en-IN'),
    ts: Date.now(),
    channel: CHANS[Math.floor(Math.random()*3)],
    amount: Math.floor(Math.random()*95000)+500,
    risk, aiDecision, finalDecision:aiDecision,
    overridden:false, analystAction:null, analystReason:null,
    reasons: sample(REASONS,3),
    xgb: Math.max(0,Math.min(100,risk+Math.floor(Math.random()*21-10))),
    lstm: Math.max(0,Math.min(100,risk+Math.floor(Math.random()*31-15))),
    gnn: Math.max(0,Math.min(100,risk+Math.floor(Math.random()*25-8)))
  };
}

function initState(){
  if(!localStorage.dvTxns){
    let tx=[];
    for(let i=0;i<24;i++){
      const t = makeTxn(i);
      t.ts = Date.now() - i*160000;
      t.time = new Date(t.ts).toLocaleTimeString('en-IN');
      tx.push(t);
    }
    localStorage.dvTxns = JSON.stringify(tx);
  }
  if(!localStorage.dvNotifs){
    localStorage.dvNotifs = JSON.stringify([
      {id:1,type:'danger',title:'Fraud spike detected - UPI',msg:'+37% Rejected transactions in last 15 min',time:'2 min ago',unread:true},
      {id:2,type:'warn',title:'Mule network identified',msg:'4 accounts linked to known ring - Rs 8.4L blocked',time:'8 min ago',unread:true},
      {id:3,type:'info',title:'Model retraining complete',msg:'XGBoost v4.2 deployed using 214 analyst overrides',time:'32 min ago',unread:true},
      {id:4,type:'warn',title:'Cross-channel anomaly',msg:'Same device on UPI and Card within 90 sec',time:'1 hr ago',unread:true}
    ]);
  }
  if(!localStorage.dvTraining){
    localStorage.dvTraining = JSON.stringify({total:214, agree:187, disagree:27});
  }
  if(!localStorage.dvSelected){
    localStorage.dvSelected = JSON.parse(localStorage.dvTxns).find(t=>t.aiDecision==='Rejected').id;
  }
  if(!localStorage.dvPage) localStorage.dvPage = '1';
}
function txns(){return JSON.parse(localStorage.dvTxns)}
function saveTxns(t){localStorage.dvTxns = JSON.stringify(t)}
function notifs(){return JSON.parse(localStorage.dvNotifs)}
function saveNotifs(n){localStorage.dvNotifs = JSON.stringify(n)}
function training(){return JSON.parse(localStorage.dvTraining)}
function saveTraining(t){localStorage.dvTraining = JSON.stringify(t)}

function common(){
  initState();
  document.documentElement.setAttribute('data-theme', localStorage.dvTheme||'light');
  document.querySelector('.app').classList.toggle('collapsed', localStorage.dvCollapsed==='yes');
  document.querySelectorAll('.nav a').forEach(a=>{ if(a.dataset.page===page) a.classList.add('active') });
  if($('pageTitle')){ $('pageTitle').textContent = META[page][0]; $('pageSub').textContent = META[page][1]; }
  $('collapseBtn').onclick = ()=>{
    if(innerWidth<760){ $('sidebar').classList.toggle('mobile-open') }
    else{
      document.querySelector('.app').classList.toggle('collapsed');
      localStorage.dvCollapsed = document.querySelector('.app').classList.contains('collapsed')?'yes':'no';
      setTimeout(drawAllCharts, 260);
    }
  };
  $('themeToggle').onclick = toggleTheme;
  $('notifBtn').onclick = e=>{ e.stopPropagation(); $('notifPanel').classList.toggle('show') };
  document.addEventListener('click', e=>{
    if($('notifPanel') && !$('notifPanel').contains(e.target) && e.target.id!=='notifBtn') $('notifPanel').classList.remove('show');
  });
  renderNotifPanel();
  setCounts();
}
function setCounts(){
  const t=txns(), n=notifs();
  document.querySelectorAll('[data-count=txns]').forEach(e=>e.textContent=t.length);
  document.querySelectorAll('[data-count=alerts]').forEach(e=>e.textContent=n.length);
  const u = n.filter(x=>x.unread).length;
  if($('notifBadge')){ $('notifBadge').textContent = u; $('notifBadge').style.display = u?'grid':'none' }
}
function renderNotifPanel(){
  const list = $('notifList'); if(!list) return;
  const n = notifs();
  list.innerHTML = n.map(x=>`
    <div class="notif ${x.unread?'unread':''}" onclick="openNotif(${x.id})">
      <span class="dot" style="background:${x.type==='danger'?'var(--danger)':x.type==='warn'?'var(--warn)':'var(--primary)'}"></span>
      <div><b>${x.title}</b><div class="small">${x.msg}</div><div class="small">${x.time}</div></div>
    </div>`).join('') || '<div class="small" style="padding:35px;text-align:center">No notifications</div>';
  setCounts();
}
function openNotif(id){ const n=notifs(); const x=n.find(i=>i.id===id); if(x) x.unread=false; saveNotifs(n); location.href='alerts.html' }
function markAllRead(){ const n=notifs(); n.forEach(x=>x.unread=false); saveNotifs(n); renderNotifPanel(); typeof renderAlerts==='function'&&renderAlerts() }
function toggleTheme(){
  const next = (document.documentElement.getAttribute('data-theme')==='dark') ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.dvTheme = next;
  drawAllCharts();
}

function chart(canvasId, type, series, labels, colors){
  const c = $(canvasId); if(!c) return;
  const dpr = devicePixelRatio||1;
  const W = c.offsetWidth, H = c.offsetHeight;
  c.width = W*dpr; c.height = H*dpr;
  const ctx = c.getContext('2d'); ctx.scale(dpr,dpr);
  const p = 34;
  ctx.clearRect(0,0,W,H);
  const cs = getComputedStyle(document.documentElement);
  ctx.strokeStyle = cs.getPropertyValue('--border'); ctx.fillStyle = cs.getPropertyValue('--muted'); ctx.font = '11px Inter';
  for(let i=0;i<5;i++){ const y=p+(H-2*p)*i/4; ctx.beginPath(); ctx.moveTo(p,y); ctx.lineTo(W-p,y); ctx.stroke() }
  if(type==='line'){
    const max = Math.max(...series.flat())*1.12;
    series.forEach((s,si)=>{
      ctx.strokeStyle = colors[si]; ctx.lineWidth = 2; ctx.beginPath();
      s.forEach((v,i)=>{ const x=p+(W-2*p)*i/(s.length-1); const y=H-p-(H-2*p)*(v/max); i?ctx.lineTo(x,y):ctx.moveTo(x,y) });
      ctx.stroke();
    });
  }
  if(type==='bar'){
    const max = Math.max(...series.flat())*1.15;
    const groups = labels.length; const groupW = (W-2*p)/groups; const bw = groupW*.35;
    labels.forEach((l,i)=>{
      series.forEach((s,si)=>{
        const x = p + groupW*i + groupW*.15 + si*bw*.55;
        const y = H-p - (H-2*p)*(s[i]/max);
        ctx.fillStyle = colors[si]; ctx.fillRect(x, y, bw*.5, H-p-y);
      });
      ctx.fillStyle = cs.getPropertyValue('--muted');
      ctx.fillText(l, p+groupW*i+groupW*.3, H-10);
    });
  }
  if(type==='donut'||type==='polar'){
    const total = series[0].reduce((a,b)=>a+b,0), cx=W/2, cy=H/2, r=Math.min(W,H)/3;
    let start = -Math.PI/2;
    series[0].forEach((v,i)=>{
      const ang = 2*Math.PI*v/total;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,start+ang); ctx.closePath();
      ctx.fillStyle = colors[i]; ctx.fill(); start += ang;
    });
    if(type==='donut'){
      ctx.globalCompositeOperation='destination-out';
      ctx.beginPath(); ctx.arc(cx,cy,r*.58,0,Math.PI*2); ctx.fill();
      ctx.globalCompositeOperation='source-over';
    }
  }
}
function drawAllCharts(){
  if($('lineChart')) chart('lineChart','line',[Array.from({length:24},()=>Math.floor(Math.random()*2600)+4200), Array.from({length:24},()=>Math.floor(Math.random()*60)+12)], [], ['#2E308E','#ef4444']);
  if($('donutChart')){
    const t = txns();
    const approved = t.filter(x=>x.finalDecision==='Approved').length;
    const rejected = t.filter(x=>x.finalDecision==='Rejected').length;
    chart('donutChart','donut',[[approved, rejected]], [], ['#22c55e','#ef4444']);
  }
  if($('barChart')){
    const t = txns();
    const byChan = c => ({app:t.filter(x=>x.channel===c&&x.finalDecision==='Approved').length, rej:t.filter(x=>x.channel===c&&x.finalDecision==='Rejected').length});
    const u=byChan('UPI'), cd=byChan('Card'), nb=byChan('Net Banking');
    chart('barChart','bar', [[u.app,cd.app,nb.app],[u.rej,cd.rej,nb.rej]], ['UPI','Card','NB'], ['#22c55e','#ef4444']);
  }
  if($('modelChart')) chart('modelChart','line',[Array.from({length:30},()=>92+Math.random()*4), Array.from({length:30},()=>88+Math.random()*5), Array.from({length:30},()=>90+Math.random()*4)], [], ['#2E308E','#f59e0b','#22c55e']);
  if($('fraudTypeChart')) chart('fraudTypeChart','polar',[[28,22,15,18,10,7]], [], ['#ef4444','#f59e0b','#2E308E','#92BBE6','#22c55e','#a855f7']);
  if($('feedbackChart')) chart('feedbackChart','bar',[[9.2,7.8,6.4,5.2,4.3,3.6,3.1,2.8],[42,51,58,63,71,78,84,92]], ['W1','W2','W3','W4','W5','W6','W7','W8'], ['#ef4444','#22c55e']);
}

function explain(){
  const t = txns().find(x=>x.id===localStorage.dvSelected) || txns()[0];
  const color = t.risk>75?'var(--danger)':t.risk>45?'var(--warn)':'var(--safe)';
  ['','2'].forEach(s=>{
    if($('explainId'+s)){
      $('explainId'+s).textContent = `${t.id} - ${t.channel} - Rs ${fmt(t.amount)}`;
      $('explainScore'+s).innerHTML = `${t.risk} <small>/100</small>`;
      $('explainScore'+s).style.color = color;
      ['XGB','LSTM','GNN'].forEach(k=>{
        const v = t[k.toLowerCase()];
        if($('sig'+k+s)){ $('sig'+k+s).textContent = v; $('fill'+k+s).style.width = v+'%'; }
      });
    }
  });
  if($('aiDecisionLabel')){
    $('aiDecisionLabel').innerHTML = `AI Decision: <span class="status st-${t.aiDecision}">${t.aiDecision}</span>` + (t.overridden ? ` <span class="override-tag disagree">Analyst overrode</span>` : '');
  }
  if($('explainReasons')) $('explainReasons').innerHTML = t.reasons.map(r=>`<span class="tag">${r}</span>`).join('');
}

// PAGINATION + LIVE STREAM
const PAGE_SIZE = 10;
let liveTimer = null;

function getFilteredRows(){
  const filter = localStorage.dvFilter || 'all';
  let rows = txns().slice().sort((a,b)=>(b.ts||0)-(a.ts||0));
  if(filter==='Approved') rows = rows.filter(t=>t.finalDecision==='Approved');
  else if(filter==='Rejected') rows = rows.filter(t=>t.finalDecision==='Rejected');
  else if(filter==='high-risk') rows = rows.filter(t=>t.risk>75);
  else if(filter==='overridden') rows = rows.filter(t=>t.overridden);
  return rows;
}

function renderTable(){
  const body = $('txnBody'); if(!body) return;
  const rows = getFilteredRows();
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  let page = parseInt(localStorage.dvPage||'1',10);
  if(page > totalPages) page = totalPages;
  localStorage.dvPage = String(page);
  const start = (page-1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  body.innerHTML = pageRows.map(t=>{
    const overrideBadge = t.overridden ? `<span class="override-tag disagree">Overridden</span>` : '';
    const btnPrimary = t.aiDecision==='Rejected'
      ? `<button class="btn safe" onclick="event.stopPropagation();openReview('approve','${t.id}')">Mark Approved</button>`
      : `<button class="btn danger" onclick="event.stopPropagation();openReview('reject','${t.id}')">Mark Rejected</button>`;
    return `<tr class="${localStorage.dvSelected===t.id?'selected':''}" onclick="selectTxn('${t.id}')">
      <td><b>${t.id}</b></td>
      <td>${t.time}</td>
      <td>${t.channel}</td>
      <td>Rs ${fmt(t.amount)}</td>
      <td><span class="pill ${rclass(t.risk)}">${t.risk}</span></td>
      <td><span class="status st-${t.aiDecision}">${t.aiDecision}</span></td>
      <td><span class="status st-${t.finalDecision}">${t.finalDecision}</span> ${overrideBadge}</td>
      <td>${t.reasons.map(r=>`<span class="tag">${r}</span>`).join('')}</td>
      <td>${btnPrimary} <button class="btn" onclick="event.stopPropagation();openReview('agree','${t.id}')">Agree</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--muted)">No transactions match this filter.</td></tr>`;

  renderPagination(rows.length, page, totalPages);
  const overrideCount = txns().filter(t=>t.overridden).length;
  if($('exportCount')) $('exportCount').textContent = overrideCount;
  if($('exportBtn')) $('exportBtn').disabled = overrideCount === 0;
}

function renderPagination(total, page, totalPages){
  const el = $('pagination'); if(!el) return;
  if(total === 0){ el.innerHTML = ''; return; }
  const start = (page-1)*PAGE_SIZE + 1;
  const end = Math.min(page*PAGE_SIZE, total);
  let btns = '';
  const maxBtns = 5;
  let s = Math.max(1, page - 2), e = Math.min(totalPages, s + maxBtns - 1);
  s = Math.max(1, e - maxBtns + 1);
  for(let i=s; i<=e; i++){
    btns += `<button class="page-btn ${i===page?'active':''}" onclick="goPage(${i})">${i}</button>`;
  }
  el.innerHTML = `
    <div class="page-info">Showing <b>${start}-${end}</b> of <b>${total}</b> transactions</div>
    <div class="page-ctrls">
      <button class="page-btn" ${page===1?'disabled':''} onclick="goPage(1)">&laquo;</button>
      <button class="page-btn" ${page===1?'disabled':''} onclick="goPage(${page-1})">&lsaquo;</button>
      ${btns}
      <button class="page-btn" ${page===totalPages?'disabled':''} onclick="goPage(${page+1})">&rsaquo;</button>
      <button class="page-btn" ${page===totalPages?'disabled':''} onclick="goPage(${totalPages})">&raquo;</button>
    </div>`;
}
function goPage(n){ localStorage.dvPage = String(n); renderTable(); }

function selectTxn(id){ localStorage.dvSelected = id; renderTable(); explain(); renderDetail(); }

function renderDetail(){
  const el = $('txnDetail'); if(!el) return;
  const t = txns().find(x=>x.id===localStorage.dvSelected) || txns()[0];
  const overrideNote = t.overridden ? `<div class="small" style="color:var(--warn);margin-top:8px">Analyst overrode AI. Reason: <b>${t.analystReason||'-'}</b></div>` : '';
  el.innerHTML = `
    <b>${t.id}</b><br>
    Channel: ${t.channel}<br>
    Amount: Rs ${fmt(t.amount)}<br>
    AI Decision: <span class="status st-${t.aiDecision}">${t.aiDecision}</span><br>
    Final Status: <span class="status st-${t.finalDecision}">${t.finalDecision}</span><br>
    Risk Score: <span class="pill ${rclass(t.risk)}">${t.risk}</span>
    <br><br><b>Reason Codes:</b><br>${t.reasons.map(r=>`<span class="tag">${r}</span>`).join('')}
    ${overrideNote}`;
}

function bindFilters(){
  document.querySelectorAll('[data-filter]').forEach(c=>c.onclick=()=>{
    document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));
    c.classList.add('active');
    localStorage.dvFilter = c.dataset.filter;
    localStorage.dvPage = '1';
    renderTable();
  });
}

function startLiveStream(){
  if(page !== 'transactions') return;
  if(liveTimer) clearInterval(liveTimer);
  liveTimer = setInterval(()=>{
    if(localStorage.dvLivePaused === 'yes') return;
    const t = txns();
    const fresh = makeTxn();
    t.unshift(fresh);
    if(t.length > 500) t.length = 500;
    saveTxns(t);
    setCounts();
    if((localStorage.dvPage||'1') === '1'){
      renderTable();
    } else {
      updateNewIndicator();
    }
  }, 5000);
}
function updateNewIndicator(){
  const el = $('liveIndicator'); if(!el) return;
  const count = parseInt(el.dataset.new||'0',10) + 1;
  el.dataset.new = String(count);
  el.innerHTML = `<span class="live-dot"></span> ${count} new transaction${count>1?'s':''} - <a href="#" onclick="goPage(1);document.getElementById('liveIndicator').dataset.new='0';return false">jump to page 1</a>`;
  el.style.display = 'flex';
}
function togglePause(){
  const paused = localStorage.dvLivePaused === 'yes';
  localStorage.dvLivePaused = paused ? 'no' : 'yes';
  const btn = $('pauseBtn');
  if(btn){
    btn.innerHTML = paused ? '&#9209; Pause live stream' : '&#9654; Resume live stream';
    btn.classList.toggle('paused', !paused);
  }
  const dot = $('liveDot'); if(dot) dot.classList.toggle('off', !paused);
}

function exportOverridden(){
  const rows = txns().filter(t=>t.overridden);
  if(rows.length === 0){ alert('No overridden transactions to export yet.'); return; }
  const headers = ['Transaction ID','Timestamp','Channel','Amount (INR)','Risk Score','AI Decision','Final Decision (Override)','Analyst Action','Analyst Reason','XGBoost Score','LSTM Score','GNN Score','Reason Codes'];
  const csvRows = [headers.join(',')];
  rows.forEach(t=>{
    const line = [
      t.id, t.time, t.channel, t.amount, t.risk,
      t.aiDecision, t.finalDecision, t.analystAction||'', (t.analystReason||'').replace(/,/g,';'),
      t.xgb, t.lstm, t.gnn, (t.reasons||[]).join(' | ')
    ].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',');
    csvRows.push(line);
  });
  const blob = new Blob([csvRows.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  a.href = url;
  a.download = `dejavu_overridden_transactions_${stamp}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Export complete', `${rows.length} overridden transaction${rows.length>1?'s':''} exported as CSV`);
}

let modalCtx = {};
function openReview(action, id){
  modalCtx = { action, id: id || localStorage.dvSelected };
  const t = txns().find(x=>x.id===modalCtx.id);
  if(!t) return;
  let title = '', desc = '';
  if(action==='approve'){ title='Mark as Approved'; desc=`AI Rejected this transaction. Marking Approved will submit as training data (AI was wrong: false rejection).`; }
  else if(action==='reject'){ title='Mark as Rejected'; desc=`AI Approved this transaction. Marking Rejected will submit as training data (AI was wrong: false approval).`; }
  else { title='Agree with AI'; desc=`Confirming the AI decision (${t.aiDecision}) will submit as positive reinforcement training data.`; }
  $('modalTitle').textContent = title;
  $('modalDesc').textContent = desc;
  $('modalBack').classList.add('show');
  $('modalReason').value = '';
  $('modalNotes').value = '';
}
function closeModal(){ $('modalBack').classList.remove('show'); }
function submitReview(){
  if(!$('modalReason').value){ alert('Reason is mandatory for model training feedback.'); return; }
  const t = txns();
  const x = t.find(i=>i.id===modalCtx.id); if(!x) return;
  const reason = $('modalReason').value;
  if(modalCtx.action==='agree'){
    x.overridden = false;
    x.finalDecision = x.aiDecision;
    x.analystAction = 'agree';
    x.analystReason = reason;
  } else {
    const newDecision = modalCtx.action==='approve' ? 'Approved' : 'Rejected';
    x.overridden = (newDecision !== x.aiDecision);
    x.finalDecision = newDecision;
    x.analystAction = x.overridden ? 'disagree' : 'agree';
    x.analystReason = reason;
  }
  saveTxns(t);
  const tr = training();
  tr.total += 1;
  if(x.analystAction==='agree') tr.agree += 1; else tr.disagree += 1;
  saveTraining(tr);
  closeModal();
  showToast('Feedback captured for retraining', `${x.id} - ${x.finalDecision} - added to next training cycle`);
  renderTable(); explain(); setCounts(); renderTrainingBanner();
}
function showToast(a,b){ $('toastTitle').textContent = a; $('toastMsg').textContent = b; $('toast').classList.add('show'); setTimeout(()=>$('toast').classList.remove('show'), 2600); }

function renderAlerts(){
  const el = $('alertsList'); if(!el) return;
  el.innerHTML = notifs().map(n=>`
    <div class="alert ${n.type}">
      <b>${n.type==='danger'?'!':n.type==='warn'?'*':'i'}</b>
      <div style="flex:1">
        <div class="alert-title">${n.title} ${n.unread?'<span class="tag" style="color:var(--primary);border-color:var(--primary)">NEW</span>':''}</div>
        <div class="alert-msg">${n.msg} - ${n.time}</div>
      </div>
      <button class="btn" onclick="dismiss(${n.id})">Mark read</button>
    </div>`).join('');
}
function dismiss(id){ const n=notifs(); const x=n.find(i=>i.id===id); if(x) x.unread=false; saveNotifs(n); renderAlerts(); renderNotifPanel(); }
function overviewAlerts(){
  const el = $('alertsStrip'); if(!el) return;
  el.innerHTML = notifs().filter(n=>n.unread).slice(0,2).map(n=>`
    <div class="alert ${n.type}">
      <b>${n.type==='danger'?'!':'*'}</b>
      <div><div class="alert-title">${n.title}</div><div class="alert-msg">${n.msg}</div></div>
      <button class="close" onclick="dismiss(${n.id});overviewAlerts()">x</button>
    </div>`).join('');
}

function renderTrainingBanner(){
  const el = $('trainingBanner'); if(!el) return;
  const t = training();
  el.innerHTML = `<div style="font-size:22px">*</div>
    <div style="flex:1;min-width:200px"><b>Analyst overrides feed the online learning loop.</b><div class="small">Every override becomes labeled training data for XGBoost, LSTM, GNN models. Retrains every 24 hours.</div></div>
    <div class="training-stat"><div class="num" style="color:var(--primary)">${t.total}</div><div class="small">Training samples</div></div>
    <div class="training-stat"><div class="num" style="color:var(--safe)">${t.agree}</div><div class="small">AI confirmed</div></div>
    <div class="training-stat"><div class="num" style="color:var(--warn)">${t.disagree}</div><div class="small">AI overridden</div></div>`;
}

window.addEventListener('resize', ()=>drawAllCharts());
window.onload = ()=>{
  common();
  bindFilters();
  overviewAlerts();
  renderTable();
  renderDetail();
  renderAlerts();
  explain();
  renderTrainingBanner();
  drawAllCharts();
  startLiveStream();
  if($('modalBack')) $('modalBack').onclick = e=>{ if(e.target.id==='modalBack') closeModal(); };
  if(localStorage.dvLivePaused === 'yes' && $('pauseBtn')){
    $('pauseBtn').innerHTML = '&#9654; Resume live stream';
    $('pauseBtn').classList.add('paused');
    $('liveDot') && $('liveDot').classList.add('off');
  }
};
