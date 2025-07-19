// static/js/local_resources.js

// 1. Initialize the map (default to NH)
const map = L.map('map').setView([43.0, -71.5], 6);

// 2. Add OSM tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 3. Marker clustering
const markers = L.markerClusterGroup();

// 4. Helper to load locations into the map
async function loadLocations(filterBounds) {
  let query = supabase.from('locations').select('*');

  if (filterBounds) {
    const { latMin, latMax, lngMin, lngMax } = filterBounds;
    query = query
      .gte('latitude', latMin)
      .lte('latitude', latMax)
      .gte('longitude', lngMin)
      .lte('longitude', lngMax);
  }

  const { data: locations, error } = await query;
  console.log('📍 fetched locations:', locations, '❗ error:', error);
  if (error) {
    console.error('Error fetching locations:', error);
    return 0;
  }

  markers.clearLayers(); // remove old markers
  locations.forEach(loc => {
    const marker = L.marker([loc.latitude, loc.longitude]);
    marker.bindPopup(`
      <strong>${loc.name}</strong><br/>
      ${loc.website ? `<a href="${loc.website}" target="_blank">Visit site</a><br/>` : ''}
      <button onclick="saveFavorite(${loc.id})">★ Save</button>
    `);
    markers.addLayer(marker);
  });

  map.addLayer(markers);

  // auto-fit to show all markers
  if (markers.getLayers().length) {
    map.fitBounds(markers.getBounds(), { padding: [50, 50] });
  }

  return locations.length;
}

// 5. Geolocation: center & filter on user
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      const { latitude: lat, longitude: lng } = coords;
      console.log('User coords:', lat, lng);
      map.setView([lat, lng], 13);

      // bounding box (~0.1° approx 11km)
      const delta = 0.1;
      const bounds = {
        latMin: lat - delta,
        latMax: lat + delta,
        lngMin: lng - delta,
        lngMax: lng + delta,
      };
      console.log('Using bounds:', bounds);

      let count = await loadLocations(bounds);
      if (count === 0) {
        console.info('No nearby markets found—loading all locations.');
        await loadLocations();
      }
    },
    // on error or denial -> load all
    () => {
      console.info('Geolocation failed or denied—loading all locations.');
      loadLocations();
    }
  );
} else {
  console.info('No geolocation support—loading all locations.');
  loadLocations();
}

// 6. Add search control (Leaflet-Geosearch)
const provider = new window.GeoSearch.OpenStreetMapProvider();
const searchControl = new window.GeoSearch.GeoSearchControl({
  provider,
  style: 'bar',
  autoComplete: true,
  searchLabel: 'Search for a place…'
});
map.addControl(searchControl);

// 7. (Optional) Locate-me button – requires leaflet.locatecontrol plugin
// L.control.locate({ flyTo: true }).addTo(map);
