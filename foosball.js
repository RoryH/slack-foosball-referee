const RtmClient = require('@slack/client').RtmClient;
const MemoryDataStore = require('@slack/client').MemoryDataStore;
const CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS;
const RTM_EVENTS = require('@slack/client').RTM_EVENTS;
const bot_token = process.env.SLACK_FOOSBALL_BOT_TOKEN || '';
const rtm = new RtmClient(bot_token);
const util = require('util');
const msgOps = require('./lib/msg_operations.js');
let rtmConfig = {};
let selfMatcher;
const commandMatcher = new RegExp(`(?:—|--)[^\\s]+`);
const channelMembers = {};

// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload if you want to cache it
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
  rtmConfig = rtmStartData;
  selfMatcher = new RegExp(`<@${rtmConfig.self.id}>`);
  console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}, but not yet connected to a channel`);
});

// you need to wait for the client to fully connect before you can send messages
rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
});

rtm.on(RTM_EVENTS.MESSAGE, function(msg) {
    if (msg.subtype && msg.subtype === 'subtype_changed') {
      msg = msg.message;
    }
    const userCommand = getCommand(msg);
    if (isThisMessageForMe(msg) && userCommand) {
      const matchedCommand = Object.keys(msgOps.commands).find(function(command) {
        return msgOps.commands[command].regex.test(userCommand);
      });
      if (matchedCommand) {
        //console.log(`Matched command: ${matchedCommand}`);
        msgOps.commands[matchedCommand].handler.call(null, rtm, msg, rtmConfig);
      }
    }
});

function isThisMessageForMe(msg) {
  return selfMatcher.test(msg.text);
}

function getCommand(msg) {
  let match;
  if (msg.text) {
    match = msg.text.match(commandMatcher);
  }
  if (!match) {
    return '--help';
  }
  return match && match[0];
}

rtm.start();