var app = angular.module('bikeWheel', []);
/*
 * AngularJS integration with the HTML5 Sortable jQuery Plugin
 * https://github.com/voidberg/html5sortable
 *
 * Copyright 2013, Alexandru Badiu <andu@ctrlz.ro>
 *
 * Released under the MIT license.
 */

app.directive('htmlSortable', [
  '$timeout', function($timeout) {
    return {
      require: '?ngModel',
      link: function(scope, element, attrs, ngModel) {
        var opts, model;

        opts = angular.extend({}, scope.$eval(attrs.htmlSortable));
        if (ngModel) {
          model = attrs.ngModel;
          ngModel.$render = function() {
            $timeout(function () {
              element.sortable('reload');
            }, 50);
          };
        }

        // Create sortable
        $(element).sortable(opts);
        if (model) {
          $(element).sortable().bind('sortupdate', function(e, data) {
            var $source = data.startparent.attr('ng-model');
            var $dest   = data.endparent.attr('ng-model');

            var $start = data.oldindex;
            var $end   = data.item.index();
          
            scope.$apply(function () {
              if ($source == $dest) {
                scope[model].splice($end, 0, scope[model].splice($start, 1)[0]);
              }
              else {
                var $item = scope[$source][$start];

                scope[$source].splice($start, 1);
                scope[$dest].splice($end, 0, $item);
              }
            });
          });
        }
      }
    };
  }
]);
/*
 * HTML5 Sortable jQuery Plugin
 * https://github.com/voidberg/html5sortable
 *
 * Original code copyright 2012 Ali Farhadi.
 * This version is mantained by Alexandru Badiu <andu@ctrlz.ro>
 *
 * Thanks to the following contributors: rodolfospalenza, bistoco, flying-sheep, ssafejava, andyburke, daemianmack, OscarGodson.
 *
 * Released under the MIT license.
 */

(function($) {
var dragging, placeholders = $();
$.fn.sortable = function(options) {
  var method = String(options);

  options = $.extend({
    connectWith: false,
    placeholder: null
  }, options);

  return this.each(function() {
    var soptions = $(this).data('opts');

    if (typeof soptions == 'undefined') {
      $(this).data('opts', options);
    }
    else {
      options = soptions;
    }

    if (method == "reload") {
      $(this).children(options.items).off('dragstart.h5s dragend.h5s selectstart.h5s dragover.h5s dragenter.h5s drop.h5s');
    }
    if (/^enable|disable|destroy$/.test(method)) {
      var items = $(this).children($(this).data('items')).attr('draggable', method == 'enable');
      if (method == 'destroy') {
        $(this).off('sortupdate');
        items.add(this).removeData('connectWith items')
          .off('dragstart.h5s dragend.h5s selectstart.h5s dragover.h5s dragenter.h5s drop.h5s').off('sortupdate');
      }
      return;
    }
    var isHandle, index, items = $(this).children(options.items);
    var placeholder = ( options.placeholder == null )
      ? $('<' + (/^ul|ol$/i.test(this.tagName) ? 'li' : 'div') + ' class="sortable-placeholder">')
      : $( options.placeholder ).addClass('sortable-placeholder');
    items.find(options.handle).mousedown(function() {
      isHandle = true;
    }).mouseup(function() {
      isHandle = false;
    });
    $(this).data('items', options.items)
    placeholders = placeholders.add(placeholder);
    if (options.connectWith) {
      $(options.connectWith).add(this).data('connectWith', options.connectWith);
    }
    items.attr('draggable', 'true').on('dragstart.h5s', function(e) {
      if (options.handle && !isHandle) {
        return false;
      }
      isHandle = false;
      var dt = e.originalEvent.dataTransfer;
      dt.effectAllowed = 'move';
      dt.setData('Text', 'dummy');
      index = (dragging = $(this)).addClass('sortable-dragging').index();
      start_parent = $(this).parent();
    }).on('dragend.h5s', function() {
      if (!dragging) {
        return;
      }
      dragging.removeClass('sortable-dragging').show();
      placeholders.detach();
      new_parent = $(this).parent();
      if (index != dragging.index() || start_parent != new_parent) {
        dragging.parent().trigger('sortupdate', {item: dragging, oldindex: index, startparent: start_parent, endparent: new_parent});
      }
      dragging = null;
    }).not('a[href], img').on('selectstart.h5s', function() {
      this.dragDrop && this.dragDrop();
      return false;
    }).end().add([this, placeholder]).on('dragover.h5s dragenter.h5s drop.h5s', function(e) {
      if (!items.is(dragging) && options.connectWith !== $(dragging).parent().data('connectWith')) {
        return true;
      }
      if (e.type == 'drop') {
        e.stopPropagation();
        placeholders.filter(':visible').after(dragging);
        dragging.trigger('dragend.h5s');
        return false;
      }
      e.preventDefault();
      e.originalEvent.dataTransfer.dropEffect = 'move';
      if (items.is(this)) {
        var draggingHeight = dragging.outerHeight(), thisHeight = $(this).outerHeight();
        if (options.forcePlaceholderSize) {
          placeholder.height(draggingHeight); 
        }
        
        // Check if $(this) is bigger than the draggable. If it is, we have to define a dead zone to prevent flickering
        if (thisHeight > draggingHeight){
          // Dead zone?
          var deadZone = thisHeight - draggingHeight, offsetTop = $(this).offset().top;
          if(placeholder.index() < $(this).index() && e.originalEvent.pageY < offsetTop + deadZone) {
            return false;
          }
          else if(placeholder.index() > $(this).index() && e.originalEvent.pageY > offsetTop + thisHeight - deadZone) {
            return false;
          }
        }

        dragging.hide();
        $(this)[placeholder.index() < $(this).index() ? 'after' : 'before'](placeholder);
        placeholders.not(placeholder).detach();
      } else if (!placeholders.is(this) && !$(this).children(options.items).length) {
        placeholders.detach();
        $(this).append(placeholder);
      }
      return false;
    });
  });
};
})(jQuery);
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
    var url = URL.createObjectURL(blob);

    var a = document.createElement('a');
    a.download = name + '.img';
    a.href = url
    a.textContent = 'Click here to download!';
    a.dataset.downloadurl = ['img', a.download, a.href].join(':');
    debugger
    a.click();
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



