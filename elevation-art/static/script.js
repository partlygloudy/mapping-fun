
// Wait for page to finish loading
$(document).ready(function(){

    // Set mapbox access token
    mapboxgl.accessToken = 'pk.eyJ1IjoicGFydGx5Z2xvdWR5IiwiYSI6ImNrb203c3lldDBiZW0ydWw2cnVqZG9sZGEifQ.Nl_giKKAbUX8Iy5NALPW-g';

    // Create map, add to 'map-container' element
    const map = new mapboxgl.Map({
        container: 'map-container',
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [-98.58, 39.83],
        zoom: 4,
        projection: "globe"
    });

    // On click, get coordinates from map
    map.on('click', (e) => {

        console.log(e.lngLat.toString());

    });

});