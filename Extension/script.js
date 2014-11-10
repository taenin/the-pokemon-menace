var mysecretvariable=0;
var bot = createBot("taenin", 0, false, false);
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
        //The way to deal with this is to make some global variable "lock"
        //If we get a move demand and "lock" is false, set lock=True
        //Perform movement command. immediately before returning command, set lock=False
        
        originallog.apply(console, arguments);
    }

})();

function pokemon_test(){
	console.log("It works");
}

console.log("injected");

//----------Utility Function: PLACE IN Utils.js--------------------------

function createBot(targetOpponent, gamesToPlay, willStartGames, active){
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
                    move = room.request.active[0].moves[index];
                    if(!move.disabled){
                        this.availableMoves.push([move.id, move.id, "MOVE"]);
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
                room.chooseMove(moveArray[1]);
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
        this.makeRandomMove();
    };
    bot.switchFaintMove = function(){
        this.makeRandomMove();
    };
    bot.previewMove = function(){
        this.makeRandomMove();
    };
    bot.makeRandomMove = function(){
        bot.makeMove(bot.availableMoves[Math.floor(Math.random() * bot.availableMoves.length)]);
    };

    return bot;
}
//------------------------------------------------------------------------------------------------------------------
//----------------------------------------Strategy Bot--------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------

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
                    move = room.request.active[0].moves[index];
                    if(!move.disabled){
                        this.availableMoves.push([move.id, move.id, "MOVE"]);
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
                room.chooseMove(moveArray[1]);
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
        for(var t =0; t<myTypes.length; t++){
            for(var opp = 0; opp<oppTypes.length; opp++){
                dmg = dmg * this.getTypeMultipliers(myTypes[t], oppTypes[opp]);
            }
        }
        return dmg <=1.0;
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
        if(bot.isNotBadMatchup()){
            //if we have a good matchup, stay in and fight
            //Sort our available moves to prioritize hitting the target
            bot.availableMoves.sort(function(a, b){
                if(typeof(a[1]) ==="string" && typeof(b[1])==="string"){
                    admg = bot.calcMoveDmg(a[1]);
                    bdmg = bot.calcMoveDmg(b[1]);
                    if(admg === bdmg){
                        return 0;
                    }
                    return admg > bdmg ? -1 : 1;
                }
                else if(typeof(a[1])==="string" && typeof(b[1])!="string"){
                    return -1;
                }
                else if(typeof(a[1])!="string" && typeof(b[1])==="string"){
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