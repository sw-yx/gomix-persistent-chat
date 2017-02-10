// server.js
// where your node app starts

// init
// setup express for handling http requests
var express = require("express");
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
// var bodyParser = require('body-parser');
// app.use(bodyParser.urlencoded({extended: false}));
// app.use(bodyParser.json());
// console.log('hi',app)
// app.listen(3001);
app.use(express.static('public'));

// Chatroom

var numUsers = 0;

// setup our datastore
var connected=false;
// var datastore = require("./datastore").sync;
var datastore = require("./datastore").async;


io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
    var item = {
            username: socket.username ? socket.username : "Anon.",
            message: data
          }
    try {
      // Get the existing posts from the MongoDB and put it into an array called posts
      var chats = datastore.get("chats")
        .then(function(chats){
          // console.log('chats so far', chats)
          chats.push(item); // the form data is in request.body because we're using the body-parser library to help make dealing with requests easier
          // We store the updated posts array back in our database posts entry
          datastore.set("chats", chats)
          // console.log('logging', item)
        });
    } catch (err) {
      console.log('error in logging', item)
      handleError(err, socket);
    }
  });

  // when the client emits 'connect_catchup', this listens and executes
  socket.on('connect_catchup', function () {
    try {
      connectOnProjectCreation()
        .then(function(){
          initializeDatastoreOnProjectCreation()
            .then(function(){
              datastore.get("chats")
                .then(function(chats){ 
                  // console.log('found these chats',chats);
                  socket.emit('connect_catchup_fromserver', chats);
                });
            });        
        });
    } catch (err) {
      console.log("Error: " + err);
      handleError(err, socket);
    }
  });
  
  
  
  
  
  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});



function handleError(err, response) {
  // response.status(500);
  // response.send(
  //   "<html><head><title>Internal Server Error!</title></head><body><pre>"
  //   + JSON.stringify(err, null, 2) + "</pre></body></pre>"
  // );
}

// ------------------------
// DATASTORE INITIALIZATION

function connectOnProjectCreation() {
  return new Promise(function (resolving) {
    if(!connected){
      connected = datastore.connect().then(function(){
        resolving();
      });
    } else {
      resolving();
    }
  });
}

function initializeDatastoreOnProjectCreation() {
  return new Promise(function (resolving) {
    datastore.get("initialized")
      .then(function(init){
          // console.log('init',init)
        if (!init) {
          // console.log('initializingchatss')
          datastore.set("chats", initialChats)
            .then(function(){
              datastore.set("initialized", true)
                .then(function(){
                  resolving();
                });
            });
        } else {
          resolving();
        }
      });
  });
}

var initialChats = [
  {
    username: "User1",
    message: "Among other things, you could make a pretty sweet blog."
  },
  {
    username: "User2",
    message: "Today I saw a double rainbow. It was pretty neat."
  }
];


