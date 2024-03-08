var AppProcess = (function () {
  var serverProcess
  var my_connection_id

  var peers_connection_ids = []
  var peers_connection = []

  var remote_vid_stream = []
  var remote_aud_stream = []

  var local_div
  var audio
  var isAudioMute = true
  var rtp_aud_senders = []

  var video_states = { None: 0, Camera: 1, ScreenShare: 2 }
  var video_st = video_states.None
  var videoCamTrack
  var rtp_vid_senders = []

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
    eventProcess()
    local_div = document.getElementById("locaVideoPlayer");
  }

  function eventProcess() {
    $("#miceMuteUnmute").on("click", async function () {
      if (!audio) {
        await loadAudio();
      }

      if (!audio) {
        alert("Audio permission has not granted.")
        return
      }

      if (isAudioMute) {
        audio.enabled = true
        $(this).html('<span class="material-icons" style="width: 100%;">mic</span>')
        updateMediaSenders(audio, rtp_aud_senders)
      }
      else {
        audio.enabled = false
        $(this).html('<span class="material-icons" style="width: 100%;">mic_off</span>')
        removeMediaSenders(rtp_aud_senders)
      }

      isAudioMute = !isAudioMute
    })


    // <span class="material-icons" style="width: 100%;">videocam_off</span>
    $("#videoCamOnOff").on("click", async function () {
      if (video_st == video_states.Camera) {
        await videoProcess(video_states.None)
      }
      else {
        await videoProcess(video_states.Camera)
      }
    })

    $("#ScreenShareOnOf").on("click", async function () {
      if (video_st == video_states.ScreenShare) {
        await videoProcess(video_states.None)
      }
      else {
        await videoProcess(video_states.ScreenShare)
      }
    })
  }

  async function loadAudio() { }

  async function videoProcess(newVideoState) {
    try {
      var vstream = null

      if (newVideoState == video_states.Camera) {
        vstream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1920, height: 1080 },
          audio: false
        })
      }

      else if (newVideoState == video_states.ScreenShare) {
        vstream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080 },
          audio: false
        })
      }

      if (vstream && vstream.getVideoTracks().length > 0) {
        videoCamTrack = vstream.getVideoTracks()[0]
        if (videoCamTrack) {
          local_div.srcObject = new MediaStream([videoCamTrack])
          updateMediaSenders(videoCamTrack, rtp_vid_senders)
        }
      }
    }
    catch (error) {
      console.log(error)
      return
    }

    video_st = newVideoState
  }

  async function removeMediaSenders() { }

  function updateMediaSenders(videoCamTrack, rtp_vid_senders) { }

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
        videoTracks.forEach(track => (
          remote_vid_stream[connId].removeTrack(track))
        )
        remote_vid_stream[connId].addTrack(event.track)

        remoteVidPlayer = document.getElementById('v_' + connId)
        remoteVidPlayer.srcObject = null
        remoteVidPlayer.srcObject = remote_vid_stream[connId]
        remoteVidPlayer.load()
      }
      else if (event.track.kind == "audio") {
        var audioTracks = remote_vid_stream[connId].getAudioTracks()
        audioTracks.forEach(track => (
          remote_aud_stream[connId].removeTrack(track))
        )
        remote_aud_stream[connId].addTrack(event.track)

        remoteAudioPlayer = document.getElementById('a_' + connId)
        remoteAudioPlayer.srcObject = null
        remoteAudioPlayer.srcObject = remote_aud_stream[connId]
        remoteAudioPlayer.load()
      }
    }

    peers_connection_ids[connId] = connId
    peers_connection[connId] = connection

    if (video_st == video_states.Camera || video_st.ScreenShare) {
      if (videoCamTrack) {
        updateMediaSenders(videoCamTrack, rtp_vid_senders)
      }
    }

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
      await peers_connection[from_connid].setRemoteDescription(
        new RTPSessionDescription(message.answer)
      )
    }

    if (message.offer) {
      if (!peers_connection[from_connid]) {
        await setConnection(from_connid)
      }

      await peers_connection[from_connid].setRemoteDescription(
        new RTCSessionDescription(message.offer)
      )

      var answer = await peers_connection[from_connid].createOffer()
      await peers_connection[from_connid].setLocalDescription(answer)
      serverProcess(JSON.stringify({ answer: answer }), from_connid)
    }

    if (message.icecandidate) {
      if (!peers_connection[from_connid]) {
        await setConnection(from_connid)
      }

      try {
        await peers_connection[from_connid].addIceCandidate(
          message.icecandidate
        )
      } catch (error) {
        console.log(error)
      }
    }
  }

  return {
    setNewConnection: async function (connId) {
      await setConnection(connId)
    },
    init: async function (SDP_function, my_connid) {
      await _init(SDP_function, my_connid)
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
    $("#meetingContainer").show()
    $("#me h2").text(user_id + "(Me)")
    document.title = user_id
    event_process_for_signaling_server()
  }

  function event_process_for_signaling_server() {
    socket = io.connect()

    var SDP_function = function (data, to_connid) {
      console.log('SDPProcess: ', data, to_connid)

      socket.emit("SDPProcess", {
        message: data,
        to_connid: to_connid
      })
    }

    socket.on("connect", () => {
      if (socket.connected) {
        console.log('connect: ', socket.connected)

        AppProcess.init(SDP_function, socket.id)

        if (user_id != "" && meeting_id != "") {
          socket.emit('userconnect', {
            displayName: user_id,
            meetingId: meeting_id
          })
        }
      }
    })

    socket.on('inform_others_about_me', data => {
      console.log('on: inform_others_about_me: ', data)
      addUser(data.other_user_id, data.connId)
      AppProcess.setNewConnection(data.connId)
    })

    socket.on('inform_me_about_other_user', function (other_users) {
      if (other_users) {
        for (var i = 0; i < other_users.length; i++) {
          addUser(other_users[i].user_id, other_users[i].connectionId)
          AppProcess.setNewConnection(other_users[i].connectionId)
        }
      }
    })

    socket.on("SDPProcess", async function (data) {
      console.log('on: SDPProcess: ', data)
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