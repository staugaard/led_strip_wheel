//= require settings

function SettingsCtrl($scope) {

  function drawReset() {
    var canvas = $('#settings canvas')[0];
    canvas.width = $scope.image.width;
    canvas.height = $scope.image.height;

    var context = canvas.getContext('2d');
    context.setTransform(1, 0, 0, 1, 0, 0);

    context.drawImage($scope.image, 0, 0, canvas.width, canvas.height);

    context.translate($scope.center.x, $scope.center.y);
    context.scale($scope.radius, $scope.radius);

    context.fillStyle = '#FF0';
    context.beginPath();
    context.arc(0, 0, 0.02, 0, 2 * Math.PI, true);
    context.closePath();
    context.fill();
  }

  function drawStrip(pixels, color) {
    var canvas = $('#settings canvas')[0];
    var context = canvas.getContext('2d');

    context.fillStyle = color;

    var x, y;

    for(var i = 0; i < pixels.length; i++) {
      x = pixels[i].x;
      y = pixels[i].y;

      context.beginPath();
      context.arc(x, y, 0.01, 0, 2 * Math.PI, true);
      context.closePath();
      context.fill();
    }
  }

  function draw(step) {
    drawStrip(settings.pixelConfig[step][0], '#F00');
    drawStrip(settings.pixelConfig[step][1], '#0F0');
    drawStrip(settings.pixelConfig[step][2], '#00F');
    drawStrip(settings.pixelConfig[step][3], '#FFF');
  }

  function startDrawing() {
    drawReset();
    draw(0);
  }

  $scope.updateFromSettings = function() {
    $scope.center = settings.configuration.center;
    $scope.radius = settings.configuration.radius;

    $scope.image = document.createElement('img');
    $scope.image.src = settings.configuration.image.url;
    $scope.image.addEventListener('load', startDrawing);
  }

  $scope.updateFromSettings();
}
