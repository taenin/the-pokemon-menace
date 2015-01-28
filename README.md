# The Pokémon Menace

###Overview

The Pokémon Menace utilizes a modified implementation of [Donald Michie's](http://en.wikipedia.org/wiki/Donald_Michie) MENACE in an attempt to learn the turn based game Pokémon. The bot is currently implemented as an extension for Google Chrome that injects code directly into the browser, so gameplay is only support on [Pokémon Showdown](http://pokemonshowdown.com/).

##Setup
1. Clone the repo or download the Extension folder
2. Using Google Chrome, navigate to your extensions page: `chrome://extensions/`.  
 Enable developer mode, load an unpacked extension (select the "Extension" folder you previously downloaded), and disable developer mode.

##Using the Extension
To use the extension, open [Pokémon Showdown](http://pokemonshowdown.com/) and select "Play Online".
Open the Chrome console and verify that the extension is functioning correctly. Amongst other messages, you should see:

`Bot Script Injected Successfuly`
###Creating a Name
The bot must have a name to play games. There are no restrictions on player names, but sometimes Pokémon Showdown does not play well with whitespace characters. Create a name using the "Choose name" button in the upper right-hand corner.
###Creating a Team
For the bot to function correctly, you must create a Pokémon team with the name "MENACE". You can do so in the Teambuilder tab of the Pokémon Showdown GUI.

Two of the teams I used in my preliminary experiments are included in pokemon_team.txt

###Creating a Bot
To create a bot, open the Chrome console and type:  

	> bot = createMenaceBot(foo)
The same syntax is used if you want to create a strategy bot:  
	> bot = createStrategyBot(foo)
or create a bot with learning disabled using another bot's knowledge base:  
	> bot = createPlayTestBot(foo)
If you create a bot that will start games, you must manually start the first game by logging information in the console.  
	> console.log('foo')
Note that any log commands in the console after the bot is created will result in the bot attempting to start its first game.