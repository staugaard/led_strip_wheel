//= require settings

function DiskImageEncoder(options) {
  var self = this;

  self.encodeImage = function(data) {
    var encoded = {}

    var resolution = data.length;
    var stripLengths = data[0].map(function(strip) { return strip.length});
    var pixelCount = Math.max.apply(stripLengths, stripLengths);
    var bytesPerStrip = pixelCount * 3;

    encoded.buffer = new ArrayBuffer(resolution * 512);
    var view = encoded.view = new Uint8Array(encoded.buffer);

    var stepIndex, step, stripIndex, strip, pixelIndex, pixel, pixelOffset;

    for (stepIndex = 0; stepIndex < resolution; stepIndex++) {
      step = data[stepIndex];

      for (stripIndex = 0; stripIndex < 4; stripIndex++) {
        strip = step[stripIndex];

        for (pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
          pixel = strip[pixelIndex] || {r: 0, g: 0, b: 0};
          pixelOffset = (stepIndex * 512) + (stripIndex * bytesPerStrip) + (pixelIndex * 3);

          view[pixelOffset + 0] = pixel.r;
          view[pixelOffset + 1] = pixel.g;
          view[pixelOffset + 2] = pixel.b;
        }
      }
    }

    return encoded;
  }

  self.encodeMetadata = function(imageCount) {
    var metadataBuffer = new ArrayBuffer(512);
    var metadata = new Uint8Array(metadataBuffer);

    metadata[0] = (imageCount >> 24) & 255;
    metadata[1] = (imageCount >> 16) & 255;
    metadata[2] = (imageCount >> 8) & 255;
    metadata[3] = imageCount & 255;

    return metadata
  }
}

function ChromeDiskImageWriter(encoder) {
  var self = this;

  self.writeFile = function(data, name) {
    var index = 0;
    self.writeImages(data.length, name, function(write) {
      if (data[index]) {
        write(data[index]);
      }
      index++;
    });
  };

  self.writeImages = function(number, name, callback) {
    chrome.fileSystem.chooseEntry({type: 'saveFile', suggestedName: name + '.img'}, function(writableFileEntry) {
      writableFileEntry.createWriter(function(writer) {
        writer.onwriteend = function(e) {
          callback(function(data) {
            var imageBufferView = encoder.encodeImage(data).view;
            writer.write(new Blob([imageBufferView], {type: 'application/octet-stream'}));
          })
          console.log('write complete');
        };
        console.log('writing meta');
        writer.write(new Blob([encoder.encodeMetadata(number)], {type: 'application/octet-stream'}));
        console.log('wrote meta');
      });
    });

  };
}

function NodeDiskImageWriter(encoder) {
  this.encoder = encoder;
}

NodeDiskImageWriter.prototype = {
  writeFile: function(data, name) {
    var index = 0;
    this.writeImages(data.length, name, function(write) {
      if (data[index]) {
        write(data[index]);
      }
      index++;
    });
  },

  writeImages: function(number, name, callback) {
    var encoder = this.encoder;
    var chooser = document.createElement('input');
    chooser.type = 'file';
    chooser.nwsaveas = name + '.img';
    chooser.addEventListener("change", function(evt) {
      var fs = require('fs');
      var writeStream = fs.createWriteStream(this.value);
      writeStream.write(new Buffer(diskImageEncoder.encodeMetadata(number)));

      var writeFunction = function(data) {
        var imageBufferView = encoder.encodeImage(data).view;
        writeStream.write(new Buffer(imageBufferView));
      }

      for(var i = 0; i < number; i++) {
        callback(writeFunction);
      }

      writeStream.end();
    });
    chooser.click();
  }
};

var diskImageWriter;

if (window.chrome) {
  diskImageWriter = new ChromeDiskImageWriter(new DiskImageEncoder());
} else {
  diskImageWriter = new NodeDiskImageWriter(new DiskImageEncoder());
}
