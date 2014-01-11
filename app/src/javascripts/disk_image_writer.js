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
    var index = 0;
    self.writeImages(compactDatas.length, name, function(write) {
      var data = compactDatas[index];
      index++;
      if (data) {
        write(data);
      }
    });
  };

  self.writeImages = function(number, name, callback) {
    var metadataBuffer = new ArrayBuffer(512);
    var metadata = new Uint8Array(metadataBuffer);

    var numberHighBits = number >> 8;
    var numberLowBits  = number & 255;

    metadata[0] = (number >> 24) & 255;
    metadata[1] = (number >> 16) & 255;
    metadata[2] = (number >> 8) & 255;
    metadata[3] = number & 255;

    chrome.fileSystem.chooseEntry({type: 'saveFile', suggestedName: name + '.img'}, function(writableFileEntry) {
      writableFileEntry.createWriter(function(writer) {
        writer.onwriteend = function(e) {
          callback(function(compactData) {
            var imageBufferView = self.optimizeData(compactData).view;
            writer.write(new Blob([imageBufferView], {type: 'application/octet-stream'}));
          })
          // console.log('write complete');
        };
        writer.write(new Blob([metadata], {type: 'application/octet-stream'}));
      });
    });

  };

}

var diskImageWriter = new DiskImageWriter(settings);
