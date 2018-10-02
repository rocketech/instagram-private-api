const _ = require('lodash');
const Promise = require('bluebird');
const request = require('request-promise');
const qs = require('querystring');
// require('request-debug')(request, (type, data, r) => {
//   // eslint-disable-line
//   // put your request or response handling logic here
//   switch (type) {
//   case 'request':
//     console.dir({ REQUEST: 'request', data }, { depth: null });
//     if (r.formData)
//       console.dir({ REQUEST: 'request.formData', formData: r.formData }, { depth: null });
//     break;
//   case 'redirect':
//     console.dir({ REQUEST: 'redirect', data }, { depth: null });
//     break;
//   case 'response':
//     console.dir({ REQUEST: 'response', data }, { depth: null });
//     break;
//   }
// });
const JSONbig = require('json-bigint');
const Agent = require('socks5-https-client/lib/Agent');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function Request(session, uuid) {
  this._id = _.uniqueId();
  this._url = null;
  this._signData = false;
  this._request = {};
  this._request.method = 'GET';
  this._request.data = {};
  this._request.bodyType = 'formData';
  this._request.options = {
    gzip: true
  };
  this._request.headers = _.extend({}, Request.defaultHeaders);
  this.attemps = 2;
  if (session) {
    this.session = session;
  } else {
    this.setData({ _csrftoken: 'missing' });
  }

  if (uuid) {
    this.setData({
      guid: uuid
    });
  }

  this._initialize.apply(this, arguments); // eslint-disable-line
  this._transform = function(t) {
    return t;
  };
}

module.exports = Request;

const signatures = require('./signatures');
const Device = require('./device');
const Exceptions = require('./exceptions');
const routes = require('./routes');
const Helpers = require('../../helpers');
const CONSTANTS = require('./constants');
const Session = require('./session');

Request.defaultHeaders = {
  'X-IG-Connection-Type': 'WIFI',
  'X-IG-Capabilities': '3QI=',
  'Accept-Language': 'en-US',
  Host: CONSTANTS.HOSTNAME,
  Accept: '*/*',
  'Accept-Encoding': 'gzip, deflate, sdch',
  Connection: 'Close'
};

Request.requestClient = request.defaults({});

Request.setTimeout = function(ms) {
  const object = { timeout: parseInt(ms) };
  Request.requestClient = request.defaults(object);
};

Request.setProxy = function(proxyUrl) {
  if (!Helpers.isValidUrl(proxyUrl))
    throw new Error('`proxyUrl` argument is not an valid url');
  const object = { proxy: proxyUrl };
  Request.requestClient = request.defaults(object);
};

Request.setSocks5Proxy = function(host, port) {
  const object = {
    agentClass: Agent,
    agentOptions: {
      socksHost: host, // Defaults to 'localhost'.
      socksPort: port // Defaults to 1080.
    }
  };
  Request.requestClient = request.defaults(object);
};

Object.defineProperty(Request.prototype, 'session', {
  get() {
    return this._session;
  },

  set(session) {
    this.setSession(session);
  }
});

Object.defineProperty(Request.prototype, 'device', {
  get() {
    return this._device;
  },

  set(device) {
    this.setDevice(device);
  }
});

Object.defineProperty(Request.prototype, 'url', {
  get() {
    return this._url;
  },

  set(url) {
    this.setUrl(url);
  }
});

Request.prototype._initialize = function() {
  // Easier for inheritence
};

Request.prototype.setOptions = function(options, override) {
  this._request.options = override
    ? _.extend(this._request.options, options || {})
    : _.defaults(this._request.options, options || {});
  return this;
};

Request.prototype.setMethod = function(method) {
  method = method.toUpperCase();
  if (!_.includes(['POST', 'GET', 'PATCH', 'PUT', 'DELETE'], method))
    throw new Error('Method `' + method + '` is not valid method');
  this._request.method = method;
  return this;
};

Request.prototype.setData = function(data, override) {
  if (_.isEmpty(data)) {
    this._request.data = {};
    return this;
  }
  if (_.isString(data)) {
    this._request.data = data;
    return this;
  }
  _.each(data, (val, key) => {
    data[key] = val && val.toString && !_.isObject(val) ? val.toString() : val;
  });
  this._request.data = override
    ? data
    : _.extend(this._request.data, data || {});
  return this;
};

Request.prototype.setBodyType = function(type) {
  if (!_.includes(['form', 'formData', 'json', 'body'], type))
    throw new Error(
      '`bodyType` param must be and form, formData, json or body'
    );
  this._request.bodyType = type;
  return this;
};

Request.prototype.signPayload = function() {
  this._signData = true;
  return this;
};

Request.prototype.transform = function(callback) {
  if (!_.isFunction(callback))
    throw new Error('Transform must be an valid function');
  this._transform = callback;
  return this;
};

Request.prototype.generateUUID = function() {
  if (!this._request.data.guid) {
    this.setData({
      guid: Helpers.generateUUID()
    });
  }
  return this;
};

Request.prototype.setHeaders = function(headers) {
  this._request.headers = _.extend(this._request.headers, headers || {});
  return this;
};

Request.prototype.removeHeader = function(name) {
  delete this._request.headers[name];
  return this;
};

Request.prototype.setUrl = function(url) {
  if (!_.isString(url) || !Helpers.isValidUrl(url))
    throw new Error('The `url` parameter must be valid url string');
  this._url = url;
  return this;
};

Request.prototype.setResource = function(resource, data) {
  this._resource = resource;
  this.setUrl(routes.getUrl(resource, data));
  return this;
};

Request.prototype.setLocalAddress = function(ipAddress) {
  this.setOptions({ localAddress: ipAddress }, true);
  return this;
};

Request.prototype.setCSRFToken = function(token) {
  // this.setData({
  //   _csrftoken: token
  // });
  return this;
};

Request.prototype.setSession = function(session) {
  if (!(session instanceof Session))
    throw new Error('`session` parametr must be instance of `Session`');
  this._session = session;
  this.setCSRFToken(session.CSRFToken);
  this.setOptions({
    jar: session.jar
  });
  if (session.device) this.setDevice(session.device);
  if (session.proxyUrl) this.setOptions({ proxy: session.proxyUrl });
  return this;
};

Request.prototype.setDevice = function(device) {
  if (!(device instanceof Device))
    throw new Error('`device` parametr must be instance of `Device`');
  this._device = device;
  this.setHeaders({
    'User-Agent': device.userAgent()
  });
  this.setData({
    device_id: device.id
  });
  return this;
};

Request.prototype.signData = function() {
  const that = this;
  if (!_.includes(['POST', 'PUT', 'PATCH', 'DELETE'], this._request.method))
    throw new Error('Wrong request method for signing data!');
  return signatures.sign(this._request.data).then(data => {
    that.setHeaders({
      'User-Agent': that.device.userAgent(data.appVersion)
    });
    return {
      signed_body: data.signature + '.' + data.payload,
      ig_sig_key_version: data.sigKeyVersion
    };
  });
};

Request.prototype._prepareData = function() {
  const that = this;
  return new Promise((resolve, reject) => {
    if (that._request.method === 'GET') return resolve({});
    if (that._signData) {
      that.signData().then(data => {
        const obj = {};
        obj[that._request.bodyType] = data;
        resolve(obj);
      }, reject);
    } else {
      const obj = {};
      obj[that._request.bodyType] = that._request.data;
      resolve(obj);
    }
  });
};

Request.prototype._mergeOptions = function(options) {
  const _options = _.defaults(
    {
      method: this._request.method,
      url: this.url,
      resolveWithFullResponse: true,
      headers: this._request.headers
    },
    options || {},
    this._request.options
  );
  return Promise.resolve(_options);
};

Request.prototype.parseMiddleware = function(response) {
  if (
    response.req._headers.host === 'upload.instagram.com' &&
    response.statusCode === 201
  ) {
    const loaded = /(\d+)-(\d+)\/(\d+)/.exec(response.body);
    response.body = {
      status: 'ok',
      start: loaded[1],
      end: loaded[2],
      total: loaded[3]
    };
    return response;
  }
  try {
    response.body = JSONbig.parse(response.body);
    return response;
  } catch (err) {
    throw new Exceptions.ParseError(response, this);
  }
};

Request.prototype.errorMiddleware = function(response) {
  response = this.parseMiddleware(response);
  const json = response.body;
  if (json.spam) throw new Exceptions.ActionSpamError(json);
  if (json.message === 'challenge_required') {
    const uuid = this._request.data.guid;
    console.log(
      `throwing CheckpointError from request.errorMiddleware. uuid=${uuid}`
    );
    throw new Exceptions.CheckpointError(json, this.session, uuid);
  }
  if (json.message === 'login_required')
    throw new Exceptions.AuthenticationError(
      'Login required to process this request'
    );
  if (json.error_type === 'sentry_block')
    throw new Exceptions.SentryBlockError(json);
  if (
    response.statusCode === 429 ||
    (_.isString(json.message) &&
      json.message.toLowerCase().indexOf('too many requests') !== -1)
  )
    throw new Exceptions.RequestsLimitError();
  if (
    _.isString(json.message) &&
    json.message.toLowerCase().indexOf('not authorized to view user') !== -1
  )
    throw new Exceptions.PrivateUserError();
  throw new Exceptions.RequestError(json);
};

// If you need to perform loging or something like that!
// will also accept promise
Request.prototype.beforeParse = function(response, request, attempts) {
  // eslint-disable-line
  return response;
};

Request.prototype.beforeError = function(error, request, attempts) {
  // eslint-disable-line
  throw error;
};

Request.prototype.afterError = function(error, request, attempts) {
  // eslint-disable-line
  throw error;
};

Request.prototype.setQuery = function(queryParams) {
  if (_.isObject(queryParams)) {
    const queryString = qs.stringify(queryParams);
    this.setUrl(this.url + '?' + queryString);
    return this;
  } else { throw new Error('Bad query params. object excepted'); }

};

Request.prototype.send = function(options, attempts) {
  const that = this;

  // const _data = that._request.data;
  // if (_.isObject(_data)) {
  //   console.log(
  //     `url: "${that.url}", request: data: ${JSON.stringify(_data)}`
  //   );
  // }
  // console.log('request.send.cookies:');
  // const cookies = await that.session.cookieStore.getCookies();
  // cookies.forEach(cookie => {
  //     console.log(cookie);
  // });

  if (!attempts) attempts = 0;
  return this._mergeOptions(options)
    .then(opts => {
      return [opts, that._prepareData()];
    })
    .spread((opts, data) => {
      opts = _.defaults(opts, data);
      return that._transform(opts);
    })
    .then(opts => {
      options = opts;
      return [Request.requestClient(options), options, attempts];
    })
    .spread(_.bind(this.beforeParse, this))
    .then(_.bind(this.parseMiddleware, this))
    .then(async response => {
      const json = response.body;
      // if (_.isObject(json))
      //   console.log(
      //     ` request.response: status: ${
      //       response.statusCode
      //     } body: ${JSON.stringify(json)}`
      //   );
      //   console.log('request.response.cookies:');
      //   const cookies = await that.session.cookieStore.getCookies();
      //   cookies.forEach(cookie => {
      //       console.log(cookie);
      //   });
      if (_.isObject(json) && json.status === 'ok')
        return _.omit(response.body, 'status');
      if (
        _.isString(json.message) &&
        json.message.toLowerCase().indexOf('transcode timeout') !== -1
      )
        throw new Exceptions.TranscodeTimeoutError();

      throw new Exceptions.RequestError(json);
    })
    .catch(error => {
      return that.beforeError(error, options, attempts);
    })
    .catch(err => {
      if (err instanceof Exceptions.APIError) throw err;
      if (!err || !err.response) throw err;

      const response = err.response;
      if (response.statusCode === 400) {
        const json = JSON.parse(response.body);
        if (_.isObject(json) && json.two_factor_required === true) {
          console.log('Request: throwing 2f Error');
          throw new Exceptions.TwoFactorError(json, that.session);
        }
      }

      if (response.statusCode === 404)
        throw new Exceptions.NotFoundError(response);
      if (response.statusCode >= 500) {
        if (attempts <= that.attemps) {
          attempts += 1;
          return that.send(options, attempts);
        } else {
          throw new Exceptions.ParseError(response, that);
        }
      } else {
        that.errorMiddleware(response);
      }
    })
    .catch(error => {
      if (error instanceof Exceptions.APIError) throw error;
      error = _.defaults(error, { message: 'Fatal internal error!' });
      throw new Exceptions.RequestError(error);
    })
    .catch(error => {
      return that.afterError(error, options, attempts);
    });
};
