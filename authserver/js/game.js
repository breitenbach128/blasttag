/// <reference path="../../def/phaser.d.ts"/>
const players = {};
var missleUID = 0;
var gooUID = 0;
var pickupUID = 0;
var newPlayerUID = 0;
var explosionQueue = [];
var splatQueue = [];
var gameScene;
var bombTimer = {time: 3000,max:3000};
var gameStarted = false;
var bombOwner = -1;//Player who owns the bomb
var transferTimer = 120;
var gameResetTimer = 0;

var PICKUPTYPES = {
    missle:1,
    goo: 2,
    trap: 3,
    fuse: 4,
}

const config = {
    type: Phaser.HEADLESS,
    parent: 'game',
    width: 960,
    height: 640,
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
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 24, frameHeight: 24 });
    this.load.tilemapTiledJSON('map1', 'assets/map1.json');
    //Equipment
    this.load.spritesheet('missle', 'assets/missle.png', { frameWidth: 32, frameHeight: 32 });
    this.load.spritesheet('goo', 'assets/goo.png', { frameWidth: 32, frameHeight: 32 });    
    this.load.spritesheet('goosplat', 'assets/goosplat16.png', { frameWidth: 16, frameHeight: 16 });
    this.load.spritesheet('fuse', 'assets/fuse.png', { frameWidth: 16, frameHeight: 16 });
}

function create() {
    const self = this;
    gameScene = this;
    this.players = this.physics.add.group();
    this.missles = this.physics.add.group();
    this.traps = this.physics.add.group();
    this.globs = this.physics.add.group();
    this.splats = this.physics.add.group();
    this.walls = this.physics.add.staticGroup();
    this.pickups = this.physics.add.group();

    io.on('connection', function (socket) {
        

        // create a new player and add it to our players object
        players[socket.id] = {
            rotation: 0,
            x: Math.floor(Math.random() * 280) + 24,
            y: Math.floor(Math.random() * 280) + 24,
            playerId: socket.id,
            uid: 0,
            team: (Math.floor(Math.random() * 2) == 0) ? 'red' : 'blue',
            input: [0, 0], // X,Y vector
            aim: [0,1],
            score: 0,
            haveBomb: false,
            condition: 0,//0 - Normal, 2 - Slowed, 4 - Stunned
            missles: 0,
            goos: 0,
            traps: 0
        };
        // add player to server
        addPlayer(self, players[socket.id]);
        console.log('a user connected',self.players.getLength());
        // send the players object to the new player
        let pickups = [];
        self.pickups.getChildren().forEach(e=>{
            pickups.push({nid:e.nid, pickupType: e.pickupType,x:e.x,y:e.y});
        });
        //Which player has the bomb? Only run if there are two players to start the game off.

        socket.emit('currentPlayers', {netplayers:players,netpickups:pickups});
        // update all other players of the new player
        socket.broadcast.emit('newPlayer', players[socket.id]);

        //If at least two players, run start game sequence.
       if(self.players.getLength() == 2){
           let currPlayers = self.players.getChildren();
           let startingBombId = currPlayers[Phaser.Math.Between(0,1)].playerId;
           players[startingBombId].haveBomb = true;
           bombOwner = players[startingBombId].uid;
           startGame(self,socket);
       };

        socket.on('disconnect', function () {
            console.log('user disconnected');
            // remove player from server
            removePlayer(self, socket.id);
            // remove this player from our players object
            delete players[socket.id];
            // emit a message to all players to remove this player
            io.emit('disconnect', socket.id);
            //If down to 1 player, reset game to unstarted status, and stop bomb timers.
            if(self.players.getLength() == 1){
                let currPlayers = self.players.getChildren();
                let startingBombId = currPlayers[0].playerId;
                players[startingBombId].haveBomb = false;
                bombOwner = -1;
                gameStarted = false;
            }
            
        });
        socket.on('playerInput', function (inputData) {
            intData = convertArrayStringToInteger(inputData);
            handlePlayerInput(self, socket.id, intData);
        });
        socket.on('playerMissle', function (data) {
            launchMissle(self, socket.id, data);
        });
        socket.on('playerGoo', function (data) {
            launchGoo(self, socket.id, data);
        });
    });
    this.physics.world.setBounds(0, 0, 480, 320);
    //Create Map
    this.map = this.make.tilemap({ key: 'map1' });
    // let tsImage = this.map.addTilesetImage('tileset','tileset',16,16,0,0);
    // this.map.createStaticLayer('main', tsImage, 0, 0).setDepth(0);
    //Collision Layer
    let hullsLayer = this.map.getObjectLayer('walls');
    hullsLayer.objects.forEach(e => {
        let shapeObject = this.add.rectangle(e.x + (e.width / 2), e.y + (e.height / 2), e.width, e.height, 0xFF0000, 0.3).setDepth(100);
        //this.physics.add.existing(shapeObject);
        this.walls.add(shapeObject);
        //shapeObject.setImmovable(true);
    });
    //Object Spawners
    //Fuses and pickups
    //Create 5 on the map in random locations.
    //When they are picked up, hide them, deactivate them for 300 frames, and then move them to another random location.
    for(let i=0;i<5;i++){
        let spawnTile = getMapOpenTile(this.map);
        //I need a check to ensure those tiles don't have something already on them;
        let newFuse = this.add.image(spawnTile.x*16+8,spawnTile.y*16+8,'fuse');
        newFuse.pickupType = PICKUPTYPES.fuse;
        newFuse.respawnTimer = -1;//How long until it becomes active again. -1 is active
        newFuse.nid = pickupUID;
        this.pickups.add(newFuse);
        pickupUID++;
    }
    for(let i=0;i<5;i++){
        let spawnTile = getMapOpenTile(this.map);
        //I need a check to ensure those tiles don't have something already on them;
        let newMissle = this.add.image(spawnTile.x*16+8,spawnTile.y*16+8,'missle');
        newMissle.pickupType = PICKUPTYPES.missle;
        newMissle.respawnTimer = -1;//How long until it becomes active again. -1 is active
        newMissle.nid = pickupUID;
        this.pickups.add(newMissle);
        pickupUID++;
    }
    for(let i=0;i<5;i++){
        let spawnTile = getMapOpenTile(this.map);
        //I need a check to ensure those tiles don't have something already on them;
        let newGoo = this.add.image(spawnTile.x*16+8,spawnTile.y*16+8,'goo');
        newGoo.pickupType = PICKUPTYPES.goo;
        newGoo.respawnTimer = -1;//How long until it becomes active again. -1 is active
        newGoo.nid = pickupUID;
        this.pickups.add(newGoo);
        pickupUID++;
    }
    //setup Collision
    this.physics.add.collider(this.players, this.walls, playerWallImpact);
    this.physics.add.collider(this.missles, this.walls, missleHit);
    this.physics.add.overlap(this.missles, this.players, missleHitPlayer);
    this.physics.add.collider(this.globs, this.walls, gooHit);
    this.physics.add.collider(this.globs, this.players, gooHitPlayer,function(){},this);
    this.physics.add.overlap(this.splats, this.players, splatHitPlayer,function(){},this);
    this.physics.add.overlap(this.players, this.pickups, collectPickup);
    this.physics.add.collider(this.players, this.players, playersTouched);
}

function update() {
    //Package gamestate for network sending
    this.players.getChildren().forEach((player) => {
        const input = players[player.playerId].input;
        let speed = player.isSlowed ? 50 : 100;
        speed = players[player.playerId].haveBomb ? speed*1.2 : speed;//Bomb Carriers move 20% faster than others.
        if(!gameStarted){speed = 0;}//Can't move if game is not started.
        player.setVelocity(input[0] * speed, input[1] * speed);
        players[player.playerId].x = player.x;
        players[player.playerId].y = player.y;
        players[player.playerId].rotation = player.rotation;
        //Set Statues back to false here;
        player.walltouch = false;
        player.isSlowed = false;

    });
    this.physics.world.wrap(this.players, 5);
    let missles = [];
    this.missles.getChildren().forEach((m) => {
        missles.push({nid:m.nid,x:m.x,y:m.y});
    });
    let globs = [];
    this.globs.getChildren().forEach((g) => {
        globs.push({nid:g.nid,x:g.x,y:g.y});
    });
    let removeSplats = [];
    this.splats.getChildren().forEach((splat) => {
        if(splat.lifespan > 0){
            splat.lifespan--;
        }else{
            removeSplats.push({nid:splat.nid});
            splat.destroy();
        }
        
    });
    let pickups = [];
    this.pickups.getChildren().forEach((p) => {
        if(p.respawnTimer > 0){p.respawnTimer--;}
        pickups.push({nid:p.nid,x:p.x,y:p.y,rspt:p.respawnTimer});
    });

    let netobject = {players: players, missles: missles, explosions: explosionQueue, globs:globs, splats: splatQueue, removeSplats: removeSplats,pickups: pickups,bombTime: bombTimer.time, gameResetTimer:gameResetTimer};
    io.emit('playerUpdates', netobject);
    //
    if(transferTimer > 0){transferTimer--};
    if(bombTimer.time > 0 && gameStarted){bombTimer.time--;}
    if(bombTimer.time == 0 && gameStarted ){
        endGame(this);
    }
    //Game Resets
    if(gameResetTimer > 0 && !gameStarted){gameResetTimer--;};
    if(gameResetTimer == 0 && !gameStarted){startGame()};
    //Clear explosion queue
    explosionQueue = [];
    splatQueue = [];
}
function startGame(){
    //Clear scores and resetup the game
    gameStarted = true;
    addBombTime(3000);

}
function endGame(scene){
    gameStarted = false;
    io.emit('gameOver', {loser: bombOwner});
    scene.players.getChildren().forEach(p=>{
        if(p.uid != bombOwner){players[p.playerId].score++};
    });
    gameResetTimer = 600;

}
function getMapOpenTile(map){
    let mlayer = map.getLayer('blocked');
    let tileCount = mlayer.width*mlayer.height;
    let found = false;
    while(found == false){
        let sTile = map.getTileAt(Phaser.Math.Between(0,mlayer.width-1),Phaser.Math.Between(0,mlayer.height-1), true, 'blocked');
        if(sTile.index == -1){
            found = true;
            return sTile;
        }
    }
}
function addBombTime(t){
    bombTimer.time  = bombTimer.time + t > bombTimer.max ? bombTimer.max : bombTimer.time+t;
}
function handlePlayerInput(self, playerId, input) {
    self.players.getChildren().forEach((player) => {
        if (playerId === player.playerId) {
            players[player.playerId].input = input;
            //Add direction code here so I have a history
            if(input[0] !=0 || input[1] != 0){
                players[player.playerId].aim = input;
            }
        }
    });
}
function playersTouched(p1,p2){
    if(transferTimer == 0){
        //console.log("players touched",bombOwner,p1.uid,p2.uid,p1.playerId,p2.playerId);
        if(p1.uid == bombOwner){
            bombOwner = p2.uid;
            players[p2.playerId].haveBomb = true;
            players[p1.playerId].haveBomb = false;
        }else if(p2.uid == bombOwner){
            bombOwner = p1.uid;
            players[p1.playerId].haveBomb = true;
            players[p2.playerId].haveBomb = false;
        }
        transferTimer = 120;   
    }
    
}
function playerWallImpact(player, wall){
    //example for status settings for collision
    player.walltouch = true;
}
function launchGoo(self, playerId, data) {
    self.players.getChildren().forEach((player) => {
        if (playerId === player.playerId) {
            if(players[player.playerId].goos > 0){
                players[player.playerId].goos--;
                let inputVec2 = players[player.playerId].aim;
                let newGoo = self.physics.add.sprite(players[player.playerId].x, players[player.playerId].y, 'goo').setOrigin(0.5, 0.5).setDisplaySize(16, 16);  
                newGoo.nid = gooUID;
                newGoo.ownerid = playerId;
                self.globs.add(newGoo);
                let speed = 200;
                newGoo.setVelocity(inputVec2[0]*speed, inputVec2[1]*speed);
                //Emit for all players
                io.emit('gooFired', {nid:gooUID,ownerid:playerId,x:newGoo.x,y:newGoo.y,rot:newGoo.rotation});
                gooUID++;
            }
        }
    });
}
function launchMissle(self, playerId, data) {

    self.players.getChildren().forEach((player) => {
        if (playerId === player.playerId) {
            if(players[player.playerId].missles > 0){
                players[player.playerId].missles--;
                let inputVec2 = players[player.playerId].aim;
                let vecRot = new Phaser.Math.Vector2(inputVec2[0],inputVec2[1]);
                let newMissle = self.physics.add.sprite(players[player.playerId].x, players[player.playerId].y, 'missle').setOrigin(0.5, 0.5).setDisplaySize(16, 16);
                //newMissle.nid = self.missles.getLength();
                newMissle.rotation=vecRot.angle()+Math.PI*(1/2);
                newMissle.nid = missleUID;
                newMissle.ownerid = playerId;
                self.missles.add(newMissle);
                let speed = 130;
                newMissle.setVelocity(inputVec2[0]*speed, inputVec2[1]*speed);
                //Emit for all players
                io.emit('missleFired', {nid:missleUID,ownerid:playerId,x:newMissle.x,y:newMissle.y,rot:newMissle.rotation});
                missleUID++;
            }
        }
    });
}
function missleHitPlayer(missle, player) {
    //missle.disableBody(true, true);
    if(missle.ownerid != player.playerId){
        explosionQueue.push({nid:missle.nid,x:missle.x,y:missle.y});
        missle.destroy();
        player.isSlowed = true;
        players[missle.ownerid].score++;
    }
}
function missleHit(missle, wall) {
    //missle.disableBody(true, true);
    explosionQueue.push({nid:missle.nid,x:missle.x,y:missle.y});
    missle.destroy();
}
function gooHit(goo, wall) {
    splatQueue.push({nid:goo.nid,x:goo.x,y:goo.y});    
    let splatEllipse = gameScene.add.ellipse(goo.x,goo.y,32,32,0xFFFFFF);
    splatEllipse.nid = goo.nid;
    splatEllipse.lifespan = 300;
    gameScene.splats.add(splatEllipse);
    goo.destroy();
}
function gooHitPlayer(goo, player) {
    if(goo.ownerid != player.playerId){
        splatQueue.push({nid:goo.nid,x:goo.x,y:goo.y});
        let splatEllipse = gameScene.add.ellipse(goo.x,goo.y,32,32,0xFFFFFF);
        splatEllipse.nid = goo.nid;
        splatEllipse.lifespan = 300;
        gameScene.splats.add(splatEllipse);
        goo.destroy();
    }
}
function splatHitPlayer(splat, player){
    player.isSlowed = true;
}
function collectPickup(player,pickup){
    if(pickup.respawnTimer <= 0){
        let sTile = getMapOpenTile(gameScene.map);
        pickup.setPosition(sTile.x*16+8,sTile.y*16+8);
        pickup.respawnTimer = 300;
        if(pickup.pickupType == PICKUPTYPES.fuse){
            //Is the player the bomb owner?
            if(players[player.playerId].haveBomb){
                addBombTime(300);
            }
        }else if(pickup.pickupType == PICKUPTYPES.missle){
            players[player.playerId].missles = players[player.playerId].missles < 3 ? players[player.playerId].missles+1 : 3;
        }else if(pickup.pickupType == PICKUPTYPES.goo){
            players[player.playerId].goos = players[player.playerId].goos < 3 ? players[player.playerId].goos+1 : 3;
        }else if(pickup.pickupType == PICKUPTYPES.trap){
            players[player.playerId].traps = players[player.playerId].traps < 3 ? players[player.playerId].traps+1 : 3;
        }
    }

}
function convertArrayStringToInteger(a) {
    var result = a.map(function (x) {
        return parseInt(x, 10);
    });
    return result;
}
function addPlayer(self, playerInfo) {
    newPlayerUID++;
    const player = self.physics.add.sprite(playerInfo.x, playerInfo.y, 'player').setOrigin(0.5, 0.5).setDisplaySize(48, 48);
    // player.setDrag(100);
    // player.setAngularDrag(100);
    player.setMaxVelocity(200);
    player.playerId = playerInfo.playerId;
    player.uid = newPlayerUID;
    player.isSlowed = false;
    self.players.add(player);
    //Adjust offsets
    player.body.setSize(20, 18, false);
    player.body.setOffset(2, 6);

    //Update Data List    
    players[playerInfo.playerId].uid = newPlayerUID;
    
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

