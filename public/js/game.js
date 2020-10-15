//Globals
var DEPTH_LAYERS = {
    background: 0,
    tiles: 100,
    objects: 150,
    players: 200,
    foreground: 300,
}

var HudScene = new Phaser.Class({

    Extends: Phaser.Scene,

    initialize:

    function HudScene ()
    {
        Phaser.Scene.call(this, { key: 'HudScene', active: true });

    },
    preload: function(){
        this.load.image('hud_fuse', 'assets/hud_fuse.png');
        this.load.spritesheet('particles_fuse', 'assets/particles_fuse.png',{ frameWidth: 4, frameHeight: 4 });
        this.gameScore = 0;
    },
    create: function ()
    {
        this.txtScore = this.add.text(50, 50, "Score: "+this.gameScore.toString(), { fontFamily: 'visitorTT1', resolution: 1 })
        this.fuse = this.add.image(32,32,'hud_fuse').setOrigin(0,0)
        //Create Fuse Particles
        this.sparkerMgr = this.add.particles('particles_fuse');
        this.sparkler = this.sparkerMgr.createEmitter({
            active:true,
            frequency: 60, 
            x: this.fuse.getRightCenter().x,
            y: this.fuse.getRightCenter().y,
            speed: { min: 35, max: 45 },
            scale: { start: 0.3, end: 0.0 },
            lifespan: 500,
            blendMode: 'ADD'
        });

    },
    update:function(){

    },
    updateFuse: function(){
        
    }

});
//Setup Game Config
var config = {
    type: Phaser.AUTO,
    parent: 'game',
    width: 960,
    height: 640,  
    pixelArt: true,  
    physics: {
        default: 'arcade',
        arcade: {
          debug: false,
          gravity: { y: 0 }
        }
      },
    scene: [{
        preload: preload,
        create: create,
        update: update
    }, HudScene]
};

//Launch Game
var game = new Phaser.Game(config);

function preload() {
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 24, frameHeight: 24 });

    //Map Assets  
    this.load.tilemapTiledJSON('map1', 'assets/map1.json'); 
    this.load.spritesheet('tileset', 'assets/tileset.png', {frameWidth: 16, frameHeight: 16});

    //Load Effects
    this.load.spritesheet('explosion1', 'assets/explosion1.png', {frameWidth: 64, frameHeight: 64});
    this.load.spritesheet('goosplat', 'assets/goosplat16.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('bombalert', 'assets/bombalert.png', { frameWidth: 16, frameHeight: 16 });
    
    //Load Equipment
    this.load.spritesheet('missle', 'assets/missle.png', {frameWidth: 32, frameHeight: 32});    
    this.load.spritesheet('goo', 'assets/goo.png', { frameWidth: 32, frameHeight: 32 });    
}

function create() {
    var self = this;
    this.socket = io();
    //get hud for quick access
    this.hud = game.scene.getScene('HudScene');
    //Physics Groups
    this.players = this.physics.add.group();
    this.walls = this.physics.add.staticGroup();
    this.missles = this.physics.add.group();
    this.globs = this.physics.add.group();
    this.splats = this.physics.add.group();
    //Create Controls
    this.controls = createControls(self);
    this.socket.on('currentPlayers', function (players) {
        //Clear the score table and rebuild it.
        //DOM Elements
        var scoreTable = document.getElementById("hudbar1");
        scoreTable.innerHTML = "";
        //Iterate thru new players
        Object.keys(players).forEach(function (id) {
            if (players[id].playerId === self.socket.id) {
                displayPlayers(self, players[id], 'player');
            } else {
                displayPlayers(self, players[id], 'player');
            }
            //Create DIV Tags for players
            var div = document.createElement('div');
            div.id = 'player_'+players[id].playerId;
            div.innerHTML = "Player:"+players[id].uid;
            div.className = 'playerdata';
            scoreTable.appendChild(div);
        });
    });

    this.socket.on('newPlayer', function (playerInfo) {
        displayPlayers(self, playerInfo, 'player');
        //DOM Elements
        var scoreTable = document.getElementById("hudbar1");
        var div = document.createElement('div');
        div.id = 'player_'+playerInfo.playerId;
        div.innerHTML = "Player:"+playerInfo.uid;
        div.className = 'playerdata';
        scoreTable.appendChild(div);
    });

    this.socket.on('disconnect', function (playerId) {
        self.players.getChildren().forEach(function (player) {
            if (playerId === player.playerId) {
                player.nametext.destroy();
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
    this.socket.on('gooFired', function (data) {
        let newGoo = self.physics.add.sprite(data.x, data.y, 'goo').setOrigin(0.5, 0.5).setDisplaySize(16, 16); 
        newGoo.nid = data.nid;
        newGoo.ownerid = data.ownerid;
        self.globs.add(newGoo);
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
            if(players[id].playerId == self.socket.id){
                let gs = self.hud.gameScore = players[id].score;
                self.hud.txtScore.setText("Score: "+gs.toString());
            }
        });
        let netMissles = netobject.missles;
        let netExplosions = netobject.explosions;
        self.missles.getChildren().forEach(function (missle) {
            netMissles.forEach(m =>{
                if (missle.nid === m.nid) {
                    missle.setPosition(m.x,m.y);
                } 
            })
            netExplosions.forEach(e =>{
                if (missle.nid === e.nid) {
                    missle.destroy();
                    createExplosion(self,e.x,e.y);
                } 
            })
        });
        let netGlobs = netobject.globs;
        let netSplats = netobject.splats;
        self.globs.getChildren().forEach(function (glob) {
            netGlobs.forEach(g =>{
                if (glob.nid === g.nid) {
                    glob.setPosition(g.x,g.y);
                } 
            })
            netSplats.forEach(s =>{
                if (glob.nid === s.nid) {

                    let splatCircle = new Phaser.Geom.Circle(s.x,s.y,32);//128 radius
                    let map = self.map;
                    let tilesInRadius = map.getTilesWithinShape(splatCircle);
                    let tempNid =  s.nid;
                    tilesInRadius.forEach(t=>{
                        //create goo splats                        
                        let splat = self.add.image((t.x*16)+8,(t.y*16)+8,'goosplat').setOrigin(0.5,0.5).setFrame(Phaser.Math.Between(0,2)).setDepth(DEPTH_LAYERS.objects);
                        splat.nid = tempNid;
                        self.splats.add(splat);
                    });


                    glob.destroy();
                } 
            })
        });
        let removeSplats = netobject.removeSplats;
        let splatKillList = [];
        removeSplats.forEach(s =>{            
            self.splats.getChildren().forEach(function (splat) {
                
                if (splat.nid === s.nid) {
                    splatKillList.push(splat);
                }
            });   
        });

        if(splatKillList.length > 0){
            splatKillList.forEach(s =>{   
                self.splats.remove(s,true,true);
            })
            
        }


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

    //Countdown Clock Graphics
    this.countdownclock = this.add.graphics();
    this.bombalert = this.add.sprite(200,200,'bombalert');
    this.bombalert.anims.play('bombalert-1');
    this.cdcTime = 0;
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
    //Goo
    if(this.controls.J.b.isDown && this.controls.J.s == 0){        
        this.socket.emit('playerGoo', {});
        this.controls.J.s++;
    }
    if(!this.controls.J.b.isDown){
        this.controls.J.s=0;
    }
    //CHeck State Change for movement
    if(this.prevMoveState[0] != moveState[0] || this.prevMoveState[1] != moveState[1]){
        this.socket.emit('playerInput', moveState);
    }

    //Save last movement
    this.prevMoveState = moveState;
    let lastPlayerTemp={x:0,y:0};
    this.players.getChildren().forEach(function (player) {
        player.nametext.setPosition(player.x,player.y);
        lastPlayerTemp.x = player.x  << 0;
        lastPlayerTemp.y = player.y-24  << 0;
        
        
    })
    this.bombalert.setPosition(lastPlayerTemp.x,lastPlayerTemp.y);
    let clockdeg = this.cdcTime.map(0,1000,0,360);
    this.countdownclock.clear();
    this.countdownclock.fillStyle(0xFFFFFF, 0.75);
    this.countdownclock.slice(lastPlayerTemp.x, lastPlayerTemp.y, 8, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(clockdeg-90), true);
    this.countdownclock.fillPath();

    if(this.cdcTime  > 1000){
        this.cdcTime = 0;
    }
    this.cdcTime++;

}
Number.prototype.map = function (in_min, in_max, out_min, out_max) {
    return (this - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
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
    const player = self.add.sprite(playerInfo.x, playerInfo.y, sprite).setOrigin(0.5, 0.5).setDisplaySize(48, 48).setDepth(DEPTH_LAYERS.players);
    // if (playerInfo.team === 'blue') player.setTint(0x0000ff);
    // else player.setTint(0xff0000);
    player.nametext = self.add.text(playerInfo.x, playerInfo.y, playerInfo.uid.toString(), { fontFamily: 'visitorTT1', resolution: 2 }).setOrigin(0.5,-1.5).setDepth(DEPTH_LAYERS.players);
    player.direction = 'down';
    player.playerId = playerInfo.playerId;
    player.uid = playerInfo.uid;
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
        J: {b:scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),s:0},
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
    scene.anims.create({
        key: 'bombalert-1',
        frames: scene.anims.generateFrameNumbers('bombalert', { frames:[0,1,2,3,4,5] }),
        frameRate: 12,
        repeat: -1
    });
}