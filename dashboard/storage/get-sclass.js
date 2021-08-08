const app = App()
let lastResourceVersion

fetch(`/apis/storage.k8s.io/v1/storageclasses`)
  .then((response) => response.json())
  .then((response) => {
    const storageClass = response.items
    lastResourceVersion = response.metadata.resourceVersion
    storageClass.forEach((sClass) => {
      const sClassID = `${sClass.metadata.namespace}-${sClass.metadata.name}`
      app.upsert(sClassID, sClass)
      console.log('STORAGECLASS:', sClassID)
   })
})
.then(() => streamUpdates())

function streamUpdates(apiString) {
  fetch(`/apis/storage.k8s.io/v1/storageclasses?watch=1&resourceVersion=${lastResourceVersion}`)
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
            const sClass = event.object
            const sClassID = `${sClass.metadata.namespace}-${sClass.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, sClass.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                app.upsert(sClassID, sClass)
                break
              }
              case 'DELETED': {
                app.remove(sClassID)
                break
              }
              case 'MODIFIED': {
                app.upsert(sClassID, sClass)
                break
              }
              case 'Progressing': {
                app.upsert(sClassID, sClass)
                break
              }
              case 'Available': {
                app.upsert(sClassID, sClass)
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
  const allSClass = new Map()
  const content = document.querySelector('#content')

  function render() {
    const storageClasses = Array.from(allSClass.values())
    if (storageClasses.length === 0) {
      return
    }
    const storageClassesByNamespace = groupBy(storageClasses, (it) => it.namespace)
    const namespaceTemplates = Object.keys(storageClassesByNamespace).map((namespace) => {
      const storageClasses = storageClassesByNamespace[namespace]
      return [
        '<div class="bg-blue center mv4 ba b--black-10 br2 shadow-1" style="width:70%;">',
          `<h3 class="white mh6">${namespace}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<div class="center mv2 bg-white br2" style="width:90%;">',
            '<table class="mv4 center" style="width:100%;">',
              '<tr class="striped--light-gray">',
                '<th>STORAGE CLASS NAME</th>',
                '<th>PROVISIONER</th>',
                '<th>RECLAIM POLICY</th>',
                '<th>VOLUME BINDING MODE</th>',
                '<th>CLUSTER ID</th>',
                '<th>POOL</th>',
              '</tr>',
              `${renderNamespace(storageClasses)}`,
            '</table>',
          '</div>',
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${namespaceTemplates.join('')}</ul>`

    function renderNamespace(storageClasses) {
      return [
        storageClasses
          .map((sClass) =>
            [
              '<tr class="striped--light-gray">',
                `<td style="width:40%;"><a href="#popup${sClass.name}">${sClass.name}</a></td>`,
                `<td style="width:60%;text-align:center;">${sClass.provisioner}</td>`,
                `<td style="width:60%;text-align:center;">${sClass.reclaimPolicy}</td>`,
                `<td style="width:60%;text-align:center;">${sClass.volumeBindingMode}</td>`,
                `<td style="width:60%;text-align:center;">${sClass.clusterID}</td>`,
                `<td style="width:60%;text-align:center;">${sClass.pool}</td>`,
              '</tr>',
              `<div id="popup${sClass.name}" class="overlay">`,
                `<div class="popup">`,
                  `<h2>Persistant Volume Claim Logs - ${sClass.name}</h2>`,
                  `<a class="close" href="#">&times;</a>`,
                  `<div class="content">`,
                    `<p>${sClass.logMessage}</p>`,
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
    upsert(sClassID, sClass) {
      var storageProvisioner = "NONE";
      var policyReclaim = "NONE";
      var modeBindingVolume = "NONE";
      var idCluster = "NONE";
      var poolType = "NONE";
      var sClassLog = [];
      if (!sClass.metadata.name) {
        return
      }
      if (sClass.provisioner) {
        storageProvisioner = sClass.provisioner;
      }
      if (sClass.reclaimPolicy) {
        policyReclaim = sClass.reclaimPolicy;
      }
      if (sClass.volumeBindingMode) {
        modeBindingVolume = sClass.volumeBindingMode;
      }
      if (sClass.parameters.clusterID) {
        idCluster = sClass.parameters.clusterID;
      }
      if (sClass.parameters.pool) {
        poolType = sClass.parameters.pool;
      }
      if (sClass.metadata) {
        sClassLog.push("UID: " + sClass.metadata.uid + "<br />");
        sClassLog.push("Resource Version: " + sClass.metadata.resourceVersion + "<br />");
        sClassLog.push("Creation Timestamp: " + sClass.metadata.creationTimestamp + "<br />");
        var logArray = sClassLog.join(' ');
      }
      allSClass.set(sClassID, {
        name: sClass.metadata.name,
        namespace: sClass.metadata.namespace,
        provisioner: storageProvisioner,
        reclaimPolicy: policyReclaim,
        volumeBindingMode: modeBindingVolume,
        clusterID: idCluster,
        pool: poolType,
        logMessage: logArray,
      })
      render()
    },
    remove(sClassID) {
      allSClass.delete(sClassID)
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