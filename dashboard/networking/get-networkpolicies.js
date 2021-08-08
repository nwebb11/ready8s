const app = App()
let lastResourceVersion

fetch(`/apis/networking.k8s.io/v1/networkpolicies`)
  .then((response) => response.json())
  .then((response) => {
    const networkpolicies = response.items
    lastResourceVersion = response.metadata.resourceVersion
    networkpolicies.forEach((networkpolicy) => {
      const networkpolicyID = `${networkpolicy.metadata.namespace}-${networkpolicy.metadata.name}`
      app.upsert(networkpolicyID, networkpolicy)
      console.log('NETWORKPOLICY:', networkpolicyID)
   })
})
.then(() => streamUpdates())

function streamUpdates(apiString) {
  fetch(`/apis/networking.k8s.io/v1/networkpolicies?watch=1&resourceVersion=${lastResourceVersion}`)
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
            const networkpolicy = event.object
            const networkpolicyID = `${networkpolicy.metadata.namespace}-${networkpolicy.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, networkpolicy.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                app.upsert(networkpolicyID, networkpolicy)
                break
              }
              case 'DELETED': {
                app.remove(networkpolicyID)
                break
              }
              case 'MODIFIED': {
                app.upsert(networkpolicyID, networkpolicy)
                break
              }
              case 'Progressing': {
                app.upsert(networkpolicyID, networkpolicy)
                break
              }
              case 'Available': {
                app.upsert(networkpolicyID, networkpolicy)
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
  const allNetworkpolicies = new Map()
  const content = document.querySelector('#content')

  function render() {
    const networkpolicies = Array.from(allNetworkpolicies.values())
    if (networkpolicies.length === 0) {
      return
    }
    const networkpoliciesByNamespace = groupBy(networkpolicies, (it) => it.namespace)
    const namespaceTemplates = Object.keys(networkpoliciesByNamespace).map((namespace) => {
      const networkpolicies = networkpoliciesByNamespace[namespace]
      return [
        '<div class="bg-blue center mv4 ba b--black-10 br2 shadow-1" style="width:70%;">',
          `<h3 class="white mh6">${namespace}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<div class="center mv2 bg-white br2" style="width:90%;">',
            '<table class="mv4 center" style="width:100%;">',
              '<tr class="striped--light-gray">',
                '<th>NETWORKPOLICY NAME</th>',
                '<th>POLICY TYPES</th>',
                '<th>POD SELECTOR</th>',
              '</tr>',
              `${renderNamespace(networkpolicies)}`,
            '</table>',
          '</div>',
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${namespaceTemplates.join('')}</ul>`

    function renderNamespace(networkpolicies) {
      return [
        networkpolicies
          .map((networkpolicy) =>
            [
              '<tr class="striped--light-gray">',
                `<td style="width:40%;"><a href="#popup${networkpolicy.name}">${networkpolicy.name}</a></td>`,
                `<td style="width:10%;text-align:center;">${networkpolicy.policytype}</td>`,
                `<td style="width:10%;text-align:center;">${networkpolicy.podselector}</td>`,
              '</tr>',
              `<div id="popup${networkpolicy.name}" class="overlay">`,
                `<div class="popup">`,
                  `<h2>Network Policy Logs - ${networkpolicy.name}</h2>`,
                  `<a class="close" href="#">&times;</a>`,
                  `<div class="content">`,
                    `<p>${networkpolicy.logMessage}</p>`,
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
    upsert(networkpolicyID, networkpolicy) {
      var netpolicyLog = [];
      var polType = [];
      var podSelect = "NONE";
      if (!networkpolicy.metadata.name) {
        return
      }
      if (networkpolicy.spec.ingress) {
        polType.push("Ingress");
      }
      if (networkpolicy.spec.egress) {
        polType.push("Egress");
      }
      if (networkpolicy.spec.podSelector.matchLabels) {
        podSelect = networkpolicy.spec.podSelector.matchLabels.role;
      }
      if (networkpolicy.metadata) {
        netpolicyLog.push("UID: " + networkpolicy.metadata.uid + "<br />");
        netpolicyLog.push("Resource Version: " + networkpolicy.metadata.resourceVersion + "<br />");
        netpolicyLog.push("Generation: " + networkpolicy.metadata.generation + "<br />");
        netpolicyLog.push("Creation Timestamp: " + networkpolicy.metadata.creationTimestamp + "<br />");
        var logArray = netpolicyLog.join(' ');
      }
      allNetworkpolicies.set(networkpolicyID, {
        name: networkpolicy.metadata.name,
        namespace: networkpolicy.metadata.namespace,
        policytype: polType,
        podselector: podSelect,
        logMessage: logArray,
      })
      render()
    },
    remove(networkpolicyID) {
      allNetworkpolicies.delete(networkpolicyID)
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