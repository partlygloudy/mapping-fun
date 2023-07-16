
// TODO fix image sizing

// TODO set initial gradient to nice grayscale
// TODO different views for map selection and image edit
// TODO button to minimize/maximize control panel
// TODO disable/grey buttons when not ready, color when ready
// TODO add button to return to map view
// TODO hide irrelevant buttons on each view

// Globals
let regionSelectActive = false
let roiCorners = [];
let map = undefined;
let corner1 = undefined;
let corner2 = undefined;
let roiJson = undefined;
let mode = "SELECT";   // "SELECT", "EDIT"
let colors = [];

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
    $("#apply-button").click(handleApplyClick);

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


async function handleSubmitClick() {

    // Check if roi is selected
    if (roiCorners.length === 2) {

        // Make request to server
        await fetch("/elevation", {
            method: "POST",
            body: JSON.stringify(roiJson),
            headers: {
                "Content-Type": "application/json"
            }
        }).then((response) => {
            return response.blob();
        }).then(loadImage).catch((error) => {
            console.error("Error: ", error)
        })

        // Switch to editor view
        switchToViewEdit();

    }


}


function loadImage(data) {

    // Image object
    var img = new Image();

    // Define function that gets triggerred when we give the
    // image data to the image
    img.onload = function() {

        // Revoke object url after image load (???)
        URL.revokeObjectURL(this.src);

        // If the image is larger than the window, scale it down
        const w = $("#editor-container-inner").width();
        const h = $("#editor-container-inner").height();
        const scale = Math.min(1, w / this.width, h / this.height);

        // Scale both canvases to the size of the image
        let canvasBase = document.getElementById("canvas-base");
        let canvasStyled = document.getElementById("canvas-styled");
        canvasBase.width = this.width * scale;
        canvasBase.height = this.height * scale;
        canvasStyled.width = this.width * scale;
        canvasStyled.height = this.height * scale;

        // Draw the image on both canvases
        let ctxBase = canvasBase.getContext("2d");
        let ctxStyled = canvasStyled.getContext("2d");
        ctxBase.drawImage(this, 0, 0, canvasBase.width, canvasBase.height);
        ctxStyled.drawImage(this, 0, 0, canvasStyled.width, canvasStyled.height);

    }

    img.src = URL.createObjectURL(data)

}


function handleApplyClick() {

    // Only do anything if we're in edit mode
    if (mode === "EDIT") {

        // Get # of bands
        let n = parseInt($("#num-bands-input").val());

        // Read the color settings for each band
        readColors(n);

        // Quantize and color the image
        quantizeImage(n);

    }

}



function readColors(n) {

    colors = [];

    for (let i=1; i<=n; i++) {

        // Read color value from input
        let hexColor = $(`#color-select-${i}`).val();

        // Separate R, G, and B values
        hexColor = hexColor.replace(/^#/, '');

        // Parse the R, G, B values
        const r = parseInt(hexColor.slice(0, 2), 16);
        const g = parseInt(hexColor.slice(2, 4), 16);
        const b = parseInt(hexColor.slice(4, 6), 16);

        colors.push([r, g, b]);

    }

}


function quantizeImage(q) {

    // Get the canvas and context for the base and styled images
    let canvasBase = document.getElementById("canvas-base");
    let canvasStyled = document.getElementById("canvas-styled");
    let ctxBase = canvasBase.getContext('2d');
    let ctxStyled = canvasStyled.getContext('2d');

    // Get pixel data for both images
    let dataBase = ctxBase.getImageData(0, 0, canvasBase.width, canvasBase.height);
    let dataStyled = ctxStyled.getImageData(0, 0, canvasStyled.width, canvasStyled.height);
    let pixelsBase = dataBase.data;
    let pixelsStyled = dataStyled.data;

    const scalar = 255.0 / q;

    // Loop over image pixels
    for(let i = 0; i < pixelsBase.length; i += 4) {

        // Get quantization integer (0 - # bands) from base image
        const qIdx = Math.min(Math.floor(pixelsBase[i] / scalar), q - 1)

        // Quantize each pixel in styled image
        pixelsStyled[i] = colors[qIdx][0];
        pixelsStyled[i + 1] = colors[qIdx][1];
        pixelsStyled[i + 2] = colors[qIdx][2];

    }

    // Put the manipulated pixels back into the canvas
    ctxStyled.putImageData(dataStyled, 0, 0);

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


function switchToViewEdit() {

    // Fade out interactive map
    $("#map-container").fadeOut(500);

    // Fade in editor canvas
    $("#editor-container").fadeIn(500);

    // Switch mode to "EDIT"
    mode = "EDIT";

}