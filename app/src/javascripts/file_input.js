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
