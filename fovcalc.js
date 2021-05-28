/*eslint indent: ["warn", 2] */
(function (D) {
  'use strict';

  function $(sel, el) {
    return (el || D).querySelector(sel);
  }

  var MONITOR_COLOR = '#f00';
  var MONITOR_THICKNESS = 6;
  var FOV_COLOR = '#d77';
  var HEAD_SIZE = 6;
  var CAR_LENGTH = 495; // centimetres, used to calculate scale for monitors
  var BACKGROUND_COLOR = '#9dbbcc';

  // These two should match the canvas element's size (as specified in
  // fovcalc.css) at normal screen size
  var CANVAS_WIDTH = 600;
  var CANVAS_HEIGHT = 490;

  var $form = $('#controls');
  var sliders = {};
  var $numberHint = $('#number-hint');

  var feedback = {
    el: $('#feedback'),
    form: null,
    inputs: {
      name: null,
      text: null,
    },
    MAX_NAME: 200,
    MAX_TEXT: 1000,
    textLengthDisplay: null,
    buttons: {
      open: $('#leave-feedback'),
      cancel: $('#feedback-cancel'),
      send: $('#feedback-send')
    },
    init: function () {
      this.form = this.el.querySelector('form');
      this.inputs.name = this.form.elements['feedback-name'];
      this.inputs.text = this.form.elements['feedback-text'];
      this.textLengthDisplay = $('#feedback-remaining');

      this.inputs.text.addEventListener('input', this.textChange.bind(this));
      this.buttons.open.addEventListener('click', this.toggleForm.bind(this));
      this.buttons.cancel.addEventListener('click', this.cancelForm.bind(this));
      this.buttons.send.addEventListener('click', this.sendFeedback.bind(this));
    },
    getSafeName: function () {
      return this.inputs.name.value.slice(0, this.MAX_NAME);
    },
    normalisedNewlines: function (s) {
      // HTTP requests are sent using \r\n but textareas are (supposed to be)
      // encoded with just \n so we need to normalise the behaviour or the MD5
      // hashes won't match.
      return s.replace(/\r?\n/g, '\r\n');
    },
    getSafeText: function () {
      var text = this.inputs.text.value.slice(0, this.MAX_TEXT);
      return this.normalisedNewlines(text);
    },
    calcChecksum: function () {
      //return hex_md5(this.getSafeName() + this.getSafeText());
      return window.md5(this.getSafeText());
    },
    textChange: function () {
      var len = this.normalisedNewlines(this.inputs.text.value).length;
      var invalidLength = len > this.MAX_TEXT || len == 0;
      this.textLengthDisplay.textContent = this.MAX_TEXT - len;
      this.textLengthDisplay.classList.toggle('too-long', invalidLength);
      this.buttons.send.disabled = invalidLength;
    },
    toggleForm: function () {
      this.el.classList.toggle('visible');
      if (this.el.classList.contains('visible')) {
        setTimeout(() => {
          this.inputs.name.focus();
          this.textChange();
        }, 0);
      }
    },
    clearInputs: function () {
      this.inputs.name.value = '';
      this.inputs.text.value = '';
    },
    cancelForm: function () {
      this.toggleForm();
    },
    sendFeedback: function (event) {
      var formData = new FormData();
      var xhr = new XMLHttpRequest();

      this.toggleForm();
      event.preventDefault();

      formData.set('feedback-name', this.getSafeName());
      formData.set('feedback-text', this.getSafeText());
      formData.set('feedback-checksum', this.calcChecksum());

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) window.alert('Thanks for your feedback!');
      });
      xhr.open('POST', this.form.action.replace('.404', ''));
      xhr.send(formData);
    }
  };

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
      normX: 0.55, // normalized value, 0-1
      normTY: 0.35,
      normSY: 0.17,
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

        // This value is what the width would be if the monitor was actually in
        // a 4:3 ratio; we need this for calculating the FOV value for Richard
        // Burns Rally.
        // Thanks to Vileska for the information:
        // https://vileska.blogspot.com/p/blog-page_12.html
        var w43 = h * (4/3);

        return { w: w, w43: w43, h: h };
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
      this.context.font = '1em ' + window.getComputedStyle(D.body).fontFamily;

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
        // Imaginary 4:3 FOV used by Richard Burns Rally.
        h43: Math.atan((monSides.w43 / 2) / this.monitor.distance) * 2,
      };
    },

    gameSpecific: {
      r3e: function (degrees) {
        // See https://www.racedepartment.com/threads/fov-setting-multiplier-explained.142992/
        // Basically, RaceRoom FoV is a multiplier of the default 58 degree VFoV.
        return Math.round((degrees * 10) / 58) / 10;
      },
      dr: function (degrees) {
        if (degrees < 29.5) return '0.0!';
        if (degrees >= 70.5) return '1.0!';
        return ((degrees - 30) / 40).toFixed(1);
      },
      dr2: function (degrees) {
        var normalizedPos;
        var scaledPos;
        // var normalizedOutput;
        // u2212 is a full-width minus sign (i.e. same width as + sign)
        if (Math.round(degrees) < 30) return '\u22125!';
        if (Math.round(degrees) > 70) return '+5!';

        // Updated scaling formula by Reddit user GalaxyMaster_P:
        // https://www.reddit.com/r/dirtgame/comments/bgg61d/i_created_an_fov_editing_tool_for_dirt_rally_20/
        normalizedPos = -Math.sqrt((degrees-75) / -20) + 1.5;
        scaledPos = Math.round(normalizedPos * 10) - 5;

        // Currently don't do anything with normalizedOutput, as it's not a
        // super useful value outside of some dubiously legal Cheat Engine use.
        // normalizedOutput = ' (' + normalizedPos.toFixed(3) + ')';


        if (scaledPos === 0) return ' 0';
        if (scaledPos < 0) return '\u2212' + (-scaledPos);
        return '+' + scaledPos;
      },
      f1: function (degrees) {
        function format(num) {
          return num.toString().replace('-', '\u2212');
        }
        var scale = Math.round(((degrees - 77) / 2)) / 20;
        return {
          old: format(scale),
          new: format(scale * 2)
        };
      },
      rbr: function (radians) {
        // RBR FoV is measured in radians 
        return radians.toFixed(3);
      }
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
      var hFov, vFov;
      var yOffset = this.textHeight / 3;
      var fovX = this.headPositions.x + HEAD_SIZE * 2 + 5;
      var headTY = this.headPositions.ty;
      var headSY = this.headPositions.sy;
      var otherTextY = this.h - 35 + yOffset;
      var precision;
      var games = {
        r3e: 0,
        rbr: 0,
        dr: 0,
        dr2: 0,
        f1: 0
      };

      fovs.h = this.degreesFromRadians(fovs.h);
      fovs.v = this.degreesFromRadians(fovs.v);

      games.r3e = this.gameSpecific.r3e(fovs.v);
      games.dr = this.gameSpecific.dr(fovs.v);
      games.dr2 = this.gameSpecific.dr2(fovs.v);
      games.f1 = this.gameSpecific.f1(fovs.h);
      games.rbr = this.gameSpecific.rbr(fovs.h43);

      precision = fovs.h > 100 ? 4 : 3;
      // u200a is a 'hair space'
      hFov = fovs.h.toPrecision(precision).replace('.', '\u200a.\u200a');
      precision = fovs.v > 100 ? 4 : 3;
      vFov = fovs.v.toPrecision(precision).replace('.', '\u200a.\u200a');

      ctx.fillText(hFov + '\u00b0', fovX, headTY + yOffset);
      ctx.fillText(vFov + '\u00b0', fovX, headSY + yOffset);


      // Other games
      ctx.fillText('R3E: ' + games.r3e + '\u00d7', 5, otherTextY);
      ctx.fillText('RBR: ' + games.rbr, 150, otherTextY);

      ctx.fillText('F1: ' + games.f1.old, 300, otherTextY);
      ctx.fillText('F1 (2019+): ' + games.f1.new, 400, otherTextY);

      if (/!/.test(games.dr)) ctx.globalAlpha = 0.3;
      ctx.fillText('DiRT Rally: ' + games.dr, 5, otherTextY + 25);
      ctx.globalAlpha = 1;

      if (/!/.test(games.dr2)) ctx.globalAlpha = 0.3;
      ctx.fillText('DiRT Rally 2: ' + games.dr2 + ' (from centre of slider)', 150, otherTextY + 25);
      ctx.globalAlpha = 1;

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
      var intValue = parseInt(value, 10);
      this.properties.value = intValue;
      this.updateSliderPosition();
      this.emit('change', intValue);
      return this;
    },

    getValue: function () {
      return this.properties.value;
    }
  };

  function getAncestorLabelOf(input) {
    var label = input;
    while (label.nodeName !== 'LABEL') {
      label = label.parentNode;
    }

    return label;
  }

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
      } else if (/-n$/.test(el.name)) {
        sliders[relatedInputs[el.name]].setValue(el.value);
      }
    }

    ['distance', 'size'].forEach(function (key) {
      var input = $form.elements[key + '-inches'];
      var label = getAncestorLabelOf(input);

      diagram.measurements[key] = {
        value: parseInt($form.elements[key + '-n'].value, 10),
        isInches: input.checked
      };

      label.classList.toggle('inches', input.checked);
    });

    $numberHint.classList.toggle('visible',
      sliders.size.properties.value >= sliders.size.properties.max ||
      sliders.distance.properties.value >= sliders.distance.properties.max
    );

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
      max: 120,
      step: 1,
      value: 40,
      el: document.querySelector('#slider-distance')
    });

    sliders.size = new Slider({
      min: 19,
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

    // Feedback stuff
    feedback.init();
  });
}(window.document));
