// static/js/local_resources.js

// 2a) Put your Mapbox token here
mapboxgl.accessToken = 'pk.eyJ1IjoiZG13OTU1IiwiYSI6ImNtZDJ4MnRrNzB4NzcybG9oNXdic2x0c3gifQ.GFJRVWXHpkFtEQzxbXEzRg';

async function fetchMapboxMarkets(lat, lng, query = 'farmers market') {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/` +
    `${encodeURIComponent(query)}.json` +
    `?proximity=${lng},${lat}` +
    `&limit=10&types=poi` +
    `&access_token=${mapboxgl.accessToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox search failed: ${res.status}`);
  const { features } = await res.json();
  return features.map(f => ({
    name:    f.text,
    address: f.place_name,
    lng:     f.geometry.coordinates[0],
    lat:     f.geometry.coordinates[1]
  }));
}

async function loadLocalResources() {
  try {
    // 2b) Get user location
    const { coords } = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej)
    );
    const lat = coords.latitude, lng = coords.longitude;

    // 2c) Initialize Mapbox map
    const map = new mapboxgl.Map({
      container: 'map',
      style:     'mapbox://styles/mapbox/streets-v11',
      center:    [lng, lat],
      zoom:      12
    });

    // 2d) Show user location
    new mapboxgl.Marker({ color: 'blue' })
      .setLngLat([lng, lat])
      .setPopup(new mapboxgl.Popup().setText('You are here'))
      .addTo(map);

    // 2e) Fetch & plot markets
    const markets = await fetchMapboxMarkets(lat, lng);
    markets.forEach(m => {
      new mapboxgl.Marker()
        .setLngLat([m.lng, m.lat])
        .setPopup(
          new mapboxgl.Popup().setHTML(
            `<strong>${m.name}</strong><br>${m.address}`
          )
        )
        .addTo(map);
    });
  } catch (err) {
    console.error('Mapbox integration error:', err);
    alert(`Error loading local markets: ${err.message}`);
  }
}

// 2f) Run it on page load
document.addEventListener('DOMContentLoaded', loadLocalResources);
