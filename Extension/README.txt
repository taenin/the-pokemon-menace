We know pokemon showdown uses jQuery, so there is no need to inject it with our custom extension in chrome.

We can use $.ajax calls to run python scripts on a local server. We will have to either run our own apache server, or simply modify the existing python -m SimpleHTTPServer 8000

The injected code from our extension will work as a "listener" of sorts. We will locally parse any console.log() that comes out to determine if it influences our game 

Depending on what information we can send/receive via ajax, it may be simplest to have the main bot written in JavasScript, with the learning and hypothesis generation handled by python. 