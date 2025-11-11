<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Threat Detector</title></head>
<body>
  <div id="requestButton">START</div>

  <div id="cameraPanel" style="display:none;">
    <video id="video" autoplay></video>
    <button id="takePhotoButton">Take Photo</button>
  </div>

  <div id="photoPanel" style="display:none;">
    <img id="photo" />
    <div id="imageDescription"></div>
    <nav id="homeNav"><button id="homeButton">Home</button></nav>
  </div>

  <canvas id="canvas" style="display:none;"></canvas>
  <div id="descriptionPanel"></div>

  <script src="Frontend index.js"></script>
</body>
</html>

