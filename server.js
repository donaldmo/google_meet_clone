const express = require("express");
const path = require("path");

var app = express();
var port = process.env.PORT || 3000

var server = app.listen(port, function () {
    console.log(`Listening on port ${port}`)
});

const io = require("socket.io")(server, { allowEIO3: true });
app.use(express.static(path.join(__dirname, "")));

io.on('connection', (socket) => {
    console.log('socket id: ', socket.id)
})
