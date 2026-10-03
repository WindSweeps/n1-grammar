'use strict';
const DATA=JSON.parse(document.getElementById('grammarData').textContent);
const CATS=[
{id:'time',name:'时间与进程',hint:'刚一… · 自从… · 直到…',prompt:'动作在什么时候发生？'},
{id:'conditions',name:'条件与前提',hint:'如果… · 取决于… · 有了…才',prompt:'什么条件，才能让后项成立？'},
{id:'concession',name:'让步与逆接',hint:'即使… · 虽说… · 明明…',prompt:'前项成立，为什么仍然相反？'},
{id:'cause',name:'原因与结果',hint:'正因为… · 由于… · 结果竟…',prompt:'因为什么，又落到什么结果？'},
{id:'degree',name:'程度与极限',hint:'极其… · 无比… · …得过头',prompt:'说话人把程度推到了哪里？'},
{id:'judgment',name:'判断与可能',hint:'一定… · 无须… · 不可能…',prompt:'说话人如何评估这件事？'},
{id:'emotion',name:'情感与自发',hint:'禁不住… · 不得不… · 不忍…',prompt:'是什么力量，让动作无法避免？'},
{id:'evaluation',name:'评价与立场',hint:'身为… · 相比… · 无视…',prompt:'从什么立场看，才有这样的评价？'},
{id:'scope',name:'范围与限定',hint:'唯有… · 不止… · 连…也',prompt:'边界在哪里，哪些也被包含？'},
{id:'manner',name:'方式与伴随',hint:'顺便… · 一边… · 宛如…',prompt:'两件事以什么方式同时发生？'},
{id:'intention',name:'意志与应对',hint:'为了… · 禁止… · 大不了…',prompt:'想要做什么，又如何作出应对？'},
{id:'topic',name:'话题与表述',hint:'说起… · 也就… · 与其说…',prompt:'如何引出话题、限定或换种说法？'}
];
const BYID=Object.fromEntries(DATA.map(d=>[d.id,d]));
const CAT=Object.fromEntries(CATS.map(c=>[c.id,c]));
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='bunpo-atlas-n1-v1';
let progress={known:[],star:[]},storageOK=true;
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved)for(const k of ['known','star'])if(Array.isArray(saved[k]))progress[k]=[...new Set(saved[k].filter(id=>BYID[id]))];}catch{storageOK=false;}
let selectedCat=null,selectedId=null,mode='map',query='',filter='all',translationOpen=false;
let quiz=[],quizIndex=0,quizRemembered=0,quizAnswered=false,toastTimer,quizPhase='setup',quizScope='current';
let overlay=null,lockedScroll=null,navigationIds=[],returnEntryId=null,searchComposing=false;
const isCompact=()=>window.innerWidth<=1270;
const isPhone=()=>window.innerWidth<=760;
const filterNames={all:'全部语法',new:'待学习',known:'已掌握',star:'已收藏'};
const navScroll=new Map();

function viewKey(){return [mode,selectedCat||'',filter,query].join('|');}
function routeHash(){if(overlay==='detail'&&selectedId)return '#grammar/'+selectedId;if(overlay)return '#'+overlay;if(mode==='compare')return '#compare';if(selectedCat)return '#category/'+selectedCat;if(filter==='star')return '#star';return '#map';}
function snapshot(){return {atlas:2,cat:selectedCat,id:selectedId,mode,query,filter,overlay,scroll:lockedScroll??window.scrollY,queue:navigationIds,returnEntryId,quiz:quiz.map(d=>d.id),quizIndex,quizRemembered,quizAnswered,quizPhase,quizScope};}
function rememberCurrent(){history.replaceState(snapshot(),'',routeHash());}
function pushCurrent(){history.pushState(snapshot(),'',routeHash());}
function lockPage(){if(lockedScroll!==null)return;lockedScroll=window.scrollY;Object.assign(document.body.style,{position:'fixed',top:-lockedScroll+'px',left:'0',right:'0',width:'100%'});}
function unlockPage(){if(lockedScroll===null)return;const y=lockedScroll;lockedScroll=null;Object.assign(document.body.style,{position:'',top:'',left:'',right:'',width:''});window.scrollTo(0,y);}
function mountOverlay(){
 if(!overlay)return;
 lockPage();
 if(overlay==='detail'){
  const panel=$('#detail');document.body.appendChild(panel);panel.classList.add('mobile-open');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
  $('#app').inert=true;$('.mobile-dock').inert=true;$('#detailBackdrop').classList.add('open');$('#closeDetail').focus({preventScroll:true});
 }else{
  const dialog=$(overlay==='quiz'?'#quizDialog':'#helpDialog');if(!dialog.open)dialog.showModal();
 }
}
function unmountOverlay(){
 const panel=$('#detail');panel.classList.remove('mobile-open');panel.removeAttribute('role');panel.removeAttribute('aria-modal');$('.workspace').appendChild(panel);
 $('#app').inert=false;$('.mobile-dock').inert=false;$('#detailBackdrop').classList.remove('open');
 for(const selector of ['#quizDialog','#helpDialog'])if($(selector).open)$(selector).close();
 unlockPage();
}
function closeOverlay(){if(history.state?.atlas===2&&history.state.overlay){history.back();}else{overlay=null;unmountOverlay();}}
function navigate(changes,{restoreScroll=false}={}){
 navScroll.set(viewKey(),window.scrollY);rememberCurrent();
 selectedCat=changes.cat===undefined?selectedCat:changes.cat;mode=changes.mode||'map';query=changes.query??'';filter=changes.filter??filter;selectedId=null;navigationIds=[];
 renderMap();renderDetail();
 if(isPhone()){const y=restoreScroll?(navScroll.get(viewKey())??0):Math.max(0,$('#main').getBoundingClientRect().top+window.scrollY-10);window.scrollTo(0,y);}
 pushCurrent();
}
function restoreSnapshot(state){
 if(state?.atlas!==2){overlay=null;unmountOverlay();return;}
 const previousReturn=returnEntryId;unmountOverlay();
 selectedCat=CAT[state.cat]?state.cat:null;selectedId=BYID[state.id]?state.id:null;mode=state.mode==='compare'?'compare':'map';query=state.query||'';filter=filterNames[state.filter]?state.filter:'all';
 overlay=state.overlay||null;navigationIds=(state.queue||[]).filter(id=>BYID[id]);returnEntryId=state.returnEntryId||null;translationOpen=false;
 quiz=(state.quiz||[]).filter(id=>BYID[id]).map(id=>BYID[id]);quizIndex=state.quizIndex||0;quizRemembered=state.quizRemembered||0;quizAnswered=!!state.quizAnswered;quizPhase=state.quizPhase||'setup';quizScope=state.quizScope||'current';
 renderMap();renderDetail();window.scrollTo(0,state.scroll||0);
 if(overlay==='quiz')renderQuiz();
 if(overlay==='detail'&&!isCompact())overlay=null;
 if(overlay)mountOverlay();else if(previousReturn){const source=document.querySelector(`[data-entry="${previousReturn}"]`)||$('#filter');source.focus({preventScroll:true});}
}
window.addEventListener('popstate',event=>restoreSnapshot(event.state));
const bridgeIds=new Set(['conditions-04','concession-07','judgment-01','judgment-02','judgment-03','evaluation-05','intention-05','intention-07','scope-07','topic-05','topic-09']);
function toast(msg){$('#toast').textContent=msg;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').hidden=true;},2500);}
function save(){try{localStorage.setItem(KEY,JSON.stringify(progress));}catch{storageOK=false;toast('浏览器无法保存进度，可在使用指南导出备份。');}updateProgress();}
function updateProgress(){const n=progress.known.length;$('#masteredCount').textContent=n;$('#totalCount').textContent=DATA.length;$('#footerTotal').textContent=DATA.length;$('#progressFill').style.width=n/DATA.length*100+'%';$('.line').setAttribute('aria-valuenow',n);$('.line').setAttribute('aria-valuemax',DATA.length);$('#storageNote').textContent=storageOK?'学习进度自动保存在当前浏览器':'当前环境无法保存进度，可在使用指南导出备份';}
function visibleData(){return DATA.filter(d=>(!selectedCat||d.category===selectedCat)&&(!query||[d.pattern,d.meaning,d.connection,d.nuance,d.example,d.cue,CAT[d.category].name].some(v=>v.toLowerCase().includes(query.trim().toLowerCase())))&&(filter==='all'||filter==='known'&&progress.known.includes(d.id)||filter==='new'&&!progress.known.includes(d.id)||filter==='star'&&progress.star.includes(d.id)));}
function renderNav(){const navItem=(id,name,num,count)=>`<button class="nav-item ${mode==='map'&&selectedCat===id?'active':''}" data-cat="${id||''}" ${mode==='map'&&selectedCat===id?'aria-current="true"':''}><span class="number">${num}</span>${name}<span class="count">${count}</span></button>`;$('#categoryNav').innerHTML=navItem(null,'全景导图','◉',DATA.length)+CATS.map((c,i)=>navItem(c.id,c.name,String(i+1).padStart(2,'0'),DATA.filter(d=>d.category===c.id).length)).join('');$('#compareBtn').classList.toggle('active',mode==='compare');$('#mobileCategory').innerHTML='<option value="">全景导图</option>'+CATS.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');$('#mobileCategory').value=selectedCat||'';}
function nodeHTML(d,style=''){const done=progress.known.includes(d.id),star=progress.star.includes(d.id);return `<button class="node grammar ${selectedId===d.id?'selected':''} ${done?'done':''}" data-entry="${d.id}" style="${style}" aria-pressed="${selectedId===d.id}"><span class="node-title" lang="ja">${esc(d.pattern)}</span><span class="node-sub">${esc(d.meaning)}</span><span class="state-dot" aria-label="${done?'已掌握 ':''}${star?'已收藏':''}">${done?'● ':''}${star?'★':''}</span></button>`;}
function renderMap(){renderNav();renderMobileSession();$('#clearSearch').hidden=!query;$('#searchAll').hidden=!query||!selectedCat;if(document.activeElement!==$('#search'))$('#search').value=query;$('#search').placeholder=selectedCat?'搜索当前分类…':'搜索语法、中文含义或接续…';$('#filter').value=filter;$('#breadcrumb').innerHTML=`语法地图 / <b>${mode==='compare'?'易混辨析':selectedCat?CAT[selectedCat].name:'全景'}</b>`;
 if(mode==='compare'){renderCompare();return;}
 const list=visibleData(),isFiltered=!!query||filter!=='all';
 $('#quizBtn').disabled=!list.length;$('#mapTag').textContent=isFiltered?list.length+' 个匹配条目':selectedCat?list.length+' 个学习节点':'12 个语义分支';
 $('#mapHint').textContent=isFiltered?'点击结果查看语法卡片':'点击分支展开 · 点击中心返回全景';
 if(isFiltered){$('#mapContent').innerHTML=`<div class="result-area"><p class="result-heading">${query?'搜索「'+esc(query)+'」':'按学习状态筛选'}${selectedCat?' · '+CAT[selectedCat].name:' · 全部分类'}</p>${list.length?'<div class="result-grid">'+list.map(d=>nodeHTML(d)).join('')+'</div>':'<div class="empty"><strong>这里暂时没有条目</strong><p>试试其他关键词，或返回全景并清除筛选。</p><button class="secondary" data-reset>显示全部语法</button></div>'}</div>`;return;}
 const nodes=selectedCat?list:CATS;
 const half=Math.ceil(nodes.length/2);
 const root=selectedCat?`<strong>${CAT[selectedCat].name}</strong><span>返回全景 ↑</span>`:'<strong>N1</strong><span lang="ja">日本語文法</span><small>从语义开始</small>';
 $('#mapContent').innerHTML=`<div class="mindmap ${selectedCat?'category':''}" role="group" aria-label="${selectedCat?CAT[selectedCat].name:'N1语法全景'}思维导图"><svg class="branches" aria-hidden="true"></svg><button class="root-node" id="mapRoot" aria-label="${selectedCat?'收起当前分支，返回全景':'N1语法全景'}">${root}</button>${nodes.map((d,i)=>{const style=`grid-column:${i<half?1:3};grid-row:${i%half+1}`;return selectedCat?nodeHTML(d,style):`<button class="node group" data-cat="${d.id}" style="${style}"><span class="node-num">${String(i+1).padStart(2,'0')}</span><span class="node-title">${d.name}</span><span class="node-sub">${d.hint}</span></button>`;}).join('')}</div>`;
 requestAnimationFrame(drawBranches);
}
function drawBranches(){const map=$('.mindmap'),svg=$('.branches'),root=$('#mapRoot');if(!map||!svg||!root||window.innerWidth<=760)return;const box=map.getBoundingClientRect(),r=root.getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);svg.innerHTML=[...map.querySelectorAll('.node')].map(node=>{const n=node.getBoundingClientRect(),left=n.left<r.left;const x1=(left?r.left:r.right)-box.left,y1=r.top+r.height/2-box.top,x2=(left?n.right:n.left)-box.left,y2=n.top+n.height/2-box.top;const mid=(x1+x2)/2;return `<path d="M ${x1} ${y1} C ${mid} ${y1},${mid} ${y2},${x2} ${y2}"/>`;}).join('');}
function chooseCategory(id){navigate({cat:id||null},{restoreScroll:!id});}
function renderGuide(){const c=selectedCat?CAT[selectedCat]:null;$('#detailContent').innerHTML=`<div class="detail-inner"><div class="detail-kicker">${c?'分支学习 / '+c.name:'STUDY WITH CONNECTIONS'}</div><div class="guide-title">${c?c.prompt:'从语义出发，<br>把句型连起来。'}</div><p class="guide-copy">${c?'点击任一节点，依次学习中文含义、接续规则、日语例句与易混辨析。':'从左侧或导图选择一种语义，把相似表达放在一起学习。每一个节点，都是一张可复习的语法卡。'}</p><div class="guide-steps"><div class="step"><b>01</b><div><strong>看语义，建立连接</strong><p>先分清时间、条件、让步与情感。</p></div></div><div class="step"><b>02</b><div><strong>看接续，读懂语感</strong><p>留意意志、评价和书面语限制。</p></div></div><div class="step"><b>03</b><div><strong>遮住答案，主动回想</strong><p>收藏易忘项，按当前分支开始自测。</p></div></div></div><div class="guide-prompt">今日は、ひと枝ずつ。<br><span style="font-family:var(--sans);font-size:11px;color:var(--muted)">今天，从一个分支开始。</span></div></div>`;}
function renderDetail(){if(selectedId)$('#detailPosition').textContent=CAT[BYID[selectedId].category].name;if(!selectedId){renderGuide();return;}const d=BYID[selectedId];const known=progress.known.includes(d.id),star=progress.star.includes(d.id);const related=(d.related||[]).filter(id=>BYID[id]);$('#detailContent').innerHTML=`<div class="detail-inner"><div class="detail-kicker">${CAT[d.category].name} / ${String(DATA.indexOf(d)+1).padStart(3,'0')}</div><h2 lang="ja">${esc(d.pattern)}</h2>${bridgeIds.has(d.id)?'<div class="bridge">跨级衔接 · 教材分级有差异</div>':''}<p class="meaning">${esc(d.meaning)}</p><div class="detail-block"><div class="label">接续 CONNECTION</div><div class="connection">${esc(d.connection)}</div></div><div class="detail-block"><div class="label">语感与限制</div><p>${esc(d.nuance)}</p></div><div class="detail-block"><div class="label">例句 · 先试着自己翻译</div><p class="example" lang="ja">${esc(d.example)}</p><button class="translation-btn" id="translationBtn" aria-expanded="${translationOpen}">${translationOpen?'收起中文译文':'查看中文译文'}</button><p class="translation" ${translationOpen?'':'hidden'}>${esc(d.translation)}</p></div><div class="detail-block"><div class="label">易混辨析</div><p>${esc(d.contrast)}</p></div><div class="cue"><strong>记忆线索</strong><br>${esc(d.cue)}</div>${related.length?'<div class="detail-block"><div class="label">连接着学</div><div class="related">'+related.map(id=>`<button data-entry="${id}" lang="ja">${esc(BYID[id].pattern)} ↗</button>`).join('')+'</div></div>':''}<div class="source-links">${(d.sources||[]).length?'参考核对：'+d.sources.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`).join(''):'编辑整理 · 原创例句'}</div></div><div class="detail-actions"><div class="detail-pager"><button data-prev ${navigationIds.indexOf(d.id)<=0?'disabled':''}>← 上一条</button><span id="entryPosition">${navigationIds.indexOf(d.id)+1} / ${navigationIds.length}</span><button data-next ${navigationIds.indexOf(d.id)>=navigationIds.length-1?'disabled':''}>下一条 →</button></div><button class="${known?'secondary':'primary'}" id="knownBtn" aria-pressed="${known}">${known?'✓ 已掌握':'标记掌握'}</button><button class="secondary star" id="starBtn" aria-pressed="${star}">${star?'★ 已收藏':'☆ 收藏'}</button></div>`;}
function openEntry(id,{keepQueue=false}={}){
 if(!BYID[id])return;
 const opening=overlay!=='detail';
 if(opening){rememberCurrent();returnEntryId=id;}
 if(!keepQueue){
  const candidates=mode==='compare'?comparisonData():visibleData();
  if(opening||!navigationIds.includes(id))navigationIds=(candidates.some(d=>d.id===id)?candidates:DATA.filter(d=>d.category===BYID[id].category)).map(d=>d.id);
 }
 selectedId=id;translationOpen=false;renderMap();renderDetail();
 if(isCompact()){
  if(opening){overlay='detail';mountOverlay();pushCurrent();}else rememberCurrent();
 }else rememberCurrent();
 const content=$('#detail .detail-inner');if(content)content.scrollTop=0;
}
function closeDetail(){closeOverlay();}
function toggleProgress(key){
 if(!selectedId)return;const active=progress[key].includes(selectedId),content=$('#detail .detail-inner'),scroll=content?.scrollTop||0;
 progress[key]=active?progress[key].filter(id=>id!==selectedId):[...progress[key],selectedId];save();renderMap();renderDetail();
 if($('#detail .detail-inner'))$('#detail .detail-inner').scrollTop=scroll;
 toast(key==='known'?(active?'已移回待学习':'已标记掌握'):(active?'已取消收藏':'已加入收藏'));
}
function stepEntry(direction){
 const i=navigationIds.indexOf(selectedId),next=i+direction;
 if(i<0||next<0||next>=navigationIds.length)return;
 openEntry(navigationIds[next],{keepQueue:true});
 if(overlay==='detail')$('#closeDetail').focus({preventScroll:true});
}
function comparisonData(){return [...new Set(COMPARISONS.flatMap(c=>c.items.map(([id])=>id)))].filter(id=>BYID[id]).map(id=>BYID[id]);}
function renderMobileSession(){
 const pool=mode==='compare'?comparisonData():visibleData();
 const scope=mode==='compare'?'易混辨析':selectedCat?CAT[selectedCat].name:'全部分类';
 $('#mobileSession .session-copy').textContent=scope+' · '+filterNames[filter]+' · '+pool.length+' 条';
 $('#mobileReview').textContent='复习 '+Math.min(pool.length,10)+' 条';$('#mobileReview').disabled=!pool.length;
 for(const [id,active] of [['dockMap',mode==='map'&&filter!=='star'],['dockStars',mode==='map'&&filter==='star'],['dockCompare',mode==='compare']]){const button=$('#'+id);button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
}
const COMPARISONS=[
{title:'一…就…：都快，焦点不同',note:'三者都常描述已经发生的紧接事件；不要只用中文翻译区分。',items:[['time-01','动作刚发生，后项立刻发生，强调间隔极短。'],['time-02','“刚一…就…”，常带出迅速的反应，偏书面。'],['time-03','同一主体随即做出后续动作，常含意外感。']]},
{title:'顺便做，还是同时兼顾？',note:'先判断两件事是同一次外出，还是长期并行。',items:[['manner-01','主行动顺便兼做另一件事，多见于移动、外出。'],['manner-02','借做某事的机会兼做另一件事，表达正式，常用于问候。'],['manner-03','以某事为主要工作或生活，一面长期兼做另一件事。']]},
{title:'没有 A，就没有 B',note:'都能表达必要条件，接续和观察角度不同。',items:[['conditions-03','接名词，强调缺少必要条件，后项通常否定。'],['conditions-04','名词＋なしには，常与不可能、无法做到相呼应。'],['conditions-05','A あっての B：正是有 A 才成立的 B，用名词结构肯定 A。']]},
{title:'不可避免：引发，还是责任？',note:'注意句子的主语和“不得不”的来源。',items:[['emotion-04','引发某种反应，或强烈决意要使某事发生。'],['emotion-05','若不这样做就说不过去，侧重责任、常识或局势。'],['emotion-02','受外部情况所迫，被迫做某事。']]},
{title:'に堪えない：感情，还是评价？',note:'相同表面形式，前面的词类和意义改变解读。',items:[['degree-07','名词＋に堪えない：感激、遗憾等感情强烈。'],['degree-08','动词辞书形＋に堪えない：不值得看、听，或不忍承受。'],['emotion-08','动词辞书形＋に忍びない：因情感上不忍心而难以做。']]},
{title:'无须做：不必要，与不至于',note:'这些表达常是说话人的判断，而不是能力不足。',items:[['judgment-04','没有必要特地做到那一步；“言うまでもない”也是常用搭配。'],['intention-09','不必做；接名词时也可表示比不上，需看结构。'],['judgment-05','事情没有达到值得惊讶、责备等程度。']]},
{title:'目的，必然，禁令',note:'别被共同出现的「べ」误导，要整块记忆。',items:[['intention-01','为了某个目标而行动，偏正式书面表达。'],['intention-02','前置条件已具备，出现这样的结果是必然的。'],['intention-03','书面禁令：不许…；并非普通的“不应该”。']]},
{title:'三个「なり」：接法决定读法',note:'先看なり前的形式，以及它是否成对出现。',items:[['time-03','动词辞书形＋なり：刚一…就…（直后）。'],['topic-06','名词等＋なりに／なりの：有其自身方式或相应程度。'],['topic-07','A なり B なり：列举可选方案，如…或…。']]}
];
function renderCompare(){$('#quizBtn').disabled=false;$('#mapTag').textContent='8 组核心辨析';$('#mapHint').textContent='点击句型打开完整语法卡';$('#mapContent').innerHTML='<div class="result-area"><p class="result-heading">先找差异，再连回语法节点。</p><div class="compare-list">'+COMPARISONS.map(c=>`<article class="compare"><h3>${c.title}</h3><p>${c.note}</p>${c.items.filter(([id])=>BYID[id]).map(([id,why])=>`<div class="compare-row"><button data-entry="${id}" lang="ja">${esc(BYID[id].pattern)} ↗</button><p>${why}</p></div>`).join('')}</article>`).join('')+'</div></div>';}
function showCompare(){navigate({mode:'compare',cat:null,query:'',filter:'all'});}
function quizPool(){
 if(quizScope==='new')return DATA.filter(d=>!progress.known.includes(d.id));
 if(quizScope==='star')return DATA.filter(d=>progress.star.includes(d.id));
 if(quizScope==='all')return DATA;
 return mode==='compare'?comparisonData():visibleData();
}
function startQuiz(){rememberCurrent();quizScope='current';quizPhase='setup';quiz=[];quizIndex=0;renderQuiz();overlay='quiz';mountOverlay();pushCurrent();}
function beginQuiz(){
 quiz=[...quizPool()];if(!quiz.length)return;
 for(let i=quiz.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[quiz[i],quiz[j]]=[quiz[j],quiz[i]];}
 quiz=quiz.slice(0,10);quizIndex=0;quizRemembered=0;quizAnswered=false;quizPhase='play';renderQuiz();rememberCurrent();
 $('#quizReveal')?.focus({preventScroll:true});
}
function renderQuiz(){
 const content=$('#quizContent');
 if(quizPhase==='setup'){
  const pool=quizPool(),scope=(mode==='compare'?'易混辨析':selectedCat?CAT[selectedCat].name:'全部分类')+' · '+filterNames[filter]+(query?' · 搜索「'+query+'」':'');
  content.innerHTML=`<div class="modal-body"><div class="eyebrow">先选范围，再开始回想</div><h3 class="quiz-pattern">今天，复习哪一组？</h3><label class="label" for="quizScope">复习范围</label><select id="quizScope" style="width:100%;max-width:none"><option value="current">当前范围：${esc(scope)}</option><option value="new">全部待学习</option><option value="star">全部收藏</option><option value="all">所有语法</option></select><p class="quiz-hint">${pool.length?`共 ${pool.length} 条，本轮随机抽取 ${Math.min(10,pool.length)} 条。<br>先看句型和例句，回想后再揭开答案。`:'这个范围还没有条目，请选择其他范围。'}</p><div class="quiz-buttons"><button class="primary" id="quizStart" ${pool.length?'':'disabled'}>开始 ${Math.min(10,pool.length)} 条自测</button></div></div>`;
  $('#quizScope').value=quizScope;return;
 }
 if(quizIndex>=quiz.length){
  content.innerHTML=`<div class="modal-body"><div class="eyebrow">本轮回想完成</div><h3 class="quiz-pattern">又连接了 ${quiz.length} 个节点。</h3><p class="quiz-hint">记住 ${quizRemembered} 条 · 待复习 ${quiz.length-quizRemembered} 条<br>判断结果已更新到学习进度。</p><div class="quiz-buttons"><button class="secondary" id="quizAgain">选择下一轮</button><button class="primary" id="quizFinish">返回导图</button></div></div>`;return;
 }
 const d=quiz[quizIndex];
 content.innerHTML=`<div class="quiz-progress"><i style="width:${quizIndex/quiz.length*100}%"></i></div><div class="modal-body"><div class="quiz-meta"><span>${CAT[d.category].name}</span><span>${quizIndex+1} / ${quiz.length}</span></div><h3 class="quiz-pattern" lang="ja">${esc(d.pattern)}</h3><p class="quiz-example" lang="ja">${esc(d.example)}</p>${quizAnswered?`<div class="quiz-reveal"><strong>${esc(d.meaning)}</strong><p>${esc(d.translation)}</p><p><b>接续：</b>${esc(d.connection)}</p><p><b>线索：</b>${esc(d.cue)}</p></div><div class="quiz-buttons"><button class="secondary" id="quizRetry">还没记住</button><button class="primary" id="quizKnown">记住了 ✓</button></div>`:'<p class="quiz-hint">回想：含义是什么？前面该接什么形式？</p><div class="quiz-buttons"><button class="primary" id="quizReveal">查看答案</button></div>'}</div>`;
}
function answerQuiz(known){
 const id=quiz[quizIndex].id;progress.known=progress.known.filter(x=>x!==id);
 if(known){progress.known.push(id);quizRemembered++;}
 save();quizIndex++;quizAnswered=false;renderQuiz();renderMap();renderDetail();rememberCurrent();
 $('#quizDialog').scrollTop=0;($('#quizReveal')||$('#quizFinish'))?.focus({preventScroll:true});
}
function openHelp(){rememberCurrent();overlay='help';mountOverlay();pushCurrent();}
function changeQuery(){query=$('#search').value;mode='map';renderMap();rememberCurrent();}
document.addEventListener('click',e=>{
 const el=e.target.closest('button');if(!el)return;
 if(el.hasAttribute('data-cat')){chooseCategory(el.dataset.cat);return;}
 if(el.dataset.entry){openEntry(el.dataset.entry);return;}
 if(el.hasAttribute('data-reset')){navigate({cat:null,query:'',filter:'all'});return;}
 if(el.hasAttribute('data-prev')){stepEntry(-1);return;}
 if(el.hasAttribute('data-next')){stepEntry(1);return;}
 switch(el.id){
  case'mapRoot':case'breadcrumb':chooseCategory(null);break;
  case'dockMap':navigate({cat:null,filter:'all'},{restoreScroll:true});break;
  case'dockStars':navigate({cat:null,filter:'star'},{restoreScroll:true});break;
  case'compareBtn':case'mobileCompare':case'dockCompare':showCompare();break;
  case'clearSearch':query='';$('#search').value='';renderMap();rememberCurrent();$('#search').focus();break;
  case'searchAll':navigate({cat:null,query,filter});break;
  case'translationBtn':{
   const content=$('#detail .detail-inner'),y=content.scrollTop;
   translationOpen=!translationOpen;renderDetail();$('#detail .detail-inner').scrollTop=y;$('#translationBtn').focus({preventScroll:true});break;
  }
  case'knownBtn':toggleProgress('known');$('#knownBtn').focus({preventScroll:true});break;
  case'starBtn':toggleProgress('star');$('#starBtn').focus({preventScroll:true});break;
  case'closeDetail':case'closeHelp':case'closeQuiz':case'quizFinish':closeOverlay();break;
  case'helpBtn':case'sourceBtn':openHelp();break;
  case'quizBtn':case'dockQuiz':case'mobileReview':startQuiz();break;
  case'quizStart':beginQuiz();break;
  case'quizAgain':quizPhase='setup';renderQuiz();rememberCurrent();break;
  case'quizReveal':quizAnswered=true;renderQuiz();rememberCurrent();$('#quizKnown').focus({preventScroll:true});break;
  case'quizRetry':answerQuiz(false);break;
  case'quizKnown':answerQuiz(true);break;
  case'exportBtn':exportProgress();break;
  case'importBtn':$('#importFile').click();break;
 }
});
$('#search').addEventListener('compositionstart',()=>{searchComposing=true;});
$('#search').addEventListener('compositionend',()=>{searchComposing=false;changeQuery();});
$('#search').addEventListener('input',e=>{if(!e.isComposing&&!searchComposing)changeQuery();});
$('#search').addEventListener('keydown',e=>{if(e.key==='Enter'&&!searchComposing)$('#search').blur();});
$('#filter').addEventListener('change',e=>navigate({filter:e.target.value,query}));
$('#mobileCategory').addEventListener('change',e=>chooseCategory(e.target.value));
document.addEventListener('change',e=>{if(e.target.id==='quizScope'){quizScope=e.target.value;renderQuiz();rememberCurrent();$('#quizScope').focus({preventScroll:true});}});
$('#detailBackdrop').addEventListener('click',closeDetail);
for(const selector of ['#quizDialog','#helpDialog'])$(selector).addEventListener('cancel',e=>{e.preventDefault();closeOverlay();});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&overlay==='detail'){e.preventDefault();closeDetail();}
 if(e.key==='Tab'&&overlay==='detail'){
  const controls=[...$('#detail').querySelectorAll('button,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length);
  const first=controls[0],last=controls[controls.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }
});

function exportProgress(){const blob=new Blob([JSON.stringify({format:KEY,exportedAt:new Date().toISOString(),...progress},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='n1-grammar-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('学习进度已导出');}
$('#importFile').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>1000000)throw Error();const data=JSON.parse(await file.text());if(data.format!==KEY||!Array.isArray(data.known)||!Array.isArray(data.star))throw Error();for(const k of ['known','star'])progress[k]=[...new Set([...progress[k],...data[k].filter(id=>typeof id==='string'&&BYID[id])])];save();renderMap();renderDetail();toast('进度已合并');}catch{toast('无法导入，请选择本页面导出的进度 JSON 文件。');}e.target.value='';});
const sourceMap=new Map();DATA.forEach(d=>(d.sources||[]).forEach(s=>{if(/^https?:\/\//.test(s.url))sourceMap.set(s.url,s.title);}));
$('#sourceList').innerHTML='<details><summary>展开 '+sourceMap.size+' 个语法参考页面</summary><ul>'+[...sourceMap].map(([url,title])=>`<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a></li>`).join('')+'</ul></details>';
new ResizeObserver(drawBranches).observe($('#main'));
window.addEventListener('resize',()=>{if(!isCompact()&&overlay==='detail')closeDetail();});
history.scrollRestoration='manual';
const persisted=history.state;
updateProgress();
if(persisted?.atlas===2){
 restoreSnapshot(persisted);rememberCurrent();
}else{
 const initialHash=location.hash,deepEntry=initialHash.startsWith('#grammar/')?initialHash.slice(9):null;
 if(initialHash.startsWith('#category/')&&CAT[initialHash.slice(10)])selectedCat=initialHash.slice(10);
 if(initialHash==='#compare')mode='compare';
 if(initialHash==='#star')filter='star';
 if(deepEntry&&BYID[deepEntry])selectedCat=BYID[deepEntry].category;
 renderMap();renderDetail();rememberCurrent();
 if(deepEntry&&BYID[deepEntry])openEntry(deepEntry);
}
