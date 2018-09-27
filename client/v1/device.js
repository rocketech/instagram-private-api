const CONSTANTS = require('./constants');
const _ = require('lodash');
const md5 = require('js-md5');

// Thanks to @mgp25 for such a list
const devices = require('./devices.js');

function Device(username) {
  if (!_.isString(username))
    throw new Error(
      '`Device` class needs username to be able generate correlated phone_id seed!'
    );
  this.username = username;
}

module.exports = Device;

Object.defineProperty(Device.prototype, 'id', {
  get() {
    return 'android-' + this.md5.slice(0, 16);
  }
});

Object.defineProperty(Device.prototype, 'md5', {
  get() {
    return md5(this.username);
  }
});

// Useful for getting device from csv based on line number
Object.defineProperty(Device.prototype, 'md5int', {
  get() {
    if (!this._md5int) this._md5int = parseInt(parseInt(this.md5, 32) / 10e32);
    return this._md5int;
  }
});

Object.defineProperty(Device.prototype, 'api', {
  get() {
    if (!this._api) {
      const line = devices[this.md5int % devices.length];
      this._api = line[0];
    }
    return this._api;
  },
  set(api) {
    this._api = api;
  }
});

Object.defineProperty(Device.prototype, 'release', {
  get() {
    if (!this._release) {
      const line = devices[this.md5int % devices.length];
      this._release = line[1];
    }
    return this._release;
  },
  set(release) {
    this._release = release;
  }
});

Object.defineProperty(Device.prototype, 'info', {
  get() {
    if (!this._info) {
      const line = devices[this.md5int % devices.length];
      this._info = {
        manufacturer: line[4],
        model: line[5],
        device: line[6]
      };
    }
    return this._info;
  },
  set(info) {
    this._info = info;
  }
});

Object.defineProperty(Device.prototype, 'payload', {
  get() {
    const payload = {};
    payload.manufacturer = this.info.manufacturer;
    payload.model = this.info.model;
    payload.android_version = this.api;
    payload.android_release = this.release;
    return payload;
  }
});

Object.defineProperty(Device.prototype, 'dpi', {
  get() {
    if (!this._dpi) {
      const line = devices[this.md5int % devices.length];
      this._dpi = line[2];
    }
    return this._dpi;
  },
  set(set) {
    return (this._dpi = set);
  }
});

Object.defineProperty(Device.prototype, 'resolution', {
  get() {
    if (!this._resolution) {
      const line = devices[this.md5int % devices.length];
      this._resolution = line[3];
    }
    return this._resolution;
  },
  set(resolution) {
    return (this._resolution = resolution);
  }
});

Object.defineProperty(Device.prototype, 'language', {
  get() {
    if (!this._language) this._language = 'en_US';
    return this._language;
  },
  set(lang) {
    return (this._language = lang);
  }
});

Object.defineProperty(Device.prototype, 'chipMaker', {
  get() {
    if (!this._chipMaker) {
      const line = devices[this.md5int % devices.length];
      this._chipMaker = line[7];
    }
    return this._chipMaker;
  },
  set(chipMaker) {
    return (this._chipMaker = chipMaker);
  }
});

Device.prototype.userAgent = function(version) {
  const agent = [
    this.api + '/' + this.release,
    this.dpi + 'dpi',
    this.resolution,
    this.info.manufacturer,
    this.info.model,
    this.info.device,
    this.chipMaker,
    this.language,
  ];
  return CONSTANTS.instagramAgentTemplate({
    agent: agent.join('; '),
    version: version || CONSTANTS.PRIVATE_KEY.APP_VERSION
  });
};
