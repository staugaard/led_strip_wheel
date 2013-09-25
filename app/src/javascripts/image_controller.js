//= require scanner
//= require disk_image_writer
//= require unique_id

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
