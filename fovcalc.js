(function (D) {
  'use strict';

  var MONITOR_COLOR = '#ff925b';
  var FOV_COLOR = 'rgba(255, 0, 0, 0.7)';
  var HEAD_SIZE = 4;
  var CAR_LENGTH = 460; // centimetres
  var BACKGROUND_COLOR = '#444';

  var $form = D.querySelector('form');
  var sliders = {};

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
    headTY: 92,
    headSY: 199,
    rrY: 287, // RaceRoom FoV multiplier position
    xOffset: 40,
    textHeight: 1,

    measurements: {
      distance: { value: 0, isInches: false },
      size: { value: 0, isInches: false }
    },

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

    initialize: function () {
      this.el = D.querySelector('#fov-preview');
      this.w = this.el.width = this.el.clientWidth;
      this.h = this.el.height = this.el.clientHeight;
      this.context = this.el.getContext('2d');

      this.context.fillStyle = MONITOR_COLOR;
      this.context.strokeStyle = FOV_COLOR;
      this.context.font = window.getComputedStyle(D.body).
        font.replace('300', '400');

      // fontSize will be in pixels
      this.textHeight = parseFloat(window.getComputedStyle(D.body).fontSize, 10);
    },
    pixelsFromUnits: function (u, useInches) {
      var pixels = u * carImages.scale;

      if (useInches) {
        pixels = pixels * 2.54;
      }

      return pixels;
    },
    setMonitorRatio: function (newRatio) {
      this.monitor.ratio = newRatio;
    },

    degreesFromRadians: function (radians) {
      return ((radians * 180) / Math.PI);
    },

    getFieldsOfView: function () {
      var monSides = this.monitor.getSides();
      return {
        h: Math.atan((monSides.w / 2) / this.monitor.distance) * 2,
        v: Math.atan((monSides.h / 2) / this.monitor.distance) * 2,
      };
    },

    gameSpecific: {
      r3e: function (degrees) {
        // See https://www.racedepartment.com/threads/fov-setting-multiplier-explained.142992/
        // Basically, RaceRoom FoV is a multiplier of the default 58 degree VFoV.
        return Math.round((degrees * 10) / 58) / 10;
      },
      dirt: function (degrees) {
        if (degrees > 70) {
          return '1.0 !';
        }
        if (degrees < 30) {
          return '0.0 !';
        }
        return ((degrees - 30) / 40).toFixed(1);
      },
      f1: function (degrees) {
        var scale = Math.round(((degrees - 77) / 2)) / 20;
        return scale.toString().replace('-', '\u2212');
      },
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
      var precision;
      var games = {
        r3e: 0,
        rbr: 0,
        dirt: 0,
        f1: 0
      };

      // RBR FoV is measured in radians, so just use existing value
      games.rbr = fovs.h.toFixed(2);

      fovs.h = this.degreesFromRadians(fovs.h);
      fovs.v = this.degreesFromRadians(fovs.v);

      games.r3e = this.gameSpecific.r3e(fovs.v);
      games.dirt = this.gameSpecific.dirt(fovs.v);
      games.f1 = this.gameSpecific.f1(fovs.h);

      precision = fovs.h > 100 ? 3 : 2;
      fovs.h = fovs.h.toPrecision(precision);
      precision = fovs.v > 100 ? 3 : 2;
      fovs.v = fovs.v.toPrecision(precision);

      ctx.fillText(fovs.h + '\u00b0', 5, this.headTY + yOffset);
      ctx.fillText(fovs.v + '\u00b0', 5, this.headSY + yOffset);
      ctx.fillText('R3E: ' + games.r3e + '\u00d7', 5, this.rrY + yOffset);
      ctx.fillText('RBR: ' + games.rbr, 100, this.rrY + yOffset);
      ctx.fillText('DiRT: ' + games.dirt, 205, this.rrY + yOffset);
      ctx.fillText('F1: ' + games.f1, 300, this.rrY + yOffset);
    },

    render: function (images) {
      this.context.fillStyle = BACKGROUND_COLOR;
      this.context.fillRect(0, 0, this.w, this.h);
      this.drawCarImages(images);
      this.drawViewLines();
      this.drawHeadsAndMonitors();
      this.drawAngleText();
    }
  };

  function has(obj, prop) {
    return Object.hasOwnProperty.call(obj, prop);
  }

  var Slider = function (options) {
    var requiredProperties = ['min', 'max', 'step', 'el'];
    var hasAllProperties = requiredProperties.every(function (prop) {
      return has(options, prop);
    });

    if (!hasAllProperties) {
      throw new Error('Missing required options. Supplied: ' +
        Object.keys(options).join(', '));
    }

    this.properties = {};
    requiredProperties.forEach(function (prop) {
      this.properties[prop] = options[prop];
    }.bind(this));

    if (has(options, 'value')) {
      this.properties.value = options.value;
    } else {
      this.properties.value = options.min;
    }

    this.el = this.properties.el;
    this.els = {};
    this.els.container = document.createElement('div');
    this.els.container.className = 'slider';
    this.els.track = document.createElement('div');
    this.els.track.className = 'slider__track';
    this.els.thumbContainer = document.createElement('div');
    this.els.thumbContainer.className = 'slider__thumb-container';
    this.els.thumb = document.createElement('div');
    this.els.thumb.className = 'slider__thumb';

    this.els.thumbContainer.appendChild(this.els.thumb);
    this.els.container.appendChild(this.els.thumbContainer);
    this.els.container.appendChild(this.els.track);
    this.el.appendChild(this.els.container);

    document.body.addEventListener('mousedown', this.onMouseDown.bind(this));
    document.body.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.body.addEventListener('mouseup', this.onMouseUp.bind(this));
    document.body.addEventListener('touchstart', this.onMouseDown.bind(this));
    document.body.addEventListener('touchmove', this.onMouseMove.bind(this));
    document.body.addEventListener('touchend', this.onMouseUp.bind(this));

    this.eventHandlers = {};

    setTimeout(function () {
      this.updateSliderPosition();
    }.bind(this), 0);
  };

  Slider.prototype.updateSliderPosition = function () {
    var min = this.properties.min;
    var max = this.properties.max;
    var value = this.properties.value;

    // User may be able to enter a value in the numerical input that is outside
    // the slider's range.
    value = Math.max(min, value);
    value = Math.min(max, value);

    var thumbPosition = ((value - min) / (max - min)) * 100;
    this.els.thumb.style.left = thumbPosition + '%';
  };

  Slider.prototype.onMouseDown = function (event) {
    var isOnSlider = Object.keys(this.els).some(function (key) {
      return event.target === this.els[key];
    }.bind(this));

    if (!isOnSlider) return this;

    this.isDragging = true;
    this.onMouseMove(event);
    return this;
  };

  Slider.prototype.onMouseMove = function (event) {
    if (!this.isDragging) return;
    event.preventDefault();

    var rect = this.els.thumbContainer.getBoundingClientRect();
    var x = (event.touches ? event.touches[0].clientX : event.clientX) - rect.left;
    if (x < 0) x = 0;
    if (x >= rect.width) x = rect.width;

    var step = this.properties.step;
    var normalizedValue = (x / rect.width);
    var min = this.properties.min;
    var max = this.properties.max;

    var newValue = min + (max - min) * normalizedValue;
    var roundedValue = Math.round(newValue / step) * step;
    this.setValue(roundedValue);

    return this;
  };

  Slider.prototype.onMouseUp = function () {
    this.isDragging = false;
    return this;
  };

  Slider.prototype.on = function (eventName, handler) {
    if (this.eventHandlers[eventName]) {
      this.eventHandlers[eventName].push(handler);
    } else {
      this.eventHandlers[eventName] = [handler];
    }

    return this;
  };

  Slider.prototype.off = function (eventName) {
    var handlers;
    if (!this.eventHandlers[eventName]) {
      return [];
    }

    handlers = this.eventHandlers[eventName];
    delete this.eventHandlers[eventName];
    return handlers;
  };

  Slider.prototype.emit = function (eventName, newValue) {
    if (!this.eventHandlers[eventName]) {
      return;
    }

    this.eventHandlers[eventName].forEach(function (handler) {
      handler.call(this, newValue);
    }.bind(this));

    return this;
  };

  Slider.prototype.setValue = function (value) {
    this.properties.value = value;
    this.updateSliderPosition();
    this.emit('change', value);
    return this;
  };

  Slider.prototype.getValue = function () {
    return this.properties.value;
  };

  function formChange(event) {
    var el = (event && event.target) || { name: null };
    var relatedInputs = {
      'distance-n': 'distance',
      'distance-s': 'distance-n',
      'size-n': 'size',
      'size-s': 'size-n'
    };
    var ratio = $form.elements['aspect-ratio'].value.split(':').map(Number);

    if (el.name) {
      if (/-s$/.test(el.name)) {
        $form.elements[relatedInputs[el.name]].value = el.value;
      } else {
        sliders[relatedInputs[el.name]].setValue(el.value);
      }
    }

    ['distance', 'size'].forEach(function (key) {
      canvas.measurements[key] = {
        value: parseInt($form.elements[key + '-n'].value, 10),
        isInches: $form.elements[key + '-inches'].checked
      };
    });

    canvas.monitor.distance = canvas.pixelsFromUnits(
      canvas.measurements.distance.value,
      canvas.measurements.distance.isInches);

    canvas.monitor.diagonalSize = canvas.pixelsFromUnits(
      canvas.measurements.size.value,
      canvas.measurements.size.isInches);

    canvas.monitor.ratio = ratio;

    canvas.render(carImages);
    canvas.alreadyUpdated = true;
  }

  window.addEventListener('load', function () {
    $form.addEventListener('input', formChange);
    $form.addEventListener('change', formChange);

    carImages.load(function () {
      canvas.initialize();
      formChange();
    });

    sliders.distance = new Slider({
      min: 10,
      max: 200,
      step: 1,
      value: 37,
      el: document.querySelector('#slider-distance')
    });

    sliders.size = new Slider({
      min: 10,
      max: 100,
      step: 0.5,
      value: 24,
      el: document.querySelector('#slider-size')
    });

    sliders.distance.on('change', function () {
      formChange({
        target: {
          name: 'distance-s',
          value: this.getValue()
        }
      });
    });
    sliders.size.on('change', function () {
      formChange({
        target: {
          name: 'size-s',
          value: this.getValue()
        }
      });
    });
  });
}(window.document));