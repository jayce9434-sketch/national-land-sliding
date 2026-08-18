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

let events=[], alerts=[], outlooks=[], probs=[], nasaFeatures=[], lhasaFeatures=[], autoOutlooks=[];
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
 const all=[]; let offset=0; const max=Number(C.COOLR_MAX_RECORDS||20000), size=Number(C.COOLR_PAGE_SIZE||2000);
 try{
  while(offset<max){
   const params=new URLSearchParams({
     where:"1=1",outFields:"*",f:"geojson",
     resultRecordCount:String(size),resultOffset:String(offset),
     orderByFields:"event_date DESC"
   });
   const r=await fetch(C.NASA_COOLR_BASE+"?"+params.toString(),{cache:"no-store"});
   if(!r.ok)throw new Error("COOLR HTTP "+r.status);
   const j=await r.json(), batch=j.features||[];
   all.push(...batch);
   document.getElementById("coolrStatus").textContent=`${all.length.toLocaleString()} reports loaded`;
   document.getElementById("historyStatus").textContent=`NASA history: ${all.length.toLocaleString()} loaded`;
   if(batch.length<size)break;
   offset+=size;
  }
  nasaFeatures=all;
  document.getElementById("coolrStatus").textContent=`${all.length.toLocaleString()} reports loaded`;
 }catch(e){
  console.warn("NASA COOLR load failed",e);
  document.getElementById("coolrStatus").textContent="Feed unavailable / retrying";
 }
}

async function loadLHASA(){
 try{
  const params=new URLSearchParams({
   where:"m_haz_pp_f > 0.01",outFields:"name_0,name_2,m_haz_pp_f,h_haz_pp_f,l_haz_pp_f",
   returnGeometry:"true",outSR:"4326",f:"geojson",resultRecordCount:"2000"
  });
  const r=await fetch(C.NASA_LHASA_URL+"?"+params.toString(),{cache:"no-store"});
  if(!r.ok)throw new Error("LHASA HTTP "+r.status);
  const j=await r.json(); lhasaFeatures=j.features||[];
  document.getElementById("lhasaStatus").textContent=`${lhasaFeatures.length.toLocaleString()} hazard areas loaded`;
 }catch(e){
  console.warn("NASA LHASA load failed",e);
  document.getElementById("lhasaStatus").textContent="Guidance unavailable / retrying";
 }
}
async function loadDB(){
 if(!db){events=demoEvents;alerts=demoAlerts;outlooks=[];probs=[];document.getElementById("nlsStatus").textContent="Demo mode • connect Supabase";return}
 const [e,a,o,p]=await Promise.all([
   db.from("events").select("*").order("created_at",{ascending:false}).limit(1000),
   db.from("alerts").select("*").order("created_at",{ascending:false}).limit(200),
   db.from("outlooks").select("*").order("created_at",{ascending:false}).limit(200),
   db.from("probabilities").select("*").order("valid_time",{ascending:true}).limit(1000)
 ]);
 events=e.data||[]; alerts=a.data||[]; outlooks=o.data||[]; probs=p.data||[];
 document.getElementById("nlsStatus").textContent=`${events.length} rated events • live database`;
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
  <div class="meta">
    ${e.estimated_volume?`Volume: ${esc(e.estimated_volume)} • `:""}
    ${e.estimated_mass?`Mass: ${esc(e.estimated_mass)} • `:""}
    ${e.speed?`Speed: ${esc(e.speed)} • `:""}
    ${e.runout_distance?`Runout: ${esc(e.runout_distance)} • `:""}
    ${e.vertical_drop?`Drop: ${esc(e.vertical_drop)} • `:""}
    ${e.width?`Width: ${esc(e.width)} • `:""}
    ${e.slope_angle?`Slope: ${esc(e.slope_angle)} • `:""}
    ${e.depth?`Depth: ${esc(e.depth)} • `:""}
    ${e.estimated_energy?`Energy: ${esc(e.estimated_energy)} • `:""}
    Fatalities: ${Number(e.fatalities||0)} • Injuries: ${Number(e.injuries||0)}
  </div>
  <div class="meta">
    Exposed: ${Number(e.people_exposed||0)} • Evacuated: ${Number(e.evacuated||0)} • Rescued: ${Number(e.rescued||0)} • Buried/Trapped: ${Number(e.buried||0)}
    ${e.trigger?` • Trigger: ${esc(e.trigger)}`:""}
    ${e.confidence?` • Confidence: ${esc(e.confidence)}`:""}
    ${e.source_count!==undefined?` • Sources: ${Number(e.source_count||0)}`:""}
  </div>
  ${e.structures?`<p><b>Infrastructure:</b> ${esc(e.structures)}</p>`:""}
  ${e.avalanche_details?`<p><b>Avalanche evidence:</b> ${esc(e.avalanche_details)}</p>`:""}
  ${e.landslide_details?`<p><b>Landslide evidence:</b> ${esc(e.landslide_details)}</p>`:""}
  <div class="media-links">${e.source_url?`<a href="${esc(e.source_url)}" target="_blank" rel="noopener">Primary source</a>`:""}${media.map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener">Media ${i+1}</a>`).join("")}</div></div>
  <div class="meta">${e.is_demo?"DEMO":"NLS"}</div>
 </article>`;
}

function suggestedALFromSource(p={}){
 let score=0;
 const size=String(p.landslide_size||"").toLowerCase();
 if(size.includes("very_large")||size.includes("catastrophic"))score+=5;
 else if(size.includes("large"))score+=4;
 else if(size.includes("medium"))score+=3;
 else if(size.includes("small"))score+=2;
 else score+=1;
 const deaths=Number(p.fatality_count||0), injuries=Number(p.injury_count||0);
 if(deaths>=10)score+=3; else if(deaths>=1)score+=2;
 if(injuries>=10)score+=2; else if(injuries>=1)score+=1;
 const text=JSON.stringify(p).toLowerCase();
 if(/destroyed|collapse|buried|blocked road|highway|homes|buildings/.test(text))score+=1;
 const center=Math.max(0,Math.min(7,Math.round(score*.75)));
 return [Math.max(0,center-1),Math.min(7,center+1)];
}
function updateRatingSuggestionFromForm(){
 const f=document.getElementById("eventForm"); if(!f)return;
 let score=0;
 const fatal=Number(f.elements.fatalities?.value||0), inj=Number(f.elements.injuries?.value||0);
 const exposed=Number(f.elements.people_exposed?.value||0), buried=Number(f.elements.buried?.value||0);
 const txt=[f.elements.structures?.value,f.elements.estimated_volume?.value,f.elements.speed?.value,f.elements.runout_distance?.value,f.elements.rating_notes?.value].join(" ").toLowerCase();
 if(fatal>=10)score+=5; else if(fatal>=1)score+=3;
 if(inj>=10)score+=2; else if(inj>=1)score+=1;
 if(buried>=5)score+=2; else if(buried>=1)score+=1;
 if(exposed>=100)score+=2; else if(exposed>=10)score+=1;
 if(/destroy|major|large|massive|highway|homes|buildings|rail/.test(txt))score+=2;
 const c=Math.max(0,Math.min(7,Math.round(score*.8)));
 const lo=Math.max(0,c-1), hi=Math.min(7,c+1);
 document.getElementById("ratingSuggestion").textContent=`Based on entered evidence: consider AL-${lo} to AL-${hi}. Unknown fields are okay.`;
}
function prefillNASAEvent(idx){
 const f=nasaFeatures[idx]; if(!f)return;
 const p=f.properties||{}, c=f.geometry?.coordinates||[];
 const form=document.getElementById("eventForm");
 setPage("admin");
 setTimeout(()=>{
   if(!form)return;
   form.elements.hazard_type.value="landslide";
   form.elements.title.value=p.event_title||"Reported landslide";
   form.elements.location_name.value=p.gazetteer_closest_point||p.location_description||p.admin_division_name||"Reported area";
   form.elements.state_region.value=p.admin_division_name||"";
   form.elements.country.value=p.country_name||"";
   if(c.length>=2){form.elements.lat.value=c[1];form.elements.lon.value=c[0]}
   form.elements.fatalities.value=Number(p.fatality_count||0);
   if(form.elements.injuries)form.elements.injuries.value=Number(p.injury_count||0);
   form.elements.trigger.value=p.landslide_trigger||"";
   form.elements.landslide_details.value=[p.landslide_category?`Type: ${p.landslide_category}`:"",p.landslide_size?`Reported size: ${p.landslide_size}`:""].filter(Boolean).join(" • ");
   form.elements.source_url.value=p.source_link||"";
   form.elements.media_urls.value=p.photo_link||"";
   form.elements.rating_notes.value=p.event_description||"";
   const [lo,hi]=suggestedALFromSource(p);
   document.getElementById("ratingSuggestion").textContent=`NASA source suggests reviewing around AL-${lo} to AL-${hi}. You decide the final rating.`;
   form.scrollIntoView({behavior:"smooth",block:"start"});
 },250);
}

function renderEvents(){
 const q=document.getElementById("eventSearch").value.toLowerCase(), type=document.getElementById("eventType").value, al=document.getElementById("eventAL").value;
 const rated=events.filter(e=>(type==="all"||e.hazard_type===type)&&(al==="all"||e.al_rating===al)&&JSON.stringify(e).toLowerCase().includes(q));
 let html=rated.map(eventHTML).join("");

 // Include NASA landslide source records when not filtering for avalanches or a specific AL rating.
 if(type!=="avalanche" && al==="all"){
  const sourceRows=nasaFeatures.filter(f=>JSON.stringify(f.properties||{}).toLowerCase().includes(q)).slice(0,500);
  html+=sourceRows.map(f=>{
   const p=f.properties||{};
   return `<article class="event-source-row"><div class="source-icon">NASA<br>COOLR</div><div>
    <div class="meta">SOURCE RECORD • ${fmtDate(p.event_date)}</div>
    <h3>${esc(p.event_title||"Reported landslide")}</h3>
    <p>${esc([p.gazetteer_closest_point,p.admin_division_name,p.country_name].filter(Boolean).join(", "))}</p>
    <p>${esc(p.event_description||"")}</p>
    <div class="meta">${p.landslide_category?`Type: ${esc(p.landslide_category)} • `:""}${p.landslide_trigger?`Trigger: ${esc(p.landslide_trigger)} • `:""}${p.landslide_size?`Size: ${esc(p.landslide_size)} • `:""}Not yet assigned an NLS AL rating</div>
    <div class="media-links">${p.source_link?`<a target="_blank" rel="noopener" href="${esc(p.source_link)}">Source</a>`:""}${p.photo_link?`<a target="_blank" rel="noopener" href="${esc(p.photo_link)}">Photo</a>`:""}
    <button class="rate-source-btn" onclick="prefillNASAEvent(${nasaFeatures.indexOf(f)})">Rate this event</button></div>
   </div></article>`;
  }).join("");
 }
 document.getElementById("eventList").innerHTML=html||'<div class="card">No matching records.</div>';
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
 const showCoolr=document.getElementById("showCoolr").checked, showLhasa=document.getElementById("showLhasa").checked;
 const cutoff=hours==="all"?0:Date.now()-Number(hours)*3600000;
 let shown=0;

 // NASA LHASA automatic hazard guidance polygons (behind event points).
 if(showLhasa && hz!=="avalanche"){
  for(const f of lhasaFeatures.slice(0,2000)){
   const p=f.properties||{}, risk=Number(p.m_haz_pp_f||0);
   const color=risk>0.25?"#a50f15":risk>0.05?"#de2d26":risk>0.01?"#fb6a4a":"#fcae91";
   try{
    const l=L.geoJSON(f,{style:{color:"transparent",weight:0,fillColor:color,fillOpacity:.14}})
      .bindPopup(`<b>NASA LHASA guidance</b><br>${esc(p.name_2||"")}, ${esc(p.name_0||"")}<br>Model hazard/exposure index: ${risk.toFixed(3)}<br><small>Automatic NASA guidance • not an NLS alert</small>`)
      .addTo(maps.main);
    layers.events.push(l);
   }catch{}
  }
 }

 // Owner-rated NLS events.
 for(const e of events){
  if(hz!=="all"&&e.hazard_type!==hz)continue;
  if(cutoff && new Date(e.created_at).getTime()<cutoff)continue;
  if(!Number.isFinite(Number(e.lat))||!Number.isFinite(Number(e.lon)))continue;
  const n=ratingNum(e.al_rating), marker=L.circleMarker([e.lat,e.lon],{radius:7+n,fillColor:intensityColor(n),color:"#111",weight:1.4,fillOpacity:.9})
   .bindPopup(`<b>${esc(e.title)}</b><br>${esc(e.al_rating)} • ${esc(e.hazard_type)}<br>${esc(e.location_name||"")}<br><small>Owner-rated NLS event</small>`).addTo(maps.main);
  layers.events.push(marker);shown++;
 }

 // NASA COOLR reported landslide history.
 if(showCoolr && hz!=="avalanche"){
  for(const f of nasaFeatures){
   const c=f.geometry?.coordinates;if(!c||c.length<2)continue;
   const p=f.properties||{}; const d=p.event_date||null;
   if(cutoff&&d&&new Date(Number(d)||d).getTime()<cutoff)continue;
   const sev=String(p.landslide_size||"").toLowerCase();
   const rn=sev.includes("very_large")||sev.includes("catastrophic")?6:sev.includes("large")?5:sev.includes("medium")?3:sev.includes("small")?2:1;
   const m=L.circleMarker([c[1],c[0]],{radius:4+Math.min(rn,5),fillColor:intensityColor(rn),color:"#444",weight:.8,fillOpacity:.52})
    .bindPopup(`<b>${esc(p.event_title||"NASA COOLR landslide report")}</b><br>${esc(p.gazetteer_closest_point||p.location_description||p.admin_division_name||p.country_name||"")}<br>${p.landslide_category?`Type: ${esc(p.landslide_category)}<br>`:""}${p.landslide_trigger?`Trigger: ${esc(p.landslide_trigger)}<br>`:""}${p.landslide_size?`Reported size: ${esc(p.landslide_size)}<br>`:""}${p.fatality_count!=null?`Fatalities: ${esc(p.fatality_count)}<br>`:""}<small>NASA COOLR source record • NOT an NLS AL rating</small>${p.source_link?`<br><a target="_blank" rel="noopener" href="${esc(p.source_link)}">Original source</a>`:""}${p.photo_link?`<br><a target="_blank" rel="noopener" href="${esc(p.photo_link)}">Photo</a>`:""}`).addTo(maps.main);
   layers.events.push(m);shown++;
  }
 }
 document.getElementById("mapCount").textContent=`${shown.toLocaleString()} events shown`;
}
document.getElementById("hazardFilter").onchange=renderMap;document.getElementById("timeFilter").onchange=renderMap;
document.getElementById("showCoolr").onchange=renderMap;document.getElementById("showLhasa").onchange=renderMap;
document.getElementById("refreshBtn").onclick=refreshAll;
document.getElementById("locateBtn").onclick=()=>navigator.geolocation?.getCurrentPosition(p=>maps.main.setView([p.coords.latitude,p.coords.longitude],10));

const riskColors={5:"#d9f5d9",10:"#8ae68a",20:"#ffe56c",30:"#ffb13b",50:"#ff6a55",70:"#e74de0",90:"#7c42c9"};
let selectedDay=1;
function renderOutlooks(){
 clearLayerList(layers.outlooks);

 // Automatic NASA LHASA global hazard polygons.
 for(const f of lhasaFeatures.slice(0,2000)){
  const p=f.properties||{}, risk=Number(p.m_haz_pp_f||0);
  const color=risk>0.25?"#a50f15":risk>0.05?"#de2d26":risk>0.01?"#fb6a4a":"#fcae91";
  try{
   const l=L.geoJSON(f,{style:{color:"transparent",weight:0,fillColor:color,fillOpacity:.16}})
     .bindPopup(`<b>NASA LHASA automatic guidance</b><br>${esc(p.name_2||"")}, ${esc(p.name_0||"")}<br>Model index: ${risk.toFixed(3)}`)
     .addTo(maps.outlook); layers.outlooks.push(l);
  }catch{}
 }

 // Automatic local Day 1–3 outlook circle, generated from forecast data.
 const auto=autoOutlooks.find(o=>o.day===selectedDay);
 if(auto){
  const max=Math.max(auto.landslide,auto.avalanche);
  const c=max>=70?"#7c42c9":max>=50?"#ff6a55":max>=30?"#ffb13b":max>=20?"#ffe56c":max>=10?"#8ae68a":"#d9f5d9";
  const circle=L.circle([auto.lat,auto.lon],{radius:35000,color:"#222",weight:2,fillColor:c,fillOpacity:.32})
   .bindPopup(`<b>NLS automatic Day ${auto.day}</b><br>Landslide signal: ${auto.landslide}%<br>Avalanche signal: ${auto.avalanche}%<br><small>Experimental weather-derived guidance</small>`).addTo(maps.outlook);
  layers.outlooks.push(circle);
 }

 // Optional owner overrides.
 const list=outlooks.filter(o=>Number(o.day)===selectedDay);
 for(const o of list){
  if(!o.geometry)continue;
  const l=L.geoJSON({type:"Feature",geometry:o.geometry,properties:{}},{style:{color:"#222",weight:2,fillColor:riskColors[o.probability]||"#ccc",fillOpacity:.42}})
    .bindPopup(`<b>${esc(o.probability)}% ${esc(o.hazard_type)}</b><br>${esc(o.label||"NLS Owner Override")}<br><small>Owner-published NLS polygon</small>`).addTo(maps.outlook);
  layers.outlooks.push(l);
 }
 document.getElementById("autoOutlookSummary").innerHTML=autoOutlooks.length?autoOutlooks.map(autoCardHTML).join(""):'<div class="card">Search a location above to generate automatic Day 1–3 local guidance. NASA LHASA global guidance still appears automatically.</div>';
 document.getElementById("outlookDetails").innerHTML=list.length?list.map(o=>`<div class="card"><b>${esc(o.probability)}% ${esc(o.hazard_type)}</b><h3>${esc(o.label||"NLS Outlook Area")}</h3><div class="meta">Day ${o.day} • owner override</div></div>`).join(""):'<div class="card">No owner override for this day — nothing required from you.</div>';
}
document.querySelectorAll("#dayPicker button").forEach(b=>b.onclick=()=>{selectedDay=Number(b.dataset.day);document.querySelectorAll("#dayPicker button").forEach(x=>x.classList.toggle("active",x===b));renderOutlooks()});

function renderDays(){
 const names=["Today","Tomorrow","Day 3"];
 document.getElementById("dayCards").innerHTML=[1,2,3].map((day,i)=>{
  const auto=autoOutlooks.find(o=>o.day===day);
  const manual=outlooks.filter(o=>Number(o.day)===day).reduce((m,o)=>Math.max(m,Number(o.probability)||0),0);
  const p=auto?Math.max(auto.landslide,auto.avalanche):manual;
  return `<div class="day-card"><div class="meta">${names[i]}</div>${auto?`<div class="prob">${p}%</div><b>Landslide ${auto.landslide}% • Avalanche ${auto.avalanche}%</b><small>${esc(auto.label)}</small>`:manual?`<div class="prob">${p}%</div><b>Owner override</b>`:`<div class="prob">—</div><b>Choose your area</b><small>Tap “Build My 3-Day Outlook” above.</small>`}</div>`;
 }).join("");
}


async function geocodePlace(name){
 const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(name)}`,{headers:{"Accept":"application/json"}});
 if(!r.ok)throw new Error("Place search failed");
 const j=await r.json(); if(!j.length)throw new Error("Place not found");
 return {lat:Number(j[0].lat),lon:Number(j[0].lon),name:j[0].display_name};
}
function dayRiskFromWeather(day, elev=0){
 const rain=Number(day.precipitation_sum||0), snow=Number(day.snowfall_sum||0), gust=Number(day.wind_gusts_10m_max||0), tmax=Number(day.temperature_2m_max||0), tmin=Number(day.temperature_2m_min||0);
 // Experimental NLS guidance — deliberately capped; not an official probability model.
 let land=Math.min(70, Math.round((rain*1.6 + Math.max(0,rain-25)*1.2)/5)*5);
 if(rain<2)land=0;
 let avalanche=0;
 if(elev>700 && snow>0){
   avalanche=Math.min(70,Math.round((snow*1.8 + Math.max(0,gust-35)*.7 + (tmax>0&&tmin<0?12:0))/5)*5);
 }
 return {landslide:land,avalanche:avalanche,rain,snow,gust,tmax,tmin};
}
async function buildAutoOutlook(lat,lon,label){
 const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,snowfall_sum,temperature_2m_max,temperature_2m_min,wind_gusts_10m_max&current=elevation&forecast_days=4&timezone=auto`;
 const r=await fetch(url);if(!r.ok)throw new Error("Forecast unavailable");
 const w=await r.json(), d=w.daily||{}, elev=Number(w.elevation||0);
 autoOutlooks=[];
 for(let i=0;i<3;i++){
   const raw={precipitation_sum:d.precipitation_sum?.[i]||0,snowfall_sum:d.snowfall_sum?.[i]||0,temperature_2m_max:d.temperature_2m_max?.[i],temperature_2m_min:d.temperature_2m_min?.[i],wind_gusts_10m_max:d.wind_gusts_10m_max?.[i]||0};
   const risk=dayRiskFromWeather(raw,elev);
   autoOutlooks.push({day:i+1,lat,lon,label,date:d.time?.[i],...risk});
 }
 maps.outlook.setView([lat,lon],8);
 renderOutlooks();renderDays();
}
function autoCardHTML(o){
 const max=Math.max(o.landslide,o.avalanche), c=riskColors[[5,10,20,30,50,70,90].reduce((a,b)=>Math.abs(b-max)<Math.abs(a-max)?b:a,5)]||"#aaa";
 return `<div class="card auto-card" style="--risk:${c}"><div class="meta">DAY ${o.day} • ${esc(o.date||"")}</div><h3>${esc(o.label)}</h3>
 <p><b>${o.landslide}% Experimental Landslide Signal</b><br><b>${o.avalanche}% Experimental Avalanche Signal</b></p>
 <div class="meta">Forecast precip ${o.rain} mm • snowfall ${o.snow} cm • max gust ${o.gust} km/h</div>
 <small>Weather-derived NLS guidance, not an official probability forecast.</small></div>`;
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
document.getElementById("homeOutlookGps").onclick=()=>{
 const b=document.getElementById("homeOutlookGps"); b.textContent="Getting location…";
 navigator.geolocation?.getCurrentPosition(async p=>{
   try{
     await buildAutoOutlook(p.coords.latitude,p.coords.longitude,"Your current area");
     document.getElementById("homeOutlookHint").textContent="Automatic Day 1–3 guidance updated for your current area.";
   }catch(e){document.getElementById("homeOutlookHint").textContent="Could not build outlook: "+e.message}
   finally{b.textContent="Refresh My 3-Day Outlook"}
 },()=>{document.getElementById("homeOutlookHint").textContent="Location permission was not available. Open 1–3 Day Outlook and search your town.";b.textContent="Build My 3-Day Outlook"});
};
document.getElementById("outlookPlaceSearch").onclick=async()=>{
 const input=document.getElementById("outlookPlaceInput"), btn=document.getElementById("outlookPlaceSearch");
 try{btn.textContent="Building…";const g=await geocodePlace(input.value.trim());await buildAutoOutlook(g.lat,g.lon,g.name)}
 catch(e){alert(e.message)}finally{btn.textContent="Build 3-Day Outlook"}
};
document.getElementById("outlookGps").onclick=()=>navigator.geolocation?.getCurrentPosition(async p=>{
 try{await buildAutoOutlook(p.coords.latitude,p.coords.longitude,"Your GPS area")}catch(e){alert(e.message)}
});
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
document.getElementById("eventForm").onsubmit=e=>{e.preventDefault();submitTable(e.currentTarget,"events",o=>({...o,
  lat:Number(o.lat),lon:Number(o.lon),
  fatalities:Number(o.fatalities||0),injuries:Number(o.injuries||0),
  people_exposed:Number(o.people_exposed||0),evacuated:Number(o.evacuated||0),
  rescued:Number(o.rescued||0),buried:Number(o.buried||0),
  source_count:Number(o.source_count||0),
  media_urls:(o.media_urls||"").split(/\n+/).filter(Boolean)
}))};
document.getElementById("alertForm").onsubmit=e=>{e.preventDefault();submitTable(e.currentTarget,"alerts",o=>({...o,expires_at:new Date(o.expires_at).toISOString()}))};
document.getElementById("probForm").onsubmit=e=>{e.preventDefault();submitTable(e.currentTarget,"probabilities",o=>({...o,probability:Number(o.probability),valid_time:new Date(o.valid_time).toISOString()}))};
document.getElementById("outlookForm").onsubmit=e=>{e.preventDefault();if(!drawnGeoJSON){e.currentTarget.querySelector(".form-status").textContent="Draw a polygon first.";return}submitTable(e.currentTarget,"outlooks",o=>({...o,day:Number(o.day),probability:Number(o.probability),geometry:drawnGeoJSON}))};

async function refreshAll(){
 await Promise.all([loadNASA(),loadLHASA(),loadDB()]);
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
const ratingForm=document.getElementById("eventForm");
if(ratingForm)ratingForm.addEventListener("input",updateRatingSuggestionFromForm);
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(console.warn);
window.prefillNASAEvent=prefillNASAEvent;initMaps();refreshAll();realtime();updateAuthUI();setInterval(refreshAll,C.AUTO_REFRESH_MS);
})();