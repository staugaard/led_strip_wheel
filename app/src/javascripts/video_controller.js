//= require scanner
//= require disk_image_writer

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
