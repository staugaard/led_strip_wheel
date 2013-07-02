var resolution = 256;
var pixelCount = 36;
var deadRadius = 1/5;


// Serial Connection

var connection = {
  connected: false,

  init: function() {
    connection.log = document.getElementById('log');
    connection.refreshPorts();
    document.querySelector('#port-selector a').addEventListener('click', connection.refreshPorts());
    document.querySelector('#port-selector button').addEventListener('click', function() {
      var select = document.querySelector('#port-selector select');
      connection.connect(select.value);
    });
  },

  refreshPorts: function() {
    console.log('refresh');

    chrome.serial.getPorts(function(ports) {
      console.log(ports);
      var select = document.querySelector('#port-selector select');

      while (select.firstChild) {
        select.removeChild(select.firstChild);
      }

      ports.forEach(function(port) {
        var option = document.createElement('option');
        option.text = option.value = port;
        select.appendChild(option);
      });
    });
  },

  connect: function(portName) {
    chrome.serial.open(portName, {bitrate: 115200}, function(openInfo) {
      connection.id = openInfo.connectionId;
      connection.connected = true;
      connection._read();
    });
  },

  _read: function() {
    if (!connection.connected) {
      return;
    }

    chrome.serial.read(connection.id, 1, function(readInfo) {
      if (readInfo.bytesRead > 0) {
        var s = String.fromCharCode.apply(null, new Uint8Array(readInfo.data));
        connection.log.value += s;
      }
      connection._read();
    });
  }
};

connection.init();




// Image Scanning

var imageScanner = {
  sourceCanvas:  document.querySelector('#image-scanner canvas.source'),
  previewCanvas: document.querySelector('#image-scanner canvas.preview'),
  fileSelector:  document.querySelector('#image-scanner input'),
  sourceRadi: [],
  previewRadi: [],
  data: null,
  optimizedData: null,
  bytes: null,

  init: function() {
    imageScanner.sourceWidth   = imageScanner.sourceCanvas.width;
    imageScanner.previewWidth  = imageScanner.previewCanvas.width;

    imageScanner.sourceContext  = imageScanner.sourceCanvas.getContext('2d');
    imageScanner.previewContext = imageScanner.previewCanvas.getContext('2d');

    imageScanner.sourceRadius  = imageScanner.sourceWidth / 2;
    imageScanner.previewRadius = imageScanner.previewWidth / 2;

    var sourceDeadRadius  = imageScanner.sourceRadius  * deadRadius;
    var previewDeadRadius = imageScanner.previewRadius * deadRadius;

    for (var pixel = 0; pixel < pixelCount; pixel++) {
      imageScanner.sourceRadi[pixel]  = ((imageScanner.sourceRadius - sourceDeadRadius) / pixelCount) * pixel + sourceDeadRadius;
      imageScanner.previewRadi[pixel] = ((imageScanner.previewRadius - previewDeadRadius) / pixelCount) * pixel + previewDeadRadius;
    }

    imageScanner.fileSelector.addEventListener('change', function(e) {
      imageScanner.scanURL(window.URL.createObjectURL(imageScanner.fileSelector.files[0]));
    });
  },

  scanImage: function(img) {
    imageScanner.data = [];
    imageScanner.data.bytes = '';

    imageScanner.optimizedData = null;
    imageScanner.bytes = [];
    imageScanner.sourceContext.clearRect(0, 0, imageScanner.sourceWidth, imageScanner.sourceWidth);
    imageScanner.previewContext.clearRect(0, 0, imageScanner.previewWidth, imageScanner.previewWidth);

    imageScanner.sourceContext.drawImage(img, 0, 0, imageScanner.sourceWidth, imageScanner.sourceWidth);

    for (var i = 0; i < resolution; i++) {
      var pixels = [];
      pixels.bytes = '';

      for (var pixel = 0; pixel < pixelCount; pixel++) {
        var angle = (i / resolution) * 2 * Math.PI;

        var sourceX = Math.cos(angle) * imageScanner.sourceRadi[pixel] + imageScanner.sourceRadius;
        var sourceY = Math.sin(angle) * imageScanner.sourceRadi[pixel] + imageScanner.sourceRadius;

        var previewX = Math.cos(angle) * imageScanner.previewRadi[pixel] + imageScanner.previewRadius;
        var previewY = Math.sin(angle) * imageScanner.previewRadi[pixel] + imageScanner.previewRadius;

        var imageData = imageScanner.sourceContext.getImageData(sourceX, sourceY, 1, 1).data;

        imageScanner.previewContext.fillStyle = 'rgb(' + imageData[0] + ', ' + imageData[1] + ', ' + imageData[2] + ')';
        imageScanner.previewContext.fillRect(previewX, previewY, 3, 3);

        pixels[pixel] = [imageData[0], imageData[1], imageData[2]];
        pixels[pixel].bytes = String.fromCharCode(imageData[0]) + String.fromCharCode(imageData[1]) + String.fromCharCode(imageData[2]);
        pixels.bytes = pixels.bytes + pixels[pixel].bytes;
      }
      imageScanner.data[i] = pixels;
      imageScanner.data.bytes = imageScanner.data.bytes + pixels.bytes;
    }

    imageScanner.optimizeData();

  },

  scanURL: function(url) {
    var img = document.createElement('img');
    img.src = url;
    img.addEventListener('load', function() {
      imageScanner.scanImage(img);
    });
  },

  optimizeData: function() {
    imageScanner.optimizedData = [];
    imageScanner.optimizedData.bytes = '';
    var stepsBetweenStrips = resolution / 4;
    for (var i = 0; i < resolution; i++) {
      var strip1 = imageScanner.data[stepsBetweenStrips * 0 + i];
      var strip2 = imageScanner.data[stepsBetweenStrips * 0 + i];
      var strip3 = imageScanner.data[stepsBetweenStrips * 0 + i];
      var strip4 = imageScanner.data[stepsBetweenStrips * 0 + i];

      imageScanner.optimizedData[i] = [strip1, strip2, strip3, strip4];
      imageScanner.optimizedData[i].bytes = strip1.bytes + strip2.bytes + strip3.bytes + strip4.bytes;
      imageScanner.optimizedData.bytes = imageScanner.optimizedData.bytes + imageScanner.optimizedData[i].bytes;
    }
  }

};

imageScanner.init();
