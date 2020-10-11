const path = require('path');
const jsdom = require('jsdom');
const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io').listen(server);
const { JSDOM } = jsdom;
 
app.use(express.static(__dirname + '/public'));
 
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});
 
// server.listen(8081, function () {
//   console.log(`Listening on ${server.address().port}`);
// });

function setupAuthoritativePhaser() {
  JSDOM.fromFile(path.join(__dirname, 'authserver/index.html'), {
    // To run the scripts in the html file
    runScripts: "dangerously",
    // Also load supported external resources
    resources: "usable",
    // So requestAnimatinFrame events fire
    pretendToBeVisual: true
  }).then((dom) => {
    dom.window.gameLoaded = () => {
      server.listen(8081, function () {
        console.log(`Listening on ${server.address().port}`);
      });
    };
    dom.window.io = io;
    
  }).catch((error) => {
    console.log(error.message);
  });
}
 
setupAuthoritativePhaser();