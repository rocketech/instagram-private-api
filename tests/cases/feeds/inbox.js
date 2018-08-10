const should = require('should');
const Client = require('../../../client/v1');
const Promise = require('bluebird');
const mkdirp = require('mkdirp');
const inquirer = require('inquirer');
const _ = require('lodash');
const fs = require('fs');

const shouldBeThreadItem = require('../thread').shouldBeThreadItem;
const shouldBeThread = require('../thread').shouldBeThread;

let threadBigOne = null;

describe('`Inbox` class', () => {

  let feed, session;

  before(() => {
    session = require('../../run').session;
    feed = new Client.Feed.Inbox(session);
  });

  it('should not be problem to get threads', (done) => {
    let firstDose;
    feed.get()
      .then((threads) => {
        firstDose = threads;
        _.each(threads, shouldBeThread);
        threadBigOne = _.maxBy(threads, (thread) => { return thread.items.length; });
        feed.isMoreAvailable().should.be.Boolean();
        if (feed.isMoreAvailable())
          return feed.get()
            .then((threads) => {
              firstDose[0].id.should.not.be.equal(threads[0].id);
              _.each(threads, shouldBeThread);
              return Promise.resolve();
            });
        else return Promise.resolve();
      })
      .then(() => {
        done();
      });
  });

});



describe('`ThreadItemsFeed` class', () => {

  let feed, session;

  before(() => {
    session = require('../../run').session;
    feed = new Client.Feed.ThreadItems(session, threadBigOne.id);
  });

  it('should not be problem to get items', (done) => {
    feed.get().then((items) => {
      _.each(items, shouldBeThreadItem);
      feed.isMoreAvailable().should.be.Boolean();
      done();
    });
  });

});
