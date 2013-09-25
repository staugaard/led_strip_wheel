// require angular

var app = angular.module('bikeWheel', []);
var settings = {
  deadRadius: 1/5,
  pixelCount: 36,
  resolution: 256
};

function DiskImageWriter(options) {
  var self = this;

  var resolution = options.resolution;
  var pixelCount = options.pixelCount;

  var bytesPerStrip      = pixelCount * 3;
  var stepsBetweenStrips = resolution / 4;


  self.optimizeData = function(compactData) {
    var optimizedData = {}

    optimizedData.buffer = new ArrayBuffer(resolution * 512);
    var view = optimizedData.view = new Uint8Array(optimizedData.buffer);

    var strips = [];
    var stepIndex, pixelOffset;

    for (var step = 0; step < resolution; step++) {

      for (var strip = 0; strip < 4; strip++) {
        stepIndex = step + (strip * stepsBetweenStrips);
        if (stepIndex >= resolution) { stepIndex = stepIndex - resolution; }

        for (var pixel = 0; pixel < pixelCount; pixel++) {
          pixelOffset = (step * 512) + (strip * bytesPerStrip) + (pixel * 3);
          view[pixelOffset + 0] = compactData[stepIndex][pixel][0];
          view[pixelOffset + 1] = compactData[stepIndex][pixel][1];
          view[pixelOffset + 2] = compactData[stepIndex][pixel][2];
        }

      }

    }

    return optimizedData;
  };

  self.writeFile = function(compactDatas, name) {
    var imageBufferViews = compactDatas.map(function(compactData) {
      return self.optimizeData(compactData).view;
    });

    var metadataBuffer = new ArrayBuffer(512);
    var metadata = new Uint8Array(metadataBuffer);
    metadata[0] = imageBufferViews.length;

    imageBufferViews.unshift(metadata);

    var blob = new Blob(imageBufferViews, {type: 'application/octet-stream'});

    if (chrome.fileSystem) {
      chrome.fileSystem.chooseEntry({type: 'saveFile', suggestedName: name + '.img'}, function(writableFileEntry) {
        writableFileEntry.createWriter(function(writer) {
          writer.onwriteend = function(e) {
            console.log('write complete');
          };
          writer.write(blob);
        });
      });
    } else {
      var url = URL.createObjectURL(blob);

      var a = document.createElement('a');
      a.download = name + '.img';
      a.href = url
      a.textContent = 'Click here to download!';
      a.dataset.downloadurl = ['img', a.download, a.href].join(':');
      a.click();
    }

  }

}

var diskImageWriter = new DiskImageWriter(settings);
jQuery.event.props.push('dataTransfer');

$(document).ready(function() {
  $(document).on('dragover', function(e) {
    e.preventDefault();
  });

  $(document).on('drop', function(e) {
    var $scope = angular.element('#items').scope();
    $scope.addFiles(e.dataTransfer.files);
    e.preventDefault();
    return false;
  });
});

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
var nextUniqueId = 0;

function uniqueId() {
  return 'unique-id-' + (nextUniqueId++);
}
;




function ImageCtrl($scope) {

  $scope.images = [];

  var items = $('#items');

  function dataArray() {
    return $scope.images.map(function(image) {
      return image.data;
    });
  }

  $scope.addFile = function(file) {
    console.log(file);

    var model = {
      name: file.name,
      done: false,
      id: uniqueId()
    };

    $scope.images.push(model);
    $scope.$apply();
    items.sortable('reload');

    imageScanner.scanFile(file, function(imageData) {
      console.log(imageData);
      $.extend(model, imageData, {done: true});
      $scope.$apply();
    });
  }

  $scope.addFiles = function(files) {
    console.log(files);
    for(i = 0; i < files.length; i++) {
      $scope.addFile(files[i]);
    }
  }

  $scope.writeDiskImage = function() {
    diskImageWriter.writeFile(dataArray(), 'bike_wheel');
  }

}
;


