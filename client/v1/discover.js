const Request = require('./request');
const Helpers = require('../../helpers');
const _ = require('lodash');
const Media = require('./media');
const Account = require('./account');

module.exports = function(session, inSingup) {
  return new Request(session)
    .setMethod('POST')
    .setResource('discoverAyml')
    .generateUUID()
    .setData({
      phone_id: Helpers.generateUUID(),
      in_singup: inSingup ? 'true' : 'false',
      module: 'ayml_recommended_users'
    })
    .send()
    .then((json) => {
      const groups = _.first(json.groups || []);
      const items = groups.items || [];
      return _.map(items, (item) => {
        return {
          account: new Account(session, item.user),
          mediaIds: item.media_ids
        };
      });
    });
};



