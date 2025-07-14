// 1. Initialize the map (default to NH)
const map = L.map('map').setView([43.0, -71.5], 6);

// 2. Add OSM tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// 3. Geolocation: center on user
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    map.setView([coords.latitude, coords.longitude], 13);
  });
}

// 4. Marker clustering
const markers = L.markerClusterGroup();

// 5. Fetch locations from Supabase
(async () => {
  const { data: locations, error } = await supabase
    .from('locations')
    .select('*');

  if (error) {
    console.error('Error fetching locations:', error);
    return;
  }

  locations.forEach(loc => {
    const marker = L.marker([loc.latitude, loc.longitude]);
    marker.bindPopup(`
      <strong>${loc.name}</strong><br/>
      <a href="${loc.website}" target="_blank">Visit site</a><br/>
      <button onclick="saveFavorite(${loc.id})">★ Save</button>
    `);
    markers.addLayer(marker);
  });

  map.addLayer(markers);
})();

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
