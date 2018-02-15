(function (D) {
  'use strict';

  var MONITOR_COLOR = '#ff925b';
  var FOV_COLOR = 'rgba(255, 0, 0, 0.7)';
  var HEAD_SIZE = 4;
  var CAR_LENGTH = 460; // centimetres

  var $form = D.querySelector('form');

  var carImages = {
    top: new Image(),
    side: new Image(),
    numLoaded: 0,
    onReady: function () {},
    scale: 1,

    load: function (callback) {
      this.top.addEventListener('load', this.imageLoaded.bind(this));
      this.side.addEventListener('load', this.imageLoaded.bind(this));
      this.top.src = 'car-top.png';
      this.side.src = 'car-side.png';
      this.onReady = callback;
    },
    imageLoaded: function () {
      this.numLoaded += 1;
      this.scale = this.top.width / CAR_LENGTH;

      if (this.numLoaded === 2) {
        this.onReady.call(this);
      }
    }
  };

  var canvas = {
    el: null,
    context: null,
    w: 0,
    h: 0,
    headX: 195,
    headTY: 90,
    headSY: 199,
    xOffset: 40,
    textHeight: 1,

    monitor: {
      ratio: [16, 9],
      // units are in pixels
      diagonalSize: 61,
      getSides: function () {
        var rw = this.ratio[0];
        var rh = this.ratio[1];
        var d = this.diagonalSize;

        var h = (d * rh) / Math.sqrt(rw* rw + rh * rh);
        var w = (rw / rh) * h;

        return { w: w, h: h };
      },
      distance: 95,
    },

    useInches: false,

    initialize: function () {
      this.el = D.querySelector('#fov-preview');
      this.w = this.el.width = this.el.offsetWidth;
      this.h = this.el.height = this.el.offsetHeight;
      this.context = this.el.getContext('2d');

      this.context.fillStyle = MONITOR_COLOR;
      this.context.strokeStyle = FOV_COLOR;
      this.context.font = window.getComputedStyle(D.body).
        font.replace('300', '400');

      // fontSize will be in pixels
      this.textHeight = parseFloat(window.getComputedStyle(D.body).fontSize, 10);
    },
    pixelsFromUnits: function (u) {
      var pixels = u * carImages.scale;

      if (this.useInches) {
        pixels = pixels * 2.54;
      }

      return pixels;
    },
    setMonitorRatio: function (newRatio) {
      this.monitor.ratio = newRatio;
    },

    getFieldsOfView: function () {
      var monSides = this.monitor.getSides();
      return {
        h: Math.atan((monSides.w / 2) / this.monitor.distance) * 2,
        v: Math.atan((monSides.h / 2) / this.monitor.distance) * 2,
      };
    },

    drawCarImages: function (images) {
      var ctx = this.context;
      var FADE_COLOR = 'rgba(0, 0, 0, 0.3)';
      var x = Math.round((this.w - images.top.width) / 2) + this.xOffset;
      var y = Math.round((this.h / 2 - images.top.height) / 2);

      ctx.drawImage(images.top, x, y + 15);
      ctx.drawImage(images.side, x, y * 2 + images.side.height + 10);

      ctx.fillStyle = FADE_COLOR;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.fillStyle = MONITOR_COLOR;
    },

    drawHeadsAndMonitors: function () {
      var ctx = this.context;
      var pi2 = Math.PI * 2;
      var headX = this.headX + this.xOffset;
      var monX = headX - this.monitor.distance;
      var monSides = this.monitor.getSides();
      var monTY = this.headTY - monSides.w / 2;
      var monSY = this.headSY - monSides.h / 2;

      ctx.beginPath();
      ctx.arc(headX, this.headTY, HEAD_SIZE, 0, pi2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(headX, this.headSY, HEAD_SIZE, 0, pi2);
      ctx.fill();

      ctx.fillRect(monX, monTY, 3, monSides.w);
      ctx.fillRect(monX, monSY, 3, monSides.h);
    },

    drawViewLines: function () {
      var ctx = this.context;
      var monSides = this.monitor.getSides();
      var headX = this.headX + this.xOffset;
      var fovW = headX - 5;
      var fovTH = (monSides.w * (fovW / this.monitor.distance)) / 2;
      var fovSH = (monSides.h * (fovW / this.monitor.distance)) / 2;

      // Top view
      ctx.beginPath();
      ctx.moveTo(headX, this.headTY);
      ctx.lineTo(headX - fovW, this.headTY - fovTH);
      ctx.moveTo(headX, this.headTY);
      ctx.lineTo(headX - fovW, this.headTY + fovTH);
      ctx.stroke();

      // Top view
      ctx.beginPath();
      ctx.moveTo(headX, this.headSY);
      ctx.lineTo(headX - fovW, this.headSY - fovSH);
      ctx.moveTo(headX, this.headSY);
      ctx.lineTo(headX - fovW, this.headSY + fovSH);
      ctx.stroke();
    },

    drawAngleText: function () {
      var ctx = this.context;
      var fovs = this.getFieldsOfView();
      var yOffset = this.textHeight / 3;

      // Convert to degrees
      fovs.h = ((180 * fovs.h) / Math.PI).toPrecision(2);
      fovs.v = ((180 * fovs.v) / Math.PI).toPrecision(2);
      ctx.fillText(fovs.h + '\u00b0', 5, this.headTY + yOffset);
      ctx.fillText(fovs.v + '\u00b0', 5, this.headSY + yOffset);
    },

    render: function (images) {
      this.context.clearRect(0, 0, this.w, this.h);
      this.drawCarImages(images);
      this.drawViewLines();
      this.drawHeadsAndMonitors();
      this.drawAngleText();
    }
  };

  function formChange(event) {
    var el = (event && event.target) || { name: null };
    var inputMap = {
      'distance-n': 'distance-s',
      'distance-s': 'distance-n',
      'size-n': 'size-s',
      'size-s': 'size-n'
    };
    var ratio = $form.elements['aspect-ratio'].value.split(':').map(Number);
    var conversion = 2.54;

    // Convert current inches values to centimetres, or vice-versa, when
    // toggling between the units options.
    if (el.name === 'units') {
      if (el.value === 'inches') {
        conversion = 1 / conversion;
      }
      Object.keys(inputMap).forEach(function (elName) {
        var el = $form.elements[elName];
        el.value = Math.round(parseInt(el.value) * conversion);
      });
    }

    if (inputMap[el.name]) {
      $form.elements[inputMap[el.name]].value = el.value;
    }

    canvas.useInches = $form.elements.units.value === 'inches';
    canvas.monitor.distance = canvas.pixelsFromUnits(Number($form.elements['distance-n'].value));
    canvas.monitor.diagonalSize = canvas.pixelsFromUnits(Number($form.elements['size-n'].value));
    canvas.monitor.ratio = ratio;

    canvas.render(carImages);
  }

  window.addEventListener('load', function () {
    $form.addEventListener('input', formChange);
    $form.addEventListener('change', formChange);

    carImages.load(function () {
      canvas.initialize();
      formChange();
    });


  });
}(window.document));
