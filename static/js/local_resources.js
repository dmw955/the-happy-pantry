// static/js/local_resources.js

console.log("▶ local_resources.js loaded");

// 1) Your Mapbox access token
mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN_HERE';

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
  const r = miles / 3958.8;           // fraction of Earth radius
  const deg = 180 / Math.PI;
  const dLat = r * deg;
  const dLng = r * deg / Math.cos(lat * Math.PI / 180);
  return `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
}

/** 
 * Perform a single free-text Mapbox Places lookup within bbox 
 * @param {number} lat 
 * @param {number} lng 
 * @param {string} query 
 */
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

/** 
 * Combined free-text search for markets, farms, butcheries & veggies 
 */
async function fetchAllMarkets(lat, lng) {
  const query = 'farmers market farm stand butcher grocery vegetable';
  let results = [];
  try {
    results = await fetchMapboxPlaces(lat, lng, query);
  } catch (err) {
    console.warn("  • Mapbox search failed:", err);
  }
  // Dedupe by name+address
  const seen = new Set(), unique = [];
  results.forEach(m => {
    const key = `${m.name}::${m.address}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(m);
    }
  });
  // sort by proximity
  unique.sort((a, b) => a.distance - b.distance);
  console.log("  ✓ final Mapbox results:", unique);
  return unique;
}

async function loadLocalResources() {
  console.log("▶ loadLocalResources()");
  try {
    // get user location
    const { coords } = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej)
    );
    const lat = coords.latitude, lng = coords.longitude;
    console.log("  ✓ coords:", lat, lng);

    // init Mapbox map
    const map = new mapboxgl.Map({
      container: 'map',
      style:     'mapbox://styles/mapbox/streets-v11',
      center:    [lng, lat],
      zoom:      12
    });

    // user marker
    new mapboxgl.Marker({ color: 'blue' })
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup().setText('You are here'))
      .addTo(map);

    // fetch & plot
    const markets = await fetchAllMarkets(lat, lng);
    markets.forEach(m => {
      const el = document.createElement('div');
      el.style.cssText = [
        'width:16px;height:16px',
        'background:#e74c3c',
        'border:2px solid white',
        'border-radius:50%'
      ].join(';');
      new mapboxgl.Marker({ element: el })
        .setLngLat([m.lng, m.lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(
            `<strong>${m.name}</strong><br>${m.address}<br><em>${m.distance.toFixed(1)} mi away</em>`
          )
        )
        .addTo(map);
    });

    // fit map to markers
    if (markets.length) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([lng, lat]);
      markets.forEach(m => bounds.extend([m.lng, m.lat]));
      map.fitBounds(bounds, { padding: 40 });
    }

    // text list
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
    alert(`Error loading local markets: ${err.message}`);
  }
}

document.addEventListener('DOMContentLoaded', loadLocalResources);
