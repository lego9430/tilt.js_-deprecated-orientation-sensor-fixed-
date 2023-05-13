// Please, for its usage, follow https://github.com/gijsroge/tilt.js
// Here, i just 'adjusted and updated some issue... and commented out the file. Nothing more. A smile to everyone!!

'use strict';

// Create a class for CardEffects
class CardEffects {
  constructor(element, settings = {}) {
    if (!(element instanceof Node)) {
      throw new Error("Can't initialize CardEffects because " + element + " is not a Node.");
    }

    // Initialize instance variables
    this.width = null;
    this.height = null;
    this.left = null;
    this.top = null;
    this.transitionTimeout = null;
    this.updateCall = null;
    this.event = null;
    this.updateBind = this.update.bind(this);
    this.resetBind = this.reset.bind(this);

    // Store element and settings
    this.element = element;
    this.settings = this.extendSettings(settings);

    // Configure options based on settings
    this.reverse = this.settings.reverse ? -1 : 1;
    this.resetToStart = this.isSettingTrue(this.settings["reset-to-start"]);
    this.glare = this.isSettingTrue(this.settings.glare);
    this.glarePrerender = this.isSettingTrue(this.settings["glare-prerender"]);
    this.fullPageListening = this.isSettingTrue(this.settings["full-page-listening"]);
    this.gyroscope = this.isSettingTrue(this.settings.gyroscope);
    this.gyroscopeSamples = this.settings.gyroscopeSamples;

    // Determine the element listener based on settings
    this.elementListener = this.getElementListener();

    // Prepare glare if enabled
    if (this.glare) {
      this.prepareGlare();
    }

    // Update client size if full page listening is enabled
    if (this.fullPageListening) {
      this.updateClientSize();
    }

    // Add event listeners
    this.addEventListeners();

    // Reset the tilt state
    this.reset();

    // If resetToStart is false, override startX and startY settings
    if (this.resetToStart === false) {
      this.settings.startX = 0;
      this.settings.startY = 0;
    }
  }

  isSettingTrue(setting) {
    return setting === "" || setting === true || setting === 1;
  }

  getElementListener() {
    // Determine the element listener based on settings
    if (this.fullPageListening) {
      return window.document;
    }

    if (typeof this.settings["mouse-event-element"] === "string") {
      const mouseEventElement = document.querySelector(this.settings["mouse-event-element"]);

      if (mouseEventElement) {
        return mouseEventElement;
      }
    }

    if (this.settings["mouse-event-element"] instanceof Node) {
      return this.settings["mouse-event-element"];
    }

    return this.element;
  }

  addEventListeners() {
    // Bind event listener methods to the instance
    this.onMouseEnterBind = this.onMouseEnter.bind(this);
    this.onMouseMoveBind = this.onMouseMove.bind(this);
    this.onMouseLeaveBind = this.onMouseLeave.bind(this);
    this.onWindowResizeBind = this.onWindowResize.bind(this);

    // Add event listeners
    this.elementListener.addEventListener("mouseenter", this.onMouseEnterBind);
    this.elementListener.addEventListener("mouseleave", this.onMouseLeaveBind);
    this.elementListener.addEventListener("mousemove", this.onMouseMoveBind);

    if (this.glare || this.fullPageListening) {
      window.addEventListener("resize", this.onWindowResizeBind);
    }

    if (this.gyroscope && this.isGyroscopeSupported()) {
      window.addEventListener("deviceorientation", this.onDeviceOrientation.bind(this));
    }
  }

  removeEventListeners() {
    // Remove event listeners
    this.elementListener.removeEventListener("mouseenter", this.onMouseEnterBind);
    this.elementListener.removeEventListener("mouseleave", this.onMouseLeaveBind);
    this.elementListener.removeEventListener("mousemove", this.onMouseMoveBind);

    if (this.gyroscope && this.isGyroscopeSupported()) {
      window.removeEventListener("deviceorientation", this.onDeviceOrientation.bind(this));
    }

    if (this.glare || this.fullPageListening) {
      window.removeEventListener("resize", this.onWindowResizeBind);
    }
  }

  isGyroscopeSupported() {
    // Check if the gyroscope is supported in the current environment
    return typeof window.DeviceOrientationEvent !== 'undefined' && typeof window.DeviceOrientationEvent.requestPermission === 'function';
  }

  destroy() {
    // Clear timers and cancel animation frame
    clearTimeout(this.transitionTimeout);
    if (this.updateCall !== null) {
      cancelAnimationFrame(this.updateCall);
    }

    // Reset the tilt state
    this.reset();

    // Remove event listeners and clean up references
    this.removeEventListeners();
    this.element.cardEffects = null;
    delete this.element.cardEffects;

    this.element = null;
  }

  onDeviceOrientation(event) {
    // Handle device orientation changes
    if (event.gamma === null || event.beta === null) {
      return;
    }

    // Update the element position
    this.updateElementPosition();

    // Sample gyroscope values if samples are remaining
    if (this.gyroscopeSamples > 0) {
      this.lastgammazero = this.gammazero;
      this.lastbetazero = this.betazero;

      if (this.gammazero === null) {
        this.gammazero = event.gamma;
        this.betazero = event.beta;
      } else {
        this.gammazero = (event.gamma + this.lastgammazero) / 2;
        this.betazero = (event.beta + this.lastbetazero) / 2;
      }

      this.gyroscopeSamples -= 1;
    }

    // Calculate angles and positions based on gyroscope values
    const totalAngleX = this.settings.gyroscopeMaxAngleX - this.settings.gyroscopeMinAngleX;
    const totalAngleY = this.settings.gyroscopeMaxAngleY - this.settings.gyroscopeMinAngleY;

    const degreesPerPixelX = totalAngleX / this.width;
    const degreesPerPixelY = totalAngleY / this.height;

    const angleX = event.gamma - (this.settings.gyroscopeMinAngleX + this.gammazero);
    const angleY = event.beta - (this.settings.gyroscopeMinAngleY + this.betazero);

    const posX = angleX / degreesPerPixelX;
    const posY = angleY / degreesPerPixelY;

    // Trigger the update call with gyroscope values
    if (this.updateCall !== null) {
      cancelAnimationFrame(this.updateCall);
    }

    this.event = {
      clientX: posX + this.left,
      clientY: posY + this.top,
    };

    this.updateCall = requestAnimationFrame(this.updateBind);
  }

  onMouseEnter() {
    // Handle mouse enter event
    this.updateElementPosition();
    this.element.style.willChange = "transform";
    this.setTransition();
}

onMouseMove(event) {
  // Handle mouse move event
  if (this.updateCall !== null) {
    cancelAnimationFrame(this.updateCall);
  }

  this.event = event;
  this.updateCall = requestAnimationFrame(this.updateBind);
}

onMouseLeave() {
  // Handle mouse leave event
  this.setTransition();

  if (this.settings.reset) {
    requestAnimationFrame(this.resetBind);
  }
}

reset() {
  // Reset the tilt state
  this.onMouseEnter();

  if (this.fullPageListening) {
    this.event = {
      clientX: (this.settings.startX + this.settings.max) / (2 * this.settings.max) * this.clientWidth,
      clientY: (this.settings.startY + this.settings.max) / (2 * this.settings.max) * this.clientHeight
    };
  } else {
    this.event = {
      clientX: this.left + ((this.settings.startX + this.settings.max) / (2 * this.settings.max) * this.width),
      clientY: this.top + ((this.settings.startY + this.settings.max) / (2 * this.settings.max) * this.height)
    };
  }

  let backupScale = this.settings.scale;
  this.settings.scale = 1;
  this.update();
  this.settings.scale = backupScale;
  this.resetGlare();
}

resetGlare() {
  if (this.glare) {
    this.glareElement.style.transform = "rotate(180deg) translate(-50%, -50%)";
    this.glareElement.style.opacity = "0";
  }
}

getValues() {
  let x, y;

  if (this.fullPageListening) {
    x = this.event.clientX / this.clientWidth;
    y = this.event.clientY / this.clientHeight;
  } else {
    x = (this.event.clientX - this.left) / this.width;
    y = (this.event.clientY - this.top) / this.height;
  }

  x = Math.min(Math.max(x, 0), 1);
  y = Math.min(Math.max(y, 0), 1);

  let tiltX = (this.reverse * (this.settings.max - x * this.settings.max * 2)).toFixed(2);
  let tiltY = (this.reverse * (y * this.settings.max * 2 - this.settings.max)).toFixed(2);
  let angle = Math.atan2(this.event.clientX - (this.left + this.width / 2), -(this.event.clientY - (this.top + this.height / 2))) * (180 / Math.PI);

  return {
    tiltX: tiltX,
    tiltY: tiltY,
    percentageX: x * 100,
    percentageY: y * 100,
    angle: angle
  };
}

updateElementPosition() {
  let rect = this.element.getBoundingClientRect();

  this.width = this.element.offsetWidth;
  this.height = this.element.offsetHeight;
  this.left = rect.left;
  this.top = rect.top;
}

update() {
  let values = this.getValues();

  this.element.style.transform = "perspective(" + this.settings.perspective + "px) " +
    "rotateX(" + (this.settings.axis === "x" ? 0 : values.tiltY) + "deg) " +
    "rotateY(" + (this.settings.axis === "y" ? 0 : values.tiltX) + "deg) " +
    "scale3d(" + this.settings.scale + ", " + this.settings.scale + ", " + this.settings.scale + ")";

    if (this.glare) {
        this.glareElement.style.transform = `rotate(${values.angle}deg) translate(-50%, -50%)`;
        this.glareElement.style.opacity = `${values.percentageY * this.settings["max-glare"] / 100}`;
      }
      this.element.dispatchEvent(new CustomEvent("tiltChange", {
        "detail": values
      }));
  
      this.updateCall = null;
    }
  
    prepareGlare() {
      if (!this.glarePrerender) {
        const jsTiltGlare = document.createElement("div");
        jsTiltGlare.classList.add("js-tilt-glare");
  
        const jsTiltGlareInner = document.createElement("div");
        jsTiltGlareInner.classList.add("js-tilt-glare-inner");
  
        jsTiltGlare.appendChild(jsTiltGlareInner);
        this.element.appendChild(jsTiltGlare);
      }
  
      this.glareElementWrapper = this.element.querySelector(".js-tilt-glare");
      this.glareElement = this.element.querySelector(".js-tilt-glare-inner");
  
      if (this.glarePrerender) {
        return;
      }
  
      Object.assign(this.glareElementWrapper.style, {
        "position": "absolute",
        "top": "0",
        "left": "0",
        "width": "100%",
        "height": "100%",
        "overflow": "hidden",
        "pointer-events": "none",
        "border-radius": "inherit"
      });
  
      Object.assign(this.glareElement.style, {
        "position": "absolute",
        "top": "50%",
        "left": "50%",
        "pointer-events": "none",
        "background-image": `linear-gradient(0deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%)`,
        "transform": "rotate(180deg) translate(-50%, -50%)",
        "transform-origin": "0% 0%",
        "opacity": "0"
      });
  
      this.updateGlareSize();
    }
  
    updateGlareSize() {
      if (this.glare) {
        const glareSize = (this.element.offsetWidth > this.element.offsetHeight ? this.element.offsetWidth : this.element.offsetHeight) * 2;
  
        Object.assign(this.glareElement.style, {
          "width": `${glareSize}px`,
          "height": `${glareSize}px`,
        });
      }
    }
  
    updateClientSize() {
      this.clientWidth = window.innerWidth ||
        document.documentElement.clientWidth ||
        document.body.clientWidth;
  
      this.clientHeight = window.innerHeight ||
        document.documentElement.clientHeight ||
        document.body.clientHeight;
    }
  
    onWindowResize() {
      this.updateGlareSize();
      this.updateClientSize();
    }
  
    setTransition() {
      clearTimeout(this.transitionTimeout);
      this.element.style.transition = this.settings.speed + "ms " + this.settings.easing;
      if (this.glare) this.glareElement.style.transition = `opacity ${this.settings.speed}ms ${this.settings.easing}`;
  
      this.transitionTimeout = setTimeout(() => {
        this.element.style.transition = "";
        if (this.glare) {
          this.glareElement.style.transition = "";
        }
      }, this.settings.speed);
    }
  
    extendSettings(settings) {
      let defaultSettings = {
        reverse: false,
        max: 10,
        startX: 0,
        startY: 0,
        perspective: 1000,
        easing: "cubic-bezier(.03,.98,.52,.99)",
        scale: 1,
        speed: 300,
        transition: true,
        axis: null,
        glare: false,
        "max-glare": 1,
        "glare-prerender": false,
        "full-page-listening": false,
        "mouse-event-element": null,
        reset: true,
        "reset-to-start": true,
        gyroscope: true,
        gyroscopeMinAngleX: -45,
        gyroscopeMaxAngleX: 45,
        gyroscopeMinAngleY: -45,
        gyroscopeMaxAngleY: 45,
        gyroscopeSamples: 10
      };
  
      let newSettings = {};
      for (let property in defaultSettings) {
        if (property in settings) {
          newSettings[property] = settings[property];
        } else if (this.element.hasAttribute(`data-tilt-${property}`)) {
          let attribute = this.element.getAttribute(`data-tilt-${property}`);
          try {
            newSettings[property] = JSON.parse(attribute);
          } catch (e) {
            newSettings[property] = attribute;
          }
        } else {
          newSettings[property] = defaultSettings[property];
        }
      }
  
      return newSettings;
    }
  
    static init(elements, settings) {
      if (elements instanceof Node) {
        elements = [elements];
      }
  
      if (elements instanceof NodeList) {
        elements = Array.from(elements);
      }
  
      if (!(elements instanceof Array)) {
        return;
      }
  
      elements.forEach((element) => {
        if (!("cardEffects" in element)) {
          element.cardEffects = new CardEffects(element, settings);
        }
      });
    }
  }
  
  if (typeof document !== "undefined") {
    // Expose the class to the global scope
    window.CardEffects = CardEffects;
  
    /**
     * Auto load
     */
    CardEffects.init(document.querySelectorAll("[data-tilt]"));
  }
  
  // Initialize CardEffects with custom settings
  CardEffects.init(document.querySelector("._path__box--card"), {
    max: 25,
    speed: 400
  });
    
