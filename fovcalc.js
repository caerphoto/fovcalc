(function (D) {
  'use strict';

  var MONITOR_COLOR = '#f00';
  var MONITOR_THICKNESS = 6;
  var FOV_COLOR = '#d77';
  var HEAD_SIZE = 6;
  var CAR_LENGTH = 495; // centimetres, used to calculate scale for monitors
  var BACKGROUND_COLOR = '#9dbbcc';

  // These two should match the canvas element's size at normal screen size
  var CANVAS_WIDTH = 600;
  var CANVAS_HEIGHT = 470;

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

      this.top.src = 'bentley-top.svg';
      this.side.src = 'bentley-side.svg';
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

  var diagram = {
    el: null,
    context: null,
    w: 0,
    h: 0,
    headPositions: {
      normX: 0.5, // normalized value, 0-1
      normTY: 0.37,
      normSY: 0.2,
      x: 0,
      ty: 0,
      sy: 0
    },
    xOffset: 0,
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
      this.w = this.el.width = CANVAS_WIDTH;
      this.h = this.el.height = CANVAS_HEIGHT;

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

    setHeadPositions: function (carImages) {
      this.headPositions.x = carImages.top.width * this.headPositions.normX;
      this.headPositions.ty = carImages.top.height * this.headPositions.normTY;
      this.headPositions.sy = carImages.side.height * this.headPositions.normSY +
        carImages.top.height + 10;
    },

    drawCarImages: function (images) {
      var ctx = this.context;

      ctx.globalAlpha = 0.5;
      ctx.drawImage(images.top, 0, 0);
      ctx.drawImage(images.side, 0, images.top.height + 10);

      ctx.globalAlpha = 1;
      ctx.fillStyle = MONITOR_COLOR;
      this.setHeadPositions(images);
    },

    drawHeadsAndMonitors: function () {
      var ctx = this.context;
      var pi2 = Math.PI * 2;
      var headX = this.headPositions.x + this.xOffset;
      var headTY = this.headPositions.ty;
      var headSY = this.headPositions.sy;
      var monX = headX - this.monitor.distance;
      var monSides = this.monitor.getSides();
      var monTY = headTY - monSides.w / 2;
      var monSY = headSY - monSides.h / 2;

      ctx.beginPath();
      ctx.arc(headX, headTY, HEAD_SIZE, 0, pi2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(headX, headSY, HEAD_SIZE, 0, pi2);
      ctx.fill();


      ctx.fillRect(monX, monTY, MONITOR_THICKNESS, monSides.w);
      ctx.fillRect(monX, monSY, MONITOR_THICKNESS, monSides.h);
    },

    drawViewLines: function () {
      var ctx = this.context;
      var monSides = this.monitor.getSides();
      var headX = this.headPositions.x + this.xOffset;
      var fovW = headX - 5;
      var fovTH = (monSides.w * (fovW / this.monitor.distance)) / 2;
      var fovSH = (monSides.h * (fovW / this.monitor.distance)) / 2;
      var headTY = this.headPositions.ty;
      var headSY = this.headPositions.sy;

      // Top view
      ctx.beginPath();
      ctx.moveTo(headX, headTY);
      ctx.lineTo(headX - fovW, headTY - fovTH);
      ctx.moveTo(headX, headTY);
      ctx.lineTo(headX - fovW, headTY + fovTH);
      ctx.stroke();

      // Top view
      ctx.beginPath();
      ctx.moveTo(headX, headSY);
      ctx.lineTo(headX - fovW, headSY - fovSH);
      ctx.moveTo(headX, headSY);
      ctx.lineTo(headX - fovW, headSY + fovSH);
      ctx.stroke();
    },

    drawAngleText: function () {
      var ctx = this.context;
      var fovs = this.getFieldsOfView();
      var yOffset = this.textHeight / 3;
      var fovX = this.headPositions.x + HEAD_SIZE * 2 + 5;
      var headTY = this.headPositions.ty;
      var headSY = this.headPositions.sy;
      var otherTextY = this.h - 10;
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

      ctx.fillText(fovs.h + '\u00b0', fovX, headTY + yOffset);
      ctx.fillText(fovs.v + '\u00b0', fovX, headSY + yOffset);

      ctx.fillText('R3E: ' + games.r3e + '\u00d7', 5, otherTextY + yOffset);
      ctx.fillText('RBR: ' + games.rbr, 100, otherTextY + yOffset);
      ctx.fillText('DiRT: ' + games.dirt, 205, otherTextY + yOffset);
      ctx.fillText('F1: ' + games.f1, 300, otherTextY + yOffset);
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

  Slider.prototype = {
    updateSliderPosition: function () {
      var min = this.properties.min;
      var max = this.properties.max;
      var value = this.properties.value;

      // User may be able to enter a value in the numerical input that is outside
      // the slider's range.
      value = Math.max(min, value);
      value = Math.min(max, value);

      var thumbPosition = ((value - min) / (max - min)) * 100;
      this.els.thumb.style.left = thumbPosition + '%';
    },

    onMouseDown: function (event) {
      var isOnSlider = Object.keys(this.els).some(function (key) {
        return event.target === this.els[key];
      }.bind(this));

      if (!isOnSlider) return this;

      this.isDragging = true;
      this.onMouseMove(event);
      return this;
    },

    onMouseMove: function (event) {
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
    },

    onMouseUp: function () {
      this.isDragging = false;
      return this;
    },

    on: function (eventName, handler) {
      if (this.eventHandlers[eventName]) {
        this.eventHandlers[eventName].push(handler);
      } else {
        this.eventHandlers[eventName] = [handler];
      }

      return this;
    },

    off: function (eventName) {
      var handlers;
      if (!this.eventHandlers[eventName]) {
        return [];
      }

      handlers = this.eventHandlers[eventName];
      delete this.eventHandlers[eventName];
      return handlers;
    },

    emit: function (eventName, newValue) {
      if (!this.eventHandlers[eventName]) {
        return;
      }

      this.eventHandlers[eventName].forEach(function (handler) {
        handler.call(this, newValue);
      }.bind(this));

      return this;
    },

    setValue: function (value) {
      this.properties.value = value;
      this.updateSliderPosition();
      this.emit('change', value);
      return this;
    },

    getValue: function () {
      return this.properties.value;
    }
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

    if (el.name && el.name !== 'aspect-ratio') {
      if (/-s$/.test(el.name)) {
        $form.elements[relatedInputs[el.name]].value = el.value;
      } else {
        sliders[relatedInputs[el.name]].setValue(el.value);
      }
    }

    ['distance', 'size'].forEach(function (key) {
      diagram.measurements[key] = {
        value: parseInt($form.elements[key + '-n'].value, 10),
        isInches: $form.elements[key + '-inches'].checked
      };
    });

    diagram.monitor.distance = diagram.pixelsFromUnits(
      diagram.measurements.distance.value,
      diagram.measurements.distance.isInches);

    diagram.monitor.diagonalSize = diagram.pixelsFromUnits(
      diagram.measurements.size.value,
      diagram.measurements.size.isInches);

    diagram.monitor.ratio = ratio;

    diagram.render(carImages);
    diagram.alreadyUpdated = true;
  }

  window.addEventListener('load', function () {
    $form.addEventListener('input', formChange);
    $form.addEventListener('change', formChange);

    carImages.load(function () {
      diagram.initialize();
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
