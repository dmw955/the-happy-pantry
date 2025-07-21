// static/js/local_resources.js

console.log("▶ local_resources.js loaded");

// 1) Mapbox token (for rendering the map & markers)
mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN_HERE';

// 2) Your Google Places API key (for searching)
const GOOGLE_API_KEY = 'YOUR_GOOGLE_PLACES_API_KEY_HERE';

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

/**
 * Call Google Places Text Search API
 */
async function fetchGooglePlaces(lat, lng, query) {
  console.log(`    • Google Places textSearch: "${query}"`);
  const radiusMeters = 50000; // 50 km
  const url = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  url.searchParams.set('location', `${lat},${lng}`);
  url.searchParams.set('radius', radiusMeters);
  url.searchParams.set('query', query);
  url.searchParams.set('key', GOOGLE_API_KEY);

  console.log('      URL:', url.toString());
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Places API error: ${res.status}`);
  const { results } = await res.json();
  return results.map(p => ({
    name:     p.name,
    address:  p.formatted_address,
    lat:      p.geometry.location.lat,
    lng:      p.geometry.location.lng,
    distance: getDistance(lat, lng, p.geometry.location.lat, p.geometry.location.lng)
  }));
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

    // 4) Fetch nearby farm/market/veggie places from Google
    const places = await fetchGooglePlaces(lat, lng, 'farmers market meat veggies');
    console.log("  ✓ Google Places results:", places);

    // 5) Plot them on the map
    places.forEach(p => {
      const el = document.createElement('div');
      el.style.cssText = 'width:16px;height:16px;background:#e74c3c;border:2px solid white;border-radius:50%';
      new mapboxgl.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(
            `<strong>${p.name}</strong><br>${p.address}<br><em>${p.distance.toFixed(1)} mi away</em>`
          )
        )
        .addTo(map);
    });

    // 6) Zoom map to fit all markers + user
    if (places.length) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend([lng, lat]);
      places.forEach(p => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 40 });
    }

    // 7) Render a text list under the map
    const listEl = document.getElementById('market-list');
    if (listEl) {
      listEl.innerHTML = places.map(p => `
        <div class="market-item">
          <h4>${p.name}</h4>
          <p>${p.address}</p>
          <small>${p.distance.toFixed(1)} mi away</small>
        </div>
      `).join('');
    }

  } catch (err) {
    console.error("✘ loadLocalResources error:", err);
    alert(`Error loading local resources: ${err.message}`);
  }
}

document.addEventListener('DOMContentLoaded', loadLocalResources);
