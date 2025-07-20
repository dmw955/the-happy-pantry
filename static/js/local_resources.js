// static/js/local_resources.js

console.log("▶ local_resources.js loaded");
mapboxgl.accessToken = 'pk.eyJ1IjoiZG13OTU1IiwiYSI6ImNtZDJ4MnRrNzB4NzcybG9oNXdic2x0c3gifQ.GFJRVWXHpkFtEQzxbXEzRg';

// Haversine
function getDistance(a1, o1, a2, o2) {
  const toRad = d => d * Math.PI/180, R=3958.8;
  const dA = toRad(a2-a1), dO = toRad(o2-o1);
  const x = Math.sin(dA/2)**2 + Math.cos(toRad(a1))*Math.cos(toRad(a2))*Math.sin(dO/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}
function buildBBox(lat,lng,mi=50){
  const r=mi/3958.8,deg=180/Math.PI;
  const dA=r*deg, dO=r*deg/Math.cos(lat*Math.PI/180);
  return `${lng-dO},${lat-dA},${lng+dO},${lat+dA}`;
}

// Combined Mapbox free-text
async function fetchMapboxMarkets(lat,lng,query){
  console.log("  • Mapbox query:",query);
  const bbox=buildBBox(lat,lng,50);
  const url=`https://api.mapbox.com/geocoding/v5/mapbox.places/`
    + encodeURIComponent(query)+`.json`
    + `?bbox=${bbox}&limit=20&types=poi`
    + `&access_token=${mapboxgl.accessToken}`;
  const r=await fetch(url);
  if(!r.ok) throw new Error(r.status);
  const {features}=await r.json();
  return features.map(f=>{
    const [o,a]=f.geometry.coordinates;
    return {name:f.text, address:f.place_name, lat:a, lng:o, distance:getDistance(lat,lng,a,o)};
  });
}

// Overpass fallback including farms by name
async function fetchOverpassMarkets(lat,lng){
  console.log("  • Overpass fallback");
  const radius=50*1609.34;
  const q=`
[out:json][timeout:25];
(
  node["amenity"="marketplace"](around:${radius},${lat},${lng});
  node["shop"~"farm|butcher|greengrocer|grocery|supermarket"](around:${radius},${lat},${lng});
  node["name"~"Farm|Market|Vegetable",i](around:${radius},${lat},${lng});
  way["name"~"Farm|Market|Vegetable",i](around:${radius},${lat},${lng});
  relation["name"~"Farm|Market|Vegetable",i](around:${radius},${lat},${lng});
);
out center;`.trim();
  const r=await fetch('https://overpass-api.de/api/interpreter',{
    method:'POST',headers:{'Content-Type':'text/plain'},body:q
  });
  if(!r.ok) throw new Error(r.status);
  const {elements}=await r.json();
  return elements.map(e=>{
    const latF=e.lat ?? e.center?.lat, lngF=e.lon ?? e.center?.lon;
    const name=e.tags?.name||e.tags?.operator||'Unknown';
    const addr=e.tags?.['addr:full']||`${e.tags?.['addr:street']||''} ${e.tags?.['addr:housenumber']||''}`.trim();
    return {name, address:addr, lat:latF, lng:lngF, distance:getDistance(lat,lng,latF,lngF)};
  });
}

async function fetchAllMarkets(lat,lng){
  let res=[];
  try {
    res = await fetchMapboxMarkets(lat,lng,'farmers market farm stand butcher grocery vegetable');
  } catch(e){ console.warn('Mapbox failed',e); }
  if(!res.length){
    res = await fetchOverpassMarkets(lat,lng);
  }
  // dedupe
  const seen=new Set(), uniq=[];
  res.forEach(m=>{
    const k=`${m.name}::${m.address}`;
    if(!seen.has(k)){ seen.add(k); uniq.push(m); }
  });
  uniq.sort((a,b)=>a.distance-b.distance);
  console.log("  ✓ final list:",uniq);
  return uniq;
}

async function loadLocalResources(){
  console.log("▶ loadLocalResources()");
  try {
    const {coords}=await new Promise((r,j)=>navigator.geolocation.getCurrentPosition(r,j));
    const {latitude:lat, longitude:lng}=coords;
    console.log("  ✓ coords:",lat,lng);

    // map
    const map=new mapboxgl.Map({
      container:'map', style:'mapbox://styles/mapbox/streets-v11',
      center:[lng,lat], zoom:12
    });
    new mapboxgl.Marker({color:'blue'}).setLngLat([lng,lat]).addTo(map);

    // fetch
    const markets=await fetchAllMarkets(lat,lng);

    // dump JSON for debug
    const dumpEl=document.getElementById('market-list');
    dumpEl.innerHTML = `<pre style="max-height:200px;overflow:auto;">`
      + JSON.stringify(markets,null,2) + `</pre>`;

    // plot & list
    markets.forEach(m=>{
      const el=document.createElement('div');
      el.style.cssText='width:12px;height:12px;background:#e74c3c;border:2px solid white;border-radius:50%';
      new mapboxgl.Marker({element:el})
        .setLngLat([m.lng,m.lat]).addTo(map);
    });

    if(markets.length){
      const b=new mapboxgl.LngLatBounds();
      b.extend([lng,lat]); markets.forEach(m=>b.extend([m.lng,m.lat]));
      map.fitBounds(b,{padding:40});
    }
  } catch(err){
    console.error(err);
    alert(err.message);
  }
}

document.addEventListener('DOMContentLoaded',loadLocalResources);
