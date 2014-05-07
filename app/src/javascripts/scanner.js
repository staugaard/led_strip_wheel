//= require settings
//= require gif_parser

function ImageScanner(options) {
  var self = this;
  var width = options.width || 500;
  var radius = width / 2;
  var pixelConfig = options.pixelConfig;

  function _colorAtCoordinates(imageData, coordinates) {
    var x = coordinates.x * radius + radius;
    var y = coordinates.y * radius + radius;

    var offset = (Math.round(y) * imageData.width + Math.round(x)) * 4

    return {
      x: coordinates.x,
      y: coordinates.y,
      r: imageData.data[offset],
      g: imageData.data[offset + 1],
      b: imageData.data[offset + 2]
    }
  }

  function _scanImage(context, callback) {
    var imageData = context.getImageData(0, 0, width, width);

    var stepIndex, step, stripIndex, strip, pixelIndex, pixel, pixelData;
    for (stepIndex = 0; stepIndex < pixelConfig.length; stepIndex++) {
      step = pixelConfig[stepIndex];

      for (stripIndex = 0; stripIndex < step.length; stripIndex++) {
        strip = step[stripIndex];

        for (pixelIndex = 0; pixelIndex < strip.length; pixelIndex++) {
          pixel = strip[pixelIndex];
          pixelData = _colorAtCoordinates(imageData, pixel);
          callback(stepIndex, stripIndex, pixelIndex, pixelData);
        }
      }
    }
  }

  function _render(data, width) {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = width;

    var context = canvas.getContext('2d');
    context.translate(width / 2, width / 2);
    context.scale(width / 2, width / 2);
    var pixelSize = 3 / width;
    var x, y, strip, strip;

    for (var stepIndex = 0; stepIndex < data.length; stepIndex++) {
      var strip = data[stepIndex][0];

      for (var pixelIndex = 0; pixelIndex < strip.length; pixelIndex++) {
        pixelData = strip[pixelIndex];
        x = pixelData.x;
        y = pixelData.y;

        context.fillStyle = 'rgb(' + pixelData.r + ', ' + pixelData.g + ', ' + pixelData.b + ')';
        context.fillRect(x, y, pixelSize, pixelSize);
      }
    }

    return canvas;
  };

  function _scanContext(context, callback, extra) {
    var imageData = [];

    _scanImage(context, function(step, strip, pixel, pixelData) {
      imageData[step] = imageData[step] || [];
      imageData[step][strip] = imageData[step][strip] || [];
      imageData[step][strip][pixel] = pixelData;
    });

    extra = extra || {};

    callback($.extend(extra, {
      data: imageData,
      // srcUrl: context.canvas.toDataURL("image/png"),
      url: _render(imageData, 112).toDataURL("image/png")
    }));
  }

  self.scanVideo = function(video, callback, extra) {
    extra = extra || {};
    var canvas = extra.canvas;
    if (!canvas) {
      var canvas = document.createElement('canvas');
      extra.context = null;
    }

    canvas.width = canvas.height = width;
    var context = extra.context = extra.context || canvas.getContext('2d');

    var drawX, drawY, drawW, drawH;

    if (video.videoWidth > video.videoHeight) {
      // crop
      drawH = drawW = video.videoHeight;
      drawY = 0;
      drawX = (video.videoWidth - video.videoHeight) / 2;

      // letter-box
      // drawX = 0;
      // drawW = canvas.width;
      // drawH = video.videoHeight * canvas.width / video.videoWidth;
      // drawY = (canvas.height - drawH) / 2;
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
      context.drawImage(video, drawX, drawY, drawW, drawH, 0, 0, width, width);

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

var imageScanner = new ImageScanner({
  pixelConfig: settings.pixelConfig,
  width: 500
});
