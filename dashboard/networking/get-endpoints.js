const app = App()
let lastResourceVersion

fetch(`/api/v1/endpoints`)
  .then((response) => response.json())
  .then((response) => {
    const endpoints = response.items
    lastResourceVersion = response.metadata.resourceVersion
    endpoints.forEach((endpoint) => {
      const endpointID = `${endpoint.metadata.namespace}-${endpoint.metadata.name}`
      app.upsert(endpointID, endpoint)
      console.log('ENDPOINTS:', endpointID)
   })
})
.then(() => streamUpdates())

function streamUpdates(apiString) {
  fetch(`/api/v1/endpoints?watch=1&resourceVersion=${lastResourceVersion}`)
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
            const endpoint = event.object
            const endpointID = `${endpoint.metadata.namespace}-${endpoint.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, endpoint.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                app.upsert(endpointID, endpoint)
                break
              }
              case 'DELETED': {
                app.remove(endpointID)
                break
              }
              case 'MODIFIED': {
                app.upsert(endpointID, endpoint)
                break
              }
              case 'Progressing': {
                app.upsert(endpointID, endpoint)
                break
              }
              case 'Available': {
                app.upsert(endpointID, endpoint)
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
  const allEndpoints = new Map()
  const content = document.querySelector('#content')

  function render() {
    const endpoints = Array.from(allEndpoints.values())
    if (endpoints.length === 0) {
      return
    }
    const endpointsByNamespace = groupBy(endpoints, (it) => it.namespace)
    const namespaceTemplates = Object.keys(endpointsByNamespace).map((namespace) => {
      const endpoints = endpointsByNamespace[namespace]
      return [
        '<div class="bg-blue center mv4 ba b--black-10 br2 shadow-1" style="width:70%;">',
          `<h3 class="white mh6">${namespace}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<div class="center mv2 bg-white br2" style="width:90%;">',
            '<table class="mv4 center" style="width:100%;">',
              '<tr class="striped--light-gray">',
                '<th>ENDPOINT NAME</th>',
                '<th>ENDPOINTS</th>',
              '</tr>',
              `${renderNamespace(endpoints)}`,
            '</table>',
          '</div>',
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${namespaceTemplates.join('')}</ul>`

    function renderNamespace(endpoints) {
      return [
        endpoints
          .map((endpoint) =>
            [
              '<tr class="striped--light-gray">',
                `<td style="width:40%;"><a href="#popup${endpoint.name}">${endpoint.name}</a></td>`,
                `<td style="width:60%;text-align:center;">${endpoint.ips}</td>`,
              '</tr>',
              `<div id="popup${endpoint.name}" class="overlay">`,
                `<div class="popup">`,
                  `<h2>Endpoint Logs - ${endpoint.name}</h2>`,
                  `<a class="close" href="#">&times;</a>`,
                  `<div class="content">`,
                    `<p>${endpoint.logMessage}</p>`,
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
    upsert(endpointID, endpoint) {
      var ipList = [];
      var endpointLog = [];
      if (!endpoint.metadata.name) {
        return
      }
      if (endpoint.subsets[0].addresses) {
        var i;
        for (i = 0; i < endpoint.subsets[0].addresses.length; i++) {
          for (j = 0; j < endpoint.subsets[0].ports.length; j++) {
            var entry = endpoint.subsets[0].addresses[i].ip + ":" + endpoint.subsets[0].ports[j].port
            ipList.push(entry);
            //ipList.push(endpoint.subsets[0].addresses[i].ip);
          }
        }
      }
      if (endpoint.metadata) {
        endpointLog.push("UID: " + endpoint.metadata.uid + "<br />");
        endpointLog.push("Resource Version: " + endpoint.metadata.resourceVersion + "<br />");
        endpointLog.push("Creation Timestamp: " + endpoint.metadata.creationTimestamp + "<br />");
        var logArray = endpointLog.join(' ');
      }
      allEndpoints.set(endpointID, {
        name: endpoint.metadata.name,
        namespace: endpoint.metadata.namespace,
        ips: ipList,
        logMessage: logArray,
      })
      render()
    },
    remove(endpointID) {
      allEndpoints.delete(endpointID)
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