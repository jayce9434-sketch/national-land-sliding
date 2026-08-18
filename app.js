(() => {
const C = window.NLS_CONFIG;
const hasSupabase = C.SUPABASE_URL && !C.SUPABASE_URL.startsWith("PASTE_") && C.SUPABASE_ANON_KEY && !C.SUPABASE_ANON_KEY.startsWith("PASTE_");
const db = hasSupabase ? window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY) : null;

const AL = [
 {n:0,name:"Trace / Minimal",desc:"Very small or low-impact movement.",items:["Little/no damage","Short runout or tiny debris","No meaningful disruption"]},
 {n:1,name:"Minor",desc:"Small event with limited local effects.",items:["Minor debris or snow movement","Brief trail/road effects possible","Little to no structural damage"]},
 {n:2,name:"Moderate",desc:"Noticeable event capable of localized damage.",items:["Road/trail blockage possible","Small structures or vehicles threatened","Rescue response may be needed"]},
 {n:3,name:"Significant",desc:"Substantial event with damaging potential.",items:["Longer runout / larger volume","Structures, roads or utilities damaged","Serious travel disruption"]},
 {n:4,name:"Major",desc:"Large, dangerous event with major impacts.",items:["Multiple structures/roads affected","Serious injuries possible","Broad local disruption"]},
 {n:5,name:"Severe",desc:"Very large/destructive event.",items:["Major infrastructure damage","Multiple casualties possible","Large evacuation/rescue footprint"]},
 {n:6,name:"Extreme",desc:"Exceptional event with catastrophic local effects.",items:["Community-scale impacts possible","Extreme runout/volume/speed","Major casualty or displacement potential"]},
 {n:7,name:"Catastrophic",desc:"Highest NLS rating: extraordinary disaster-level event.",items:["Devastating populated-area impacts","Massive runout/volume or destructive force","Catastrophic infrastructure/casualty potential"]}
];

let events=[], alerts=[], outlooks=[], probs=[], nasaFeatures=[];
let maps={}, layers={events:[], outlooks:[]}, drawnGeoJSON=null;

const demoEvents=[
 {id:"demo1",hazard_type:"landslide",title:"Demo Hillside Slide",location_name:"Example County",state_region:"West Virginia",country:"United States",lat:38.1,lon:-81.8,al_rating:"AL-2",rating_notes:"Demo record shown until Supabase is configured.",source_url:"",media_urls:[],created_at:new Date().toISOString(),is_demo:true},
 {id:"demo2",hazard_type:"avalanche",title:"Demo Mountain Avalanche",location_name:"Example Range",state_region:"Colorado",country:"United States",lat:39.1,lon:-106.3,al_rating:"AL-3",rating_notes:"Demo record shown until you publish real NLS events.",source_url:"",media_urls:[],created_at:new Date(Date.now()-3600000).toISOString(),is_demo:true}
];
const demoAlerts=[{id:"a1",product:"NLS Landslide Watch",area:"Demo Area",headline:"Conditions may support landslides.",details:"Demo product.",severity:"watch",expires_at:new Date(Date.now()+21600000).toISOString(),created_at:new Date().toISOString(),is_demo:true}];

function esc(v=""){return String(v).replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[s]))}
function ratingNum(r){return Math.max(0,Math.min(7,parseInt(String(r).replace(/\D/g,""))||0))}
function intensityColor(n){return ["#8c8c8c","#2684ff","#36b55c","#ffd33d","#ff8c24","#e33131","#9a46d1","#102d8c"][n]}
function fmtDate(d){try{return new Date(d).toLocaleString()}catch{return d||""}}
function updateStamp(){document.getElementById("lastUpdate").textContent="Updated "+new Date().toLocaleTimeString()}
function setPage(id){
 document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===id));
 document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===id));
 document.getElementById("nav").classList.remove("open");
 if(id==="map") setTimeout(()=>maps.main?.invalidateSize(),50);
 if(id==="outlooks") setTimeout(()=>maps.outlook?.invalidateSize(),50);
 if(id==="admin") setTimeout(()=>maps.admin?.invalidateSize(),50);
}
document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>setPage(b.dataset.page));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>setPage(b.dataset.go));
document.getElementById("menuBtn").onclick=()=>document.getElementById("nav").classList.toggle("open");

function initMaps(){
 maps.main=L.map("mainMap").setView(C.DEFAULT_CENTER,C.DEFAULT_ZOOM);
 maps.outlook=L.map("outlookMap").setView(C.DEFAULT_CENTER,C.DEFAULT_ZOOM);
 maps.admin=L.map("adminMap").setView(C.DEFAULT_CENTER,C.DEFAULT_ZOOM);
 for(const m of Object.values(maps)) L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(m);

 const fg=new L.FeatureGroup().addTo(maps.admin);
 maps.admin.addControl(new L.Control.Draw({edit:{featureGroup:fg},draw:{polyline:false,rectangle:false,circle:false,circlemarker:false,marker:false}}));
 maps.admin.on(L.Draw.Event.CREATED,e=>{fg.clearLayers();fg.addLayer(e.layer);drawnGeoJSON=e.layer.toGeoJSON().geometry});
 maps.admin.on(L.Draw.Event.EDITED,()=>{fg.eachLayer(l=>drawnGeoJSON=l.toGeoJSON().geometry)});
}

async function loadNASA(){
 try{
  const r=await fetch(C.NASA_COOLR_URL,{cache:"no-store"}); if(!r.ok) throw new Error(r.status);
  const j=await r.json(); nasaFeatures=j.features||[];
 }catch(e){console.warn("NASA COOLR load failed",e)}
}
async function loadDB(){
 if(!db){events=demoEvents;alerts=demoAlerts;outlooks=[];probs=[];return}
 const [e,a,o,p]=await Promise.all([
   db.from("events").select("*").order("created_at",{ascending:false}).limit(1000),
   db.from("alerts").select("*").order("created_at",{ascending:false}).limit(200),
   db.from("outlooks").select("*").order("created_at",{ascending:false}).limit(200),
   db.from("probabilities").select("*").order("valid_time",{ascending:true}).limit(1000)
 ]);
 events=e.data||[]; alerts=a.data||[]; outlooks=o.data||[]; probs=p.data||[];
}

function renderScale(){
 document.getElementById("scaleGrid").innerHTML=AL.map(x=>`<article class="scale-card"><header class="al${x.n}">AL-${x.n} • ${x.name}</header><div><b>${x.desc}</b><ul>${x.items.map(i=>`<li>${i}</li>`).join("")}</ul></div></article>`).join("");
}
function eventHTML(e){
 const n=ratingNum(e.al_rating), media=Array.isArray(e.media_urls)?e.media_urls:(e.media_urls||"").split(/\n+/).filter(Boolean);
 return `<article class="event-row">
  <div class="al-badge al${n}">${esc(e.al_rating||"AL-0")}</div>
  <div><div class="meta">${esc((e.hazard_type||"event").toUpperCase())} • ${fmtDate(e.created_at)}</div><h3>${esc(e.title)}</h3>
  <p>${esc([e.location_name,e.state_region,e.country].filter(Boolean).join(", "))}</p><p>${esc(e.rating_notes||"No rating notes.")}</p>
  <div class="meta">${e.estimated_volume?`Size: ${esc(e.estimated_volume)} • `:""}${e.speed?`Speed: ${esc(e.speed)} • `:""}Fatalities: ${Number(e.fatalities||0)} • Injuries: ${Number(e.injuries||0)}</div>
  <div class="media-links">${e.source_url?`<a href="${esc(e.source_url)}" target="_blank" rel="noopener">Source</a>`:""}${media.map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener">Media ${i+1}</a>`).join("")}</div></div>
  <div class="meta">${e.is_demo?"DEMO":"NLS"}</div>
 </article>`;
}
function renderEvents(){
 const q=document.getElementById("eventSearch").value.toLowerCase(), type=document.getElementById("eventType").value, al=document.getElementById("eventAL").value;
 const f=events.filter(e=>(type==="all"||e.hazard_type===type)&&(al==="all"||e.al_rating===al)&&JSON.stringify(e).toLowerCase().includes(q));
 document.getElementById("eventList").innerHTML=f.length?f.map(eventHTML).join(""):'<div class="card">No matching NLS events.</div>';
 document.getElementById("latestEvents").innerHTML=events.slice(0,4).map(e=>`<div class="card"><div class="al-badge al${ratingNum(e.al_rating)}">${esc(e.al_rating)}</div><h3>${esc(e.title)}</h3><p>${esc(e.location_name)}</p></div>`).join("");
}
["eventSearch","eventType","eventAL"].forEach(id=>document.getElementById(id).addEventListener("input",renderEvents));

function alertHTML(a){
 const sev=(a.severity||"watch").toLowerCase();
 return `<article class="card alert-card ${esc(sev)}"><div class="product-title">${esc(a.product)}</div><h3>${esc(a.headline)}</h3><p><b>${esc(a.area)}</b></p><p>${esc(a.details||"")}</p><div class="meta">Expires ${fmtDate(a.expires_at)} • NLS independent product</div></article>`;
}
function renderAlerts(){
 const active=alerts.filter(a=>!a.expires_at||new Date(a.expires_at)>new Date());
 document.getElementById("alertsList").innerHTML=active.length?active.map(alertHTML).join(""):'<div class="card">No active NLS alerts.</div>';
 document.getElementById("homeAlerts").innerHTML=active.length?active.slice(0,3).map(alertHTML).join(""):'<div class="card">No active NLS alerts.</div>';
}

function clearLayerList(arr){arr.forEach(x=>x.remove());arr.length=0}
function renderMap(){
 clearLayerList(layers.events);
 const hz=document.getElementById("hazardFilter").value, hours=document.getElementById("timeFilter").value;
 const cutoff=hours==="all"?0:Date.now()-Number(hours)*3600000;
 for(const e of events){
  if(hz!=="all"&&e.hazard_type!==hz) continue;
  if(cutoff && new Date(e.created_at).getTime()<cutoff) continue;
  if(!Number.isFinite(Number(e.lat))||!Number.isFinite(Number(e.lon))) continue;
  const n=ratingNum(e.al_rating), marker=L.circleMarker([e.lat,e.lon],{radius:7+n,fillColor:intensityColor(n),color:"#111",weight:1,fillOpacity:.8})
   .bindPopup(`<b>${esc(e.title)}</b><br>${esc(e.al_rating)} • ${esc(e.hazard_type)}<br>${esc(e.location_name||"")}<br><small>NLS rated event</small>`).addTo(maps.main);
  layers.events.push(marker);
 }
 // NASA feed: displayed as gray un-rated source points until owner rates them.
 for(const f of nasaFeatures.slice(0,1000)){
  const c=f.geometry?.coordinates;if(!c||c.length<2)continue;
  const p=f.properties||{}; const d=p.event_date||p.event_date_time||p.date||null;
  if(cutoff&&d&&new Date(d).getTime()<cutoff)continue;
  if(hz==="avalanche")continue;
  const m=L.circleMarker([c[1],c[0]],{radius:5,fillColor:"#8c8c8c",color:"#444",weight:1,fillOpacity:.55})
    .bindPopup(`<b>${esc(p.event_title||"NASA COOLR landslide report")}</b><br>${esc(p.location_description||p.country_name||"")}<br><small>Source: NASA COOLR • Unrated by NLS</small>${p.source_link?`<br><a target="_blank" rel="noopener" href="${esc(p.source_link)}">Source link</a>`:""}`).addTo(maps.main);
  layers.events.push(m);
 }
}
document.getElementById("hazardFilter").onchange=renderMap;document.getElementById("timeFilter").onchange=renderMap;
document.getElementById("refreshBtn").onclick=refreshAll;
document.getElementById("locateBtn").onclick=()=>navigator.geolocation?.getCurrentPosition(p=>maps.main.setView([p.coords.latitude,p.coords.longitude],10));

const riskColors={5:"#d9f5d9",10:"#8ae68a",20:"#ffe56c",30:"#ffb13b",50:"#ff6a55",70:"#e74de0",90:"#7c42c9"};
let selectedDay=1;
function renderOutlooks(){
 clearLayerList(layers.outlooks);
 const list=outlooks.filter(o=>Number(o.day)===selectedDay);
 for(const o of list){
  if(!o.geometry)continue;
  const l=L.geoJSON({type:"Feature",geometry:o.geometry,properties:{}},{style:{color:"#222",weight:2,fillColor:riskColors[o.probability]||"#ccc",fillOpacity:.42}})
    .bindPopup(`<b>${esc(o.probability)}% ${esc(o.hazard_type)}</b><br>${esc(o.label||"NLS Outlook")}`).addTo(maps.outlook);
  layers.outlooks.push(l);
 }
 document.getElementById("outlookDetails").innerHTML=list.length?list.map(o=>`<div class="card"><b>${esc(o.probability)}% ${esc(o.hazard_type)}</b><h3>${esc(o.label||"NLS Outlook Area")}</h3><div class="meta">Day ${o.day}</div></div>`).join(""):'<div class="card">No owner-published polygons for this day yet.</div>';
}
document.querySelectorAll("#dayPicker button").forEach(b=>b.onclick=()=>{selectedDay=Number(b.dataset.day);document.querySelectorAll("#dayPicker button").forEach(x=>x.classList.toggle("active",x===b));renderOutlooks()});

function renderDays(){
 const names=["Today","Tomorrow","Day 3"];
 document.getElementById("dayCards").innerHTML=[1,2,3].map((day,i)=>{
  const p=outlooks.filter(o=>Number(o.day)===day).reduce((m,o)=>Math.max(m,Number(o.probability)||0),0);
  return `<div class="day-card"><div class="meta">${names[i]}</div><div class="prob">${p}%</div><b>Highest published NLS probability</b></div>`;
 }).join("");
}

function renderLocal(area="Your Area"){
 document.getElementById("localTitle").textContent=area;
 let arr=probs.filter(p=>String(p.area||"").toLowerCase().includes(area.toLowerCase())).slice(0,24);
 if(!arr.length){
   arr=Array.from({length:12},(_,i)=>({valid_time:new Date(Date.now()+i*3600000).toISOString(),probability:0,hazard_type:"landslide"}));
 }
 document.getElementById("probabilityChart").innerHTML=arr.map(p=>`<div class="hour-block"><small>${new Date(p.valid_time).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</small><b>${Number(p.probability)||0}%</b><span>${esc(p.hazard_type)}</span></div>`).join("");
 document.getElementById("nearbyEvents").innerHTML=events.filter(e=>JSON.stringify(e).toLowerCase().includes(area.toLowerCase())).slice(0,6).map(e=>`<div class="card"><b>${esc(e.al_rating)}</b><h3>${esc(e.title)}</h3><p>${esc(e.location_name)}</p></div>`).join("")||'<div class="card">No matching rated events loaded.</div>';
}
document.getElementById("placeSearch").onclick=()=>renderLocal(document.getElementById("placeInput").value.trim()||"Your Area");
document.getElementById("useGps").onclick=()=>navigator.geolocation?.getCurrentPosition(p=>{maps.main.setView([p.coords.latitude,p.coords.longitude],9);renderLocal("GPS area");setPage("local")});

async function isAdmin(){
 if(!db)return false;
 const {data:{user}}=await db.auth.getUser(); if(!user)return false;
 const {data}=await db.from("admin_users").select("user_id").eq("user_id",user.id).maybeSingle();
 return !!data;
}
async function updateAuthUI(){
 const ok=await isAdmin();
 document.getElementById("adminControls").classList.toggle("hidden",!ok);
 document.getElementById("authBox").classList.toggle("hidden",ok);
 if(ok)setTimeout(()=>maps.admin.invalidateSize(),50);
}
document.getElementById("loginBtn").onclick=async()=>{
 const el=document.getElementById("authMsg");
 if(!db){el.textContent="Configure Supabase in config.js first.";return}
 const email=document.getElementById("adminEmail").value.trim(); if(!email){el.textContent="Enter the owner email.";return}
 const {error}=await db.auth.signInWithOtp({email,options:{emailRedirectTo:location.href}});
 el.textContent=error?error.message:"Magic sign-in link sent. Open it on this device.";
};

async function submitTable(form,table,transform=x=>x){
 const status=form.querySelector(".form-status");status.textContent="Publishing…";
 if(!db){status.textContent="Configure Supabase first.";return}
 if(!(await isAdmin())){status.textContent="Owner authorization required.";return}
 const obj=Object.fromEntries(new FormData(form).entries());
 const final=transform(obj); const {error}=await db.from(table).insert(final);
 status.textContent=error?error.message:"Published!";
 if(!error){form.reset();await refreshAll()}
}
document.getElementById("eventForm").onsubmit=e=>{e.preventDefault();submitTable(e.currentTarget,"events",o=>({...o,lat:Number(o.lat),lon:Number(o.lon),fatalities:Number(o.fatalities||0),injuries:Number(o.injuries||0),media_urls:(o.media_urls||"").split(/\n+/).filter(Boolean)}))};
document.getElementById("alertForm").onsubmit=e=>{e.preventDefault();submitTable(e.currentTarget,"alerts",o=>({...o,expires_at:new Date(o.expires_at).toISOString()}))};
document.getElementById("probForm").onsubmit=e=>{e.preventDefault();submitTable(e.currentTarget,"probabilities",o=>({...o,probability:Number(o.probability),valid_time:new Date(o.valid_time).toISOString()}))};
document.getElementById("outlookForm").onsubmit=e=>{e.preventDefault();if(!drawnGeoJSON){e.currentTarget.querySelector(".form-status").textContent="Draw a polygon first.";return}submitTable(e.currentTarget,"outlooks",o=>({...o,day:Number(o.day),probability:Number(o.probability),geometry:drawnGeoJSON}))};

async function refreshAll(){
 await Promise.all([loadNASA(),loadDB()]);
 renderScale();renderEvents();renderAlerts();renderMap();renderOutlooks();renderDays();renderLocal(document.getElementById("localTitle").textContent==="Choose an area"?"Your Area":document.getElementById("localTitle").textContent);updateStamp();
}
async function realtime(){
 if(!db)return;
 db.channel("nls-public-live")
  .on("postgres_changes",{event:"*",schema:"public",table:"events"},refreshAll)
  .on("postgres_changes",{event:"*",schema:"public",table:"alerts"},refreshAll)
  .on("postgres_changes",{event:"*",schema:"public",table:"outlooks"},refreshAll)
  .on("postgres_changes",{event:"*",schema:"public",table:"probabilities"},refreshAll)
  .subscribe();
 db.auth.onAuthStateChange(()=>setTimeout(updateAuthUI,200));
}
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(console.warn);
initMaps();refreshAll();realtime();updateAuthUI();setInterval(refreshAll,C.AUTO_REFRESH_MS);
})();