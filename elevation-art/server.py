
# Import packages
from flask import Flask, request, jsonify, send_file
import ee
import numpy as np
import urllib.request
import os
from PIL import Image
import io

# ------------------------ #
# ----- SETUP / INIT ----- #
# ------------------------ #


# Crate flask app
app = Flask(__name__)

# Authenticate / Initialize Google Earth Engine
EE_ACCOUNT = 'earth-engine-client@miscellaneous-projects-391201.iam.gserviceaccount.com'
EE_PRIVATE_KEY_FILE = '.private-key.json'
EE_CREDENTIALS = ee.ServiceAccountCredentials(EE_ACCOUNT, EE_PRIVATE_KEY_FILE)
ee.Initialize(EE_CREDENTIALS)


# ---------------------------- #
# ----- HELPER FUNCTIONS ----- #
# ---------------------------- #


def get_elevation_image(corners):

    # Convert corner data to polygon
    roi = ee.Geometry.Polygon(corners)

    # Load elevation data and clip to roi
    elevation_raw = ee.Image('USGS/SRTMGL1_003').select('elevation')
    elevation_raw = elevation_raw.clip(roi)

    # Find min and max elevation
    data_range = elevation_raw.reduceRegion(reducer=ee.Reducer.minMax(), geometry=roi, scale=30, maxPixels=1e9)
    e_min = data_range.getInfo()['elevation_min']
    e_max = data_range.getInfo()['elevation_max']

    # Rescale image so 0 = min elevation, 1 = max elevation
    elevation_scaled = elevation_raw.unitScale(e_min, e_max)

    # Get a download URL for the image
    path = elevation_scaled.getDownloadUrl({
        "name": "image",
        "scale": 30,
        "format": "NPY"
    })

    # Download zipfile from download url
    urllib.request.urlretrieve(path, "elevation_data.npy")

    # Read downloaded numpy array
    data = np.load("elevation_data.npy")
    data = data["elevation"]

    # Convert numpy array to PIL Image, then to PNG file
    # Mode = L since it's a 2D grayscale array
    data = (data * 255).astype(np.uint8)
    pil_img = Image.fromarray(data, mode='L')

    # Create in-memory PNG file
    file = io.BytesIO()
    pil_img.save(file, 'PNG')
    file.seek(0)

    # Clean up leftover files
    os.remove("elevation_data.npy")

    return file


@app.route('/')
def home():
    return open("index.html", "r")


@app.route('/elevation', methods=['POST'])
def post_endpoint():

    # Parse request
    feature = request.get_json()

    # Get roi from request
    corners = feature["geometry"]["coordinates"][0]

    # Load elevation data for requested region from Earth Engine
    img_file = get_elevation_image(corners)

    # Perform operations with the data
    return send_file(img_file, mimetype='image/PNG')


if __name__ == '__main__':

    # Run flask server
    app.run(debug=True)




