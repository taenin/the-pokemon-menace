
var bot = createStrategyBot("taenin", 0, false, false); //holder for actual bot once inside the console

/*The bots opperate by modifying the native logging function console.log() to send a request to the bot to move.
  Thanks to the helpful logs sent out by the devs, the bot can function solely on the information logged.
*/
(function(){

    var originallog = console.log;

    console.log = function(txt) {
        mysecretvariable=txt;
        if(bot.active){
            if(!bot.inGame){
                //bot is not in-game or waiting for an opponent to accept a game request
                bot.handleWaiting(txt);
            }
            else{
                //match was accepted, currently in a game
                if(!bot.isThinking){
                    bot.isThinking = true;
                    bot.handleBattle(txt);
                }
            }
        }
        //Very important here to log the information given
        //Everytime a log is returned, we go to our parser
        //When the parser is called, it will determine if the
        //log is relevant
        //If the log demands a move, the parser will only move
        //if another move demand has not been issued
        //The way to deal with this is to make some global variable "lock"--in this case, bot.isThinking--
        //If we get a move demand and "lock" is false, set lock=True
        //Perform movement command. immediately before returning command, set lock=False        
        originallog.apply(console, arguments);
    }

})();
console.log("Bot Script Injected Successfuly");
//------------------------------------------------------------------------------------------------------------------
//----------------------------------------Menace Bot--------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------
/**Creates a bot and returns it as a JavaScript object
**targetOpponent: String name of the opponent
**gamesToPlay: Integer number of games to play before termination
**willStartGames: Boolean to determine if the bot is a listener(False) or a requester(True)
**active: Boolean to determine if the bot will respond to server requests
**turnWeighting: Boolean. True if using diminishing returns weights, False for linear weights
**/
function createMenaceBot(targetOpponent, gamesToPlay, willStartGames, active, turnWeighting){
    var bot = {};
    bot.gamesToPlay = gamesToPlay;
    bot.menace = {}; //Map representing MatchBoxes and Beads. Initially Empty
    bot.initBeads = 5;
    bot.reward = 5;
    bot.turnWeighting = turnWeighting ? turnWeighting : false; //True if and only if we are using Diminishing Returns Weighting
    bot.turnReward = 10*bot.reward; //Max reward for Diminishing Returns
    //Menace is a mapping of Strings representing situations to a Mapping of Strings representing actions to integer "beads"
    bot.movesMade=[];
    bot.movesToPunish=[];
    bot.movesToReward=[];
    bot.gamesWon =0;
    bot.gamesLost=0;
    bot.wonLastGame = false;
    bot.lostLastGame = false;
    bot.active = active;
    bot.team = findTeam();
    bot.willStartGames = willStartGames;
    bot.opponent = targetOpponent;
    bot.inGame = false;
    bot.gameState = null;
    bot.isThinking = false;
    bot.availableMoves = [];
    //Format of this.availableMoves: An array of arrays
    //Every sub array is of this form: [BoxName, argument to function, string of function to make move]
    //Where BoxName is the string "key" of the current "MENACE Match Box" to be used

    bot.getWinRate=function(){
        return "Won " + this.gamesWon + ", Lost " + this.gamesLost;
    };
    //Updates the movesToPunish array and resets the movesMade array
    bot.updatePunishList = function(){
        if(this.movesMade.length > 0){
            this.movesToPunish.push(this.movesMade);
            this.movesMade = [];
        }
        
    };
    //Updates the movesToReward array and resets the movesMade array
    bot.updateRewardList = function(){
        if(this.movesMade.length > 0){
           this.movesToReward.push(this.movesMade);
            this.movesMade =[];         
        }

    };
    //For each array of moves to punish, each move is punished based upon the desired weighting scheme.
    //If the result of a punishment would leave less than 1 bead, we leave exactly 1 bead
    bot.punishMenace= function(){
        var weightedPunishment = this.turnWeighting ? Math.ceil(this.turnReward / this.movesToPunish.length) : this.reward;
        for(var boxind = 0; boxind < this.movesToPunish.length; boxind++){
            var miniGame = this.movesToPunish[boxind];
            for(var moveInd=0; moveInd < miniGame.length; moveInd++){
                var situationKey = miniGame[moveInd][0];
                var moveKey = miniGame[moveInd][1];
                //If subtracting 1 from our match boxes gives us less than 1 bead, leave that 1 bead.
                this.menace[situationKey][moveKey] = this.menace[situationKey][moveKey]-weightedPunishment > 1 ? this.menace[situationKey][moveKey]-weightedPunishment: 1;
            }
        }
    };
    //For each array of moves to reward, each move is rewarded based upon the desired weighting scheme.
    bot.rewardMenace= function(){
        var weightedReward = this.turnWeighting ? Math.ceil(this.turnReward / this.movesToReward.length) : this.reward;
        for(var boxind = 0; boxind < this.movesToReward.length; boxind++){
            var miniGame = this.movesToReward[boxind];
            for(var moveInd=0; moveInd < miniGame.length; moveInd++){
                var situationKey = miniGame[moveInd][0];
                var moveKey = miniGame[moveInd][1];
                this.menace[situationKey][moveKey] +=weightedReward;
            }
        }
    };
    //The bot is first rewarded then punished for every minigame won/lost
    bot.updateMenace = function(){
        this.rewardMenace();
        this.punishMenace();
        this.movesToReward = [];
        this.movesToPunish = [];
    };

    //Checks is the current situation exists in the menace. If it does not, the situation is created
    bot.checkCreateMenaceSituation = function(situationKey){
        if(!this.menace[situationKey]){
            this.menace[situationKey] = {};
        }
    };

    //If the menace has experienced this situation but has not seen this move in the situation, the move is added with the default number of beads
    bot.checkCreateMenaceMove = function(situationKey, moveKey){
        if(this.menace[situationKey] && !this.menace[situationKey][moveKey]){
            this.menace[situationKey][moveKey] = this.initBeads;
        }
    };

    //Returns the state as parsed from the server message. Returns "UNKNOWN_STATE" if the message is not relevant to the bot
    //If a valid gamestate is found, this.gameState is updated accordingly. gameState will never be "UNKNOWN_STATE"
    bot.getState = function(msg){
        if(msg.indexOf("|win|" + this.opponent) > -1){
            this.gameState = "MATCH_LOSS";
            this.lostLastGame = true;
            this.updatePunishList();
            this.updateMenace();
            return this.gameState;
        }
        if(msg.indexOf("|win|")>-1){
            this.gameState = "MATCH_WIN";
            this.wonLastGame = true;
            this.updateRewardList();
            this.updateMenace();
            return this.gameState;
        }
        if(msg.indexOf("|teampreview") > -1){
            this.gameState = "TEAM_PREVIEW";
            return this.gameState;
        }
        if(msg.indexOf("|faint|p1") > -1 && msg.indexOf("|faint|p2") > -1){
            this.gameState = "DOUBLE_FAINT";
            return this.gameState;
        }
        if((msg.indexOf("|p1") > -1 || msg.indexOf("|p2") > -1) && msg.indexOf("|turn|") >-1 && msg.indexOf("faint") === -1){
            this.gameState = "NORMAL_TURN";
            return this.gameState;
        }
        if((msg.indexOf("|p1") > -1 || msg.indexOf("|p2") > -1) && msg.indexOf("|faint|" + room.side) > -1){
            //Minigame Loss
            this.updatePunishList();
            this.gameState = "SWITCH_FAINT";
            return this.gameState;
        }
        if((msg.indexOf("|p1") > -1 || msg.indexOf("|p2") > -1) && (msg.indexOf("|faint|p1") > -1 || msg.indexOf("faint|p2") > -1)){
            //Minigame Win
            this.updateRewardList();
        }
        return "UNKNOWN_STATE";
    };

    //Given the current state, populates this.available moves with all valid moves from the current situation
    bot.getValidMoves = function(){
        switch(this.gameState){
            case "TEAM_PREVIEW":
                this.availableMoves = [];
                this.checkCreateMenaceSituation("Preview");
                for(var index = 0; index <room.request.side.pokemon.length; index++){
                    var pkmnKey = "SWITCH " + room.battle.mySide.pokemon[index].speciesid;
                    this.checkCreateMenaceMove("Preview", pkmnKey);
                    this.availableMoves.push([["Preview",pkmnKey], index, "TEAM_PREVIEW"]);
                }
                break;

            case "DOUBLE_FAINT":
                this.availableMoves = [];
                this.checkCreateMenaceSituation("Preview");
                for(var index = 0; index <room.request.side.pokemon.length; index++){
                    var pkmnKey = "SWITCH " + room.battle.mySide.pokemon[index].speciesid;
                    this.checkCreateMenaceMove("Preview", pkmnKey);
                    if(room.request.side.pokemon[index].condition != "0 fnt"){
                        this.availableMoves.push([["Preview",pkmnKey], index, "SWITCH"]);
                    }
                }
                break;

            case "SWITCH_FAINT":
                this.availableMoves = [];
                var situationKey = "FAINT vs. " + room.battle.yourSide.active[0].speciesid
                this.checkCreateMenaceSituation(situationKey);
                for(var index = 0; index <room.request.side.pokemon.length; index++){
                    var pkmnKey = "SWITCH " + room.battle.mySide.pokemon[index].speciesid;
                    this.checkCreateMenaceMove(situationKey, pkmnKey);
                    if(room.request.side.pokemon[index].condition != "0 fnt"){
                        this.availableMoves.push([[situationKey,pkmnKey], index, "SWITCH"]);
                    }
                }
                break;

            case "NORMAL_TURN":
                this.availableMoves = [];
                var situationKey = room.battle.mySide.active[0].speciesid + " vs. " + room.battle.yourSide.active[0].speciesid;
                this.checkCreateMenaceSituation(situationKey);
                for(var index = 0; index <room.request.side.pokemon.length; index++){
                    var pkmnKey = "SWITCH " + room.battle.mySide.pokemon[index].speciesid;
                    this.checkCreateMenaceMove(situationKey, pkmnKey);
                    if(room.request.side.pokemon[index].condition != "0 fnt" && !room.request.side.pokemon[index].active){
                        this.availableMoves.push([[situationKey,pkmnKey], index, "SWITCH"]);
                    }
                }


                for(var index = 0; index < room.request.active[0].moves.length; index++){
                    move = room.request.active[0].moves[index].move.toLowerCase().replace(/ /g, "").replace(/-/g, "");
                    moveKey = "MOVE " + move;
                    if(!room.request.active[0].moves[index].disabled){
                        this.availableMoves.push([[situationKey,moveKey],
                            {"getAttribute": function(d){return this[d]}, "data-move": move, "pos": index+1},
                            "MOVE"]);
                    }
                }

                /*for(var index = 0; index < room.request.active[0].moves.length; index++){
                    move = room.request.active[0].moves[index];
                    moveKey = "MOVE " + move.move.toLowerCase().replace(/ /g, "").replace(/-/g, "");
                    this.checkCreateMenaceMove(situationKey, moveKey);
                    if(!move.disabled){
                        this.availableMoves.push([[situationKey,moveKey], move.move.toLowerCase().replace(/ /g, "").replace(/-/g, ""), "MOVE"]);
                    }
                }*/

                break;

            default:
                this.availableMoves = [];
                break;
        }
    };
    //Handle creating and accepting games. Attributes of the bot are reset to keep track of wins and losses
    bot.handleWaiting = function(msg){
        if(this.willStartGames && this.gamesToPlay > 0){
            this.gamesToPlay -= 1;
            this.gamesWon = this.wonLastGame ? this.gamesWon+1 : this.gamesWon;
            this.gamesLost = this.lostLastGame ? this.gamesLost+1 : this.gamesLost;
            this.wonLastGame = false;
            this.lostLastGame = false;
            this.inGame = true;
            requestBattle(this.opponent, this.team);
        }

        else if(!this.willStartGames && this.gamesToPlay > 0){
            if(msg.indexOf(bot.opponent.toLowerCase()) > -1 && msg.indexOf("updatechallenges") > -1){
                this.gamesWon = this.wonLastGame ? this.gamesWon+1 : this.gamesWon;
                this.gamesLost = this.lostLastGame ? this.gamesLost+1 : this.gamesLost;
                this.wonLastGame = false;
                this.lostLastGame = false;
                this.inGame = true;
                this.gamesToPlay -=1;
                //wait for variables to become defined, then accept invitation
                setTimeout(acceptBattle(this.opponent, this.team), 1000);
            }
        }
        else if(this.gamesToPlay===0){
            this.gamesToPlay = -1;
            this.gamesWon = this.wonLastGame ? this.gamesWon+1 : this.gamesWon;
            this.gamesLost = this.lostLastGame ? this.gamesLost+1 : this.gamesLost;
            this.wonLastGame = false;
            this.lostLastGame = false;
        }
    };
    //Makes a valid move given the current situation
    bot.makeMove = function(moveArray){
        switch(moveArray[2]){
            case "TEAM_PREVIEW":
                this.isThinking = false;
                this.movesMade.push(moveArray[0]);
                room.chooseTeamPreview(moveArray[1]);
                
                //this.gameState = "NORMAL_TURN";
                break;
            case "MOVE":
                this.isThinking = false;
                this.movesMade.push(moveArray[0]);
                room.chooseMove(moveArray[1].pos, moveArray[1]);
                //this.gameState = "NORMAL_TURN";
                break;
            case "SWITCH":
                this.isThinking = false;
                this.movesMade.push(moveArray[0]);
                room.chooseSwitch(moveArray[1]);
                //this.gameState = "NORMAL_TURN";
                break;
            default:
                break;
        }
    };
    //Direccts the bot to the correct handler function based upon the current state of the game
    bot.handleBattle = function(msg){
        if((room && room.request && room.request.side && room.request.side.pokemon)){
            //we probably want to wait for room.choice to become defined--how though?
            if(this.getState(msg)=== "TEAM_PREVIEW"){
                handlePreview();
            }
            else if(this.getState(msg)==="DOUBLE_FAINT"){
                handleSwitchFaint();
            }
            else if(this.getState(msg) === "NORMAL_TURN"){
                handleNormalTurn();
            }
            else if(this.getState(msg) === "SWITCH_FAINT"){
                handleSwitchFaint();
            }
            else if(this.getState(msg) === "MATCH_WIN"){
                handleEndGame();
            }
            else if(this.getState(msg) === "MATCH_LOSS"){
                handleEndGame();
            }
            else{
                this.isThinking = false;
            }
        }
        else{
            this.isThinking = false;
        }
    };

    bot.normalTurnMove = function(){
        var move = this.pickBeadMove();
        this.makeMove(move);
    };
    bot.switchFaintMove = function(){
        var move = this.pickBeadMove();
        this.makeMove(move);
    };
    //Picks a random bead from the boxes provided by availableMoves and returns the corresponding move array
    bot.pickBeadMove = function(){
        var total = 0;
        for(var ind=0; ind<this.availableMoves.length; ind++){
            var move = this.availableMoves[ind];
            total += this.menace[move[0][0]][move[0][1]];
        }
        var bead = Math.floor(Math.random() * total) +1;
        var beadRange=0;
        for(var ind=0; ind<this.availableMoves.length; ind++){
            var move = this.availableMoves[ind];
            beadRange +=this.menace[move[0][0]][move[0][1]];
            if(bead<=beadRange){
                return move;
            }
        }
        return this.availableMoves[0];
    };
    bot.previewMove = function(){
        var move = this.pickBeadMove();
        this.makeMove(move);
    };
    bot.makeRandomMove = function(){
        bot.makeMove(bot.availableMoves[Math.floor(Math.random() * bot.availableMoves.length)]);
    };

    return bot;
}
//------------------------------------------------------------------------------------------------------------------
//----------------------------------------Strategy Bot--------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------
/**Creates a bot and returns it as a JavaScript object
**targetOpponent: String name of the opponent
**gamesToPlay: Integer number of games to play before termination
**willStartGames: Boolean to determine if the bot is a listener(False) or a requester(True)
**active: Boolean to determine if the bot will respond to server requests
**/
function createStrategyBot(targetOpponent, gamesToPlay, willStartGames, active){
    var bot = {};
    bot.gamesToPlay = gamesToPlay;
    bot.active = active;
    bot.team = findTeam();
    bot.willStartGames = willStartGames;
    bot.opponent = targetOpponent;
    bot.inGame = false;
    bot.gameState = null;
    bot.isThinking = false;
    bot.availableMoves = [];
    //Format of this.availableMoves: An array of arrays
    //Every sub array is of this form: [BoxName, argument to function, string of function to make move]
    //Where BoxName is the string "key" of the current "MENACE Match Box" to be used

    bot.getState = function(msg){
        if(msg.indexOf("|win|" + this.opponent) > -1){
            this.gameState = "MATCH_LOSS";
            return this.gameState;
        }
        if(msg.indexOf("|win|")>-1){
            this.gameState = "MATCH_WIN";
            return this.gameState;
        }
        if(msg.indexOf("|teampreview") > -1){
            this.gameState = "TEAM_PREVIEW";
            return this.gameState;
        }
        if(msg.indexOf("|faint|p1") > -1 && msg.indexOf("|faint|p2") > -1){
            this.gameState = "DOUBLE_FAINT";
            return this.gameState;
        }
        if((msg.indexOf("|p1") > -1 || msg.indexOf("|p2") > -1) && msg.indexOf("|turn|") >-1 && msg.indexOf("faint") === -1){
            this.gameState = "NORMAL_TURN";
            return this.gameState;
        }
        if((msg.indexOf("|p1") > -1 || msg.indexOf("|p2") > -1) && msg.indexOf("|faint|" + room.side) > -1){
            this.gameState = "SWITCH_FAINT";
            return this.gameState;
        }
        return "UNKNOWN_STATE";
    };

    bot.getValidMoves = function(){
        switch(this.gameState){
            case "TEAM_PREVIEW":
                this.availableMoves = [];
                for(var index = 0; index <room.request.side.pokemon.length; index++){
                    var pkmn = room.request.side.pokemon[index];
                    var commaIndex = pkmn.details.indexOf(",") > -1 ? pkmn.details.indexOf(",") : pkmn.details.length;
                    this.availableMoves.push([pkmn.details.slice(0, commaIndex), index, "TEAM_PREVIEW"]);
                }
                break;

            case "DOUBLE_FAINT":
                this.availableMoves = [];
                for(var index = 0; index <room.request.side.pokemon.length; index++){
                    var pkmnKey = "SWITCH " + room.battle.mySide.pokemon[index].speciesid;
                    if(room.request.side.pokemon[index].condition != "0 fnt"){
                        this.availableMoves.push([["Preview",pkmnKey], index, "SWITCH"]);
                    }
                }
                break;

            case "SWITCH_FAINT":
                this.availableMoves = [];
                for(var index = 0; index <room.request.side.pokemon.length; index++){
                    if(room.request.side.pokemon[index].condition != "0 fnt"){
                        var pkmn = room.request.side.pokemon[index];
                        var commaIndex = pkmn.details.indexOf(",") > -1 ? pkmn.details.indexOf(",") : pkmn.details.length;
                        this.availableMoves.push([pkmn.details.slice(0, commaIndex), index, "SWITCH"]);
                    }
                }
                break;

            case "NORMAL_TURN":
                this.availableMoves = [];
                for(var index = 0; index <room.request.side.pokemon.length; index++){
                    if(room.request.side.pokemon[index].condition != "0 fnt" && !room.request.side.pokemon[index].active){
                        var pkmn = room.request.side.pokemon[index];
                        var commaIndex = pkmn.details.indexOf(",") > -1 ? pkmn.details.indexOf(",") : pkmn.details.length;
                        this.availableMoves.push([pkmn.details.slice(0, commaIndex), index, "SWITCH"]);
                    }
                }




                for(var index = 0; index < room.request.active[0].moves.length; index++){
                    move = room.request.active[0].moves[index].move.toLowerCase().replace(/ /g, "").replace(/-/g, "");
                    if(!room.request.active[0].moves[index].disabled){
                        this.availableMoves.push([pkmn.details.slice(0, commaIndex),
                            {"getAttribute": function(d){return this[d]}, "data-move": move, "pos": index+1},
                            "MOVE"]);
                    }
                }

                break;

            default:
                this.availableMoves = [];
                break;
        }
    };

    bot.handleWaiting = function(msg){
        if(this.willStartGames && this.gamesToPlay > 0){
            this.gamesToPlay -= 1;
            this.inGame = true;
            requestBattle(this.opponent, this.team);
            
            
        }
        else if(!this.willStartGames && this.gamesToPlay > 0){
            if(msg.indexOf(bot.opponent.toLowerCase()) > -1 && msg.indexOf("updatechallenges") > -1){
                this.inGame = true;
                this.gamesToPlay -=1;
                //wait for variables to become defined, then accept invitation
                setTimeout(acceptBattle(this.opponent, this.team), 1000);
            }
        }
    };
    bot.makeMove = function(moveArray){
        switch(moveArray[2]){
            case "TEAM_PREVIEW":
                this.isThinking = false;
                room.chooseTeamPreview(moveArray[1]);
                
                //this.gameState = "NORMAL_TURN";
                break;
            case "MOVE":
                this.isThinking = false;
                room.chooseMove(moveArray[1].pos, moveArray[1]);
                //this.gameState = "NORMAL_TURN";
                break;
            case "SWITCH":
                this.isThinking = false;
                room.chooseSwitch(moveArray[1]);
                //this.gameState = "NORMAL_TURN";
                break;
            default:
                break;
        }
    };
    bot.handleBattle = function(msg){
        if((room && room.request && room.request.side && room.request.side.pokemon)){
            //we probably want to wait for room.choice to become defined--how though?
            if(this.getState(msg)=== "TEAM_PREVIEW"){
                handlePreview();
                /*setTimeout(function(){
                    bot.getValidMoves();
                    bot.makeMove(bot.availableMoves[Math.floor(Math.random() * bot.availableMoves.length)]);
                }, 1000); */
            }
            else if(this.getState(msg) === "NORMAL_TURN"){
                handleNormalTurn();
            }
            else if(this.getState(msg) === "SWITCH_FAINT"){
                handleSwitchFaint();
            }
            else if(this.getState(msg) === "DOUBLE_FAINT"){
                handleDoubleFaint();
            }
            else if(this.getState(msg) === "MATCH_WIN"){
                handleEndGame();
            }
            else if(this.getState(msg) === "MATCH_LOSS"){
                handleEndGame();
            }
            else{
                this.isThinking = false;
            }
        }
        else{
            this.isThinking = false;
        }

    };

    bot.isNotBadMatchup= function(){
        var myTypes = room.battle.mySide.pokemon[0].types;
        var oppTypes = room.battle.yourSide.active[0].types;
        dmg = 1.0;
        numPokemonRemaining=0;
        for(var t =0; t<myTypes.length; t++){
            for(var opp = 0; opp<oppTypes.length; opp++){
                dmg = dmg * this.getTypeMultipliers(myTypes[t], oppTypes[opp]);
            }
        }
        //Check to see if there is only one pokemon remaining
        for(var index = 0; index <room.request.side.pokemon.length; index++){
            if(room.request.side.pokemon[index].condition != "0 fnt"){
                numPokemonRemaining+=1;
            }
        }
        return dmg <=1.0 || numPokemonRemaining===1;
    };
    bot.matchupValue= function(pokeID){
        //returns a measure of how well your opponent's active pokemon does against pokeID
        //a high number indicates your opponent does very well
        var myTypes = BattlePokedex[pokeID].types;
        var oppTypes = room.battle.yourSide.active[0].types;
        dmg = 1.0;
        for(var t =0; t<myTypes.length; t++){
            for(var opp = 0; opp<oppTypes.length; opp++){
                dmg = dmg * this.getTypeMultipliers(myTypes[t], oppTypes[opp]);
            }
        }
        return dmg;
    };

    bot.matchupValueReversed= function(pokeID){
        //returns a measure of how well pokeID does against your opponents active pokemon
        //a higher number indicates your pokemon does very well
        var myTypes = BattlePokedex[pokeID].types;
        var oppTypes = room.battle.yourSide.active[0].types;
        dmg = 1.0;
        for(var t =0; t<myTypes.length; t++){
            for(var opp = 0; opp<oppTypes.length; opp++){
                dmg = dmg * this.getTypeMultipliers(oppTypes[opp], myTypes[t]);
            }
        }
        return dmg;
    };
    bot.getTypeMultipliers = function(defenderType, attackerType){
        switch(BattleTypeChart[defenderType].damageTaken[attackerType]){
            case 0:
                return 1.0;
                break;
            case 1:
                return 2.0;
                break;
            case 2:
                return 0.5;
                break;
            case 3:
                return 0.0;
                break;
        }
    };
    bot.calcMoveDmg = function(moveID){
        var myTypes = room.battle.mySide.pokemon[0].types;
        var oppTypes = room.battle.yourSide.active[0].types;
        var moveType = BattleMovedex[moveID].type;
        var basedmg = BattleMovedex[moveID].basePower;
        if(BattleMovedex[moveID].basePowerCallback){
            if(BattleMovedex[moveID].basePowerCallback.length ===1){
                basedmg = BattleMovedex[moveID].basePowerCallback(room.battle.mySide.pokemon[0]);
            }
            else if(BattleMovedex[moveID].basePowerCallback.length ===2){
                basedmg = BattleMovedex[moveID].basePowerCallback(room.battle.mySide.pokemon[0], room.battle.yourSide.active[0]);
            }
        }
        var stabBonus = myTypes.indexOf(moveType) > -1;
        for(var opp =0; opp < oppTypes.length; opp++){
            basedmg = this.getTypeMultipliers(oppTypes[opp], moveType) * basedmg;
        }
        return stabBonus ? 1.5 * basedmg : basedmg;
    };
    bot.normalTurnMove = function(){
        if(bot.isNotBadMatchup() || bot.noBetterMatchup()){ // || nobettermatchup
            //if we have a good matchup, stay in and fight
            //Sort our available moves to prioritize hitting the target
            bot.availableMoves.sort(function(a, b){
                if(typeof(a[1]) ==="object" && typeof(b[1])==="object"){
                    admg = bot.calcMoveDmg(a[1]['data-move']);
                    bdmg = bot.calcMoveDmg(b[1]['data-move']);
                    if(admg === bdmg){
                        return 0;
                    }
                    return admg > bdmg ? -1 : 1;
                }
                else if(typeof(a[1])==="object" && typeof(b[1])!="object"){
                    return -1;
                }
                else if(typeof(a[1])!="object" && typeof(b[1])==="object"){
                    return 1;
                }
                return 0;
            });
            bot.makeMove(bot.availableMoves[0]);
        }
        else{
            bot.switchFaintMove();
        }
    };
    bot.noBetterMatchup = function(){
        myTeam = [];
        active = room.battle.mySide.active[0].speciesid;
        admg = bot.matchupValue(active);
        ares = bot.matchupValueReversed(active);
        aTotal = admg/ares;
        bestMatchup = active;
        for(var index = 0; index <room.battle.mySide.pokemon.length; index++){
            if(room.request.side.pokemon[index].condition != "0 fnt"){
                var pkmn = room.battle.mySide.pokemon[index].speciesid;
                bdmg = bot.matchupValue(pkmn);
                bres = bot.matchupValueReversed(pkmn);
                bestMatchup = (bdmg/bres) < aTotal ? pkmn : bestMatchup;
            }
        }
        return active === bestMatchup;
    };
    bot.switchFaintMove = function(){
        bot.availableMoves.sort(function(a, b){
            if(typeof(a[1]) ==="number" && typeof(b[1])==="number"){
                admg = bot.matchupValue(room.battle.mySide.pokemon[a[1]].speciesid);
                ares = bot.matchupValueReversed(room.battle.mySide.pokemon[a[1]].speciesid);
                bdmg = bot.matchupValue(room.battle.mySide.pokemon[b[1]].speciesid);
                bres = bot.matchupValueReversed(room.battle.mySide.pokemon[b[1]].speciesid);
                aTotal = admg/ares;
                bTotal = bdmg/bres;
                if(aTotal === bTotal){
                    return 0;
                }
                return aTotal > bTotal ? 1 : -1;
            }
            else if(typeof(a[1])==="number" && typeof(b[1])!="number"){
                return -1;
            }
            else if(typeof(a[1])!="number" && typeof(b[1])==="number"){
                return 1;
            }
            return 0;
        });
        bot.makeMove(bot.availableMoves[0]);
    };
    bot.previewMove = function(){
        this.makeRandomMove();
    };
    bot.doubleFaintMove = function(){
        this.makeRandomMove();
    }
    bot.makeRandomMove = function(){
        bot.makeMove(bot.availableMoves[Math.floor(Math.random() * bot.availableMoves.length)]);
    };

    return bot;
}
//------------------------------------------------------------------------------------------------------------------
//----------------------------------------Menace PLAY TESTING Bot--------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------
/**Creates a bot and returns it as a JavaScript object
**targetOpponent: String name of the opponent
**gamesToPlay: Integer number of games to play before termination
**willStartGames: Boolean to determine if the bot is a listener(False) or a requester(True)
**active: Boolean to determine if the bot will respond to server requests
**menace: Object. Must be a menace extracted from a previously trained bot
**/
function createPlayTestBot(targetOpponent, gamesToPlay, willStartGames, active, menace){
    var bot = {};
    bot.gamesToPlay = gamesToPlay;
    bot.menace = menace;
    bot.initBeads = 5;
    bot.reward = 5;
    //Menace is a mapping of Strings representing situations to a Mapping of Strings representing actions to integer "beads"
    bot.movesMade=[];
    bot.movesToPunish=[];
    bot.movesToReward=[];
    bot.gamesWon =0;
    bot.gamesLost=0;
    bot.wonLastGame = false;
    bot.lostLastGame = false;
    bot.active = active;
    bot.team = findTeam();
    bot.willStartGames = willStartGames;
    bot.opponent = targetOpponent;
    bot.inGame = false;
    bot.gameState = null;
    bot.isThinking = false;
    bot.availableMoves = [];
    //Format of this.availableMoves: An array of arrays
    //Every sub array is of this form: [BoxName, argument to function, string of function to make move]
    //Where BoxName is the string "key" of the current "MENACE Match Box" to be used

    bot.getWinRate=function(){
        return "Won " + this.gamesWon + ", Lost " + this.gamesLost;
    };
    bot.updatePunishList = function(){
        if(this.movesMade.length > 0){
            this.movesToPunish.push(this.movesMade);
            this.movesMade = [];
        }
        
    };
    bot.updateRewardList = function(){
        if(this.movesMade.length > 0){
           this.movesToReward.push(this.movesMade);
            this.movesMade =[];         
        }

    };
    bot.punishMenace= function(){
        var weightedPunishment = this.turnWeighting ? Math.ceil(this.turnReward / this.movesToPunish.length) : this.reward;
        for(var boxind = 0; boxind < this.movesToPunish.length; boxind++){
            var miniGame = this.movesToPunish[boxind];
            for(var moveInd=0; moveInd < miniGame.length; moveInd++){
                var situationKey = miniGame[moveInd][0];
                var moveKey = miniGame[moveInd][1];
                //If subtracting 1 from our match boxes gives us less than 1 bead, leave that 1 bead.
                this.menace[situationKey][moveKey] = this.menace[situationKey][moveKey]-weightedPunishment > 1 ? this.menace[situationKey][moveKey]-weightedPunishment: 1;
            }
        }
    };
    bot.rewardMenace= function(){
        var weightedReward = this.turnWeighting ? Math.ceil(this.turnReward / this.movesToReward.length) : this.reward;
        for(var boxind = 0; boxind < this.movesToReward.length; boxind++){
            var miniGame = this.movesToReward[boxind];
            for(var moveInd=0; moveInd < miniGame.length; moveInd++){
                var situationKey = miniGame[moveInd][0];
                var moveKey = miniGame[moveInd][1];
                this.menace[situationKey][moveKey] +=weightedReward;
            }
        }
    };
    bot.updateMenace = function(){
        this.rewardMenace();
        this.punishMenace();
        this.movesToReward = [];
        this.movesToPunish = [];
    };


    bot.checkCreateMenaceSituation = function(situationKey){
        if(!this.menace[situationKey]){
            this.menace[situationKey] = {};
        }
    };
    bot.checkCreateMenaceMove = function(situationKey, moveKey){
        if(this.menace[situationKey] && !this.menace[situationKey][moveKey]){
            this.menace[situationKey][moveKey] = this.initBeads;
        }
    };
    bot.getState = function(msg){
        if(msg.indexOf("|win|" + this.opponent) > -1){
            this.gameState = "MATCH_LOSS";
            this.lostLastGame = true;
            this.updatePunishList();
            return this.gameState;
        }
        if(msg.indexOf("|win|")>-1){
            this.gameState = "MATCH_WIN";
            this.wonLastGame = true;
            this.updateRewardList();
            return this.gameState;
        }
        if(msg.indexOf("|teampreview") > -1){
            this.gameState = "TEAM_PREVIEW";
            return this.gameState;
        }
        if(msg.indexOf("|faint|p1") > -1 && msg.indexOf("|faint|p2") > -1){
            this.gameState = "DOUBLE_FAINT";
            return this.gameState;
        }
        if((msg.indexOf("|p1") > -1 || msg.indexOf("|p2") > -1) && msg.indexOf("|turn|") >-1 && msg.indexOf("faint") === -1){
            this.gameState = "NORMAL_TURN";
            return this.gameState;
        }
        if((msg.indexOf("|p1") > -1 || msg.indexOf("|p2") > -1) && msg.indexOf("|faint|" + room.side) > -1){
            //Minigame Loss
            this.updatePunishList();
            this.gameState = "SWITCH_FAINT";
            return this.gameState;
        }
        if((msg.indexOf("|p1") > -1 || msg.indexOf("|p2") > -1) && (msg.indexOf("|faint|p1") > -1 || msg.indexOf("faint|p2") > -1)){
            //Minigame Win
            this.updateRewardList();
        }
        return "UNKNOWN_STATE";
    };

    bot.getValidMoves = function(){
        switch(this.gameState){
            case "TEAM_PREVIEW":
                this.availableMoves = [];
                this.checkCreateMenaceSituation("Preview");
                for(var index = 0; index <room.request.side.pokemon.length; index++){
                    var pkmnKey = "SWITCH " + room.battle.mySide.pokemon[index].speciesid;
                    this.checkCreateMenaceMove("Preview", pkmnKey);
                    this.availableMoves.push([["Preview",pkmnKey], index, "TEAM_PREVIEW"]);
                }
                break;

            case "DOUBLE_FAINT":
                this.availableMoves = [];
                this.checkCreateMenaceSituation("Preview");
                for(var index = 0; index <room.request.side.pokemon.length; index++){
                    var pkmnKey = "SWITCH " + room.battle.mySide.pokemon[index].speciesid;
                    this.checkCreateMenaceMove("Preview", pkmnKey);
                    if(room.request.side.pokemon[index].condition != "0 fnt"){
                        this.availableMoves.push([["Preview",pkmnKey], index, "SWITCH"]);
                    }
                }
                break;

            case "SWITCH_FAINT":
                this.availableMoves = [];
                var situationKey = "FAINT vs. " + room.battle.yourSide.active[0].speciesid
                this.checkCreateMenaceSituation(situationKey);
                for(var index = 0; index <room.request.side.pokemon.length; index++){
                    var pkmnKey = "SWITCH " + room.battle.mySide.pokemon[index].speciesid;
                    this.checkCreateMenaceMove(situationKey, pkmnKey);
                    if(room.request.side.pokemon[index].condition != "0 fnt"){
                        this.availableMoves.push([[situationKey,pkmnKey], index, "SWITCH"]);
                    }
                }
                break;

            case "NORMAL_TURN":
                this.availableMoves = [];
                var situationKey = room.battle.mySide.active[0].speciesid + " vs. " + room.battle.yourSide.active[0].speciesid;
                this.checkCreateMenaceSituation(situationKey);
                for(var index = 0; index <room.request.side.pokemon.length; index++){
                    var pkmnKey = "SWITCH " + room.battle.mySide.pokemon[index].speciesid;
                    this.checkCreateMenaceMove(situationKey, pkmnKey);
                    if(room.request.side.pokemon[index].condition != "0 fnt" && !room.request.side.pokemon[index].active){
                        this.availableMoves.push([[situationKey,pkmnKey], index, "SWITCH"]);
                    }
                }

                for(var index = 0; index < room.request.active[0].moves.length; index++){
                    move = room.request.active[0].moves[index].move.toLowerCase().replace(/ /g, "").replace(/-/g, "");
                    moveKey = "MOVE " + move;
                    if(!room.request.active[0].moves[index].disabled){
                        this.availableMoves.push([[situationKey,moveKey],
                            {"getAttribute": function(d){return this[d]}, "data-move": move, "pos": index+1},
                            "MOVE"]);
                    }
                }

                /*
                for(var index = 0; index < room.request.active[0].moves.length; index++){
                    move = room.request.active[0].moves[index];
                    moveKey = "MOVE " + move.move.toLowerCase().replace(/ /g, "").replace(/-/g, "");
                    this.checkCreateMenaceMove(situationKey, moveKey);
                    if(!move.disabled){
                        this.availableMoves.push([[situationKey,moveKey], move.move.toLowerCase().replace(/ /g, "").replace(/-/g, ""), "MOVE"]);
                    }
                }*/

                break;

            default:
                this.availableMoves = [];
                break;
        }
    };

    bot.handleWaiting = function(msg){
        if(this.willStartGames && this.gamesToPlay > 0){
            this.gamesToPlay -= 1;
            this.gamesWon = this.wonLastGame ? this.gamesWon+1 : this.gamesWon;
            this.gamesLost = this.lostLastGame ? this.gamesLost+1 : this.gamesLost;
            this.wonLastGame = false;
            this.lostLastGame = false;
            this.inGame = true;
            requestBattle(this.opponent, this.team);
            
            
        }
        else if(!this.willStartGames && this.gamesToPlay > 0){
            if(msg.indexOf(bot.opponent.toLowerCase()) > -1 && msg.indexOf("updatechallenges") > -1){
                this.gamesWon = this.wonLastGame ? this.gamesWon+1 : this.gamesWon;
                this.gamesLost = this.lostLastGame ? this.gamesLost+1 : this.gamesLost;
                this.wonLastGame = false;
                this.lostLastGame = false;
                this.inGame = true;
                this.gamesToPlay -=1;
                //wait for variables to become defined, then accept invitation
                setTimeout(acceptBattle(this.opponent, this.team), 1000);
            }
        }
        else if(this.gamesToPlay===0){
            this.gamesToPlay = -1;
            this.gamesWon = this.wonLastGame ? this.gamesWon+1 : this.gamesWon;
            this.gamesLost = this.lostLastGame ? this.gamesLost+1 : this.gamesLost;
            this.wonLastGame = false;
            this.lostLastGame = false;
        }
    };
    bot.makeMove = function(moveArray){
        switch(moveArray[2]){
            case "TEAM_PREVIEW":
                this.isThinking = false;
                this.movesMade.push(moveArray[0]);
                room.chooseTeamPreview(moveArray[1]);
                
                //this.gameState = "NORMAL_TURN";
                break;
            case "MOVE":
                this.isThinking = false;
                this.movesMade.push(moveArray[0]);
                room.chooseMove(moveArray[1].pos, moveArray[1]);
                //this.gameState = "NORMAL_TURN";
                break;
            case "SWITCH":
                this.isThinking = false;
                this.movesMade.push(moveArray[0]);
                room.chooseSwitch(moveArray[1]);
                //this.gameState = "NORMAL_TURN";
                break;
            default:
                break;
        }
    };
    bot.handleBattle = function(msg){
        if((room && room.request && room.request.side && room.request.side.pokemon)){
            //we probably want to wait for room.choice to become defined--how though?
            if(this.getState(msg)=== "TEAM_PREVIEW"){
                handlePreview();
                /*setTimeout(function(){
                    bot.getValidMoves();
                    bot.makeMove(bot.availableMoves[Math.floor(Math.random() * bot.availableMoves.length)]);
                }, 1000); */
            }
            else if(this.getState(msg)==="DOUBLE_FAINT"){
                handleSwitchFaint();
            }
            else if(this.getState(msg) === "NORMAL_TURN"){
                handleNormalTurn();
            }
            else if(this.getState(msg) === "SWITCH_FAINT"){
                handleSwitchFaint();
            }
            else if(this.getState(msg) === "MATCH_WIN"){
                handleEndGame();
            }
            else if(this.getState(msg) === "MATCH_LOSS"){
                handleEndGame();
            }
            else{
                this.isThinking = false;
            }
        }
        else{
            this.isThinking = false;
        }

    };

    bot.isNotBadMatchup= function(){
        var myTypes = room.battle.mySide.pokemon[0].types;
        var oppTypes = room.battle.yourSide.active[0].types;
        dmg = 1.0;
        numPokemonRemaining=0;
        for(var t =0; t<myTypes.length; t++){
            for(var opp = 0; opp<oppTypes.length; opp++){
                dmg = dmg * this.getTypeMultipliers(myTypes[t], oppTypes[opp]);
            }
        }
        //Check to see if there is only one pokemon remaining
        for(var index = 0; index <room.request.side.pokemon.length; index++){
            if(room.request.side.pokemon[index].condition != "0 fnt"){
                numPokemonRemaining+=1;
            }
        }
        return dmg <=1.0 || numPokemonRemaining===1;
    };
    bot.matchupValue= function(pokeID){
        //returns a measure of how well your opponent's active pokemon does against pokeID
        //a high number indicates your opponent does very well
        var myTypes = BattlePokedex[pokeID].types;
        var oppTypes = room.battle.yourSide.active[0].types;
        dmg = 1.0;
        for(var t =0; t<myTypes.length; t++){
            for(var opp = 0; opp<oppTypes.length; opp++){
                dmg = dmg * this.getTypeMultipliers(myTypes[t], oppTypes[opp]);
            }
        }
        return dmg;
    };

    bot.matchupValueReversed= function(pokeID){
        //returns a measure of how well pokeID does against your opponents active pokemon
        //a higher number indicates your pokemon does very well
        var myTypes = BattlePokedex[pokeID].types;
        var oppTypes = room.battle.yourSide.active[0].types;
        dmg = 1.0;
        for(var t =0; t<myTypes.length; t++){
            for(var opp = 0; opp<oppTypes.length; opp++){
                dmg = dmg * this.getTypeMultipliers(oppTypes[opp], myTypes[t]);
            }
        }
        return dmg;
    };
    bot.getTypeMultipliers = function(defenderType, attackerType){
        switch(BattleTypeChart[defenderType].damageTaken[attackerType]){
            case 0:
                return 1.0;
                break;
            case 1:
                return 2.0;
                break;
            case 2:
                return 0.5;
                break;
            case 3:
                return 0.0;
                break;
        }
    };
    bot.calcMoveDmg = function(moveID){
        var myTypes = room.battle.mySide.pokemon[0].types;
        var oppTypes = room.battle.yourSide.active[0].types;
        var moveType = BattleMovedex[moveID].type;
        var basedmg = BattleMovedex[moveID].basePower;
        if(BattleMovedex[moveID].basePowerCallback){
            if(BattleMovedex[moveID].basePowerCallback.length ===1){
                basedmg = BattleMovedex[moveID].basePowerCallback(room.battle.mySide.pokemon[0]);
            }
            else if(BattleMovedex[moveID].basePowerCallback.length ===2){
                basedmg = BattleMovedex[moveID].basePowerCallback(room.battle.mySide.pokemon[0], room.battle.yourSide.active[0]);
            }
        }
        var stabBonus = myTypes.indexOf(moveType) > -1;
        for(var opp =0; opp < oppTypes.length; opp++){
            basedmg = this.getTypeMultipliers(oppTypes[opp], moveType) * basedmg;
        }
        
        return stabBonus ? 1.5 * basedmg : basedmg;
    };
    bot.normalTurnMove = function(){
        var move = this.pickBestMove();
        this.makeMove(move);
    };
    bot.noBetterMatchup = function(){
        myTeam = [];
        active = room.battle.mySide.active[0].speciesid;
        admg = bot.matchupValue(active);
        ares = bot.matchupValueReversed(active);
        aTotal = admg/ares;
        bestMatchup = active;
        for(var index = 0; index <room.battle.mySide.pokemon.length; index++){
            if(room.request.side.pokemon[index].condition != "0 fnt"){
                var pkmn = room.battle.mySide.pokemon[index].speciesid;
                bdmg = bot.matchupValue(pkmn);
                bres = bot.matchupValueReversed(pkmn);
                bestMatchup = (bdmg/bres) < aTotal ? pkmn : bestMatchup;
            }
        }
        return active === bestMatchup;
    };
    bot.switchFaintMove = function(){
        var move = this.pickBeadMove();
        this.makeMove(move);
    };

    bot.pickBestMove = function(){
        var allTied = true;
        var best = 0;
        var move = this.availableMoves[0];
        for(var ind=0; ind<this.availableMoves.length; ind++){
            var newmove = this.availableMoves[ind];
            if(best < this.menace[newmove[0][0]][newmove[0][1]]){
                allTied = false;
                best = this.menace[newmove[0][0]][newmove[0][1]];
                move = newmove;
            }
        }
        move = allTied ? bot.availableMoves[Math.floor(Math.random() * bot.availableMoves.length)] : move;
        return move;
    };

    //Picks a random bead from the boxes provided by availableMoves and returns the corresponding move array
    bot.pickBeadMove = function(){
        var total = 0;
        for(var ind=0; ind<this.availableMoves.length; ind++){
            var move = this.availableMoves[ind];
            total += this.menace[move[0][0]][move[0][1]];
        }
        var bead = Math.floor(Math.random() * total) +1;
        var beadRange=0;
        for(var ind=0; ind<this.availableMoves.length; ind++){
            var move = this.availableMoves[ind];
            beadRange +=this.menace[move[0][0]][move[0][1]];
            if(bead<=beadRange){
                return move;
            }
        }
        return this.availableMoves[0];
    };
    bot.previewMove = function(){
        var move = this.pickBestMove();;
        this.makeMove(move);
    };
    bot.makeRandomMove = function(){
        bot.makeMove(bot.availableMoves[Math.floor(Math.random() * bot.availableMoves.length)]);
    };

    return bot;
}
//---------------------------------------------------------------------------------------------------------------------

function handlePreview(){
    if(room.choice && room.choice.teamPreview){
        bot.getValidMoves();
        bot.previewMove();
    }
    else{
        setTimeout(handlePreview, 1000);
    }
}

function handleEndGame(){
    setTimeout(function(){
        room.close();
        bot.inGame = false;
        bot.isThinking = false;
        console.log("Start Next Game");
    }, 2000);
}

function handleNormalTurn(){
    if(room.choice && room.choice.switchFlags && room.choice.choices && room.choice.switchOutFlags){
        bot.getValidMoves();
        bot.normalTurnMove();
    }
    else{
        setTimeout(handleNormalTurn, 1000);
    }
}
function handleDoubleFaint(){
    if(room.choice && room.choice.canSwitch){
        bot.getValidMoves();
        bot.doubleFaintMove();
    }
    else{
        setTimeout(handleDoubleFaint, 1000);
    }
}
function handleSwitchFaint(){
    if(room.choice && room.choice.canSwitch){
        bot.getValidMoves();
        bot.switchFaintMove();
    }
    else{
        setTimeout(handleSwitchFaint, 1000);
    }
}

//--------------------------------------------------------------------------------------

/**playerName is a String representing the name of the target player
 **team is a team object */
function requestBattle(playerName, team){
    room.challenge(playerName, "ou", team);
    app.sendTeam(team);
    app.send("/challenge " + playerName + ", ou");
}

/**opponent is a String representing the name of the target opponent
 **team is a team object */
function acceptBattle(opponent, team){
    app.sendTeam(team);
    app.send("/accept " + opponent);
}

/**Iterates through the player's teams
 **Returns the correct team object if it exist, otherwise returns an empty object 
 **A correct team will have the team name "MENACE"*/
function findTeam(){
    for(var teamIndex=0; teamIndex < Storage.teams.length; teamIndex++){
        if(Storage.teams[teamIndex].name === "MENACE"){
            return Storage.teams[teamIndex].team;
        }
    }
    return {};
}

function getEnemyActivePokemon(){
    return room.battle.yourSide.active[0].baseSpecies;
}