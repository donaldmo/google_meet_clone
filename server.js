const express = require("express");
const path = require("path");

var app = express();
var port = process.env.PORT || 3000

var server = app.listen(port, function () {
	console.log(`Listening on port ${port}`)
})

const io = require("socket.io")(server, { allowEIO3: true });
app.use(express.static(path.join(__dirname, "")))

var userConnections = []

io.on("connection", (socket) => {
	console.log("connection: ", socket.id)

	socket.on("userconnect", data => {
		console.log("userconnect: ", data)
		var other_users = userConnections.filter(i => i != data.meetingId)

		userConnections.push({
			connectionId: socket.id,
			user_id: data.displayName,
			meeting_id: data.meetingId
		})

		other_users.forEach(other_user => {
			socket.to(other_user.connectionId).emit("inform_others_about_me", {
				other_user_id: data.displayName,
				connId: socket.id,
			})
		})

		socket.emit("inform_me_about_other_user", other_users)
	})

	socket.on("SDPProcess", data => {
		console.log("SDPProcess : ", data)
		
		socket.to(data.to_connid).emit("SDPProcess", {
			message: data.message,
			from_connid: socket.id
		})
	})
})
