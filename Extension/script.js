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
        if(msg.search("|teampreview") > -1){
            this.gameState = "TEAM_PREVIEW";
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
                    var commaIndex = pkmn.details.search(",") > -1 ? pkmn.details.search(",") : pkmn.details.length;
                    this.availableMoves.push([pkmn.details.slice(0, commaIndex), index, "TEAM_PREVIEW"]);
                }
                break;

            case "SWITCH_FAINT":
                this.availableMoves = [];
                break;

            case "NORMAL_TURN":
                this.availableMoves = [];
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
            if(msg.search(bot.opponent) > -1 && msg.search("updatechallenges") > -1){
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
                room.chooseTeamPreview(moveArray[1]);
                this.isThinking = false;
                this.gameState = "NORMAL_TURN";
                break;
            case "MOVE":
                room.chooseMove(moveArray[1]);
                this.isThinking = false;
                this.gameState = "NORMAL_TURN";
                break;
            case "SWITCH":
                room.chooseSwitch(moveArray[1]);
                this.isThinking = false;
                this.gameState = "NORMAL_TURN";
                break;
            default:
                break;
        }
    };
    bot.handleBattle = function(msg){
        if((room && room.request && room.request.side && room.request.side.pokemon)){
            //we probably want to wait for room.choice to become defined--how though?
            if(this.getState(msg) === "TEAM_PREVIEW"){
                setTimeout(function(){
                    bot.getValidMoves();
                    bot.makeMove(bot.availableMoves[Math.floor(Math.random() * bot.availableMoves.length)]);
                }, 1000);
            }
        }
        else{
            this.isThinking = false;
        }

    };

    bot.makeRandomMove = function(msg){

    };

    return bot;
}

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