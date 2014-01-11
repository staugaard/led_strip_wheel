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
jQuery.event.props.push('dataTransfer');

$(document).ready(function() {
  $(document).on('dragover', function(e) {
    e.preventDefault();
  });

  $(document).on('drop', function(e) {
    var mode = angular.element('#container').scope().mode;

    if (mode == 'slide-show') {
      var $scope = angular.element('#items').scope();
      $scope.addFiles(e.dataTransfer.files);
    } else {
      console.log('make video!');
    }

    e.preventDefault();
    return false;
  });
});
// Generic functions
var bitsToNum = function (ba) {
	return ba.reduce(function (s, n) {
		return s * 2 + n;
	}, 0);
};

var byteToBitArr = function (bite) {
	var a = [];
	for (var i = 7; i >= 0; i--) {
		a.push( !! (bite & (1 << i)));
	}
	return a;
};

// Stream
/**
 * @constructor
 */
// Make compiler happy.
var Stream = function (data) {
	this.data = data;
	this.len = this.data.length;
	this.pos = 0;

	this.readByte = function () {
		if (this.pos >= this.data.length) {
			throw new Error('Attempted to read past end of stream.');
		}
		return data.charCodeAt(this.pos++) & 0xFF;
	};

	this.readBytes = function (n) {
		var bytes = [];
		for (var i = 0; i < n; i++) {
			bytes.push(this.readByte());
		}
		return bytes;
	};

	this.read = function (n) {
		var s = '';
		for (var i = 0; i < n; i++) {
			s += String.fromCharCode(this.readByte());
		}
		return s;
	};

	this.readUnsigned = function () { // Little-endian.
		var a = this.readBytes(2);
		return (a[1] << 8) + a[0];
	};
};

var lzwDecode = function (minCodeSize, data) {
	// TODO: Now that the GIF parser is a bit different, maybe this should get an array of bytes instead of a String?
	var pos = 0; // Maybe this streaming thing should be merged with the Stream?
	var readCode = function (size) {
		var code = 0;
		for (var i = 0; i < size; i++) {
			if (data.charCodeAt(pos >> 3) & (1 << (pos & 7))) {
				code |= 1 << i;
			}
			pos++;
		}
		return code;
	};

	var output = [];

	var clearCode = 1 << minCodeSize;
	var eoiCode = clearCode + 1;

	var codeSize = minCodeSize + 1;

	var dict = [];

	var clear = function () {
		dict = [];
		codeSize = minCodeSize + 1;
		for (var i = 0; i < clearCode; i++) {
			dict[i] = [i];
		}
		dict[clearCode] = [];
		dict[eoiCode] = null;

	};

	var code;
	var last;

	while (true) {
		last = code;
		code = readCode(codeSize);

		if (code === clearCode) {
			clear();
			continue;
		}
		if (code === eoiCode) break;

		if (code < dict.length) {
			if (last !== clearCode) {
				dict.push(dict[last].concat(dict[code][0]));
			}
		}
		else {
			if (code !== dict.length) throw new Error('Invalid LZW code.');
			dict.push(dict[last].concat(dict[last][0]));
		}
		output.push.apply(output, dict[code]);

		if (dict.length === (1 << codeSize) && codeSize < 12) {
			// If we're at the last code and codeSize is 12, the next code will be a clearCode, and it'll be 12 bits long.
			codeSize++;
		}
	}

	// I don't know if this is technically an error, but some GIFs do it.
	//if (Math.ceil(pos / 8) !== data.length) throw new Error('Extraneous LZW bytes.');
	return output;
};


// The actual parsing; returns an object with properties.
var parseGIF = function (st, handler) {
	handler || (handler = {});

	// LZW (GIF-specific)
	var parseCT = function (entries) { // Each entry is 3 bytes, for RGB.
		var ct = [];
		for (var i = 0; i < entries; i++) {
			ct.push(st.readBytes(3));
		}
		return ct;
	};

	var readSubBlocks = function () {
		var size, data;
		data = '';
		do {
			size = st.readByte();
			data += st.read(size);
		} while (size !== 0);
		return data;
	};

	var parseHeader = function () {
		var hdr = {};
		hdr.sig = st.read(3);
		hdr.ver = st.read(3);
		if (hdr.sig !== 'GIF') throw new Error('Not a GIF file.'); // XXX: This should probably be handled more nicely.
		hdr.width = st.readUnsigned();
		hdr.height = st.readUnsigned();

		var bits = byteToBitArr(st.readByte());
		hdr.gctFlag = bits.shift();
		hdr.colorRes = bitsToNum(bits.splice(0, 3));
		hdr.sorted = bits.shift();
		hdr.gctSize = bitsToNum(bits.splice(0, 3));

		hdr.bgColor = st.readByte();
		hdr.pixelAspectRatio = st.readByte(); // if not 0, aspectRatio = (pixelAspectRatio + 15) / 64
		if (hdr.gctFlag) {
			hdr.gct = parseCT(1 << (hdr.gctSize + 1));
		}
		handler.hdr && handler.hdr(hdr);
	};

	var parseExt = function (block) {
		var parseGCExt = function (block) {
			var blockSize = st.readByte(); // Always 4
			var bits = byteToBitArr(st.readByte());
			block.reserved = bits.splice(0, 3); // Reserved; should be 000.
			block.disposalMethod = bitsToNum(bits.splice(0, 3));
			block.userInput = bits.shift();
			block.transparencyGiven = bits.shift();

			block.delayTime = st.readUnsigned();

			block.transparencyIndex = st.readByte();

			block.terminator = st.readByte();

			handler.gce && handler.gce(block);
		};

		var parseComExt = function (block) {
			block.comment = readSubBlocks();
			handler.com && handler.com(block);
		};

		var parsePTExt = function (block) {
			// No one *ever* uses this. If you use it, deal with parsing it yourself.
			var blockSize = st.readByte(); // Always 12
			block.ptHeader = st.readBytes(12);
			block.ptData = readSubBlocks();
			handler.pte && handler.pte(block);
		};

		var parseAppExt = function (block) {
			var parseNetscapeExt = function (block) {
				var blockSize = st.readByte(); // Always 3
				block.unknown = st.readByte(); // ??? Always 1? What is this?
				block.iterations = st.readUnsigned();
				block.terminator = st.readByte();
				handler.app && handler.app.NETSCAPE && handler.app.NETSCAPE(block);
			};

			var parseUnknownAppExt = function (block) {
				block.appData = readSubBlocks();
				// FIXME: This won't work if a handler wants to match on any identifier.
				handler.app && handler.app[block.identifier] && handler.app[block.identifier](block);
			};

			var blockSize = st.readByte(); // Always 11
			block.identifier = st.read(8);
			block.authCode = st.read(3);
			switch (block.identifier) {
			case 'NETSCAPE':
				parseNetscapeExt(block);
				break;
			default:
				parseUnknownAppExt(block);
				break;
			}
		};

		var parseUnknownExt = function (block) {
			block.data = readSubBlocks();
			handler.unknown && handler.unknown(block);
		};

		block.label = st.readByte();
		switch (block.label) {
		case 0xF9:
			block.extType = 'gce';
			parseGCExt(block);
			break;
		case 0xFE:
			block.extType = 'com';
			parseComExt(block);
			break;
		case 0x01:
			block.extType = 'pte';
			parsePTExt(block);
			break;
		case 0xFF:
			block.extType = 'app';
			parseAppExt(block);
			break;
		default:
			block.extType = 'unknown';
			parseUnknownExt(block);
			break;
		}
	};

	var parseImg = function (img) {
		var deinterlace = function (pixels, width) {
			// Of course this defeats the purpose of interlacing. And it's *probably*
			// the least efficient way it's ever been implemented. But nevertheless...
			var newPixels = new Array(pixels.length);
			var rows = pixels.length / width;
			var cpRow = function (toRow, fromRow) {
				var fromPixels = pixels.slice(fromRow * width, (fromRow + 1) * width);
				newPixels.splice.apply(newPixels, [toRow * width, width].concat(fromPixels));
			};

			// See appendix E.
			var offsets = [0, 4, 2, 1];
			var steps = [8, 8, 4, 2];

			var fromRow = 0;
			for (var pass = 0; pass < 4; pass++) {
				for (var toRow = offsets[pass]; toRow < rows; toRow += steps[pass]) {
					cpRow(toRow, fromRow)
					fromRow++;
				}
			}

			return newPixels;
		};

		img.leftPos = st.readUnsigned();
		img.topPos = st.readUnsigned();
		img.width = st.readUnsigned();
		img.height = st.readUnsigned();

		var bits = byteToBitArr(st.readByte());
		img.lctFlag = bits.shift();
		img.interlaced = bits.shift();
		img.sorted = bits.shift();
		img.reserved = bits.splice(0, 2);
		img.lctSize = bitsToNum(bits.splice(0, 3));

		if (img.lctFlag) {
			img.lct = parseCT(1 << (img.lctSize + 1));
		}

		img.lzwMinCodeSize = st.readByte();

		var lzwData = readSubBlocks();

		img.pixels = lzwDecode(img.lzwMinCodeSize, lzwData);

		if (img.interlaced) { // Move
			img.pixels = deinterlace(img.pixels, img.width);
		}

		handler.img && handler.img(img);
	};

	var parseBlock = function () {
		var block = {};
		block.sentinel = st.readByte();

		switch (String.fromCharCode(block.sentinel)) { // For ease of matching
		case '!':
			block.type = 'ext';
			parseExt(block);
			break;
		case ',':
			block.type = 'img';
			parseImg(block);
			break;
		case ';':
			block.type = 'eof';
			handler.eof && handler.eof(block);
			break;
		default:
			throw new Error('Unknown block: 0x' + block.sentinel.toString(16)); // TODO: Pad this with a 0.
		}

		if (block.type !== 'eof') setTimeout(parseBlock, 0);
	};

	var parse = function () {
		parseHeader();
		setTimeout(parseBlock, 0);
	};

	parse();
};


var GifParser = function () {
	var canvas, ctx;
	var stream;
	var hdr;

	var transparency = null;
	var delay = null;
	var disposalMethod = null;
	var lastDisposalMethod = null;

	var frames = [];
	var didDraw = false;

	var clear = function() {
		transparency = null;
		delay = null;
		lastDisposalMethod = disposalMethod;
		disposalMethod = null;
	};

	var doParse = function(callback) {
		parseGIF(stream, {
			hdr: doHdr,
			gce: doGCE,
			img: doImg,
			eof: function() {
				pushFrame();
				canvas.width = hdr.width;
				canvas.height = hdr.height;
				callback(frames);
			}
		});
	};

	var doHdr = function (_hdr) {
		hdr = _hdr;
		canvas.width = hdr.width;
		canvas.height = hdr.height;
	};

	var doGCE = function (gce) {
		pushFrame();
		clear();
		transparency = gce.transparencyGiven ? gce.transparencyIndex : null;
		delay = gce.delayTime;
		disposalMethod = gce.disposalMethod;
		// We don't have much to do with the rest of GCE.
	};

	var pushFrame = function () {
		if (!didDraw) return;
		frames.push({
			data: ctx.getImageData(0, 0, hdr.width, hdr.height),
			delay: delay
		});
	};

	var doImg = function (img) {
		//ct = color table, gct = global color table
		var ct = img.lctFlag ? img.lct : hdr.gct; // TODO: What if neither exists?
		var cData = ctx.getImageData(img.leftPos, img.topPos, img.width, img.height);

		//apply color table colors
		img.pixels.forEach(function (pixel, i) {
			// cData.data === [R,G,B,A,...]
			if (transparency !== pixel) { // This includes null, if no transparency was defined.
				cData.data[i * 4 + 0] = ct[pixel][0];
				cData.data[i * 4 + 1] = ct[pixel][1];
				cData.data[i * 4 + 2] = ct[pixel][2];
				cData.data[i * 4 + 3] = 255; // Opaque.
			}
			else {
				// TODO: Handle disposal method properly.
				// XXX: When I get to an Internet connection, check which disposal method is which.
				if (lastDisposalMethod === 2 || lastDisposalMethod === 3) {
					cData.data[i * 4 + 3] = 0; // Transparent.
					// XXX: This is very very wrong.
				}
				else {
					// lastDisposalMethod should be null (no GCE), 0, or 1; leave the pixel as it is.
					// assert(lastDispsalMethod === null || lastDispsalMethod === 0 || lastDispsalMethod === 1);
					// XXX: If this is the first frame (and we *do* have a GCE),
					// lastDispsalMethod will be null, but we want to set undefined
					// pixels to the background color.
				}
			}
		});

		ctx.putImageData(cData, img.leftPos, img.topPos);
		didDraw = true;
	};

	return {
		parse: function(data, callback) {
			frames = [];
			clear();
			canvas = document.createElement('canvas');
			ctx = canvas.getContext('2d');
			stream = new Stream(data);
			didDraw = false;
			doParse(callback);
		}
	};

};



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
var nextUniqueId = 0;

function uniqueId() {
  return 'unique-id-' + (nextUniqueId++);
}
;




function ModeCtrl($scope) {

  $scope.mode = 'slide-show';

  $scope.switchToSlideShow = function() {
    $scope.mode = 'slide-show';
  }

  $scope.switchToVideo = function() {
    $scope.mode = 'video';
  }

}
;




function SlideShowCtrl($scope) {

  $scope.images = [];

  var items = $('#items');

  function dataArray() {
    return $scope.images.map(function(image) {
      return image.data;
    });
  }

  $scope.addFile = function(file) {
    console.log(file);

    imageScanner.scanFile(file, function(imageData) {
      console.log(imageData);

      var model = {
        name: file.name,
        done: false,
        id: uniqueId()
      };

      $.extend(model, imageData, {done: true});

      $scope.images.push(model);
      $scope.$apply();
      items.sortable('reload');
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



function VideoCtrl($scope) {

  $scope.pickVideoFile = function() {
    chrome.fileSystem.chooseEntry({type: 'openFile'}, function(fileEntry) {
      fileEntry.file(function(file) {
        var video = document.createElement('video');
        video.addEventListener('canplaythrough', function(e) {
          var frames = Math.floor(video.duration * 10);

          var next, write;

          var frameHandler = function(imageData) {
            // console.log(imageData);
            write(imageData.data);
          };

          next = imageScanner.scanVideo(video, frameHandler, {canvas: $('canvas')[0]});

          diskImageWriter.writeImages(frames, 'video', function(writeFunc) {
            write = writeFunc;
            next()
          });

        });

        video.src = URL.createObjectURL(file);
        window.foo = video;
        video.load();
      });
    });
  }

}
;


