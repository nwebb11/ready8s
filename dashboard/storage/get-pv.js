const app = App()
let lastResourceVersion

fetch(`/api/v1/persistentvolumes`)
  .then((response) => response.json())
  .then((response) => {
    const pVolume = response.items
    lastResourceVersion = response.metadata.resourceVersion
    pVolume.forEach((pv) => {
      const pvID = `${pv.metadata.namespace}-${pv.metadata.name}`
      app.upsert(pvID, pv)
      console.log('PERSISTENTVOLUME:', pvID)
   })
})
.then(() => streamUpdates())

function streamUpdates(apiString) {
  fetch(`/api/v1/persistentvolumes?watch=1&resourceVersion=${lastResourceVersion}`)
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
            const pv = event.object
            const pvID = `${pv.metadata.namespace}-${pv.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, pv.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                app.upsert(pvID, pv)
                break
              }
              case 'DELETED': {
                app.remove(pvID)
                break
              }
              case 'MODIFIED': {
                app.upsert(pvID, pv)
                break
              }
              case 'Progressing': {
                app.upsert(pvID, pv)
                break
              }
              case 'Available': {
                app.upsert(pvID, pv)
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
  const allPV = new Map()
  const content = document.querySelector('#content')

  function render() {
    const pVolumes = Array.from(allPV.values())
    if (pVolumes.length === 0) {
      return
    }
    const pVolumesByNamespace = groupBy(pVolumes, (it) => it.namespace)
    const namespaceTemplates = Object.keys(pVolumesByNamespace).map((namespace) => {
      const pVolumes = pVolumesByNamespace[namespace]
      return [
        '<div class="bg-blue center mv4 ba b--black-10 br2 shadow-1" style="width:70%;">',
          `<h3 class="white mh6">${namespace}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<div class="center mv2 bg-white br2" style="width:90%;">',
            '<table class="mv4 center" style="width:100%;">',
              '<tr class="striped--light-gray">',
                '<th>PV NAME</th>',
                '<th>CAPACITY</th>',
                '<th>ACCESS MODES</th>',
                '<th>RECLAIM POLICY</th>',
                '<th>STATUS</th>',
                '<th>CLAIM</th>',
                '<th>STORAGE CLASS</th>',
                '<th>REASON</th>',
                '<th>VOLUME MODE</th>',
              '</tr>',
              `${renderNamespace(pVolumes)}`,
            '</table>',
          '</div>',
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${namespaceTemplates.join('')}</ul>`

    function renderNamespace(pVolumes) {
      return [
        pVolumes
          .map((pv) =>
            [
              '<tr class="striped--light-gray">',
                `<td style="width:40%;"><a href="#popup${pv.name}">${pv.name}</a></td>`,
                `<td style="width:60%;text-align:center;">${pv.capacity}</td>`,
                `<td style="width:60%;text-align:center;">${pv.accessModes}</td>`,
                `<td style="width:60%;text-align:center;">${pv.reclaimPolicy}</td>`,
                `<td style="width:60%;text-align:center;">${pv.status}</td>`,
                `<td style="width:60%;text-align:center;">${pv.claim}</td>`,
                `<td style="width:60%;text-align:center;">${pv.storageClass}</td>`,
                `<td style="width:60%;text-align:center;">${pv.reason}</td>`,
                `<td style="width:60%;text-align:center;">${pv.volumeMode}</td>`,
              '</tr>',
              `<div id="popup${pv.name}" class="overlay">`,
                `<div class="popup">`,
                  `<h2>Persistant Volume Logs - ${pv.name}</h2>`,
                  `<a class="close" href="#">&times;</a>`,
                  `<div class="content">`,
                    `<p>${pv.logMessage}</p>`,
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
    upsert(pvID, pv) {
      var volCapacity = "NONE";
      var modesAccess = "NONE";
      var policyReclaim = "NONE";
      var currStatus = "NONE";
      var currClaim = "NONE";
      var classStroage = "NONE";
      var volReason = "NONE";
      var modeVolume = "NONE";
      var pvLog = [];
      if (!pv.metadata.name) {
        return
      }
      if (pv.spec.capacity.storage) {
          volCapacity = pv.spec.capacity.storage;
      }
      if (pv.spec.accessModes[0]) {
          modesAccess = pv.spec.accessModes[0];
      }
      if (pv.spec.persistentVolumeReclaimPolicy) {
          policyReclaim = pv.spec.persistentVolumeReclaimPolicy;
      }
      if (pv.status.phase) {
          currStatus = pv.status.phase;
      }
      if (pv.spec.volumeMode) {
          modeVolume = pv.spec.volumeMode;
      }
      if (pv.metadata) {
        pvLog.push("UID: " + pv.metadata.uid + "<br />");
        pvLog.push("Resource Version: " + pv.metadata.resourceVersion + "<br />");
        pvLog.push("Creation Timestamp: " + pv.metadata.creationTimestamp + "<br />");
        var logArray = pvLog.join(' ');
      }
      allPV.set(pvID, {
        name: pv.metadata.name,
        namespace: pv.metadata.namespace,
        capacity: volCapacity,
        accessModes: modesAccess,
        reclaimPolicy: policyReclaim,
        status: currStatus,
        claim: currClaim,
        storageClass: classStroage,
        reason: volReason,
        volumeMode: modeVolume,
        logMessage: logArray,
      })
      render()
    },
    remove(pvID) {
      allPV.delete(pvID)
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