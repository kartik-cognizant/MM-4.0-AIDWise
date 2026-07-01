
const page = document.body.dataset.page;
const META = {
  overview:['Fraud Detection Overview','Executive view across UPI, Cards & Net Banking'],
  transactions:['Transactions','AI-scored transactions with analyst override for model retraining'],
  alerts:['Alerts & Notifications','System alerts from AI engines and thresholds'],
  insights:['Insights & Analytics','Model performance and analyst feedback impact'],
  settings:['Settings','Detection engine, notifications and profile preferences']
};
const CHANS = ['UPI','Card','Net Banking'];
const REASONS = ['Velocity anomaly','New beneficiary','Unusual amount','Device mismatch','Geo-location delta','Mule ring linked','Behavioral drift','Off-hours txn','IP reputation low','MCC anomaly','Failed OTP recent','Synthetic ID pattern'];
function $(id){return document.getElementById(id)}
function sample(a,n){return [...a].sort(()=>.5-Math.random()).slice(0,n)}
function fmt(n){return Number(n).toLocaleString('en-IN')}
function rclass(r){return r>75?'high':r>45?'med':'low'}
function initState(){
  if(!localStorage.dvTxns_v4){
    let tx=[];
    for(let i=0;i<24;i++){
      const risk = Math.floor(Math.random()*100);
      const aiDecision = risk >= 60 ? 'Rejected' : 'Approved';
      tx.push({id:'TXN-'+(8842000+i),time:new Date(Date.now()-i*160000).toLocaleTimeString('en-IN'),channel:CHANS[Math.floor(Math.random()*3)],amount:Math.floor(Math.random()*95000)+500,risk,aiDecision,finalDecision:aiDecision,overridden:false,analystAction:null,analystReason:null,reasons:sample(REASONS,3),xgb:Math.max(0,Math.min(100,risk+Math.floor(Math.random()*21-10))),lstm:Math.max(0,Math.min(100,risk+Math.floor(Math.random()*31-15))),gnn:Math.max(0,Math.min(100,risk+Math.floor(Math.random()*25-8)))});
    }
    localStorage.dvTxns_v4 = JSON.stringify(tx);
  }
  if(!localStorage.dvNotifs_v4){
    localStorage.dvNotifs_v4 = JSON.stringify([
      {id:1,type:'danger',title:'Fraud spike detected - UPI',msg:'+37% Rejected in last 15 min',time:'2 min ago',unread:true},
      {id:2,type:'warn',title:'Mule network identified',msg:'4 accounts linked - Rs 8.4L blocked',time:'8 min ago',unread:true},
      {id:3,type:'info',title:'Model retraining complete',msg:'XGBoost v4.2 deployed using 214 overrides',time:'32 min ago',unread:true},
      {id:4,type:'warn',title:'Cross-channel anomaly',msg:'Same device on UPI and Card within 90 sec',time:'1 hr ago',unread:true}
    ]);
  }
  if(!localStorage.dvTraining_v4){localStorage.dvTraining_v4=JSON.stringify({total:214,agree:187,disagree:27});}
  if(!localStorage.dvSelected_v4){localStorage.dvSelected_v4=JSON.parse(localStorage.dvTxns_v4).find(t=>t.aiDecision==='Rejected').id;}
}
function txns(){return JSON.parse(localStorage.dvTxns_v4)}
function saveTxns(t){localStorage.dvTxns_v4=JSON.stringify(t)}
function notifs(){return JSON.parse(localStorage.dvNotifs_v4)}
function saveNotifs(n){localStorage.dvNotifs_v4=JSON.stringify(n)}
function training(){return JSON.parse(localStorage.dvTraining_v4)}
function saveTraining(t){localStorage.dvTraining_v4=JSON.stringify(t)}
function common(){
  initState();
  document.documentElement.setAttribute('data-theme',localStorage.dvTheme||'light');
  document.querySelector('.app').classList.toggle('collapsed',localStorage.dvCollapsed==='yes');
  document.querySelectorAll('.nav a').forEach(a=>{if(a.dataset.page===page)a.classList.add('active')});
  if($('pageTitle')){$('pageTitle').textContent=META[page][0];$('pageSub').textContent=META[page][1];}
  $('collapseBtn').onclick=()=>{
    if(innerWidth<600){$('sidebar').classList.toggle('mobile-open')}
    else{document.querySelector('.app').classList.toggle('collapsed');localStorage.dvCollapsed=document.querySelector('.app').classList.contains('collapsed')?'yes':'no';setTimeout(drawAllCharts,280);}
  };
  $('themeToggle').onclick=toggleTheme;
  $('notifBtn').onclick=e=>{e.stopPropagation();$('notifPanel').classList.toggle('show')};
  document.addEventListener('click',e=>{if($('notifPanel')&&!$('notifPanel').contains(e.target)&&e.target.id!=='notifBtn')$('notifPanel').classList.remove('show');});
  renderNotifPanel();setCounts();
}
function setCounts(){
  const t=txns(),n=notifs();
  document.querySelectorAll('[data-count=txns]').forEach(e=>e.textContent=t.length);
  document.querySelectorAll('[data-count=alerts]').forEach(e=>e.textContent=n.length);
  const u=n.filter(x=>x.unread).length;
  if($('notifBadge')){$('notifBadge').textContent=u;$('notifBadge').style.display=u?'grid':'none'}
}
function renderNotifPanel(){
  const list=$('notifList');if(!list)return;
  list.innerHTML=notifs().map(x=>`<div class="notif ${x.unread?'unread':''}" onclick="openNotif(${x.id})"><span class="dot" style="background:${x.type==='danger'?'var(--danger)':x.type==='warn'?'var(--warn)':'var(--primary)'}"></span><div><b>${x.title}</b><div class="small">${x.msg}</div><div class="small">${x.time}</div></div></div>`).join('')||'<div class="small" style="padding:35px;text-align:center">No notifications</div>';
  setCounts();
}
function openNotif(id){const n=notifs();const x=n.find(i=>i.id===id);if(x)x.unread=false;saveNotifs(n);location.href='alerts.html'}
function markAllRead(){const n=notifs();n.forEach(x=>x.unread=false);saveNotifs(n);renderNotifPanel();if(typeof renderAlerts==='function')renderAlerts()}
function toggleTheme(){const next=(document.documentElement.getAttribute('data-theme')==='dark')?'light':'dark';document.documentElement.setAttribute('data-theme',next);localStorage.dvTheme=next;drawAllCharts();}
function drawChart(canvasId,type,series,labels,colors,opts){
  const c=$(canvasId);if(!c||!c.parentElement)return;
  const rect=c.parentElement.getBoundingClientRect();
  const W=Math.max(1,Math.floor(rect.width)),H=Math.max(1,Math.floor(rect.height));
  const dpr=window.devicePixelRatio||1;
  c.width=W*dpr;c.height=H*dpr;c.style.width=W+'px';c.style.height=H+'px';
  const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
  const cs=getComputedStyle(document.documentElement);
  const gridC=cs.getPropertyValue('--border').trim(),mutedC=cs.getPropertyValue('--muted').trim();
  ctx.font='11px Inter, sans-serif';
  const pad={l:38,r:12,t:14,b:(type==='bar'?36:24)};
  if(type==='line'){
    const max=Math.max(1,Math.max(...series.flat())*1.15);
    ctx.strokeStyle=gridC;ctx.lineWidth=1;
    for(let i=0;i<5;i++){const y=pad.t+(H-pad.t-pad.b)*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();}
    ctx.fillStyle=mutedC;ctx.textAlign='right';ctx.textBaseline='middle';
    for(let i=0;i<5;i++){const y=pad.t+(H-pad.t-pad.b)*i/4;ctx.fillText(Math.round(max*(1-i/4)).toLocaleString(),pad.l-6,y);}
    series.forEach((s,si)=>{ctx.strokeStyle=colors[si];ctx.lineWidth=2.2;ctx.beginPath();s.forEach((v,i)=>{const x=pad.l+(W-pad.l-pad.r)*i/(s.length-1);const y=pad.t+(H-pad.t-pad.b)*(1-v/max);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.stroke();});
  } else if(type==='bar'){
    const max=Math.max(1,Math.max(...series.flat())*1.2);
    ctx.strokeStyle=gridC;ctx.lineWidth=1;ctx.fillStyle=mutedC;
    for(let i=0;i<5;i++){const y=pad.t+(H-pad.t-pad.b)*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();ctx.textAlign='right';ctx.textBaseline='middle';ctx.fillText(Math.round(max*(1-i/4)),pad.l-4,y);}
    const groups=labels.length,groupW=(W-pad.l-pad.r)/groups,sCount=series.length,barW=groupW*0.28;
    labels.forEach((l,i)=>{series.forEach((s,si)=>{const x=pad.l+groupW*i+groupW/2-(sCount*barW)/2+si*barW;const y=pad.t+(H-pad.t-pad.b)*(1-s[i]/max);const h=(H-pad.t-pad.b)-(H-pad.t-pad.b)*(1-s[i]/max);ctx.fillStyle=colors[si];ctx.fillRect(x,y,barW*0.85,h);});ctx.fillStyle=mutedC;ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(l,pad.l+groupW*i+groupW/2,H-pad.b+6);});
    if(opts&&opts.legend){let lx=pad.l;opts.legend.forEach((name,si)=>{ctx.fillStyle=colors[si];ctx.fillRect(lx,H-14,10,10);ctx.fillStyle=mutedC;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(name,lx+14,H-9);lx+=22+ctx.measureText(name).width+12;});}
  } else if(type==='donut'){
    const total=series[0].reduce((a,b)=>a+b,0)||1;
    const cx=W/2,cy=H/2-8,r=Math.max(10,Math.min(W,H-40)/2.6);
    let start=-Math.PI/2;
    series[0].forEach((v,i)=>{const ang=2*Math.PI*v/total;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,start+ang);ctx.closePath();ctx.fillStyle=colors[i];ctx.fill();start+=ang;});
    ctx.globalCompositeOperation='destination-out';ctx.beginPath();ctx.arc(cx,cy,r*0.6,0,Math.PI*2);ctx.fill();ctx.globalCompositeOperation='source-over';
    ctx.fillStyle=cs.getPropertyValue('--text').trim();ctx.font='bold 17px Inter, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(total.toLocaleString(),cx,cy-4);
    ctx.font='10px Inter, sans-serif';ctx.fillStyle=mutedC;ctx.fillText('Total',cx,cy+12);
    if(opts&&opts.legend){let ly=H-8-(opts.legend.length*14);opts.legend.forEach((name,i)=>{ctx.fillStyle=colors[i];ctx.fillRect(12,ly,10,10);ctx.fillStyle=mutedC;ctx.textAlign='left';ctx.textBaseline='middle';ctx.font='10px Inter, sans-serif';ctx.fillText(`${name} (${series[0][i]})`,26,ly+5);ly+=14;});}
  } else if(type==='polar'){
    const cx=W/2,cy=H/2,maxR=Math.max(10,Math.min(W,H)/2-20),total=series[0].length,max=Math.max(...series[0]);
    let start=-Math.PI/2;
    series[0].forEach((v,i)=>{const r=maxR*(v/max);const ang=2*Math.PI/total;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,start,start+ang);ctx.closePath();ctx.fillStyle=colors[i];ctx.globalAlpha=0.8;ctx.fill();ctx.globalAlpha=1;start+=ang;});
  }
}
function drawAllCharts(){
  requestAnimationFrame(()=>{
    if($('lineChart')){
      const hours=Array.from({length:24},(_,i)=>`${i}h`);
      const legit=hours.map(()=>Math.floor(Math.random()*2600)+4200);
      const fraud=hours.map(()=>Math.floor(Math.random()*60)+12);
      drawChart('lineChart','line',[legit,fraud],hours,['#2E308E','#ef4444']);
    }
    if($('barChart')){
      const t=txns();
      const by=c=>({app:t.filter(x=>x.channel===c&&x.finalDecision==='Approved').length,rej:t.filter(x=>x.channel===c&&x.finalDecision==='Rejected').length});
      const u=by('UPI'),cd=by('Card'),nb=by('Net Banking');
      drawChart('barChart','bar',[[u.app,cd.app,nb.app],[u.rej,cd.rej,nb.rej]],['UPI','Card','NB'],['#22c55e','#ef4444'],{legend:['Approved','Rejected']});
    }
    if($('donutChart')){
      const t=txns();
      const app=t.filter(x=>x.finalDecision==='Approved').length;
      const rej=t.filter(x=>x.finalDecision==='Rejected').length;
      drawChart('donutChart','donut',[[app,rej]],[],['#22c55e','#ef4444'],{legend:['Approved','Rejected']});
    }
    if($('modelChart')){drawChart('modelChart','line',[Array.from({length:30},()=>92+Math.random()*4),Array.from({length:30},()=>88+Math.random()*5),Array.from({length:30},()=>90+Math.random()*4)],Array.from({length:30},(_,i)=>`D${i+1}`),['#2E308E','#f59e0b','#22c55e']);}
    if($('fraudTypeChart'))drawChart('fraudTypeChart','polar',[[28,22,15,18,10,7]],[],['#ef4444','#f59e0b','#2E308E','#92BBE6','#22c55e','#a855f7']);
    if($('feedbackChart'))drawChart('feedbackChart','bar',[[9.2,7.8,6.4,5.2,4.3,3.6,3.1,2.8],[42,51,58,63,71,78,84,92]],['W1','W2','W3','W4','W5','W6','W7','W8'],['#ef4444','#22c55e'],{legend:['FP %','Overrides']});
  });
}
function explain(){
  const t=txns().find(x=>x.id===localStorage.dvSelected_v4)||txns()[0];
  const color=t.risk>75?'var(--danger)':t.risk>45?'var(--warn)':'var(--safe)';
  ['','2'].forEach(s=>{if($('explainId'+s)){$('explainId'+s).textContent=`${t.id} - ${t.channel} - Rs ${fmt(t.amount)}`;$('explainScore'+s).innerHTML=`${t.risk} <small>/100</small>`;$('explainScore'+s).style.color=color;['XGB','LSTM','GNN'].forEach(k=>{const v=t[k.toLowerCase()];if($('sig'+k+s)){$('sig'+k+s).textContent=v;$('fill'+k+s).style.width=v+'%';}});}});
  if($('aiDecisionLabel'))$('aiDecisionLabel').innerHTML=`AI Decision: <span class="status st-${t.aiDecision}">${t.aiDecision}</span>`+(t.overridden?` <span class="override-tag">Overridden</span>`:'');
  if($('explainReasons'))$('explainReasons').innerHTML=t.reasons.map(r=>`<span class="tag">${r}</span>`).join('');
}
function renderTable(){
  const body=$('txnBody');if(!body)return;
  const filter=localStorage.dvFilter||'all';
  let rows=txns();
  if(filter==='Approved')rows=rows.filter(t=>t.finalDecision==='Approved');
  else if(filter==='Rejected')rows=rows.filter(t=>t.finalDecision==='Rejected');
  else if(filter==='high-risk')rows=rows.filter(t=>t.risk>75);
  else if(filter==='overridden')rows=rows.filter(t=>t.overridden);
  body.innerHTML=rows.map(t=>{
    const badge=t.overridden?`<span class="override-tag">Overridden</span>`:'';
    const btn=t.aiDecision==='Rejected'?`<button class="btn safe" onclick="event.stopPropagation();openReview('approve','${t.id}')">Approve</button>`:`<button class="btn danger" onclick="event.stopPropagation();openReview('reject','${t.id}')">Reject</button>`;
    return `<tr class="${localStorage.dvSelected_v4===t.id?'selected':''}" onclick="selectTxn('${t.id}')"><td><b>${t.id}</b></td><td>${t.time}</td><td>${t.channel}</td><td>Rs ${fmt(t.amount)}</td><td><span class="pill ${rclass(t.risk)}">${t.risk}</span></td><td><span class="status st-${t.aiDecision}">${t.aiDecision}</span></td><td><span class="status st-${t.finalDecision}">${t.finalDecision}</span> ${badge}</td><td>${t.reasons.map(r=>`<span class="tag">${r}</span>`).join('')}</td><td>${btn} <button class="btn" onclick="event.stopPropagation();openReview('agree','${t.id}')">Agree</button></td></tr>`;
  }).join('');
}
function selectTxn(id){localStorage.dvSelected_v4=id;renderTable();explain();renderDetail();}
function renderDetail(){
  const el=$('txnDetail');if(!el)return;
  const t=txns().find(x=>x.id===localStorage.dvSelected_v4)||txns()[0];
  const note=t.overridden?`<div class="small" style="color:var(--warn);margin-top:8px">Analyst overrode AI. Reason: <b>${t.analystReason||'-'}</b></div>`:'';
  el.innerHTML=`<b>${t.id}</b><br>Channel: ${t.channel}<br>Amount: Rs ${fmt(t.amount)}<br>AI Decision: <span class="status st-${t.aiDecision}">${t.aiDecision}</span><br>Final: <span class="status st-${t.finalDecision}">${t.finalDecision}</span><br>Risk: <span class="pill ${rclass(t.risk)}">${t.risk}</span><br><br><b>Reasons:</b><br>${t.reasons.map(r=>`<span class="tag">${r}</span>`).join('')}${note}`;
}
function bindFilters(){document.querySelectorAll('[data-filter]').forEach(c=>c.onclick=()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.classList.remove('active'));c.classList.add('active');localStorage.dvFilter=c.dataset.filter;renderTable();});}
let modalCtx={};
function openReview(action,id){
  modalCtx={action,id:id||localStorage.dvSelected_v4};
  const t=txns().find(x=>x.id===modalCtx.id);if(!t)return;
  let title='',desc='';
  if(action==='approve'){title='Mark as Approved';desc=`AI Rejected this. Marking Approved adds training data (AI was wrong: false rejection).`;}
  else if(action==='reject'){title='Mark as Rejected';desc=`AI Approved this. Marking Rejected adds training data (AI was wrong: false approval).`;}
  else{title='Agree with AI';desc=`Confirms AI decision (${t.aiDecision}) as positive training data.`;}
  $('modalTitle').textContent=title;$('modalDesc').textContent=desc;
  $('modalBack').classList.add('show');$('modalReason').value='';
}
function closeModal(){$('modalBack').classList.remove('show');}
function submitReview(){
  if(!$('modalReason').value){alert('Reason is mandatory for model training.');return;}
  const t=txns();const x=t.find(i=>i.id===modalCtx.id);if(!x)return;
  const reason=$('modalReason').value;
  if(modalCtx.action==='agree'){x.overridden=false;x.finalDecision=x.aiDecision;x.analystAction='agree';x.analystReason=reason;}
  else{const newDecision=modalCtx.action==='approve'?'Approved':'Rejected';x.overridden=(newDecision!==x.aiDecision);x.finalDecision=newDecision;x.analystAction=x.overridden?'disagree':'agree';x.analystReason=reason;}
  saveTxns(t);
  const tr=training();tr.total+=1;if(x.analystAction==='agree')tr.agree+=1;else tr.disagree+=1;saveTraining(tr);
  closeModal();showToast('Training data captured',`${x.id} - ${x.finalDecision} - added to next retraining cycle`);
  renderTable();explain();setCounts();renderTrainingBanner();drawAllCharts();
}
function showToast(a,b){$('toastTitle').textContent=a;$('toastMsg').textContent=b;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2600);}
function renderAlerts(){const el=$('alertsList');if(!el)return;el.innerHTML=notifs().map(n=>`<div class="alert ${n.type}"><div style="flex:1"><div class="alert-title">${n.title} ${n.unread?'<span class="tag" style="color:var(--primary);border-color:var(--primary)">NEW</span>':''}</div><div class="alert-msg">${n.msg} - ${n.time}</div></div><button class="btn" onclick="dismiss(${n.id})">Mark read</button></div>`).join('');}
function dismiss(id){const n=notifs();const x=n.find(i=>i.id===id);if(x)x.unread=false;saveNotifs(n);renderAlerts();renderNotifPanel();}
function overviewAlerts(){const el=$('alertsStrip');if(!el)return;el.innerHTML=notifs().filter(n=>n.unread).slice(0,2).map(n=>`<div class="alert ${n.type}"><div style="flex:1"><div class="alert-title">${n.title}</div><div class="alert-msg">${n.msg}</div></div><button class="close" onclick="dismiss(${n.id});overviewAlerts()">x</button></div>`).join('');}
function renderTrainingBanner(){const el=$('trainingBanner');if(!el)return;const t=training();el.innerHTML=`<div style="flex:1;min-width:200px"><b>Analyst overrides feed the online learning loop.</b><div class="small">Every override becomes labeled training data for XGBoost, LSTM, GNN. Retrains every 24 hours.</div></div><div class="training-stat"><div class="num" style="color:var(--primary)">${t.total}</div><div class="small">Training samples</div></div><div class="training-stat"><div class="num" style="color:var(--safe)">${t.agree}</div><div class="small">AI confirmed</div></div><div class="training-stat"><div class="num" style="color:var(--warn)">${t.disagree}</div><div class="small">AI overridden</div></div>`;}
let resizeTimer;
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(drawAllCharts,120);});
window.onload=()=>{
  common();bindFilters();overviewAlerts();renderTable();renderDetail();renderAlerts();explain();renderTrainingBanner();
  requestAnimationFrame(()=>{requestAnimationFrame(drawAllCharts);});
  if(window.ResizeObserver){document.querySelectorAll('.chartbox').forEach(box=>{new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(drawAllCharts,80);}).observe(box);});}
  if($('modalBack'))$('modalBack').onclick=e=>{if(e.target.id==='modalBack')closeModal();};
};
