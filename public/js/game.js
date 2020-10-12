var config = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: 640,
    height: 640,  
    pixelArt: true,  
    physics: {
        default: 'arcade',
        arcade: {
          debug: true,
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

    //Map Assets  
    this.load.tilemapTiledJSON('map1', 'assets/map1.json'); 
    this.load.spritesheet('tileset', 'assets/tileset.png', {frameWidth: 16, frameHeight: 16});
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
                    //Anims
                    if(players[id].input[1] < 0){
                        player.anims.play('player-walk-up',true);
                    }else if (players[id].input[1] > 0){
                        player.anims.play('player-walk-down',true);
                    }else{
                        player.anims.play('player-idle-down',true);

                    }
                }
            });
        });
    });
    //Create Map
    this.map = this.make.tilemap({key: 'map1'});  
    let tsImage = this.map.addTilesetImage('tileset','tileset',16,16,0,0);
    this.map.createStaticLayer('main', tsImage, 0, 0).setDepth(0);
    //Collision Layer
    let hullsLayer = this.map.getObjectLayer('walls');
    hullsLayer.objects.forEach(e=>{
        let shapeObject = this.add.rectangle(e.x + (e.width / 2), e.y + (e.height / 2),e.width, e.height,0xFF0000,0.3).setDepth(100);        
        this.physics.add.existing(shapeObject);
    });

    //Creat animations
    createAnims(this);
    //MoveState Variables
    this.prevMoveState = [0,0];
    //Camera
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);  
    this.cameras.main.setBackgroundColor('#000000'); 
    this.cameras.main.roundPixels = true;
    this.cameras.main.setZoom(2.00);

}

function update() { 
    let moveState =[0,0];
    //Movement State update
    //Up/Down Vector
    if(this.controls.W.b.isDown){
        moveState[1] -=1;
    }
    
    if(this.controls.S.b.isDown){
        moveState[1] += 1;
    }
    //Left/Right Vector
    if(this.controls.A.b.isDown){
        moveState[0]-= 1;
    }
    if(this.controls.D.b.isDown){
        moveState[0]+= 1;
    }


    if(this.prevMoveState[0] != moveState[0] || this.prevMoveState[1] != moveState[1]){
        this.socket.emit('playerInput', moveState);
    }


    this.prevMoveState = moveState;

}
function displayPlayers(self, playerInfo, sprite) {
    const player = self.add.sprite(playerInfo.x, playerInfo.y, sprite).setOrigin(0.5, 0.5).setDisplaySize(48, 48);
    // if (playerInfo.team === 'blue') player.setTint(0x0000ff);
    // else player.setTint(0xff0000);
    player.playerId = playerInfo.playerId;
    self.players.add(player);    
    player.body.setSize(20,18,false);
    player.body.setOffset(2,6);
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

function createAnims(scene){
    scene.anims.create({
        key: 'player-idle-down',
        frames: scene.anims.generateFrameNumbers('player', { frames:[0] }),
        frameRate: 16,
        repeat: 0
    });
    scene.anims.create({
        key: 'player-walk-down',
        frames: scene.anims.generateFrameNumbers('player', { frames:[1,2] }),
        frameRate: 16,
        repeat: 0
    });
    scene.anims.create({
        key: 'player-walk-up',
        frames: scene.anims.generateFrameNumbers('player', { frames:[4,5] }),
        frameRate: 16,
        repeat: 0
    });
}