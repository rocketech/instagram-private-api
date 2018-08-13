//const _ = require('lodash');
const errors = require('request-promise/errors');
const Promise = require('bluebird');
const util = require('util');

//const Session = require('../session');
//const routes = require('../routes');
//const CONSTANTS = require('../constants');
const WebRequest = require('./web-request');
const Request = require('../request');
//const Helpers = require('../../../helpers');
const Exceptions = require('../exceptions');
//const ORIGIN = CONSTANTS.WEBHOST.slice(0, -1); // Trailing / in origin

// iPhone probably works best, even from android previosly done request
const iPhoneUserAgent =
  'Instagram 19.0.0.27.91 (iPhone6,1; iPhone OS 9_3_1; en_US; en; scale=2.00; gamut=normal; 640x1136) AppleWebKit/420+';
//const iPhoneUserAgentHtml =
('Mozilla/5.0 (iPhone; CPU iPhone OS 9_3_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Mobile/13E238 Instagram 10.28.0 (iPhone6,1; iPhone OS 9_3_1; en_US; en; scale=2.00; gamut=normal; 640x1136)');

// const EMAIL_FIELD_REGEXP = /email.*value(.*)"/i;
// const PHONE_FIELD_REGEXP = /sms.*value(.*)"/i;
// const PHONE_ENTERED_FIELD_REGEXP = /tel.*value="(\+\d+)"/i;
// const RESET_FIELD_REGEXP = /reset_progress_form.*action="\/(.*)"/i;
//const SHARED_JSON_REGEXP = /window._sharedData = (.*);<\/script>/i;

const Challenge = function(challengeError) {
  this.json = challengeError.json;
  this._session = challengeError.session;
  this._challengeError = challengeError;
  this.apiUrl =
    'https://i.instagram.com/api/v1' + challengeError.json.challenge.api_path;
  this._uuid = challengeError.uuid;
  this.step = 'none';
  this.step_data = '';
};

// we need change json over steps...
// Object.defineProperty(Challenge.prototype, 'json', {
//   get() {
//     return this._json;
//   },
//   set() {}
// });

Object.defineProperty(Challenge.prototype, 'session', {
  get() {
    return this._session;
  },
  set() {}
});

Object.defineProperty(Challenge.prototype, 'challengeError', {
  get() {
    return this._challengeError;
  },
  set() {}
});

Object.defineProperty(Challenge.prototype, 'uuid', {
  get() {
    return this._uuid;
  },
  set() {}
});

Challenge.prototype.reset = function() {
  const that = this;

  return new Request(that.session)
    .setMethod('POST')
    .setBodyType('form')
    .setUrl(that.apiUrl.replace('/challenge/', '/challenge/reset/'))
    .setHeaders({
      'User-Agent': iPhoneUserAgent
    })
    .signPayload()
    .send({ followRedirect: true })
    .catch(error => {
      throw error; //return error.response;
    })
    .then(json => {
      // let json = null;
      // try {
      //   json = JSON.parse(response.body);
      // } catch (error) {
      //   throw new TypeError('Invalid response. JSON expected');
      // }
      that.json = json;
      that.step = json.step_name;
      that.stepData = json.step_data;
      return that;
    });
};

Challenge.prototype.select = function(methodId) {
  const that = this;

  return Promise.resolve(this).then(() => {
    return (
      new WebRequest(that.session)
        .setMethod('POST')
        .setUrl(that.apiUrl)
        .setHeaders({
          'User-Agent': iPhoneUserAgent
        })
        .setData({
          choice: methodId
        })
        .send({ followRedirect: true })
        //we need catch 400 status to extract response.body.json
        .catch(errors.StatusCodeError, error => {
          let json;
          if (
            error.response.body.indexOf(
              'url=instagram://checkpoint/dismiss'
            ) !== -1
          )
            throw new Exceptions.NoChallengeRequired(
              that.session,
              'DismissRequestedByInstagram'
            );

          try {
            json = JSON.parse(error.response.body);
          } catch (err) {
            throw new TypeError('Invalid response. JSON expected');
          }
          if (json.challenge && json.challenge.native_flow === false)
            throw new Error('Native flow not implemented'); //return that.resolveHtml(checkpointError, defaultMethod);
          //Challenge is not required
          if (json.status === 'ok' && json.action === 'close')
            throw new Exceptions.NoChallengeRequired(that.session, 'statusOk'); //TODO: fix it!
        })
        .then(webResponse => {
          let json = null;
          try {
            json = JSON.parse(webResponse.body);
          } catch (error) {
            throw new TypeError('Invalid response. JSON expected');
          }
          that.json = json;
          that.step = json.step_name;
          that.stepData = json.step_data;
          return that;
        })
    );
  });
};

Challenge.prototype.applyCode = function(code) {
  const that = this;
  if (!code || code.length !== 6) throw new Error('Invalid code provided');
  return new WebRequest(that.session)
    .setMethod('POST')
    .setUrl(that.apiUrl)
    .setHeaders({
      'User-Agent': iPhoneUserAgent
    })
    .setBodyType('form')
    .setData({
      security_code: code
    })
    .removeHeader('x-csrftoken')
    .send({ followRedirect: false })
    .then(response => {
      let json;
      try {
        json = JSON.parse(response.body);
      } catch (e) {
        throw new TypeError('Invalid response. JSON expected');
      }
      if (
        response.statusCode === 200 &&
        json.status === 'ok' &&
        (json.action === 'close' ||
          json.location === 'instagram://checkpoint/dismiss')
      ) {
        that.json = json;
        that.step = 'success';
        that.stepData = '';
        return that;
      }
      throw new Exceptions.NotPossibleToResolveChallenge(
        'Unknown error',
        Exceptions.NotPossibleToResolveChallenge.CODE.UNKNOWN
      );
    })
    .catch(errors.StatusCodeError, error => {
      if (error.statusCode === 400)
        throw new Exceptions.NotPossibleToResolveChallenge(
          'Verification has not been accepted',
          Exceptions.NotPossibleToResolveChallenge.CODE.NOT_ACCEPTED
        );
      throw error;
    });
};

exports.Challenge = Challenge;

// Challenge.prototype.resolve = function(
//   checkpointError,
//   defaultMethod,
//   skipResetStep
// ) {
//   const that = this;
//   // checkpointError =
//   //   checkpointError instanceof Exceptions.CheckpointError
//   //     ? checkpointError
//   //     : checkpointError.json;
//   // if (!this.apiUrl)
//   this.apiUrl =
//     'https://i.instagram.com/api/v1' + checkpointError.json.challenge.api_path;
//   if (typeof defaultMethod === 'undefined') defaultMethod = 'email';
//   if (!(checkpointError instanceof Exceptions.CheckpointError))
//     throw new Error(
//       '`Challenge.resolve` method must get exception (type of `CheckpointError`) as a first argument'
//     );
//   if (['email', 'phone'].indexOf(defaultMethod) === -1)
//     throw new Error('Invalid default method');
//   const session = checkpointError.session;

//   return new Promise((res, rej) => {
//     // eslint-disable-line
//     // eslint-disable-line
//     if (skipResetStep) return res();
//     return res(that.reset(checkpointError));
//   })
//     .then(() => {
//       return new WebRequest(session)
//         .setMethod('GET')
//         .setUrl(that.apiUrl)
//         .setHeaders({
//           'User-Agent': iPhoneUserAgent
//         })
//         .send({ followRedirect: true });
//     })
//     .catch(errors.StatusCodeError, error => {
//       return error.response;
//     })
//     .then(response => {
//       let json = null;
//       try {
//         json = JSON.parse(response.body);
//       } catch (e) {
//         if (response.body.indexOf('url=instagram://checkpoint/dismiss') !== -1)
//           throw new Exceptions.NoChallengeRequired(session, 'indexofDismiss');
//         throw new TypeError('Invalid response. JSON expected');
//       }
//       //Using html unlock if native is not supported
//       if (json.challenge && json.challenge.native_flow === false)
//         return that.resolveHtml(checkpointError, defaultMethod);
//       //Challenge is not required
//       if (json.status === 'ok' && json.action === 'close')
//         throw new Exceptions.NoChallengeRequired(session, 'statusOk');

//       //Using API-version of challenge
//       switch (json.step_name) {
//       case 'select_verify_method': {
//         return new WebRequest(session)
//           .setMethod('POST')
//           .setUrl(that.apiUrl)
//           .setHeaders({
//             'User-Agent': iPhoneUserAgent
//           })
//           .setData({
//             choice: defaultMethod === 'email' ? 1 : 0
//           })
//           .send({ followRedirect: true })
//           .then(() => {
//             return that.resolve(checkpointError, defaultMethod, true);
//           });
//       }
//       case 'verify_code':
//       case 'submit_phone': {
//         return new PhoneVerificationChallenge(
//           session,
//           'phone',
//           checkpointError,
//           json
//         );
//       }
//       case 'verify_email': {
//         return new EmailVerificationChallenge(
//           session,
//           'email',
//           checkpointError,
//           json
//         );
//       }
//       default:
//         return new NotImplementedChallenge(
//           session,
//           json.step_name,
//           checkpointError,
//           json
//         );
//       }
//     });
// };

// Challenge.resolveHtml = function(checkpointError, defaultMethod) {
//   //Using html version
//   const that = this;
//   if (!(checkpointError instanceof Exceptions.CheckpointError))
//     throw new Error(
//       '`Challenge.resolve` method must get exception (type of `CheckpointError`) as a first argument'
//     );
//   if (['email', 'phone'].indexOf(defaultMethod) === -1)
//     throw new Error('Invalid default method');
//   const session = checkpointError.session;

//   return new WebRequest(session)
//     .setMethod('GET')
//     .setUrl(checkpointError.url)
//     .setHeaders({
//       'User-Agent': iPhoneUserAgentHtml,
//       Referer: checkpointError.url
//     })
//     .send({ followRedirect: true })
//     .catch(errors.StatusCodeError, error => {
//       return error.response;
//     })
//     .then(parseResponse);

//   function parseResponse(response) {
//     let json, challenge, choice;
//     try {
//       if (response.headers['content-type'] === 'application/json') {
//         json = JSON.parse(response.body);
//         challenge = json;
//       } else {
//         json = JSON.parse(SHARED_JSON_REGEXP.exec(response.body)[1]);
//         challenge = json.entry_data.Challenge[0];
//       }
//     } catch (e) {
//       throw new TypeError('Invalid response. JSON expected');
//     }
//     if (defaultMethod === 'email') {
//       choice = challenge.fields.email ? 1 : 0;
//     } else if (defaultMethod === 'phone') {
//       choice = challenge.fields.phone_number ? 0 : 1;
//     }

//     switch (challenge.challengeType) {
//     case 'SelectVerificationMethodForm': {
//       return new WebRequest(session)
//         .setMethod('POST')
//         .setUrl(checkpointError.url)
//         .setHeaders({
//           'User-Agent': iPhoneUserAgentHtml,
//           Referer: checkpointError.url,
//           'Content-Type': 'application/x-www-form-urlencoded',
//           'X-Instagram-AJAX': 1
//         })
//         .setData({
//           choice
//         })
//         .send({ followRedirect: true })
//         .then(() => {
//           return that.resolveHtml(checkpointError, defaultMethod);
//         });
//     }
//     case 'VerifyEmailCodeForm': {
//       return new EmailVerificationChallenge(
//         session,
//         'email',
//         checkpointError,
//         json
//       );
//     }
//     case 'VerifySMSCodeForm': {
//       return new PhoneVerificationChallenge(
//         session,
//         'phone',
//         checkpointError,
//         json
//       );
//     }
//     default:
//       return new NotImplementedChallenge(
//         session,
//         challenge.challengeType,
//         checkpointError,
//         json
//       );
//     }
//   }
// };

//WARNING: This is NOT backward compatible code since most methods are not needed anymore. But you are free to make it backward compatible :)
//How does it works now?
//Well, we have two ways of resolving challange. Native and html versions.
//First of all we reset the challenge. Just to make sure we start from beginning;
//After if we check if we can use native api version. If not - using html;
//Selecting method and sending code is diffenent, depending on native or html style.
//As soon as we got the code we can confirm it using Native version.
//Oh, and code confirm is same now for email and phone checkpoints

// Challenge.resolve = function(checkpointError, defaultMethod, skipResetStep) {
//   const that = this;
//   // checkpointError =
//   //   checkpointError instanceof Exceptions.CheckpointError
//   //     ? checkpointError
//   //     : checkpointError.json;
//   // if (!this.apiUrl)
//   this.apiUrl =
//     'https://i.instagram.com/api/v1' + checkpointError.json.challenge.api_path;
//   if (typeof defaultMethod === 'undefined') defaultMethod = 'email';
//   if (!(checkpointError instanceof Exceptions.CheckpointError))
//     throw new Error(
//       '`Challenge.resolve` method must get exception (type of `CheckpointError`) as a first argument'
//     );
//   if (['email', 'phone'].indexOf(defaultMethod) === -1)
//     throw new Error('Invalid default method');
//   const session = checkpointError.session;

//   return new Promise((res, rej) => {
//     // eslint-disable-line
//     // eslint-disable-line
//     if (skipResetStep) return res();
//     return res(that.reset(checkpointError));
//   })
//     .then(() => {
//       return new WebRequest(session)
//         .setMethod('GET')
//         .setUrl(that.apiUrl)
//         .setHeaders({
//           'User-Agent': iPhoneUserAgent
//         })
//         .send({ followRedirect: true });
//     })
//     .catch(errors.StatusCodeError, error => {
//       return error.response;
//     })
//     .then(response => {
//       let json = null;
//       try {
//         json = JSON.parse(response.body);
//       } catch (e) {
//         if (response.body.indexOf('url=instagram://checkpoint/dismiss') !== -1)
//           throw new Exceptions.NoChallengeRequired(session, 'indexofDismiss');
//         throw new TypeError('Invalid response. JSON expected');
//       }
//       //Using html unlock if native is not supported
//       if (json.challenge && json.challenge.native_flow === false)
//         return that.resolveHtml(checkpointError, defaultMethod);
//       //Challenge is not required
//       if (json.status === 'ok' && json.action === 'close')
//         throw new Exceptions.NoChallengeRequired(session, 'statusOk');

//       //Using API-version of challenge
//       switch (json.step_name) {
//       case 'select_verify_method': {
//         return new WebRequest(session)
//           .setMethod('POST')
//           .setUrl(that.apiUrl)
//           .setHeaders({
//             'User-Agent': iPhoneUserAgent
//           })
//           .setData({
//             choice: defaultMethod === 'email' ? 1 : 0
//           })
//           .send({ followRedirect: true })
//           .then(() => {
//             return that.resolve(checkpointError, defaultMethod, true);
//           });
//       }
//       case 'verify_code':
//       case 'submit_phone': {
//         return new PhoneVerificationChallenge(
//           session,
//           'phone',
//           checkpointError,
//           json
//         );
//       }
//       case 'verify_email': {
//         return new EmailVerificationChallenge(
//           session,
//           'email',
//           checkpointError,
//           json
//         );
//       }
//       default:
//         return new NotImplementedChallenge(
//           session,
//           json.step_name,
//           checkpointError,
//           json
//         );
//       }
//     });
// };
// Challenge.resolveHtml = function(checkpointError, defaultMethod) {
//   //Using html version
//   const that = this;
//   if (!(checkpointError instanceof Exceptions.CheckpointError))
//     throw new Error(
//       '`Challenge.resolve` method must get exception (type of `CheckpointError`) as a first argument'
//     );
//   if (['email', 'phone'].indexOf(defaultMethod) === -1)
//     throw new Error('Invalid default method');
//   const session = checkpointError.session;

//   return new WebRequest(session)
//     .setMethod('GET')
//     .setUrl(checkpointError.url)
//     .setHeaders({
//       'User-Agent': iPhoneUserAgentHtml,
//       Referer: checkpointError.url
//     })
//     .send({ followRedirect: true })
//     .catch(errors.StatusCodeError, error => {
//       return error.response;
//     })
//     .then(parseResponse);

//   function parseResponse(response) {
//     let json, challenge, choice;
//     try {
//       if (response.headers['content-type'] === 'application/json') {
//         json = JSON.parse(response.body);
//         challenge = json;
//       } else {
//         json = JSON.parse(SHARED_JSON_REGEXP.exec(response.body)[1]);
//         challenge = json.entry_data.Challenge[0];
//       }
//     } catch (e) {
//       throw new TypeError('Invalid response. JSON expected');
//     }
//     if (defaultMethod === 'email') {
//       choice = challenge.fields.email ? 1 : 0;
//     } else if (defaultMethod === 'phone') {
//       choice = challenge.fields.phone_number ? 0 : 1;
//     }

//     switch (challenge.challengeType) {
//     case 'SelectVerificationMethodForm': {
//       return new WebRequest(session)
//         .setMethod('POST')
//         .setUrl(checkpointError.url)
//         .setHeaders({
//           'User-Agent': iPhoneUserAgentHtml,
//           Referer: checkpointError.url,
//           'Content-Type': 'application/x-www-form-urlencoded',
//           'X-Instagram-AJAX': 1
//         })
//         .setData({
//           choice
//         })
//         .send({ followRedirect: true })
//         .then(() => {
//           return that.resolveHtml(checkpointError, defaultMethod);
//         });
//     }
//     case 'VerifyEmailCodeForm': {
//       return new EmailVerificationChallenge(
//         session,
//         'email',
//         checkpointError,
//         json
//       );
//     }
//     case 'VerifySMSCodeForm': {
//       return new PhoneVerificationChallenge(
//         session,
//         'phone',
//         checkpointError,
//         json
//       );
//     }
//     default:
//       return new NotImplementedChallenge(
//         session,
//         challenge.challengeType,
//         checkpointError,
//         json
//       );
//     }
//   }
// };

// function PhoneVerificationChallenge(session, type, checkpointError, json) {
//   this.submitPhone = json.step_name === 'submit_phone';
//   Challenge.apply(this, arguments); // eslint-disable-line
// }

// //Confirming phone number.
// //We need to return PhoneVerificationChallenge that can be able to request code.
// //So, if we need to submit phone number first - let's do it. If not - just return current PhoneVerificationChallenge;
// PhoneVerificationChallenge.prototype.phone = function(phone) {
//   const that = this;
//   if (!this.submitPhone) return Promise.resolve(this);
//   const instaPhone =
//     that.json && that.json.step_data ? that.json.step_data.phone_number : null;
//   const _phone = phone || instaPhone;
//   if (!_phone) return new Error('Invalid phone number');
//   console.log('Requesting phone');
//   return new WebRequest(that.session)
//     .setMethod('POST')
//     .setUrl(that.apiUrl)
//     .setHeaders({
//       'User-Agent': iPhoneUserAgent
//     })
//     .setBodyType('form')
//     .setData({
//       phone_number: _phone
//     })
//     .removeHeader('x-csrftoken')
//     .send({ followRedirect: false })
//     .then(response => {
//       let json;
//       try {
//         json = JSON.parse(response.body);
//       } catch (e) {
//         throw new TypeError('Invalid response. JSON expected');
//       }
//       return new PhoneVerificationChallenge(
//         that.session,
//         'phone',
//         that.error,
//         json
//       );
//     });
// };
// util.inherits(PhoneVerificationChallenge, Challenge);
// exports.PhoneVerificationChallenge = PhoneVerificationChallenge;

// function EmailVerificationChallenge(...params) {
//   Challenge.call(this, ...params);
// }

// util.inherits(EmailVerificationChallenge, Challenge);
// exports.EmailVerificationChallenge = EmailVerificationChallenge;

// function NotImplementedChallenge(...params) {
//   Challenge.call(this, ...params);
//   throw new Error(
//     'Not implemented, due to missing account for testing, please write me on email `ivan.ivan.90.90@gmail.com`'
//   );
// }
// util.inherits(NotImplementedChallenge, Challenge);
// exports.NotImplementedChallenge = NotImplementedChallenge;
