var config = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 800,
    height: 600,  
    pixelArt: true,  
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
    this.controls = createControls(self);
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
    
    this.socket.on('playerUpdates', function (players) {
        Object.keys(players).forEach(function (id) {
            self.players.getChildren().forEach(function (player) {
                if (players[id].playerId === player.playerId) {
                    player.setRotation(players[id].rotation);
                    player.setPosition(players[id].x, players[id].y);
                }
            });
        });
    });
}

function update() { 
    let moveStateReqUpdate = false;
    let moveState =[0,0];
    //Movement State update
    //Up/Down Vector
    if(this.controls.W.b.isDown){
        moveStateReqUpdate = true;
        moveState[1] -=1;
    }
    
    if(this.controls.S.b.isDown){
        moveStateReqUpdate = true;
        moveState[1] += 1;
    }
    //Left/Right Vector
    if(this.controls.A.b.isDown){
        moveStateReqUpdate = true;
        moveState[0]-= 1;
    }
    if(this.controls.D.b.isDown){
        moveStateReqUpdate = true;
        moveState[0]+= 1;
    }
    if(moveStateReqUpdate){
        this.socket.emit('playerInput', moveState);
    }

}
function displayPlayers(self, playerInfo, sprite) {
    const player = self.add.sprite(playerInfo.x, playerInfo.y, sprite).setOrigin(0.5, 0.5).setDisplaySize(48, 48);
    // if (playerInfo.team === 'blue') player.setTint(0x0000ff);
    // else player.setTint(0xff0000);
    player.playerId = playerInfo.playerId;
    self.players.add(player);
}
function createControls(scene){
    let controls = {
        W: {b:scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),s:0},
        S: {b:scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),s:0},
        A: {b:scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),s:0},
        D: {b:scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),s:0}
    }
    return controls;
}