const app = App()
let lastResourceVersion

fetch(`/api/v1/persistentvolumeclaims`)
  .then((response) => response.json())
  .then((response) => {
    const pVolumeClaim = response.items
    lastResourceVersion = response.metadata.resourceVersion
    pVolumeClaim.forEach((pvc) => {
      const pvcID = `${pvc.metadata.namespace}-${pvc.metadata.name}`
      app.upsert(pvcID, pvc)
      console.log('PERSISTENTVOLUMECLAIM:', pvcID)
   })
})
.then(() => streamUpdates())

function streamUpdates(apiString) {
  fetch(`/api/v1/persistentvolumeclaims?watch=1&resourceVersion=${lastResourceVersion}`)
    .then((response) => {
      const stream = response.body.getReader()
      const utf8Decoder = new TextDecoder('utf-8')
      let buffer = ''

      // wait for an update and prepare to read it
      return stream.read().then(function onIncomingStream({ done, value }) {
        if (done) {
          console.log('Watch request terminated')
          return
        }
        buffer += utf8Decoder.decode(value)
        const remainingBuffer = findLine(buffer, (line) => {
          try {
            const event = JSON.parse(line)
            const pvc = event.object
            const pvcID = `${pvc.metadata.namespace}-${pvc.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, pvc.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                app.upsert(pvcID, pvc)
                break
              }
              case 'DELETED': {
                app.remove(pvcID)
                break
              }
              case 'MODIFIED': {
                app.upsert(pvcID, pvc)
                break
              }
              case 'Progressing': {
                app.upsert(pvcID, pvc)
                break
              }
              case 'Available': {
                app.upsert(pvcID, pvc)
                break
              }
              default:
                break
            }
            lastResourceVersion = event.object.metadata.resourceVersion
          } catch (error) {
            console.log('Error while parsing', chunk, '\n', error)
          }
        })

        buffer = remainingBuffer

        return stream.read().then(onIncomingStream)
      })
    })
    .then(() => {
      // request terminated
      return streamUpdates()
    })
    .catch((error) => {
     return streamUpdates()
    })
}

function findLine(buffer, fn) {
  const newLineIndex = buffer.indexOf('\n')
  // if the buffer doesn't contain a new line, do nothing
  if (newLineIndex === -1) {
    return buffer
  }
  const chunk = buffer.slice(0, buffer.indexOf('\n'))
  const newBuffer = buffer.slice(buffer.indexOf('\n') + 1)

  // found a new line! execute the callback
  fn(chunk)

  // there could be more lines, checking again
  return findLine(newBuffer, fn)
}

function App() {
  const allPVC = new Map()
  const content = document.querySelector('#content')

  function render() {
    const pVolumeClaims = Array.from(allPVC.values())
    if (pVolumeClaims.length === 0) {
      return
    }
    const pVolumeClaimsByNamespace = groupBy(pVolumeClaims, (it) => it.namespace)
    const namespaceTemplates = Object.keys(pVolumeClaimsByNamespace).map((namespace) => {
      const pVolumeClaims = pVolumeClaimsByNamespace[namespace]
      return [
        '<div class="bg-blue center mv4 ba b--black-10 br2 shadow-1" style="width:70%;">',
          `<h3 class="white mh6">${namespace}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<div class="center mv2 bg-white br2" style="width:90%;">',
            '<table class="mv4 center" style="width:100%;">',
              '<tr class="striped--light-gray">',
                '<th>PVC NAME</th>',
                '<th>STATUS</th>',
                '<th>VOLUME</th>',
                '<th>CAPACITY</th>',
                '<th>ACCESS MODES</th>',
                '<th>STORAGE CLASS</th>',
                '<th>VOLUME MODE</th>',
              '</tr>',
              `${renderNamespace(pVolumeClaims)}`,
            '</table>',
          '</div>',
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${namespaceTemplates.join('')}</ul>`

    function renderNamespace(pVolumeClaims) {
      return [
        pVolumeClaims
          .map((pvc) =>
            [
              '<tr class="striped--light-gray">',
                `<td style="width:40%;"><a href="#popup${pvc.name}">${pvc.name}</a></td>`,
                `<td style="width:60%;text-align:center;">${pvc.status}</td>`,
                `<td style="width:60%;text-align:center;">${pvc.volume}</td>`,
                `<td style="width:60%;text-align:center;">${pvc.capacity}</td>`,
                `<td style="width:60%;text-align:center;">${pvc.accessModes}</td>`,
                `<td style="width:60%;text-align:center;">${pvc.storageClass}</td>`,
                `<td style="width:60%;text-align:center;">${pvc.volumeMode}</td>`,
              '</tr>',
              `<div id="popup${pvc.name}" class="overlay">`,
                `<div class="popup">`,
                  `<h2>Persistant Volume Claim Logs - ${pvc.name}</h2>`,
                  `<a class="close" href="#">&times;</a>`,
                  `<div class="content">`,
                    `<p>${pvc.logMessage}</p>`,
                  `</div>`,
                `</div>`,
              `</div>`,
            ].join(''),
          )
          .join(''),
      ].join('')
    }
  }

  return {
    upsert(pvcID, pvc) {
      var currStatus = "NONE";
      var volumeName = "NONE";
      var volCapacity = "NONE";
      var modesAccess = "NONE";
      var classStorage = "NONE";
      var modeVolume = "NONE";
      var pvcLog = [];
      if (!pvc.metadata.name) {
        return
      }
      if (pvc.status.phase) {
        currStatus = pvc.status.phase;
      }
      if (pvc.spec.resources.requests.storage) {
        volCapacity = pvc.spec.resources.requests.storage;
      }
      if (pvc.spec.accessModes[0]) {
        modesAccess = pvc.spec.accessModes[0];
      }
      if (pvc.spec.storageClassName) {
        classStorage = pvc.spec.storageClassName;
      }
      if (pvc.spec.volumeMode) {
        modeVolume = pvc.spec.volumeMode;
      }
      if (pvc.metadata) {
        pvcLog.push("UID: " + pvc.metadata.uid + "<br />");
        pvcLog.push("Resource Version: " + pvc.metadata.resourceVersion + "<br />");
        pvcLog.push("Creation Timestamp: " + pvc.metadata.creationTimestamp + "<br />");
        var logArray = pvcLog.join(' ');
      }
      allPVC.set(pvcID, {
        name: pvc.metadata.name,
        namespace: pvc.metadata.namespace,
        status: currStatus,
        volume: volumeName,
        capacity: volCapacity,
        accessModes: modesAccess,
        storageClass: classStorage,
        volumeMode: modeVolume,
        logMessage: logArray,
      })
      render()
    },
    remove(pvcID) {
      allPVC.delete(pvcID)
      render()
    },
  }
}

function groupBy(arr, groupByKeyFn) {
  return arr.reduce((acc, c) => {
    const key = groupByKeyFn(c)
    if (!(key in acc)) {
      acc[key] = []
    }
    acc[key].push(c)
    return acc
  }, {})
}