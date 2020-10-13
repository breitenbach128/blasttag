const players = {};
var missleUID = 0;
var explosionQueue = [];

const config = {
    type: Phaser.HEADLESS,
    parent: 'phaser-example',
    width: 640,
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
}

function create() {
    const self = this;
    this.players = this.physics.add.group();
    this.missles = this.physics.add.group();
    this.walls = this.physics.add.staticGroup();

    io.on('connection', function (socket) {
        console.log('a user connected');

        // create a new player and add it to our players object
        players[socket.id] = {
            rotation: 0,
            x: Math.floor(Math.random() * 280) + 24,
            y: Math.floor(Math.random() * 280) + 24,
            playerId: socket.id,
            team: (Math.floor(Math.random() * 2) == 0) ? 'red' : 'blue',
            input: [0, 0], // X,Y vector
            aim: [0,1] 
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
        socket.on('playerMissle', function (data) {
            ; launchMissle(self, socket.id, data);
        });
    });
    this.physics.world.setBounds(0, 0, 320, 320);
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
    //setup Collision
    this.physics.add.collider(this.players, this.walls);
    this.physics.add.collider(this.missles, this.walls, missleHit);
    this.physics.add.overlap(this.missles, this.players, missleHitPlayer);
}

function update() {
    //Package gamestate for network sending
    this.players.getChildren().forEach((player) => {
        const input = players[player.playerId].input;
        let speed = 100;
        player.setVelocity(input[0] * speed, input[1] * speed);
        players[player.playerId].x = player.x;
        players[player.playerId].y = player.y;
        players[player.playerId].rotation = player.rotation;
    });
    this.physics.world.wrap(this.players, 5);
    let missles = [];
    this.missles.getChildren().forEach((m) => {
        missles.push({nid:m.nid,x:m.x,y:m.y});
    });
    let netobject = {players: players, missles: missles, explosions: explosionQueue};
    io.emit('playerUpdates', netobject);
    
    //Clear explosion queue
    explosionQueue = [];
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
function launchMissle(self, playerId, data) {

    self.players.getChildren().forEach((player) => {
        if (playerId === player.playerId) {

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
    });
}
function missleHitPlayer(missle, player) {
    //missle.disableBody(true, true);
    if(missle.ownerid != player.playerId){
        explosionQueue.push({nid:missle.nid,x:missle.x,y:missle.y});
        missle.destroy();
    }
}
function missleHit(missle, wall) {
    //missle.disableBody(true, true);
    explosionQueue.push({nid:missle.nid,x:missle.x,y:missle.y});
    missle.destroy();
}
function convertArrayStringToInteger(a) {
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
    //Adjust offsets
    player.body.setSize(20, 18, false);
    player.body.setOffset(2, 6);
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

