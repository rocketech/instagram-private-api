const should = require('should');
const Client = require('../../../client/v1');
const _ = require('lodash');

const shouldBeThread = require('../thread').shouldBeThread;

describe('`InboxPending` class', () => {

  let feed, session;

  before(() => {
    session = require('../../run').session;
    feed = new Client.Feed.InboxPending(session);
  });

  it('should not be problem to get pending threads', (done) => {

    feed.get().then((items) => {
      _.each(items, shouldBeThread);
      feed.isMoreAvailable().should.be.Boolean();
      done();
    });
  });

});
