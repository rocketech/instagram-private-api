const util = require('util');
const _ = require('lodash');
const fs = require('fs');
const Request = require('../request');
const routes = require('../routes');
const Helpers = require('../../../helpers');
const CONSTANTS = require('../constants');


function WebRequest() {
  Request.apply(this, arguments);
  this._request.headers = _.extend(_.clone(this._request.headers), {
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache'
  });
  this._jsonEndpoint = false;
  delete this._request.headers['X-IG-Connection-Type'];
  delete this._request.headers['X-IG-Capabilities'];
}

util.inherits(WebRequest, Request);

module.exports = WebRequest;
const Exceptions = require('../exceptions');
const Session = require('../session');
const Device = require('../device');

WebRequest.prototype.setResource = function(resource, data) {
  this._resource = resource;
  this.setUrl(routes.getWebUrl(resource, data));
  return this;
};

WebRequest.prototype.setDevice = function(device) {
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

WebRequest.prototype.setJSONEndpoint = function(json) {
  this.setOptions({
    qs: { __a: '1' }
  });
  this._jsonEndpoint = true;
  return this;
};

WebRequest.prototype.setCSRFToken = function(token) {
  this.setHeaders({
    'x-csrftoken': token
  });
  // this.setData({
  //   _csrftoken: token
  // });
  return this;
};

WebRequest.prototype.setHost = function(host) {
  if (!host) host = CONSTANTS.WEB_HOSTNAME;
  this.setHeaders({
    Host: host
  });
  return this;
};

WebRequest.prototype.send = function(options) {
  const that = this;
  // const _data = that._request.data;
  // if (_.isObject(_data)) {
  //   console.log(
  //     `url: "${that.url}", webRequest: data: ${JSON.stringify(
  //       _data
  //     )}`
  //   );
  // }
  //   console.log('webRequest.send.cookies:');
  //   const cookies = await that.session.cookieStore.getCookies();
  //   cookies.forEach(cookie => {
  //       console.log(cookie);
  //   });

  return this._mergeOptions(options)
    .then((opts) => {
      return [opts, that._prepareData()];
    })
    .spread((opts, data) => {
      opts = _.defaults(opts, data);
      return that._transform(opts);
    })
    .then((opts) => {
      options = opts;
      return [Request.requestClient(options), options];
    })
    .spread((response, options) => {
      if (that._jsonEndpoint) {
        const beforeParse = _.bind(that.beforeParse, that);
        const parseMiddleware = _.bind(that.parseMiddleware, that);
        return new Promise(((resolve, reject) => {
          return resolve(beforeParse(response));
        })).then(parseMiddleware);
      }
      return response;
    })
    .then(async (response) => {
      const json = response.body;
      // if (_.isObject(json))
      //   console.log(
      //     `webRequest.response: status: ${
      //       response.statusCode
      //     } body: ${JSON.stringify(json)}`
      //   );
      //   console.log('webRequest.response.cookies:');
      //   const cookies = await that.session.cookieStore.getCookies();
      //   cookies.forEach(cookie => {
      //       console.log(cookie);
      //   });

      if (that._jsonEndpoint) return response.body;
      return response;
    })
    .catch((error) => {
      return that.beforeError(error, options, 0);
    })
    .catch((err) => {
      if (!err || !err.response) throw err;
      const response = err.response;
      if (response.statusCode == 404)
        throw new Exceptions.NotFoundError(response);
      throw err;
    })
    .catch((error) => {
      return that.afterError(error, options, 0);
    });
};
