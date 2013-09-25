//= require settings

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
