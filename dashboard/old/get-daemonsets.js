const app = App()
let lastResourceVersion

fetch(`/apis/apps/v1/daemonsets`)
  .then((response) => response.json())
  .then((response) => {
    const daemonsets = response.items
    lastResourceVersion = response.metadata.resourceVersion
    daemonsets.forEach((daemonset) => {
      const daemonsetID = `${daemonset.metadata.namespace}-${daemonset.metadata.name}`
      app.upsert(daemonsetID, daemonset)
      console.log('DAEMONSETS:', daemonsetID)
   })
})
.then(() => streamUpdates())

function streamUpdates(apiString) {
  fetch(`/apis/apps/v1/daemonsets?watch=1&resourceVersion=${lastResourceVersion}`)
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
            const daemonset = event.object
            const daemonsetID = `${daemonset.metadata.namespace}-${daemonset.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, daemonset.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                app.upsert(daemonsetID, daemonset)
                break
              }
              case 'DELETED': {
                app.remove(daemonsetID)
                break
              }
              case 'MODIFIED': {
                app.upsert(daemonsetID, daemonset)
                break
              }
              case 'Progressing': {
                app.upsert(daemonsetID, daemonset)
                break
              }
              case 'Available': {
                app.upsert(daemonsetID, daemonset)
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
  const allDaemonsets = new Map()
  const content = document.querySelector('#content')

  function render() {
    const daemonsets = Array.from(allDaemonsets.values())
    if (daemonsets.length === 0) {
      return
    }
    const daemonsetsByNamespace = groupBy(daemonsets, (it) => it.namespace)
    const namespaceTemplates = Object.keys(daemonsetsByNamespace).map((namespace) => {
      const daemonsets = daemonsetsByNamespace[namespace]
      return [
        '<div class="bg-blue center mv4 ba b--black-10 br2 shadow-1 grow" style="width:70%;">',
          `<h3 class="white mh6">${namespace}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<table class="mv4 center bg-light-blue" style="width:85%;">',
            '<tr>',
              '<th>DAEMON SET NAME</th>',
              '<th>DESIRED</th>',
              '<th>CURRENT</th>',
              '<th>READY</th>',
              '<th>UP-TO-DATE</th>',
              '<th>AVAILABLE</th>',
            '</tr>',
            `${renderNamespace(daemonsets)}`,
          '</table>',
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${namespaceTemplates.join('')}</ul>`

    function renderNamespace(daemonsets) {
      return [
        daemonsets
          .map((daemonset) =>
            [
              '<tr>',
                `<td style="width:30%;">${daemonset.name}</td>`,
                `<td style="width:10%;text-align:center;">${daemonset.desiredNumberScheduled}</td>`,
                `<td style="width:10%;text-align:center;">${daemonset.currentNumberScheduled}</td>`,
                `<td style="width:10%;text-align:center;">${daemonset.numberReady}</td>`,
                `<td style="width:10%;text-align:center;">${daemonset.updatedNumberScheduled}</td>`,
                `<td style="width:10%;text-align:center;">${daemonset.numberAvailable}</td>`,
              '</tr>',
            ].join(''),
          )
          .join(''),
      ].join('')
    }
  }

  return {
    upsert(daemonsetID, daemonset) {
      if (!daemonset.status.desiredNumberScheduled) {
        return
      }
      allDaemonsets.set(daemonsetID, {
        name: daemonset.metadata.name,
        namespace: daemonset.metadata.namespace,
        desiredNumberScheduled: daemonset.status.desiredNumberScheduled,
        currentNumberScheduled: daemonset.status.currentNumberScheduled,
        numberReady: daemonset.status.numberReady,
        updatedNumberScheduled: daemonset.status.updatedNumberScheduled,
        numberAvailable: daemonset.status.numberAvailable,
      })
      render()
    },
    remove(daemonsetID) {
      allDaemonsets.delete(daemonsetID)
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
