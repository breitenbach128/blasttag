var config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: 640,
    height: 640,  
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

    //Map Assets  
    this.load.tilemapTiledJSON('map1', 'assets/map1.json'); 
    this.load.spritesheet('tileset', 'assets/tileset.png', {frameWidth: 16, frameHeight: 16});

    //Load Effects
    this.load.spritesheet('explosion1', 'assets/explosion1.png', {frameWidth: 64, frameHeight: 64});

    //Load Equipment
    this.load.spritesheet('missle', 'assets/missle.png', {frameWidth: 32, frameHeight: 32});
}

function create() {
    var self = this;
    this.socket = io();
    //Physics Groups
    this.players = this.physics.add.group();
    this.walls = this.physics.add.staticGroup();
    this.missles = this.physics.add.group();
    //Create Controls
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
    this.socket.on('missleFired', function (data) {
        let newMissle = self.physics.add.sprite(data.x, data.y, 'missle').setOrigin(0.5, 0.5).setDisplaySize(16, 16);
        newMissle.setRotation(data.rot);
        newMissle.anims.play('missle-fly',true);
        newMissle.nid = data.nid;
        newMissle.ownerid = data.ownerid;
        self.missles.add(newMissle);
    });
    this.socket.on('playerUpdates', function (netobject) {
        let players = netobject.players;
        Object.keys(players).forEach(function (id) {
            self.players.getChildren().forEach(function (player) {
                if (players[id].playerId === player.playerId) {
                    player.setRotation(players[id].rotation);
                    player.setPosition(players[id].x, players[id].y);
                    //Anims
                    if(players[id].input[1] < 0){
                        player.anims.play('player-walk-up',true);
                        player.direction = 'up';
                    }else if (players[id].input[1] > 0){
                        player.anims.play('player-walk-down',true);
                        player.direction = 'down;'
                    }else if(players[id].input[0] < 0){
                        player.anims.play('player-walk-left',true);
                        player.direction = 'left';
                    }else if (players[id].input[0] > 0){
                        player.anims.play('player-walk-right',true);
                        player.direction = 'right;'
                    }else{
                        //If it was walking up, play idle up. if walking down, play idle down
                        player.anims.play('player-idle-down',true);

                    }
                }
            });
        });
        let missles = netobject.missles;
        let explosions = netobject.explosions;
        self.missles.getChildren().forEach(function (missle) {
            missles.forEach(m =>{
                if (missle.nid === m.nid) {
                    missle.setPosition(m.x,m.y);
                } 
            })
            explosions.forEach(e =>{
                if (missle.nid === e.nid) {
                    missle.destroy();
                    createExplosion(self,e.x,e.y);
                } 
            })
        });
    });
    //Create Map
    this.map = this.make.tilemap({key: 'map1'});  
    let tsImage = this.map.addTilesetImage('tileset','tileset',16,16,0,0);
    this.map.createStaticLayer('main', tsImage, 0, 0).setDepth(0);
    //Collision Layer
    let hullsLayer = this.map.getObjectLayer('walls');
    hullsLayer.objects.forEach(e=>{
        let shapeObject = this.add.rectangle(e.x + (e.width / 2), e.y + (e.height / 2),e.width, e.height,0xFF0000,0.0).setDepth(100);        
        this.walls.add(shapeObject);
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

    //Local Simulation for improvement of timing
    this.physics.add.overlap(this.missles, this.walls, missleHit);

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
    //Missle
    if(this.controls.K.b.isDown && this.controls.K.s == 0){        
        this.socket.emit('playerMissle', {});
        this.controls.K.s++;
    }

    if(!this.controls.K.b.isDown){
        this.controls.K.s=0;
    }
    //CHeck State Change for movement
    if(this.prevMoveState[0] != moveState[0] || this.prevMoveState[1] != moveState[1]){
        this.socket.emit('playerInput', moveState);
    }

    //Save last movement
    this.prevMoveState = moveState;
    

}
function missleHit(missle, wall) {
    //missle.disableBody(true, true);
    console.log("Missle Hit Wall, Destroyed.",missle.nid);
    missle.destroy();
}
function createExplosion(self,x,y){
    let exp = self.add.sprite(x, y, 'explosion1').setOrigin(0.5,0.5);
    exp.anims.play('explosion-1',true);
    exp.on('animationcomplete', function(){exp.destroy()}, this);
}
function displayPlayers(self, playerInfo, sprite) {
    const player = self.add.sprite(playerInfo.x, playerInfo.y, sprite).setOrigin(0.5, 0.5).setDisplaySize(48, 48);
    // if (playerInfo.team === 'blue') player.setTint(0x0000ff);
    // else player.setTint(0xff0000);
    player.direction = 'down';
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
        D: {b:scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),s:0},
        K: {b:scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K),s:0}
    }
    return controls;
}

function createAnims(scene){
    //Player
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
    scene.anims.create({
        key: 'player-walk-left',
        frames: scene.anims.generateFrameNumbers('player', { frames:[10,11,12,13] }),
        frameRate: 16,
        repeat: 0
    });
    scene.anims.create({
        key: 'player-walk-right',
        frames: scene.anims.generateFrameNumbers('player', { frames:[6,7,8,9] }),
        frameRate: 16,
        repeat: 0
    });
    //Equipment
    scene.anims.create({
        key: 'missle-fly',
        frames: scene.anims.generateFrameNumbers('missle', { frames:[1,2] }),
        frameRate: 16,
        repeat: -1
    });
    //Effects
    scene.anims.create({
        key: 'explosion-1',
        frames: scene.anims.generateFrameNumbers('explosion1', { frames:[0,1,2,3,4,5,6] }),
        frameRate: 16,
        repeat: 0
    });
}