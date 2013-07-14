var resolution = 256;
var pixelCount = 36;
var deadRadius = 1/5;


// Serial Connection

var connection = {
  connected: false,
  read: true,
  line: '',

  init: function() {
    connection.log = document.getElementById('log');
    connection.refreshPorts();
    document.querySelector('#port-selector a').addEventListener('click', connection.refreshPorts);
    document.querySelector('#port-selector button').addEventListener('click', function() {
      var select = document.querySelector('#port-selector select');
      connection.connect(select.value);
    });
  },

  refreshPorts: function() {
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
      connection.line = '';
      var wasConnected = connection.connected;
      connection.connected = true;
      connection.read = true;
      if (!wasConnected) {
        connection._read();
      }
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

    chrome.serial.write(connection.id, buffer.slice(offset, Math.min(offset + 32, buffer.byteLength)), function(writeInfo) {
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
        callback(data, index);
      } else {
        console.log(data);
      }
    });

  },

  readImages: function(count, offset) {
    offset = offset || 0;

    if (count == 0 || offset >= count) {
      return;
    }

    console.log('getting image ' + offset);
    connection.readImage(offset, function(optimizedData, index) {
      console.log('got image ' + index);

      var compactedData = dataOptimizer.compactData(optimizedData);
      var thumbnail = thumbnails.create(compactedData);
      thumbnails.add(thumbnail);

      connection.readImages(count, offset + 1);
    });
  },

  _readData: function(length, callback, buffer) {
    buffer = buffer || [];

    chrome.serial.read(connection.id, Math.min(1024, length - buffer.length), function(readInfo) {
      var view = new Uint8Array(readInfo.data);

      for (var i = 0; i < view.length; i++) {
        buffer.push(view[i]);
      }

      // console.log(readInfo.bytesRead, view.length, buffer.length, length);

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
        var data = new Uint8Array(readInfo.data)

        var s = '';
        if (data.length != 1 || data[0] != 13) {
          s = String.fromCharCode.apply(null, data);
        }

        connection.log.value += s;
        connection.log.scrollTop = connection.log.scrollHeight;

        connection.line += s;

        var match = connection.line.match("^image_count: (\\d+)\n");
        if (match) {
          connection.line = '';
          connection.readImages(Number(match[1]));
        }

        connection._read();
      } else {
        setTimeout(connection._read, 500);
      }
    });
  }
};

connection.init();


// Image Rendering

var imageRenderer = {
  render: function(canvas, compactData, pixelSize) {
    var renderWidth      = canvas.width;
    var renderContext    = canvas.getContext('2d');
    var renderRadius     = renderWidth / 2;
    var renderDeadRadius = renderRadius * deadRadius;
    var renderRadi       = [];

    for (var pixel = 0; pixel < pixelCount; pixel++) {
      renderRadi[pixel]  = ((renderRadius - renderDeadRadius) / pixelCount) * pixel + renderDeadRadius;
    }

    renderContext.clearRect(0, 0, renderWidth, renderWidth);

    var angle, angleSin, angleCos, x, y, stepData, pixelData;
    for (var step = 0; step < resolution; step++) {
      stepData = compactData[step];
      angle = (step / resolution) * 2 * Math.PI;
      angleSin = Math.sin(angle);
      angleCos = Math.cos(angle);

      for (var pixel = 0; pixel < pixelCount; pixel++) {
        pixelData = stepData[pixel];
        x = angleCos * renderRadi[pixel] + renderRadius;
        y = angleSin * renderRadi[pixel] + renderRadius;

        renderContext.fillStyle = 'rgb(' + pixelData[0] + ', ' + pixelData[1] + ', ' + pixelData[2] + ')';
        renderContext.fillRect(x, y, pixelSize, pixelSize);
      }
    }
  }
}


// Data optimizations

var dataOptimizer = {
  bytesPerStrip: pixelCount * 3,
  bytesPerBlock: pixelCount * 3 * 4,

  optimizeData: function(compactData) {
    var optimizedData = {}

    optimizedData.buffer = new ArrayBuffer(resolution * dataOptimizer.bytesPerBlock);
    var view = optimizedData.view = new Uint8Array(optimizedData.buffer);

    var stepsBetweenStrips = resolution / 4;

    var strips = [];
    var stepIndex;
    var pixelOffset;

    for (var step = 0; step < resolution; step++) {

      for (var strip = 0; strip < 4; strip++) {
        stepIndex = step + (strip * stepsBetweenStrips);
        if (stepIndex >= resolution) { stepIndex = stepIndex - resolution; }

        for (var pixel = 0; pixel < pixelCount; pixel++) {
          pixelOffset = (step * dataOptimizer.bytesPerBlock) + (strip * dataOptimizer.bytesPerStrip) + (pixel * 3);
          view[pixelOffset + 0] = compactData[stepIndex][pixel][0];
          view[pixelOffset + 1] = compactData[stepIndex][pixel][1];
          view[pixelOffset + 2] = compactData[stepIndex][pixel][2];
        }

      }

    }

    return optimizedData;
  },

  compactData: function(optimizedData) {
    var compactedData = [];
    var stepOffset, pixelOffset;

    for (var step = 0; step < resolution; step++) {
      stepOffset = step * dataOptimizer.bytesPerBlock;
      compactedData[step] = [];
      for (var pixel = 0; pixel < pixelCount; pixel++) {
        pixelOffset = stepOffset + (pixel * 3);
        compactedData[step].push([
          optimizedData[pixelOffset + 0],
          optimizedData[pixelOffset + 1],
          optimizedData[pixelOffset + 2]
        ]);
      }
    }

    return compactedData;
  },

  verifyOptimizedData: function(data) {
    var stepsBetweenStrips = resolution / 4;
    var stepIndex;
    var pixelIndex;
    var color;

    if (data.length != (resolution * dataOptimizer.bytesPerBlock)) {
      console.log('data has wrong length');
      return false;
    }

    for (var step = 0; step < resolution; step++) {
      for (var strip = 0; strip < 4; strip++) {
        stepIndex = step + (strip * stepsBetweenStrips);
        if (stepIndex >= resolution) { stepIndex = stepIndex - resolution; }

        for (var pixel = 0; pixel < pixelCount; pixel++) {
          pixelIndex = step * dataOptimizer.bytesPerBlock + strip * dataOptimizer.bytesPerStrip + pixel * 3;
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


// Thumbnails

var thumbnails = {
  container: document.querySelector('#thumbnails'),
  canvas:    document.querySelector('#thumbnails canvas.thumbnail'),

  init: function() {
    thumbnails.clear();
  },

  clear: function() {
    while (thumbnails.container.firstChild) {
      thumbnails.container.removeChild(thumbnails.container.firstChild);
    }
  },

  items: function() {
    return thumbnails.container.querySelector('canvas.thumbnail');
  },

  create: function(compactData) {
    var canvas = thumbnails.canvas.cloneNode();
    imageRenderer.render(canvas, compactData, 2);
    canvas.data = compactData;
    canvas.optimizedData = dataOptimizer.optimizeData(compactData);
    return canvas;
  },

  add: function(thumbnail) {
    thumbnails.container.appendChild(thumbnail);
  },
}

thumbnails.init();

// Image Scanning

var imageScanner = {
  canvas:  document.querySelector('#image-scanner canvas.source'),
  previewCanvas: document.querySelector('#image-scanner canvas.preview'),
  fileSelector:  document.querySelector('#image-scanner input'),
  radi: [],
  data: null,
  optimizedData: null,
  bytes: null,

  init: function() {
    imageScanner.width   = imageScanner.canvas.width;

    imageScanner.context  = imageScanner.canvas.getContext('2d');

    imageScanner.radius  = imageScanner.width / 2;

    var sourceDeadRadius  = imageScanner.radius  * deadRadius;

    for (var pixel = 0; pixel < pixelCount; pixel++) {
      imageScanner.radi[pixel]  = ((imageScanner.radius - sourceDeadRadius) / pixelCount) * pixel + sourceDeadRadius;
    }

    imageScanner.fileSelector.addEventListener('change', function(e) {
      imageScanner.scanURL(window.URL.createObjectURL(imageScanner.fileSelector.files[0]));
    });
  },

  _angleForStep: function(step) {
    return (step / resolution) * 2 * Math.PI;
  },

  _coordinates: function(step, pixel) {
    var angle = imageScanner._angleForStep(step);

    return {
      x: Math.cos(angle) * imageScanner.radi[pixel] + imageScanner.radius,
      y: Math.sin(angle) * imageScanner.radi[pixel] + imageScanner.radius
    }
  },

  _colorAtCoordinates: function(x, y) {
    return imageScanner.context.getImageData(x, y, 1, 1).data;
  },

  _colorAtPixel: function(step, pixel) {
    var coordinates  = imageScanner._coordinates(step, pixel);
    var imageData    = imageScanner.context.getImageData(coordinates.x, coordinates.y, 1, 1).data;

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
    imageScanner.context.clearRect(0, 0, imageScanner.width, imageScanner.width);

    imageScanner.context.drawImage(img, 0, 0, imageScanner.width, imageScanner.width);

    imageScanner._scanImage(function(step, pixel, data) {
      imageScanner.data[step] = imageScanner.data[step] || [];
      imageScanner.data[step].push([data.r, data.g, data.b])
    });

    imageRenderer.render(imageScanner.previewCanvas, imageScanner.data, 4);

    imageScanner.optimizedData = dataOptimizer.optimizeData(imageScanner.data);
  },

  scanURL: function(url) {
    var img = document.createElement('img');
    img.src = url;
    img.addEventListener('load', function() {
      imageScanner.scanImage(img);
    });
  }

};

imageScanner.init();
