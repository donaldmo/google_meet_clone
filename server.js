const express = require("express");
const path = require("path");
const os = require('os');


var app = express();
var port = process.env.PORT || 3000

function getLocalIpAddress() {
	const nics = os.networkInterfaces();
	for (const name in nics) {
		const nicsDetails = nics[name];
		for (const nic of nicsDetails) {
			if (nic.family === 'IPv4' && !nic.internal) {
				return nic.address;
			}
		}
	}
	return null;
}

var server = app.listen(port, function () {
	const localIpAddress = getLocalIpAddress();
	console.log(`Listening on port http://${localIpAddress}:${port}`)
})

const io = require("socket.io")(server, { allowEIO3: true });
app.use(express.static(path.join(__dirname, "")))

var userConnections = []

io.on("connection", (socket) => {
	console.log("connection: ", socket.id)

	socket.on("userconnect", data => {
		console.log("userconnect: ", data)
		var other_users = userConnections.filter(i => i != data.meetingid)

		userConnections.push({
			connectionId: socket.id,
			user_id: data.displayName,
			meeting_id: data.meetingid
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
		// console.log("SDPProcess : ", data)
		socket.to(data.to_connid).emit("SDPProcess", {
			message: data.message,
			from_connid: socket.id
		})
	})

	socket.on("disconnect", function () {
		console.log("Disconnected: ", socket.id)
		var user = userConnections.find((p) => p.connectionId == socket.id)
		if (user) {
			userConnections = userConnections.filter(
				(p) => p.connectionId != socket.id
			)

			var list = userConnections.filter((p) => {
        return p.meeting_id == user.meeting_id
      })

			list.forEach(v => {
				socket.to(v.connectionId).emit("inform_other_about_disconnected_user", {
					connId: socket.id,
					uNumber: userConnections.length,
				})
			})
		}
	})
})
