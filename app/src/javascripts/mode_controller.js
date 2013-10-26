//= require scanner
//= require disk_image_writer
//= require unique_id

function ModeCtrl($scope) {

  $scope.mode = 'slide-show';

  $scope.switchToSlideShow = function() {
    $scope.mode = 'slide-show';
  }

  $scope.switchToVideo = function() {
    $scope.mode = 'video';
  }

}
