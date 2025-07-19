// static/js/local_resources.js

console.log("▶ local_resources.js loaded");

// 1) Mapbox token
mapboxgl.accessToken = 'pk.eyJ1IjoiZG13OTU1IiwiYSI6ImNtZDJ4MnRrNzB4NzcybG9oNXdic2x0c3gifQ.GFJRVWXHpkFtEQzxbXEzRg';

/** Haversine distance in miles */
function getDistance(lat1, lng1, lat2, lng2) {
  const toRad = d => d * Math.PI / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/** Build a bbox for Overpass/Mapbox: minLon,minLat,maxLon,maxLat */
function buildBBox(lat, lng, miles = 50) {
  const r   = miles / 3958.8;
  const deg = 180/Math.PI;
  const dLat = r*deg, dLng = r*deg/Math.cos(lat*Math.PI/180);
  return `${lng-dLng},${lat-dLat},${lng+dLng},${lat+dLat}`;
}

/** Mapbox Places lookup */
async function fetchMapboxMarkets(lat, lng, query) {
  console.log(`    • Mapbox: "${query}"`);
  const bbox = buildBBox(lat, lng, 50);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
              `${encodeURIComponent(query)}.json` +
              `?bbox=${bbox}&limit=20&types=poi` +
              `&access_token=${mapboxgl.accessToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox ${query} failed: ${res.status}`);
  const { features } = await res.json();
  return features.map(f => {
    const [lon, latf] = f.geometry.coordinates;
    return {
      name:     f.text,
      address:  f.place_name,
      lat:      latf,
      lng:      lon,
      distance: getDistance(lat, lng, latf, lon)
    };
  });
}

/** Overpass fallback for true local POIs */
async function fetchOverpassMarkets(lat, lng) {
  console.log("    • Overpass fallback");
  const radius = 50 * 1609.34; // 50mi in meters
  const q = `
[out:json][timeout:25];
(
  node["amenity"="marketplace"](around:${radius},${lat},${lng});
  node["shop"="farm"](around:${radius},${lat},${lng});
  node["shop"="butcher"](around:${radius},${lat},${lng});
);
out body;`.trim();

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body:   q,
    headers: { 'Content-Type':'text/plain;charset=UTF-8' }
  });
  if (!res.ok) throw new Error(`Overpass failed: ${res.status}`);
  const data = await res.json();
  return data.elements.map(e => {
    const name = e.tags.name || e.tags.operator || 'Unknown';
    const addr = e.tags['addr:full']
              || `${e.tags['addr:street']||''} ${e.tags['addr:housenumber']||''}`.trim();
    return {
      name,
      address: addr,
      lat: e.lat,
      lng: e.lon,
      distance: getDistance(lat, lng, e.lat, e.lon)
    };
  });
}

/** Aggregate Mapbox → fallback Overpass → dedupe & sort */
async function fetchAllMarkets(lat, lng) {
  const queries = ['farmers market','farm stand','local market','butchery','meat market'];
  let all = [];
  for (let q of queries) {
    try {
      all = all.concat(await fetchMapboxMarkets(lat, lng, q));
    } catch(e) {
      console.warn(`      Mapbox ${q} error`, e);
    }
  }
  // dedupe
  const seen = new Set(), uniq = [];
  all.forEach(m => {
    const k = `${m.name}::${m.address}`;
    if (!seen.has(k)) { seen.add(k); uniq.push(m); }
  });
  if (!uniq.length) {
    // fallback
    const over = await fetchOverpassMarkets(lat, lng);
    over.forEach(m=> { 
      const k = `${m.name}::${m.address}`; 
      if (!seen.has(k)) { seen.add(k); uniq.push(m); } 
    });
  }
  // sort by distance
  uniq.sort((a,b)=>a.distance-b.distance);
  console.log("  ✓ final market list:", uniq);
  return uniq;
}

/** Main */
async function loadLocalResources() {
  console.log("▶ loadLocalResources()");
  try {
    // geolocation
    const { coords } = await new Promise((r,j)=>navigator.geolocation.getCurrentPosition(r,j));
    const lat = coords.latitude, lng = coords.longitude;
    console.log("  ✓ coords:", lat, lng);

    // map
    const map = new mapboxgl.Map({
      container:'map', style:'mapbox://styles/mapbox/streets-v11',
      center:[lng,lat], zoom:12
    });

    // user pin
    new mapboxgl.Marker({ color:'blue' })
      .setLngLat([lng,lat])
      .setPopup(new mapboxgl.Popup().setText('You are here'))
      .addTo(map);

    // fetch & plot
    const markets = await fetchAllMarkets(lat, lng);
    markets.forEach(m => {
      const el = document.createElement('div');
      el.style.cssText = 'width:16px;height:16px;background:#e74c3c;border:2px solid white;border-radius:50%';
      new mapboxgl.Marker({ element:el })
        .setLngLat([m.lng,m.lat])
        .setPopup(new mapboxgl.Popup()
          .setHTML(`<strong>${m.name}</strong><br>${m.address}<br><em>${m.distance.toFixed(1)}mi</em>`))
        .addTo(map);
    });
    // fit bounds
    if (markets.length) {
      const b = new mapboxgl.LngLatBounds();
      b.extend([lng,lat]);
      markets.forEach(m=>b.extend([m.lng,m.lat]));
      map.fitBounds(b,{padding:40});
    }
    // text list
    const listEl = document.getElementById('market-list');
    if (listEl) {
      listEl.innerHTML = markets.map(m=>`
        <div class="market-item">
          <h4>${m.name}</h4>
          <p>${m.address}</p>
          <small>${m.distance.toFixed(1)} mi away</small>
        </div>
      `).join('');
    }

  } catch(err) {
    console.error("✘ load error:", err);
    alert(`Error loading local markets: ${err.message}`);
  }
}

document.addEventListener('DOMContentLoaded', loadLocalResources);
