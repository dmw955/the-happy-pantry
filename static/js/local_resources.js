// static/js/local_resources.js

console.log("▶ local_resources.js loaded");

// 1) Your Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoiZG13OTU1IiwiYSI6ImNtZDJ4MnRrNzB4NzcybG9oNXdic2x0c3gifQ.GFJRVWXHpkFtEQzxbXEzRg'

/** Haversine distance in miles */
function getDistance(lat1, lng1, lat2, lng2) {
  const toRad = d => d * Math.PI / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Build a bbox string: minLon,minLat,maxLon,maxLat */
function buildBBox(lat, lng, miles = 50) {
  const r   = miles / 3958.8;
  const deg = 180 / Math.PI;
  const dLat = r * deg;
  const dLng = r * deg / Math.cos(lat * Math.PI / 180);
  return `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
}

/** Single free-text Mapbox lookup, filtered to true POIs */
async function fetchMapboxPlaces(lat, lng, query) {
  console.log(`    • Mapbox search: "${query}"`);
  const bbox = buildBBox(lat, lng, 50);
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(query)}.json` +
    `?bbox=${bbox}` +
    `&limit=30` +
    `&access_token=${mapboxgl.accessToken}`;
  console.log("      URL:", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox search error: ${res.status}`);
  const { features } = await res.json();

  // 1) Only keep Mapbox Place POIs (id prefix "poi.")
  const poiFeatures = features.filter(f => f.id && f.id.startsWith('poi.'));

  // 2) Further filter by category or name keywords
  const kw = /market|farm|butcher|grocery|veg/i;
  const filtered = poiFeatures.filter(f => {
    const cat = (f.properties && f.properties.category) || '';
    return kw.test(cat) || kw.test(f.text);
  });
  console.log(`      ✓ filtered ${filtered.length}/${features.length} features to true POIs`);

  // 3) Map to our simpler object
  return filtered.map(f => {
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

/** Run multiple targeted queries, merge & dedupe */
async function fetchAllMarkets(lat, lng) {
  const queries = [
    'farmers market',
    'produce market',
    'fruit stand',
    'vegetable stand',
    'butcher shop',
    'grocery store',
    'dairy farm',
    'fish market',
    'food co-op',
    'organic market',
    'road-side stand',
    'farm shop',
    'pop-up market'
  ];

  let all = [];
  for (const q of queries) {
    try {
      const res = await fetchMapboxPlaces(lat, lng, q);
      all = all.concat(res);
    } catch (err) {
      console.warn(`  • Mapbox "${q}" search failed:`, err);
    }
  }

  // dedupe by name + address
  const seen = new Set();
  const unique = all.filter(m => {
    const key = `${m.name}::${m.address}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // sort by proximity
  unique.sort((a, b) => a.distance - b.distance);
  console.log('  ✓ combined Mapbox results:', unique);
  return unique;
}

async function loadLocalResources() {
  console.log("▶ loadLocalResources()");
  try {
    // 1) Get user location
    const { coords } = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej)
    );
    const lat = coords.latitude, lng = coords.longitude;
    console.log("  ✓ coords:", lat, lng);

    // 2) Initialize Mapbox map
    const map = new mapboxgl.Map({
      container: 'map',
      style:     'mapbox://styles/mapbox/streets-v11',
      center:    [lng, lat],
      zoom:      12
    });

    // 3) Add user marker
    new mapboxgl.Marker({ color: 'blue' })
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup().setText('You are here'))
      .addTo(map);

    // 4) Fetch & plot all markets
    const markets = await fetchAllMarkets(lat, lng);
    markets.forEach(m => {
      const el = document.createElement('div');
      el.style.cssText =
        'width:16px;height:16px;background:#e74c3c;' +
        'border:2px solid white;border-radius:50%';
      new mapboxgl.Marker({ element: el })
        .setLngLat([m.lng, m.lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(
            `<strong>${m.name}</strong><br>${m.address}<br>` +
            `<em>${m.distance.toFixed(1)} mi away</em>`
          )
        )
        .addTo(map);
    });

    // 5) Fit bounds to include all markers + user
    if (markets.length) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([lng, lat]);
      markets.forEach(m => bounds.extend([m.lng, m.lat]));
      map.fitBounds(bounds, { padding: 40 });
    }

    // 6) Render text list
    const listEl = document.getElementById('market-list');
    if (listEl) {
      listEl.innerHTML = markets.map(m => `
        <div class="market-item">
          <h4>${m.name}</h4>
          <p>${m.address}</p>
          <small>${m.distance.toFixed(1)} mi away</small>
        </div>
      `).join('');
    }

  } catch (err) {
    console.error("✘ loadLocalResources error:", err);
    alert(`Error loading local resources: ${err.message}`);
  }
}

document.addEventListener('DOMContentLoaded', loadLocalResources);
