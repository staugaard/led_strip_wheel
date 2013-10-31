//= require settings
//= require gif_parser

function ImageScanner(options) {
  var self = this;
  var resolution = options.resolution;
  var width = options.width || 500;
  var radius = width / 2;
  var deadRadius = radius * options.deadRadius;
  var pixelCount = options.pixelCount;

  var radi = [];
  for (var pixel = 0; pixel < pixelCount; pixel++) {
    radi[pixel]  = ((radius - deadRadius) / pixelCount) * pixel + deadRadius;
  }

  function _angleForStep(step) {
    return (-step / resolution) * 2 * Math.PI;
  };

  function _coordinates(step, pixel) {
    var angle = _angleForStep(step);

    return {
      x: Math.cos(angle) * radi[pixel] + radius,
      y: Math.sin(angle) * radi[pixel] + radius
    }
  };

  function _colorAtPixel(imageData, step, pixel) {
    var coordinates  = _coordinates(step, pixel);

    var offset = (Math.round(coordinates.y) * imageData.width + Math.round(coordinates.x)) * 4

    return {
      x: coordinates.x,
      y: coordinates.y,
      angle: coordinates.angle,
      r: imageData.data[offset],
      g: imageData.data[offset + 1],
      b: imageData.data[offset + 2]
    }
  };

  function _scanImage(context, callback) {
    var imageData = context.getImageData(0, 0, width, width);
    for (var step = 0; step < resolution; step++) {
      for (var pixel = 0; pixel < pixelCount; pixel++) {
        callback(step, pixel, _colorAtPixel(imageData, step, pixel))
      }
    }
  };



  function _render(data, width) {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = width;

    var context    = canvas.getContext('2d');
    var radius     = width / 2;
    var deadRadius = radius * options.deadRadius;
    var radi       = [];
    for (var pixel = 0; pixel < pixelCount; pixel++) {
      radi[pixel]  = ((radius - deadRadius) / pixelCount) * pixel + deadRadius;
    }
    var pixelSize = 2;
    var angle, angleSin, angleCos, x, y, stepData, pixelData;
    for (var step = 0; step < resolution; step++) {
      stepData = data[step];
      angle = _angleForStep(step);
      angleSin = Math.sin(angle);
      angleCos = Math.cos(angle);

      for (var pixel = 0; pixel < pixelCount; pixel++) {
        pixelData = stepData[pixel];
        x = angleCos * radi[pixel] + radius;
        y = angleSin * radi[pixel] + radius;

        context.fillStyle = 'rgb(' + pixelData[0] + ', ' + pixelData[1] + ', ' + pixelData[2] + ')';
        context.fillRect(x, y, pixelSize, pixelSize);
      }
    }

    return canvas;
  };

  function _scanContext(context, callback, extra) {
    var imageData = [];

    _scanImage(context, function(step, pixel, pixelData) {
      imageData[step] = imageData[step] || [];
      imageData[step].push([pixelData.r, pixelData.g, pixelData.b])
    });

    extra = extra || {};

    callback($.extend(extra, {
      data: imageData,
      // srcUrl: context.canvas.toDataURL("image/png"),
      url: _render(imageData, 112).toDataURL("image/png")
    }));
  }

  self.scanVideo = function(video, callback, extra) {
    var canvas = (extra || {}).canvas;
    if (!canvas) {
      var canvas = document.createElement('canvas');
    }
    canvas.width = canvas.height = width;
    var context = canvas.getContext('2d');

    var drawX, drawY, drawW, drawH;

    if (video.videoWidth > video.videoHeight) {
      drawX = 0;
      drawW = canvas.width;

      drawH = video.videoHeight * canvas.width / video.videoWidth;
      drawY = (canvas.height - drawH) / 2;
    }

    var first = true;
    var scanning = true;

    var next = function() {
      if (first) {
        first = false;
        video.currentTime = 0;
      } else if (scanning) {
        video.currentTime += 0.1;
      }
    };

    var seeked = function() {
      // console.log('seeked');
      context.drawImage(video, drawX, drawY, drawW, drawH);

      _scanContext(context, callback, extra);

    }

    var ended = function() {
      // console.log('ended');
      scanning = false;
    }

    video.addEventListener('seeked', seeked);
    video.addEventListener('ended',  ended);

    return next;
  };

  self.scanImage = function(image, callback, extra) {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = width;
    var context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, width, width);

    _scanContext(context, callback, extra);
  };

  self.scanURL = function(url, callback, extra) {
    var img = document.createElement('img');
    img.src = url;
    img.addEventListener('load', function() {
      self.scanImage(img, callback, extra || {});
    });
  };

  self.scanGIF = function(file, callback) {
    var reader = new FileReader();
    reader.onloadend = function () {
      var parser = new GifParser();
      parser.parse(reader.result, function(frames) {
        frames.forEach(function(frame) {
          var canvas = document.createElement('canvas');
          canvas.width = frame.data.width;
          canvas.height = frame.data.height;
          var context = canvas.getContext('2d');
          context.putImageData(frame.data, 0, 0);
          self.scanImage(canvas, callback, {delay: frame.delay});
        })
      })
    }

    reader.readAsBinaryString(file);
  };

  self.scanFile = function(file, callback) {
    if (file.type == 'image/gif') {
      self.scanGIF(file, callback);
    } else {
      var url = window.URL.createObjectURL(file);
      self.scanURL(url, callback, {});
    }
  };
}

var imageScanner = new ImageScanner(settings);
