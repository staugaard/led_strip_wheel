var resolution = 256;
var pixelCount = 36;
var deadRadius = 1/5;


// Serial Connection

var connection = {
  connected: false,
  read: true,

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

  sendCommand: function(command) {
    return connection.sendDataString(command + "\n");
  },

  sendDataString: function(data) {
    var buffer = new ArrayBuffer(data.length);
    var uint8View = new Uint8Array(buffer);

    for (var i = 0; i < data.length; i++) {
      uint8View[i] = data.charCodeAt(i);
    }

    connection.sendDataBuffer(buffer);
  },

  sendDataBuffer: function(buffer, offset) {
    offset = offset || 0;

    chrome.serial.write(connection.id, buffer.slice(offset), function(writeInfo) {
      console.log(writeInfo);
      if (writeInfo.bytesWritten > 0) {
        offset = offset + writeInfo.bytesWritten;
      }

      if (offset < buffer.byteLength) {
        connection.sendDataBuffer(buffer, offset);
      }
    });
  },

  info: function() {
    if (connection.connected) {
      connection.sendCommand('info');
    }
  },

  writeImage: function(index, dataBuffer) {
    if (!connection.connected) {
      return;
    }

    connection.sendCommand('write_image ' + index);
    connection.sendDataBuffer(dataBuffer);
  },

  readImage: function(index, callback) {
    connection.read = false;

    connection.sendCommand('read_image ' + index);

    var bytesPerBlock = pixelCount * 4 * 3;
    var expectedLength = bytesPerBlock * resolution;

    connection._readData(expectedLength, function(data) {
      connection.read = true;
      if (callback) {
        callback(data);
      } else {
        console.log(data);
      }
    });

  },

  _readData: function(length, callback, buffer) {
    buffer = buffer || [];

    chrome.serial.read(connection.id, Math.min(1024, length - buffer.length), function(readInfo) {
      var view = new Uint8Array(readInfo.data);

      for (var i = 0; i < view.length; i++) {
        buffer.push(view[i]);
      }

      console.log(readInfo.bytesRead, view.length, buffer.length, length);

      if (buffer.length == length) {
        callback(buffer);
      } else {
        connection._readData(length, callback, buffer);
      }
    });
  },

  _read: function() {
    if (!connection.connected) {
      return;
    }

    if (!connection.read) {
      setTimeout(connection._read, 500);
      return;
    }

    chrome.serial.read(connection.id, 1, function(readInfo) {
      if (readInfo.bytesRead > 0) {
        var s = String.fromCharCode.apply(null, new Uint8Array(readInfo.data));
        connection.log.value += s;
        connection._read();
      } else {
        setTimeout(connection._read, 500);
      }
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

  _angleForStep: function(step) {
    return (step / resolution) * 2 * Math.PI;
  },

  _sourceCoordinates: function(step, pixel) {
    var angle = imageScanner._angleForStep(step);

    return {
      x: Math.cos(angle) * imageScanner.sourceRadi[pixel] + imageScanner.sourceRadius,
      y: Math.sin(angle) * imageScanner.sourceRadi[pixel] + imageScanner.sourceRadius
    }
  },

  _previewCoordinates: function(step, pixel) {
    var angle = imageScanner._angleForStep(step);

    return {
      x: Math.cos(angle) * imageScanner.previewRadi[pixel] + imageScanner.previewRadius,
      y: Math.sin(angle) * imageScanner.previewRadi[pixel] + imageScanner.previewRadius,
      angle: angle
    }
  },

  _colorAtCoordinates: function(x, y) {
    return imageScanner.sourceContext.getImageData(x, y, 1, 1).data;
  },

  _colorAtPixel: function(step, pixel) {
    var coordinates  = imageScanner._sourceCoordinates(step, pixel);
    var imageData    = imageScanner.sourceContext.getImageData(coordinates.x, coordinates.y, 1, 1).data;

    return {
      x: coordinates.x,
      y: coordinates.y,
      angle: coordinates.angle,
      r: imageData[0],
      g: imageData[1],
      b: imageData[2]
    }
  },

  _scanImage: function(callback) {
    for (var step = 0; step < resolution; step++) {
      for (var pixel = 0; pixel < pixelCount; pixel++) {
        callback(step, pixel, imageScanner._colorAtPixel(step, pixel))
      }
    }
  },

  scanImage: function(img) {
    imageScanner.data = [];

    imageScanner.optimizedData = null;
    imageScanner.sourceContext.clearRect(0, 0, imageScanner.sourceWidth, imageScanner.sourceWidth);
    imageScanner.previewContext.clearRect(0, 0, imageScanner.previewWidth, imageScanner.previewWidth);

    imageScanner.sourceContext.drawImage(img, 0, 0, imageScanner.sourceWidth, imageScanner.sourceWidth);

    imageScanner._scanImage(function(step, pixel, data) {
      var previewCoordinates = imageScanner._previewCoordinates(step, pixel);

      imageScanner.previewContext.fillStyle = 'rgb(' + data.r + ', ' + data.g + ', ' + data.b + ')';
      imageScanner.previewContext.fillRect(previewCoordinates.x, previewCoordinates.y, 3, 3);

      imageScanner.data[step] = imageScanner.data[step] || [];
      imageScanner.data[step].push([data.r, data.g, data.b])
    });

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
    imageScanner.optimizedData = {};

    var bytesPerStrip = pixelCount * 3;
    var bytesPerBlock = 4 * bytesPerStrip;

    imageScanner.optimizedData.buffer = new ArrayBuffer(resolution * bytesPerBlock);
    var view = imageScanner.optimizedData.view = new Uint8Array(imageScanner.optimizedData.buffer);

    var stepsBetweenStrips = resolution / 4;

    var strips = [];
    var stepIndex;
    var pixelOffset;

    for (var step = 0; step < resolution; step++) {

      for (var strip = 0; strip < 4; strip++) {
        stepIndex = step + (strip * stepsBetweenStrips);
        if (stepIndex >= resolution) { stepIndex = stepIndex - resolution; }

        for (var pixel = 0; pixel < pixelCount; pixel++) {
          pixelOffset = (step * bytesPerBlock) + (strip * bytesPerStrip) + (pixel * 3);
          view[pixelOffset + 0] = imageScanner.data[stepIndex][pixel][0];
          view[pixelOffset + 1] = imageScanner.data[stepIndex][pixel][1];
          view[pixelOffset + 2] = imageScanner.data[stepIndex][pixel][2];
        }

      }

    }
  },

  verifyOptimizedData: function(data) {
    var bytesPerStrip      = pixelCount * 3;
    var bytesPerBlock      = 4 * bytesPerStrip;
    var stepsBetweenStrips = resolution / 4;
    var stepIndex;
    var pixelIndex;
    var color;

    if (data.length != (resolution * bytesPerBlock)) {
      console.log('data has wrong length');
      return false;
    }

    for (var step = 0; step < resolution; step++) {
      for (var strip = 0; strip < 4; strip++) {
        stepIndex = step + (strip * stepsBetweenStrips);
        if (stepIndex >= resolution) { stepIndex = stepIndex - resolution; }

        for (var pixel = 0; pixel < pixelCount; pixel++) {
          pixelIndex = step * bytesPerBlock + strip * bytesPerStrip + pixel * 3;
          color = imageScanner._colorAtPixel(stepIndex, pixel);

          if (data[pixelIndex] != color.r) {
            console.log('red is wrong');
            return false;
          }

          if (data[pixelIndex + 1] != color.g) {
            console.log('red is wrong');
            return false;
          }

          if (data[pixelIndex + 2] != color.b) {
            console.log('red is wrong');
            return false;
          }
        }
      }
    }

    return true;
  }
};

imageScanner.init();
