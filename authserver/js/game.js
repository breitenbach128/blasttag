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
   
  function preload() {}
   
  function create() {

      io.on('connection', function (socket) {
          console.log('a user connected');
          socket.on('disconnect', function () {
              console.log('user disconnected');
          });
      });

  }
   
  function update() {}
   
  const game = new Phaser.Game(config);


  window.gameLoaded();

