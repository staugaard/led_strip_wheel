//= require settings

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
    return (step / resolution) * 2 * Math.PI;
  };

  function _coordinates(step, pixel) {
    var angle = _angleForStep(step);

    return {
      x: Math.cos(angle) * radi[pixel] + radius,
      y: Math.sin(angle) * radi[pixel] + radius
    }
  };

  function _colorAtPixel(context, step, pixel) {
    var coordinates  = _coordinates(step, pixel);
    var imageData    = context.getImageData(coordinates.x, coordinates.y, 1, 1).data;

    return {
      x: coordinates.x,
      y: coordinates.y,
      angle: coordinates.angle,
      r: imageData[0],
      g: imageData[1],
      b: imageData[2]
    }
  };

  function _scanImage(context, callback) {
    for (var step = 0; step < resolution; step++) {
      for (var pixel = 0; pixel < pixelCount; pixel++) {
        callback(step, pixel, _colorAtPixel(context, step, pixel))
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
      angle = (step / resolution) * 2 * Math.PI;
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



  self.scanImage = function(image, callback, extra) {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = width;
    var context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, width, width);

    var imageData = [];

    _scanImage(context, function(step, pixel, pixelData) {
      imageData[step] = imageData[step] || [];
      imageData[step].push([pixelData.r, pixelData.g, pixelData.b])
    });

    extra = extra || {};

    callback($.extend(extra, {
      data: imageData,
      srcUrl: canvas.toDataURL("image/png"),
      url: _render(imageData, 112).toDataURL("image/png")
    }));
  };

  self.scanURL = function(url, callback, extra) {
    var img = document.createElement('img');
    img.src = url;
    img.addEventListener('load', function() {
      self.scanImage(img, callback, extra || {});
    });
  };

  self.scanFile = function(file, callback) {
    var url = window.URL.createObjectURL(file);
    self.scanURL(url, callback, {});
  };
}

var imageScanner = new ImageScanner(settings);
