const players = {};

const config = {
    type: Phaser.HEADLESS,
    parent: 'phaser-example',
    width: 800,
    height: 600,
    autoFocus: false,
    physics: {
      default: 'arcade',
      arcade: {
        debug: false,
        gravity: { y: 0 }
      }
    },
    scene: {
      preload: preload,
      create: create,
      update: update
    }
  };
   
  function preload() {
      //Preloads
      this.load.spritesheet('player', 'assets/player.png',{frameWidth: 24, frameHeight: 24});
  }
   
  function create() {
    const self = this;
    this.players = this.physics.add.group();

    io.on('connection', function (socket) {
        console.log('a user connected');        

        // create a new player and add it to our players object
        players[socket.id] = {
            rotation: 0,
            x: Math.floor(Math.random() * 700) + 50,
            y: Math.floor(Math.random() * 500) + 50,
            playerId: socket.id,
            team: (Math.floor(Math.random() * 2) == 0) ? 'red' : 'blue',
            input: [0,0] // X,Y vector
        };
        // add player to server
        addPlayer(self, players[socket.id]);
        // send the players object to the new player
        socket.emit('currentPlayers', players);
        // update all other players of the new player
        socket.broadcast.emit('newPlayer', players[socket.id]);
        socket.on('disconnect', function () {
            console.log('user disconnected');
            // remove player from server
            removePlayer(self, socket.id);
            // remove this player from our players object
            delete players[socket.id];
            // emit a message to all players to remove this player
            io.emit('disconnect', socket.id);
        });
        socket.on('playerInput', function (inputData) {
            intData = convertArrayStringToInteger(inputData);
            handlePlayerInput(self, socket.id, intData);
        });
    });

  }
   
  function update() {
    this.players.getChildren().forEach((player) => {
        const input = players[player.playerId].input;
        let speed = 100;
        player.setVelocity(input[0]*speed,input[1]*speed);
        players[player.playerId].x = player.x;
        players[player.playerId].y = player.y;
        players[player.playerId].rotation = player.rotation;
      });
      this.physics.world.wrap(this.players, 5);
      io.emit('playerUpdates', players);
  }

  function handlePlayerInput(self, playerId, input) {
    self.players.getChildren().forEach((player) => {
      if (playerId === player.playerId) {
        players[player.playerId].input = input;
        
      }
    });
  }
  function convertArrayStringToInteger(a){
    var result = a.map(function (x) { 
        return parseInt(x, 10); 
      });
    return result;
  }
  function addPlayer(self, playerInfo) {
    const player = self.physics.add.sprite(playerInfo.x, playerInfo.y, 'player').setOrigin(0.5, 0.5).setDisplaySize(48, 48);
    // player.setDrag(100);
    // player.setAngularDrag(100);
    player.setMaxVelocity(200);
    player.playerId = playerInfo.playerId;
    self.players.add(player);
  }

  function removePlayer(self, playerId) {
    self.players.getChildren().forEach((player) => {
      if (playerId === player.playerId) {
        player.destroy();
      }
    });
  }
  const game = new Phaser.Game(config);


  window.gameLoaded();

