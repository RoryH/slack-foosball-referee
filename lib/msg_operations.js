module.exports = function() {
  const _ = require('lodash');
  const util = require('util');
  const initGameState = {
        currentPlayers: [],
        currentOpenGame: false
      };
  const gameStates = {};

  function getRoomGameState(channelId) {
    if (!gameStates[channelId]) {
      gameStates[channelId] = _.clone(initGameState, true);
    }

    return gameStates[channelId];
  }

  function isUserInCurrentGame(userObj, channelId) {
    var gameState = getRoomGameState(channelId);
    return !!_.find(gameState.currentPlayers, function(player) {
      return player === userObj;
    });
  }

  function getRealUserName(rtm, userId) {
    const user = rtm.dataStore.getUserById(userId);
    return user.real_name || user.name
  }

  function getReferenceWithRealName(rtm, userId) {
    const user = rtm.dataStore.getUserById(userId);
    return `<@${userId}|${user.name}>`;
  }

  const commands = {
      newgame : {
        regex: /^(?:--|—)new$/i,
        handler: function (rtm, message) {
          var gameState = getRoomGameState(message.channel);
          if (!gameState.currentOpenGame) {
            gameState.currentPlayers = [];
            gameState.currentOpenGame = true;
            gameState.currentPlayers.push(message.user);
            return rtm.sendMessage(`${getReferenceWithRealName(rtm, message.user)} just started a new game. Message me "--y" to join the game.`, message.channel);
          } else {
            return rtm.sendMessage(`${getReferenceWithRealName(rtm, message.user)}, there is already an open game waiting for ${ 4 - gameState.currentPlayers.length} player(s), use --hard-new command to force a new game. Use --y to join the game.`, message.channel);
          }
        }
      },
      hardnew: {
        regex: /^(?:--|—)hard-new$/i,
        handler: function (rtm, message) {
          var gameState = getRoomGameState(message.channel);
          gameState.currentPlayers = [];
          gameState.currentPlayers.push(message.user);
          gameState.currentOpenGame = true;
          rtm.sendMessage(`${getReferenceWithRealName(rtm, message.user)} just forced a new game. Message "--y" to join the game.`, message.channel);
        }
      },
      status: {
        regex: /(?:--|—)status$/i,
        handler: function (rtm, message) {
          var gameState = getRoomGameState(message.channel);
          if (!gameState.currentOpenGame) {
            rtm.sendMessage('No current game.', message.channel);
          } else {
            var playersStr = gameState.currentPlayers.map(function(i) {
              return getRealUserName(rtm, i);
            }).join(', ');
            rtm.sendMessage(`Game currently needs ${4 - gameState.currentPlayers.length} more player(s). Players in are: ${playersStr}`, message.channel);
          }
        }
      },
      help: {
        regex: /^(?:--|—)help$/i,
        handler: function (rtm, message) {
          const helpMsg = [];
          helpMsg.push('*Foosball referee, available commands.*');
          helpMsg.push('');
          helpMsg.push('*--new* Begins a new game)');
          helpMsg.push('*--hard-new* Forces new game to reset current state ');
          helpMsg.push('*--y* Add yourself to the open game ');
          helpMsg.push('*--y @user* Adds @user to the open game ');
          helpMsg.push('*--n* Removes yourself from the current game. ');
          helpMsg.push('*--n @user* Removes @user from current game. ');
          helpMsg.push('*--status* Status of current game being organised. ');
          helpMsg.push('*--help* This message! ');
          rtm.sendMessage(helpMsg.join('\n'), message.channel);
        }
      },
      joingame: {
        regex: /(?:--|—)y(?:\s+<@(\w+)>\s*)?$/i,
        handler: function (rtm, message) {
          var gameState = getRoomGameState(message.channel),
              self = this,
              newPlayerMatch = message.text.match(commands.joingame.regex);
              newPlayer = newPlayerMatch && newPlayerMatch[1];
          if (!gameState.currentOpenGame) {
            rtm.sendMessage(`${getReferenceWithRealName(rtm, message.user)} there is no open game, use "--new" to begin a new game.`, message.channel);
          } else {
            if (newPlayer) {   //adding another user to the game.
              if (!isUserInCurrentGame(message.user, message.channel)) {
                rtm.sendMessage(`${getReferenceWithRealName(rtm, message.user)}, you need to be in the game to add or remove players.`, message.channel);
                return;
              } else if (rtm.dataStore.getUserById(newPlayer).is_bot) {
                rtm.sendMessage(`If only bots could play foosball :cry: :glitch_crab:`, message.channel);
                return
              }
            } else if (!newPlayer) {
              newPlayer = message.user;
            }

            if (gameState.currentPlayers.length > 0 && gameState.currentPlayers.filter(function(i) { return i === newPlayer; }).length > 0) {
              rtm.sendMessage(`${getReferenceWithRealName(rtm, newPlayer)} is already signed up for the current game.`, message.channel);
              return;
            }

            if (message.user !== newPlayer) {
              rtm.sendMessage(`${getReferenceWithRealName(rtm, message.user)} has added ${getReferenceWithRealName(rtm, newPlayer)} to the game.`, message.channel);
            }

            gameState.currentPlayers.push(newPlayer);

            if (gameState.currentPlayers.length == 4) {
              var players = gameState.currentPlayers.map(function(i) { return getReferenceWithRealName(rtm, i); });
              players = _.shuffle(players);
              gameState.currentOpenGame = false;
              rtm.sendMessage(`:soccer: :bell: Game On!  ${players.slice(0,2).join(' &amp; ')} - Vs - ${players.slice(2,4).join(' &amp; ')}`, message.channel);
            } else {
              rtm.sendMessage(`${getReferenceWithRealName(rtm, newPlayer)} you are now in the game. Waiting on ${4 - gameState.currentPlayers.length} player(s).`, message.channel);;
            }
          }
        }
      },
      leavegame: {
        regex: /(?:--|—)n(?:\s+<@(\w+)>\s*)?$/i,
        handler: function (rtm, message) {
          var gameState = getRoomGameState(message.channel),
            playerToRemoveMatch = message.text.match(commands.leavegame.regex);
            playerToRemove = playerToRemoveMatch && playerToRemoveMatch[1];
          if (gameState.currentPlayers.length > 0) {    //check number of players... as we want to allow players leave after a game is setup.
            if (playerToRemove) {
              if (!isUserInCurrentGame(message.user, message.channel)) {
                rtm.sendMessage(`${getReferenceWithRealName(rtm, message.user)}, you need to be in the game to add or remove players.`, message.channel);
                return;
              }
            } else if (!playerToRemove) {
              playerToRemove = message.user;
            }

            if (!gameState.currentPlayers.includes(playerToRemove)) {
              rtm.sendMessage(`${getReferenceWithRealName(rtm, message.user)}, player ${getReferenceWithRealName(rtm, playerToRemove)} is not in the current game.`, message.channel);
            }

            for (var i=0; i < gameState.currentPlayers.length; i++) {
              if (gameState.currentPlayers[i] === playerToRemove) {

                if (playerToRemove !== message.user) {
                  rtm.sendMessage(`${getReferenceWithRealName(rtm, message.user)} just removed ${getReferenceWithRealName(rtm, playerToRemove)} from the game.`, message.channel);
                  //game opened again as player left
                  gameState.currentOpenGame = true;
                }

                gameState.currentPlayers.splice(i,1);
                if (gameState.currentPlayers.length >= 1) {
                  rtm.sendMessage(`${getReferenceWithRealName(rtm, playerToRemove)} , you are now REMOVED from the game.`, message.channel);
                } else {
                  rtm.sendMessage(`${getReferenceWithRealName(rtm, playerToRemove)} , you are now REMOVED from the game. There are no other players, Game closed.`, message.channel);
                  gameState.currentOpenGame = false;
                }
                break;
              }
            }
          }
        }
      }
    };


  return {
    getGameState: function(channel) {
      return gameStates[channel];
    },
    commands: commands,
    resetGameState: function(channel) {
      //used in unit tests
      gameStates[channel] = _.clone(initGameState, true);
    }
  };
}();
