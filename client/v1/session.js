const util = require('util');
const Resource = require('./resource');
const fs = require('fs');
const _ = require('lodash');
const request = require('request-promise');
const CookieStorage = require('./cookie-storage');
const RequestJar = require('./jar');

function Session(device, storage, proxy) {
  this.setDevice(device);
  this.setCookiesStorage(storage);
  if (_.isString(proxy) && !_.isEmpty(proxy))
    this.proxyUrl = proxy;
}

util.inherits(Session, Resource);
module.exports = Session;

const CONSTANTS = require('./constants');
const Account = require('./account');
const Exceptions = require('./exceptions');
const Request = require('./request');
const Device = require('./device');
const QE = require('./qe');
const Megaphone = require('./megaphone');
const Timeline = require('./feeds/timeline-feed');
const Inbox = require('./feeds/inbox');
const Thread = require('./thread');
const Relationship = require('./relationship');
const Helpers = require('../../helpers');

Object.defineProperty(Session.prototype, 'jar', {
  get() { return this._jar; },
  set(val) {}
});


Object.defineProperty(Session.prototype, 'cookieStore', {
  get() { return this._cookiesStore; },
  set(val) {}
});


Object.defineProperty(Session.prototype, 'device', {
  get() { return this._device; },
  set(val) {}
});


Object.defineProperty(Session.prototype, 'CSRFToken', {
  get() {
    const cookies = this.jar.getCookies(CONSTANTS.HOST);
    const item = _.find(cookies, { key: 'csrftoken' });
    return item ? item.value : 'missing';
  },
  set(val) {}
});

Object.defineProperty(Session.prototype, 'proxyUrl', {
  get() {
    return this._proxyUrl;
  },
  set (val) {
    if (!Helpers.isValidUrl(val) && val !== null)
      throw new Error('`proxyUrl` argument is not an valid url');
    this._proxyUrl = val;
  }
});


Session.prototype.setCookiesStorage = function (storage) {
  if (!(storage instanceof CookieStorage))
    throw new Error('`storage` is not an valid instance of `CookieStorage`');
  this._cookiesStore = storage;
  this._jar = new RequestJar(storage.store);
  return this;
};


Session.prototype.setDevice = function (device) {
  if (!(device instanceof Device))
    throw new Error('`device` is not an valid instance of `Device`');
  this._device = device;
  return this;
};


Session.prototype.getAccountId = function() {
  const that = this;
  return this._cookiesStore.getSessionId()
    .then(() => {
      return that._cookiesStore.getAccountId();
    });
};


Session.prototype.setProxy = function(url) {
  this.proxyUrl = url;
  return this;
};


Session.prototype.getAccount = function () {
  const that = this;
  return that.getAccountId()
    .then((id) => {
      return Account.getById(that, id);
    });
};


Session.prototype.destroy = function () {
  const that = this;
  return new Request(this)
    .setMethod('POST')
    .setResource('logout')
    .generateUUID()
    .send()
    .then((response) => {
      that._cookiesStore.destroy();
      delete that._cookiesStore;
      return response;
    });
};


Session.login = function(session, username, password, uuid) {
  return new Request(session, uuid)
    .setResource('login')
    .setMethod('POST')
    .setUUID(uuid)
    // .generateUUID() //if not set
    .setData({
      username,
      password,
      login_attempt_count: uuid ? '1' : '0'
    })
    .setBodyType('form')
    .signPayload()
    .send()
    .catch((error) => {
      if (error.name == 'RequestError' && _.isObject(error.json)) {
        if (error.json.invalid_credentials)
          throw new Exceptions.AuthenticationError(error.message);
        if (error.json.error_type === 'inactive user')
          throw new Exceptions.AccountBanned(error.json.message + ' ' + error.json.help_url);
      }
      throw error;
    })
    .then(() => {
      return [session, QE.sync(session)];
    })
    .spread((session) => {
      const autocomplete = Relationship.autocompleteUserList(session)
        .catch(Exceptions.RequestsLimitError, () => {
          // autocompleteUserList has ability to fail often
          return false;
        });
      return [session, autocomplete];
    })
    .spread((session) => {
      return [session, new Timeline(session).get()];
    })
    .spread((session) => {
      return [session, Thread.recentRecipients(session)];
    })
    .spread((session) => {
      return [session, new Inbox(session).get()];
    })
    .spread((session) => {
      return [session, Megaphone.logSeenMainFeed(session)];
    })
    .spread((session) => {
      return session;
    })
    .catch(Exceptions.CheckpointError, (error) => {
      // This situation is not really obvious,
      // but even if you got checkpoint error (aka captcha or phone)
      // verification, it is still an valid session unless `sessionid` missing
      return session.getAccountId()
        .then(() => {
          // We got sessionId and accountId, we are good to go
          return session;
        })
        .catch(Exceptions.CookieNotValidError, () => {
          throw error;
        });
    });

};

Session.twoFactorLogin = function(session,  username, password, two_factor_identifier, verification_code) {
  return new Request(session)
    .setResource('twoFactorLogin')
    .setMethod('POST')
    .generateUUID()
    .setData({
      username,
      password,
      verification_code,
      two_factor_identifier
    })
    .signPayload()
    .send()
    .catch((error) => {
      if (error.name == 'RequestError' && _.isObject(error.json)) {
        if (error.json.invalid_credentials)
          throw new Exceptions.AuthenticationError(error.message);
        if (error.json.error_type === 'inactive user')
          throw new Exceptions.AccountBanned(error.json.message + ' ' + error.json.help_url);
      }
      throw error;
    })
    .then(() => {
      return [session, QE.sync(session)];
    })
    .spread((session) => {
      const autocomplete = Relationship.autocompleteUserList(session)
        .catch(Exceptions.RequestsLimitError, () => {
          // autocompleteUserList has ability to fail often
          return false;
        });
      return [session, autocomplete];
    })
    .spread((session) => {
      return [session, new Timeline(session).get()];
    })
    .spread((session) => {
      return [session, Thread.recentRecipients(session)];
    })
    .spread((session) => {
      return [session, new Inbox(session).get()];
    })
    .spread((session) => {
      return [session, Megaphone.logSeenMainFeed(session)];
    })
    .spread((session) => {
      return session;
    })
    .catch(Exceptions.CheckpointError, (error) => {
      // This situation is not really obvious,
      // but even if you got checkpoint error (aka captcha or phone)
      // verification, it is still an valid session unless `sessionid` missing
      return session.getAccountId()
        .then(() => {
          // We got sessionId and accountId, we are good to go
          return session;
        })
        .catch(Exceptions.CookieNotValidError, (e) => {
          throw error;
        });
    });

};

Session.create = function(device, storage, username, password, uuid, proxy) {
  const that = this;
  const session = new Session(device, storage);
  if (_.isString(proxy) && !_.isEmpty(proxy))
    session.proxyUrl = proxy;
  return session.getAccountId()
    .then(() => {
      return session;
    })
    .catch(Exceptions.CookieNotValidError, () => {
      // We either not have valid cookes or authentication is not fain!
      return Session.login(session, username, password, uuid);
    });
};
