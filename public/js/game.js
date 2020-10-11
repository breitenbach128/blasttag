var config = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 800,
    height: 600,    
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

var game = new Phaser.Game(config);

function preload() {
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 24, frameHeight: 24 });
}

function create() {
    var self = this;
    this.socket = io();
    this.players = this.physics.add.group();

    this.socket.on('currentPlayers', function (players) {
        Object.keys(players).forEach(function (id) {
            if (players[id].playerId === self.socket.id) {
                displayPlayers(self, players[id], 'player');
            } else {
                displayPlayers(self, players[id], 'player');
            }
        });
    });

    this.socket.on('newPlayer', function (playerInfo) {
        displayPlayers(self, playerInfo, 'player');
    });

    this.socket.on('disconnect', function (playerId) {
        self.players.getChildren().forEach(function (player) {
            if (playerId === player.playerId) {
                player.destroy();
            }
        });
    });
}

function update() { }

function displayPlayers(self, playerInfo, sprite) {
    const player = self.add.sprite(playerInfo.x, playerInfo.y, sprite).setOrigin(0.5, 0.5).setDisplaySize(48, 48);
    // if (playerInfo.team === 'blue') player.setTint(0x0000ff);
    // else player.setTint(0xff0000);
    player.playerId = playerInfo.playerId;
    self.players.add(player);
}