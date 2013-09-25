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
