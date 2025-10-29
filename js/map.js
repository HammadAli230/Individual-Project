const TOMTOM_KEY=(typeof window!=="undefined"&&window.TOMTOM_KEY)?String(window.TOMTOM_KEY):"";
const API_BASE=(typeof window!=="undefined"&&window.API_BASE)?String(window.API_BASE):"";

const apiGet=async(path,params={})=>{const url=new URL("./api/proxy.php",location.href);url.searchParams.set("path",path.replace(/^\//,""));for(const[k,v]of Object.entries(params))url.searchParams.set(k,v);const res=await fetch(url.toString());if(!res.ok)throw new Error(`HTTP ${res.status}`);return res.json()};
const apiPost=async(path,body={})=>{const url=new URL("./api/proxy.php",location.href);url.searchParams.set("path",path.replace(/^\//,""));const res=await fetch(url.toString(),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});if(!res.ok)throw new Error(`HTTP ${res.status}`);return res.json()};

const map=L.map("map").setView([52.4862,-1.8904],13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:20,attribution:"© OpenStreetMap"}).addTo(map);

const startIcon=new L.Icon({iconUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",iconSize:[25,41],iconAnchor:[12,41],className:"start-marker"});
const endIcon=new L.Icon({iconUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",iconSize:[25,41],iconAnchor:[12,41],className:"end-marker"});

let startMarker=null,endMarker=null,routeLine=null,compareLines=[],trafficLayer=null;
const placesLayer=L.layerGroup().addTo(map);
const demandLayer=L.layerGroup().addTo(map);
const depotLayer=L.layerGroup().addTo(map);
const chargerLayer=L.layerGroup().addTo(map);

function setStart(lat,lon,label="Start"){if(startMarker)startMarker.remove();startMarker=L.marker([lat,lon],{icon:startIcon,draggable:true}).addTo(map).bindPopup(label);startMarker.on("dragend",()=>drawRoute())}
function setEnd(lat,lon,label="End"){if(endMarker)endMarker.remove();endMarker=L.marker([lat,lon],{icon:endIcon,draggable:true}).addTo(map).bindPopup(label);endMarker.on("dragend",()=>drawRoute())}
function clearRoutes(){if(routeLine){routeLine.remove();routeLine=null}compareLines.forEach(l=>l.remove());compareLines=[]}
function clearAll(){clearRoutes();if(startMarker){startMarker.remove();startMarker=null}if(endMarker){endMarker.remove();endMarker=null}placesLayer.clearLayers();demandLayer.clearLayers();depotLayer.clearLayers();chargerLayer.clearLayers();setStats(null);setLegend()}
function fitToMarkers(){const pts=[];if(startMarker)pts.push(startMarker.getLatLng());if(endMarker)pts.push(endMarker.getLatLng());if(pts.length)map.fitBounds(L.latLngBounds(pts),{padding:[40,40]})}
function setLegend(html){const box=document.getElementById("legend");if(!box)return;if(!html){box.style.display="none";box.innerHTML="";return}box.style.display="block";box.innerHTML=html}
function setStats(stats){const dEl=document.getElementById("statDistance");const tEl=document.getElementById("statEta");const cEl=document.getElementById("statCo2");if(!dEl||!tEl||!cEl)return;if(!stats){dEl.textContent="—";tEl.textContent="—";cEl.textContent="—";return}const km=stats.distance_m/1000;const mins=stats.duration_s?stats.duration_s/60:stats.travel_s/60;let co2=Number.isFinite(stats.emissions_g)?stats.emissions_g:NaN;const veh=typeof getVehicleProfile==="function"?getVehicleProfile():null;if(veh&&veh.ef_gpkm){co2=km*Number(veh.ef_gpkm);if(veh.idle_pct)co2*=1+Number(veh.idle_pct)/100}dEl.textContent=km.toFixed(2);tEl.textContent=mins.toFixed(0);cEl.textContent=Number.isFinite(co2)?co2.toFixed(0):"—"}
function pushReport(row){const arr=JSON.parse(localStorage.getItem("adv_reports")||"[]");arr.unshift({...row,at:new Date().toISOString()});localStorage.setItem("adv_reports",JSON.stringify(arr.slice(0,50)))}

async function geocodeViaAPI(query){const j=await apiGet("geocode",{q:String(query||"").trim()});if(j&&j.ok&&Array.isArray(j.results)&&j.results[0]){const r=j.results[0];return{lat:parseFloat(r.lat),lon:parseFloat(r.lng),label:r.name||query}}return null}

async function drawRoute(){
  const modeEl=document.getElementById("mode");
  const mode=modeEl?modeEl.value:"drive";
  if(!startMarker||!endMarker)return;
  const s=startMarker.getLatLng(),e=endMarker.getLatLng();
  const data=await apiPost("route",{origin:{lat:s.lat,lng:s.lng},destination:{lat:e.lat,lng:e.lng},mode:String(mode)});
  if(!data||!Array.isArray(data.polyline))return;
  clearRoutes();
  routeLine=L.polyline(data.polyline.map(p=>[p.lat,p.lng]),{weight:6}).addTo(map);
  map.fitBounds(routeLine.getBounds(),{padding:[20,20]});
  setStats({distance_m:data.distance_m,duration_s:data.duration_s,emissions_g:data.emissions_g});
  pushReport({mode:mode,distance_m:data.distance_m,travel_s:data.duration_s,emissions_g:data.emissions_g});
}

async function compareModes(){
  if(!startMarker||!endMarker)return;
  clearRoutes();
  const s=startMarker.getLatLng(),e=endMarker.getLatLng();
  const modes=["walk","bike","drive"],styles=[{weight:4,dashArray:"4 4"},{weight:4},{weight:6}],rows=[];
  for(let i=0;i<modes.length;i++){
    const m=modes[i];
    const d=await apiPost("route",{origin:{lat:s.lat,lng:s.lng},destination:{lat:e.lat,lng:e.lng},mode:m});
    if(d&&Array.isArray(d.polyline)){
      const line=L.polyline(d.polyline.map(p=>[p.lat,p.lng]),styles[i]).addTo(map);
      compareLines.push(line);
      rows.push(`${m}: ${(d.distance_m/1000).toFixed(2)} km, ${(d.duration_s/60).toFixed(1)} min`);
    }
  }
  if(compareLines.length){map.fitBounds(L.featureGroup(compareLines).getBounds(),{padding:[20,20]})}
  setLegend(`<b>Compare</b><br>${rows.join("<br>")}`);
}

function ensureTrafficLayer(){
  if(!TOMTOM_KEY)return null;
  if(!trafficLayer){trafficLayer=L.tileLayer(`https://api.tomtom.com/traffic/map/4/tile/flow/{z}/{x}/{y}.png?key=${encodeURIComponent(TOMTOM_KEY)}`,{opacity:.7,zIndex:999,maxZoom:20,attribution:"Traffic © TomTom"})}
  return trafficLayer
}

map.on("click",async e=>{
  if(!startMarker){setStart(e.latlng.lat,e.latlng.lng,"Start")}
  else if(!endMarker){setEnd(e.latlng.lat,e.latlng.lng,"End");await drawRoute()}
  else{setEnd(e.latlng.lat,e.latlng.lng,"End");await drawRoute()}
});

const routeBtn=document.getElementById("routeBtn");
if(routeBtn){routeBtn.addEventListener("click",async()=>{
  const sQ=document.getElementById("start")?.value||"";
  const eQ=document.getElementById("end")?.value||"";
  if(sQ){const g=await geocodeViaAPI(sQ);if(g)setStart(g.lat,g.lon,g.label||"Start")}
  if(eQ){const g=await geocodeViaAPI(eQ);if(g)setEnd(g.lat,g.lon,g.label||"End")}
  await drawRoute()
})}

const compareBtn=document.getElementById("compareBtn");
if(compareBtn){compareBtn.addEventListener("click",compareModes)}

const clearBtn=document.getElementById("clearBtn");
if(clearBtn){clearBtn.addEventListener("click",clearAll)}

const locateBtn=document.getElementById("locateBtn");
if(locateBtn){locateBtn.addEventListener("click",()=>{if(navigator.geolocation){navigator.geolocation.getCurrentPosition(p=>{map.setView([p.coords.latitude,p.coords.longitude],14)})}})}

const swapBtn=document.getElementById("swapBtn");
if(swapBtn){swapBtn.addEventListener("click",async()=>{
  const s=document.getElementById("start"),e=document.getElementById("end");
  if(s&&e){const t=s.value;s.value=e.value;e.value=t}
  const sm=startMarker;startMarker=endMarker;endMarker=sm;
  await drawRoute()
})}

const trafficToggle=document.getElementById("trafficToggle");
if(trafficToggle){trafficToggle.addEventListener("change",()=>{
  if(!TOMTOM_KEY){trafficToggle.checked=false;alert("Set TOMTOM_KEY to enable live traffic.");return}
  const tl=ensureTrafficLayer();if(!tl)return;
  if(trafficToggle.checked){tl.addTo(map)}else{map.removeLayer(tl)}
})}

const regionBtn=document.getElementById("regionBtn");
if(regionBtn){regionBtn.addEventListener("click",async()=>{
  const q=document.getElementById("region")?.value?.trim(); if(!q)return;
  const r=await geocodeViaAPI(q);
  if(r){map.setView([r.lat,r.lon],13)}
})}

const placesBtn=document.getElementById("placesBtn");
if(placesBtn){placesBtn.addEventListener("click",async()=>{
  const q=document.getElementById("placesQuery")?.value?.trim(); if(!q)return;
  let center=map.getCenter(); if(startMarker)center=startMarker.getLatLng();
  let url;
  if(TOMTOM_KEY){url=`https://api.tomtom.com/search/2/poiSearch/${encodeURIComponent(q)}.json?key=${TOMTOM_KEY}&lat=${center.lat}&lon=${center.lng}&radius=5000&limit=20`}
  else{url=`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=20`}
  const res=await fetch(url);const data=await res.json();
  placesLayer.clearLayers();
  if(Array.isArray(data?.results)){
    data.results.forEach(r=>{const lat=r.position.lat,lon=r.position.lon;const name=(r.poi&&r.poi.name)||(r.address&&r.address.freeformAddress)||q;const m=L.marker([lat,lon]).addTo(placesLayer).bindPopup(name);m.on("click",()=>{setEnd(lat,lon,name);drawRoute()})})
  }else if(Array.isArray(data)){
    data.forEach(r=>{const lat=parseFloat(r.lat),lon=parseFloat(r.lon),name=r.display_name||q;const m=L.marker([lat,lon]).addTo(placesLayer).bindPopup(name);m.on("click",()=>{setEnd(lat,lon,name);drawRoute()})})
  }
  if(placesLayer.getLayers().length){map.fitBounds(placesLayer.getBounds(),{padding:[40,40]})}
})}

const exportBtn=document.getElementById("exportBtn");
if(exportBtn){exportBtn.addEventListener("click",()=>{
  const rows=JSON.parse(localStorage.getItem("adv_reports")||"[]");
  if(!rows.length){alert("No route data yet");return}
  const header=["timestamp","mode","distance_m","travel_s","emissions_g"];
  const csv=[header.join(",")].concat(rows.map(r=>[r.at,r.mode,r.distance_m,r.travel_s,r.emissions_g].join(","))).join("\n");
  const blob=new Blob([csv],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="routes.csv";a.click()
})}

function kmToDegLat(km){return km/110.574}
function kmToDegLng(km,lat){return km/(111.320*Math.cos(lat*Math.PI/180))}
function randomDemandPoints(center,n,maxW,rkm){const pts=[];for(let i=0;i<n;i++){const r=Math.random()*rkm,th=Math.random()*Math.PI*2;const dlat=kmToDegLat(r*Math.cos(th)),dlng=kmToDegLng(r*Math.sin(th),center.lat);const lat=center.lat+dlat,lng=center.lng+dlng,w=1+Math.floor(Math.random()*Math.max(1,maxW));pts.push({lat,lng,weight:w})}return pts}
function dist2(a,b){const dx=a.lat-b.lat,dy=a.lng-b.lng;return dx*dx+dy*dy}
function kmeans(points,k,iters=10){let centers=[];const used=new Set();while(centers.length<k){const i=Math.floor(Math.random()*points.length);if(!used.has(i)){used.add(i);centers.push({lat:points[i].lat,lng:points[i].lng})}}for(let t=0;t<iters;t++){const buckets=Array.from({length:k},()=>[]);points.forEach(p=>{let bi=0,bd=Infinity;centers.forEach((c,i)=>{const d=dist2(p,c);if(d<bd){bd=d;bi=i}});buckets[bi].push(p)});centers=centers.map((c,i)=>{const b=buckets[i];if(!b.length)return c;let sw=0,slat=0,slng=0;b.forEach(p=>{const w=p.weight||1;sw+=w;slat+=p.lat*w;slng+=p.lng*w});return {lat:slat/sw,lng:slng/sw}})}return centers}

let regionCenter=L.latLng(52.4862,-1.8904);
document.getElementById("show-demand")?.addEventListener("click",()=>{
  const p=Math.max(1,Number(document.getElementById("p-count")?.value)||50);
  const M=Math.max(1,Number(document.getElementById("max-demand")?.value)||200);
  const R=Math.max(.2,Number(document.getElementById("radius-km")?.value)||5);
  const pts=randomDemandPoints(regionCenter,p,M,R);
  demandLayer.clearLayers();
  pts.forEach(pt=>{const rad=4+Math.min(12,pt.weight/(M/12));L.circleMarker([pt.lat,pt.lng],{radius:rad,color:"#cc5500",weight:1,fillOpacity:.6}).bindPopup(`Demand w=${pt.weight}`).addTo(demandLayer)});
  if(pts.length){map.fitBounds(L.featureGroup(pts.map(pt=>L.marker([pt.lat,pt.lng]))).getBounds(),{padding:[20,20]})}
  setLegend(`<b>Demand</b><br>${pts.length} points within ${R} km (max weight ${M})`);
  window.__advDemand=pts;
});

document.getElementById("solve-depots")?.addEventListener("click",()=>{
  const pts=window.__advDemand||[];
  if(!pts.length){alert("Generate demand first");return}
  const k=Math.max(1,Math.round(Math.sqrt(pts.length)/2));
  const centers=kmeans(pts,k,10);
  depotLayer.clearLayers();
  centers.forEach((c,i)=>{L.marker([c.lat,c.lng],{title:`Depot ${i+1}`}).bindPopup(`Depot ${i+1}`).addTo(depotLayer)});
  map.fitBounds(L.featureGroup(centers.map(c=>L.marker([c.lat,c.lng]))).getBounds(),{padding:[20,20]});
  setLegend(`<b>Depots</b><br>${centers.length} centers`);
  window.__advDepots=centers;
});

document.getElementById("solve-chargers")?.addEventListener("click",()=>{
  const pts=window.__advDemand||[];
  const dep=window.__advDepots||[];
  if(!pts.length && !dep.length){alert("Add depots or demand first");return}
  chargerLayer.clearLayers();
  dep.forEach((c,i)=>{L.circleMarker([c.lat,c.lng],{radius:9,color:"#007aff",weight:2,fillOpacity:.5}).bindPopup(`Charger (Depot ${i+1})`).addTo(chargerLayer)});
  if(pts.length){[...pts].sort((a,b)=>b.weight-a.weight).slice(0,5).forEach((pt,j)=>{L.circleMarker([pt.lat,pt.lng],{radius:8,color:"#0a0",weight:2,fillOpacity:.4}).bindPopup(`Charger (Demand #${j+1}, w=${pt.weight})`).addTo(chargerLayer)})}
  const all=chargerLayer.getLayers(); if(all.length){map.fitBounds(L.featureGroup(all).getBounds(),{padding:[20,20]})}
  setLegend(`<b>Chargers</b><br>${all.length} charger sites`);
});

(async()=>{
  try{
    const s=document.getElementById("start")?.value,e=document.getElementById("end")?.value;
    if(s){const g=await geocodeViaAPI(s);if(g){setStart(g.lat,g.lon,g.label);regionCenter=L.latLng(g.lat,g.lon)}}
    if(e){const g=await geocodeViaAPI(e);if(g)setEnd(g.lat,g.lon,g.label)}
    fitToMarkers()
  }catch(e){}
})();
