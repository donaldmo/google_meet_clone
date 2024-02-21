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

    socket.on("connect", () => {
      if (socket.connected) {

        if (user_id != "" && meeting_id != "") {
          socket.emit('userconnect', {
            displayName: user_id,
            meetingId: meeting_id
          })
        }
      }
    })

    socket.on('inform_others_about_me', data => addUser(data))
  }

  function addUser() {
    var originalDiv = document.getElementById('otherTemplate')

    var newDivId = originalDiv.cloneNode(true)
    newDivId.setAttribute('id', connId)
    newDivId.classList.add('other')

    var h2Element = newDivId.querySelector('h2')
    h2Element.textContent = other_user_id
    newDivId.querySelector('video').setAttribute('id', 'v_' + connId)
    newDivId.querySelector('audio').setAttribute('id', 'a_' + connId)
    newDivId.style.display = 'block'
    document.getElementById('divUsers').appendChild(newDivId)
  }

  return {
    _init: function (uid, mid) {
      init(uid, mid)
    }
  }
})()