const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "little-by-little-v1";
const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const dateFromKey = (key) => new Date(`${key}T12:00:00`);
const defaultData = () => ({
  habits: [
    {id: crypto.randomUUID(), name:"Study", frequency:"daily", icon:"✳"},
    {id: crypto.randomUUID(), name:"Movement", frequency:"3", icon:"⌁"},
    {id: crypto.randomUUID(), name:"YouTube", frequency:"weekly", icon:"◌"},
    {id: crypto.randomUUID(), name:"Read", frequency:"daily", icon:"▤"}
  ],
  completions: {}, notes: {}
});
let data;
try { data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultData(); }
catch { data = defaultData(); }
let editingId = null;
let calendarDate = new Date(); calendarDate.setDate(1);
function save(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function completed(habitId, key=todayKey()){ return !!data.completions[key]?.includes(habitId); }
function toggle(habitId){
  const key=todayKey(); data.completions[key] ||= [];
  const arr=data.completions[key];
  data.completions[key]=arr.includes(habitId)?arr.filter(x=>x!==habitId):[...arr,habitId];
  if(!data.completions[key].length) delete data.completions[key];
  save(); render();
}
function freqLabel(f){return f==="daily"?"Every day":f==="weekly"?"Once a week":`${f} times a week`;}
function habitStreak(h){
  const doneDates=Object.entries(data.completions)
    .filter(([,ids])=>ids.includes(h.id))
    .map(([key])=>dateFromKey(key))
    .sort((a,b)=>a-b);
  if(h.frequency==="daily"){
    const set=new Set(doneDates.map(todayKey));
    let cursor=new Date(); cursor.setHours(12,0,0,0);
    if(!set.has(todayKey(cursor))) cursor.setDate(cursor.getDate()-1);
    let current=0;
    while(set.has(todayKey(cursor))){current++;cursor.setDate(cursor.getDate()-1);}
    let best=0,run=0,prev=null;
    for(const d of doneDates){
      const key=todayKey(d);
      if(prev){const diff=(d-prev)/86400000;run=diff===1?run+1:1;}else run=1;
      best=Math.max(best,run);prev=d;
    }
    return {current,best,unit:"day"};
  }
  const target=h.frequency==="weekly"?1:Number(h.frequency);
  const mondayOf=d=>{const x=new Date(d);x.setHours(12,0,0,0);x.setDate(x.getDate()-(x.getDay()+6)%7);return todayKey(x);};
  const counts={};doneDates.forEach(d=>{const w=mondayOf(d);counts[w]=(counts[w]||0)+1;});
  const weeks=Object.keys(counts).sort();
  let best=0,run=0,prev=null;
  weeks.forEach(w=>{const d=dateFromKey(w);if(counts[w]>=target){run=prev&&((d-dateFromKey(prev))/604800000===1)?run+1:1;best=Math.max(best,run);}else run=0;prev=w;});
  const currentWeek=mondayOf(new Date());
  let cursor=dateFromKey(currentWeek);
  if((counts[currentWeek]||0)<target) cursor.setDate(cursor.getDate()-7);
  let current=0;
  while((counts[todayKey(cursor)]||0)>=target){current++;cursor.setDate(cursor.getDate()-7);}
  return {current,best,unit:"wk"};
}
function renderHabits(){
  const host=$("habitList"); host.innerHTML="";
  if(!data.habits.length){host.innerHTML='<div class="empty-state">No habits yet. Add one small thing you'd like to show up for.</div>';return;}
  data.habits.forEach(h=>{
    const row=document.createElement("div");row.className="habit-row";
    const icon=document.createElement("div");icon.className="habit-icon";icon.textContent=h.icon||"✳";
    const info=document.createElement("div");info.className="habit-info";
    const name=document.createElement("p");name.className="habit-name";name.textContent=h.name;
    const meta=document.createElement("p");meta.className="habit-meta";const streak=habitStreak(h);meta.textContent=`${freqLabel(h.frequency)}  ·  ${streak.current} ${streak.unit} streak`;
    info.append(name,meta);
    const check=document.createElement("input");check.type="checkbox";check.className="habit-check";check.checked=completed(h.id);check.setAttribute("aria-label",`Mark ${h.name} complete`);check.addEventListener("change",()=>toggle(h.id));
    const edit=document.createElement("button");edit.className="edit-habit";edit.textContent="···";edit.setAttribute("aria-label",`Edit ${h.name}`);edit.addEventListener("click",()=>openHabit(h.id));
    row.append(icon,info,check,edit);host.append(row);
  });
}
function renderProgress(){
  const total=data.habits.length,done=data.habits.filter(h=>completed(h.id)).length;
  $("doneCount").textContent=done;$("totalCount").textContent=total;
  $("progressFill").style.width=(total?done/total*100:0)+"%";
  $("progressNote").textContent=total?(done===total?"You showed up for everything. Lovely.":done===0?"A fresh page.": "One step at a time."):"Add a habit to begin.";
}
function renderWeek(){
  const today=new Date();const monday=new Date(today);monday.setDate(today.getDate()-(today.getDay()+6)%7);
  const host=$("weekDots");host.innerHTML="";let count=0;
  for(let i=0;i<7;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);const key=todayKey(d);const active=!!(data.completions[key]||[]).length;if(active)count++;
    const wrap=document.createElement("div");wrap.className="day-dot-wrap";
    const dot=document.createElement("div");dot.className="day-dot"+(active?" active":"")+(key===todayKey()?" today":"");
    const label=document.createElement("span");label.textContent=["M","T","W","T","F","S","S"][i];wrap.append(dot,label);host.append(wrap);}
  $("weekSummary").textContent=`You showed up on ${count} of 7 days this week.`;
}
function renderCalendar(){
  const y=calendarDate.getFullYear(),m=calendarDate.getMonth();
  $("monthTitle").textContent=calendarDate.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  const host=$("calendar");host.innerHTML="";
  ["M","T","W","T","F","S","S"].forEach(x=>{const el=document.createElement("div");el.className="calendar-label";el.textContent=x;host.append(el);});
  const first=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate();
  for(let i=0;i<first;i++){const el=document.createElement("div");host.append(el);}
  for(let day=1;day<=days;day++){const d=new Date(y,m,day),key=todayKey(d);const el=document.createElement("div");el.className="calendar-day"+((data.completions[key]||[]).length?" done":"")+(key===todayKey()?" today":"");el.textContent=day;el.title=(data.completions[key]||[]).length?`${(data.completions[key]||[]).length} habit(s) completed`:"No check-ins recorded";host.append(el);}
}
function render(){
  const now=new Date();$("todayLabel").textContent=now.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"}).toUpperCase();
  renderHabits();renderProgress();renderWeek();renderCalendar();
  $("journal").value=data.notes[todayKey()]||"";
}
function openHabit(id=null){
  editingId=id;const h=data.habits.find(x=>x.id===id);
  $("dialogTitle").textContent=h?"Edit habit":"Add a habit";
  $("habitName").value=h?.name||"";$("habitFrequency").value=h?.frequency||"daily";
  $("deleteHabitBtn").hidden=!h;$("habitDialog").showModal();$("habitName").focus();
}
$("addHabitBtn").addEventListener("click",()=>openHabit());
$("cancelHabitBtn").addEventListener("click",()=>$("habitDialog").close());
$("habitForm").addEventListener("submit",e=>{
  e.preventDefault();const name=$("habitName").value.trim();if(!name)return;
  const frequency=$("habitFrequency").value;
  if(editingId){const h=data.habits.find(x=>x.id===editingId);h.name=name;h.frequency=frequency;}
  else data.habits.push({id:crypto.randomUUID(),name,frequency,icon:"✳"});
  save();$("habitDialog").close();render();
});
$("deleteHabitBtn").addEventListener("click",()=>{
  if(!editingId)return;
  if(confirm("Delete this habit? Your past check-ins will remain in your calendar.")){
    data.habits=data.habits.filter(h=>h.id!==editingId);save();$("habitDialog").close();render();
  }
});
$("journal").addEventListener("input",e=>{data.notes[todayKey()]=e.target.value;save();$("saveStatus").textContent="Saved";});
$("prevMonth").addEventListener("click",()=>{calendarDate.setMonth(calendarDate.getMonth()-1);renderCalendar();});
$("nextMonth").addEventListener("click",()=>{calendarDate.setMonth(calendarDate.getMonth()+1);renderCalendar();});
$("settingsBtn").addEventListener("click",()=>$("settingsDialog").showModal());
$("exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="little-by-little-backup.json";a.click();URL.revokeObjectURL(url);
});
$("resetBtn").addEventListener("click",()=>{
  if(confirm("This will permanently clear habits, check-ins and notes saved in this browser. Continue?")){data=defaultData();save();$("settingsDialog").close();render();}
});
render();