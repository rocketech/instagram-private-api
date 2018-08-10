const _ = require('lodash');
const Promise = require('bluebird');
const Exceptions = require('./exceptions');
const hmac = require('crypto-js/hmac-sha256');
const CONSTANTS = require('./constants');
const pruned = require('./json-pruned');


exports.sign = function(payload) {
  const key = CONSTANTS.PRIVATE_KEY;
  const json = _.isString(payload) ? payload : pruned(payload);
  const signed = hmac(json, key.SIG_KEY);
  return new Promise(((resolve, reject) => {
    return resolve({
      signature: signed.toString(),
      appVersion: key.APP_VERSION,
      sigKeyVersion: key.SIG_VERSION,
      payload: json
    });
  }));

};
