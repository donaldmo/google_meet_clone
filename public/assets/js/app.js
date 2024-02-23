var AppProcess = (function () {
  var serverProcess
  var my_connection_id
  
  var peers_connection_ids = []
  var peers_connection = []

  var remote_vid_stream = []
  var remote_aud_stream = []

  var iceConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ]
  }

  async function _init(SDP_function, my_connid) {
    serverProcess = SDP_function
    my_connection_id = my_connid
  }

  async function setConnection(connId) {
    console.log('set new connection: ', connId)
    var connection = new RTCPeerConnection(iceConfiguration)

    connection.onnegotiationneeded = async function (event) {
      await setOffer(connId)
    }

    connection.onicecandidate = function (event) {
      if (event.candidate) {
        var candidate = JSON.stringify({ icecandidate: event.candidate })
        serverProcess(candidate, connId)
      }
    }

    connection.ontrack = function (event) {
      if (!remote_vid_stream[connId]) {
        remote_vid_stream[connId] = new MediaStream()
      }

      if (!remote_aud_stream[connId]) {
        remote_aud_stream[connId] = new MediaStream()
      }

      if (event.track.kind == 'video') {
        var videoTracks = remote_vid_stream[connId].getVideoTracks()
        videoTracks.forEach(track => remote_vid_stream[connId].removeTrack(track))
        remote_vid_stream[connId].addTrack(event.track)

        remoteVidPlayer = document.getElementById('v_' + connId)
        remoteVidPlayer.srcObject = null
        remoteVidPlayer.srcObject = remote_vid_stream[connId]
        remoteVidPlayer.load()
      }
      else if (event.track.kind == "audio") {
        var audioTracks = remote_vid_stream[connId].getAudioTracks()
        audioTracks.forEach(track => remote_aud_stream[connId].removeTrack(track))
        remote_aud_stream[connId].addTrack(event.track)

        remoteAudioPlayer = document.getElementById('a_' + connId)
        remoteAudioPlayer.srcObject = null
        remoteAudioPlayer.srcObject = remote_aud_stream[connId]
        remoteAudioPlayer.load()
      }
    }

    peers_connection_ids[connId] = connId
    peers_connection[connId] = connection

    return connection
  }

  async function setOffer(connId) {
    console.log('set offer...')
    var connection = peers_connection[connId]
    var offer = await connection.createOffer()

    await connection.setLocalDescription(offer)
    serverProcess(
      JSON.stringify({ offer: connection.localDescription }), connId)
  }


  async function SDPProcess(data, from_connid) {
    message = JSON.parse(data)

    if (message.answer) {

    }
    else if(message.offer) {
      // here...
    }
  }


  return {
    setNewConnection: async function (connId) {
      await setConnection(connId)
    },
    init: async function (SDPConnection, my_connid) {
      await _init(SDPConnection, my_connid)
    },
    processClientFunc: async function (data, from_connid) {
      await SDPProcess(data, from_connid)
    }
  }
})()


var MyApp = (function () {
  var socket = null
  var user_id = ""
  var meeting_id = ""

  function init(uid, mid) {
    user_id = uid
    meeting_id = mid

    event_process_for_signaling_server()
  }

  function event_process_for_signaling_server() {
    socket = io.connect()

    var SDPConnection = function (data, to_connid) {
      console.log('emit SDPProcess...', data, to_connid)

      socket.emit("SDPProcess", {
        message: data,
        to_connid: to_connid
      })
    }

    socket.on("connect", () => {
      if (socket.connected) {
        console.log('my_connid: ', socket.id)

        AppProcess.init(SDPConnection, socket.id)

        if (user_id != "" && meeting_id != "") {
          socket.emit('userconnect', {
            displayName: user_id,
            meetingId: meeting_id
          })
        }
      }
    })

    socket.on('inform_others_about_me', data => {
      console.log('inform_others_about_me: ', data)
      addUser(data.other_user_id, data.connId)
      AppProcess.setNewConnection(data.connId)
    })

    socket.on("SDPProcess", async function (data) {
      console.log('SDPProcess: ', data)
      await AppProcess.processClientFunc(data.message, data.from_connid)
    })
  }

  function addUser(other_user_id, connId) {
    console.log('add user: ', other_user_id, connId)
    var newDivId = $('#otherTemplate').clone()
    newDivId = newDivId.attr('id', connId).addClass('other')
    newDivId.find('h2').text(other_user_id)
    newDivId.find('video').attr('id', "v_" + connId)
    newDivId.find('audio').attr('id', "a_" + connId)
    newDivId.show()
    $('#divUsers').append(newDivId)
  }

  return {
    _init: function (uid, mid) {
      init(uid, mid)
    }
  }
})()