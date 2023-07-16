
// TODO clear points and roi on reset click
// TODO if roi selected, send request on submit
// TODO auto-gen color selection panel and update when # changes
// TODO different views for map selection and image edit
// TODO button to minimize/maximize control panel

// Globals
let regionSelectActive = false
let roiCorners = [];
let map = undefined;
let corner1 = undefined;
let corner2 = undefined;
let roiJson = undefined;

// Wait for page to finish loading
$(document).ready(function(){

    // Set mapbox access token
    mapboxgl.accessToken = 'pk.eyJ1IjoicGFydGx5Z2xvdWR5IiwiYSI6ImNrb203c3lldDBiZW0ydWw2cnVqZG9sZGEifQ.Nl_giKKAbUX8Iy5NALPW-g';

    // Create map, add to 'map-container' element
    map = new mapboxgl.Map({
        container: 'map-container',
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [-98.58, 39.83],
        zoom: 4,
        projection: "globe"
    });

    // On click, get coordinates from map
    map.on('click', handleMapClick)

    // Add click handlers to buttons
    $("#select-button").click(toggleRegionSelect);
    $("#reset-button").click(handleResetClick);
    $("#submit-button").click(handleSubmitClick);

    // Add handler for changing the number of bands
    $("#num-bands-input").on("blur", updateBandsPanel)

    // Do initial update of the bands panel
    updateBandsPanel();

});


function toggleRegionSelect() {

    // Toggle boolean
    regionSelectActive = !regionSelectActive;

    // Update highlighting
    if (regionSelectActive) {
        $("#select-button").addClass("active");
    } else {
        $("#select-button").removeClass("active");
    }

}


function handleResetClick() {

    // Reset select toggle button
    if (regionSelectActive) {
        regionSelectActive = false;
        $("#select-button").removeClass("active");
    }

    // Clear map corners
    if (corner1 !== undefined) {
        corner1.remove();
        corner1 = undefined;
    }
    if (corner2 !== undefined) {
        corner2.remove();
        corner2 = undefined;
    }
    roiCorners = []

    // Clear polygon
    if (map.getLayer("roi-fill")) {
        map.removeLayer("roi-fill");
    }
    if (map.getLayer("roi-stroke")) {
        map.removeLayer("roi-stroke");
    }
    if (map.getSource("roi-source")) {
        map.removeSource("roi-source");
    }

}


function handleSubmitClick() {

}


function handleMapClick(e) {

    // If region selection is active, record click coordinates
    if (regionSelectActive) {

        // Placing first corner
        if (roiCorners.length === 0) {

            // Add first corner to array
            roiCorners.push(e.lngLat.toArray());

            // Draw first corner pin
            corner1 = new mapboxgl.Marker()
                .setLngLat(e.lngLat)
                .addTo(map);

        }

        else if (roiCorners.length === 1) {

            // Add second corner to array
            roiCorners.push(e.lngLat.toArray());

            // Draw second corner pin
            corner2 = new mapboxgl.Marker()
                .setLngLat(e.lngLat)
                .addTo(map);

            // Get geoJson for bounding box
            roiJson = getGeoJsonRectangle(roiCorners.at(0), roiCorners.at(1));

            // Add roi polygon as a source
            map.addSource('roi-source', {
                'type': 'geojson',
                'data': roiJson
            });

            // Draw roi on map
            map.addLayer({
                'id': 'roi-fill',
                'type': 'fill',
                'source': 'roi-source',
                'layout': {},
                'paint': {
                    'fill-color': 'rgba(100,175,255,0.5)',
                    'fill-opacity': 0.5
                }
            });

            // Draw outline
            map.addLayer({
                'id': 'roi-stroke',
                'type': 'line',
                'source': 'roi-source',
                'layout': {},
                'paint': {
                    'line-color': '#000',
                    'line-width': 1
                }
            });

        }
    }
}


function getGeoJsonRectangle(c1, c2) {

    // Compute the corners of the rectangle
    let coordinates = [
        c1,
        [c1.at(0), c2.at(1)],
        c2,
        [c2.at(0), c1.at(1)],
        c1
    ]

    // Construct geoJSON object
    let rectJson = {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [coordinates]
        }
    }

    return rectJson;

}


function updateBandsPanel() {

    // Get current value of band # select input as an integer
    let nBands = parseInt($("#num-bands-input").val());

    // Sanitize the input
    if (nBands < 0 || isNaN(nBands)) {
        nBands = 0
    }
    $("#num-bands-input").val(nBands)

    // Check if we need to add or remove color selectors
    let nCurrent = $("#color-selection-wrapper").children().length;

    // Remove excess color selectors
    if (nCurrent > nBands) {
        $('#color-selection-wrapper').children(`:gt(${(nBands - 1)})`).remove();
    }

    // Add more color selectors as needed
    else if (nCurrent < nBands) {

        for (let i=nCurrent+1; i<=nBands; i++) {

            // Create the new element
            let newColorSelect = $(`
                <div class="color-select-row">
                    <input type="color" class="color-select" id="color-select-${i}" name="colorPicker" value="#ff0000">
                        <label class="color-select-label" for="color-select-${i}">band ${i}</label>
                </div> 
            `);

            // Append to the container
            $('#color-selection-wrapper').append(newColorSelect);

        }

    }

}