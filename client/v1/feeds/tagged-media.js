const _ = require('lodash');
const util = require('util');
const FeedBase = require('./feed-base');

function TaggedMediaFeed(session, tag, limit) {
  this.tag = tag;
  this.limit = parseInt(limit) || null;
  FeedBase.apply(this, arguments);
}
util.inherits(TaggedMediaFeed, FeedBase);

module.exports = TaggedMediaFeed;
const Media = require('../media');
const Request = require('../request');
const Helpers = require('../../../helpers');
const Exceptions = require('../exceptions');

TaggedMediaFeed.prototype.get = function () {
  const that = this;
  return this.session.getAccountId()
    .then((id) => {
      const rankToken = Helpers.buildRankToken(id);
      return new Request(that.session)
        .setMethod('GET')
        .setResource('tagFeed', {
          tag: that.tag,
          maxId: that.getCursor(),
          rankToken
        })
        .send()
        .then((data) => {
          that.moreAvailable = data.more_available && !!data.next_max_id;
          if (!that.moreAvailable && !_.isEmpty(data.ranked_items) && !that.getCursor())
            throw new Exceptions.OnlyRankedItemsError();
          if (that.moreAvailable)
            that.setCursor(data.next_max_id);
          return _.map(data.items, (medium) => {
            return new Media(that.session, medium);
          });
        });
    });
};
