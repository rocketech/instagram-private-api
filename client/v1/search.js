const _ = require('lodash');
const Request = require('./request');
const Helpers = require('../../helpers');
const Account = require('./account');
const Hashtag = require('./hashtag');
const Location = require('./location');

module.exports = function (session, query) {
  return session.getAccountId()
    .then((id) => {
      return new Request(session)
        .setMethod('GET')
        .setResource('topSearch', {
          rankToken: Helpers.buildRankToken(id).toUpperCase(),
          query
        })
        .send();
    })
    .then((json) => {
      const users = json.users.map((user) => {
        return {
          user: new Account(session, user.user),
          position: user.position
        };
      });
      const places = json.places.map((place) => {
        return {
          place: new Location(session, place.place),
          position: place.position
        };
      });
      const hashtags = json.hashtags.map((hashtag) => {
        return {
          hashtag: new Hashtag(session, hashtag.hashtag),
          position: hashtag.position
        };
      });

      return {
        users,
        places,
        hashtags
      };
    });
};
