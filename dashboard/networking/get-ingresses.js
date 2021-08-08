const app = App()
let lastResourceVersion

fetch(`/apis/networking.k8s.io/v1/ingresses`)
  .then((response) => response.json())
  .then((response) => {
    const ingresses = response.items
    lastResourceVersion = response.metadata.resourceVersion
    ingresses.forEach((ingress) => {
      const ingressID = `${ingress.metadata.namespace}-${ingress.metadata.name}`
      app.upsert(ingressID, ingress)
      console.log('INGRESSES:', ingressID)
   })
})
.then(() => streamUpdates())

function streamUpdates(apiString) {
  fetch(`/apis/networking.k8s.io/v1/ingresses?watch=1&resourceVersion=${lastResourceVersion}`)
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
            const ingress = event.object
            const ingressID = `${ingress.metadata.namespace}-${ingress.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, ingress.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                app.upsert(ingressID, ingress)
                break
              }
              case 'DELETED': {
                app.remove(ingressID)
                break
              }
              case 'MODIFIED': {
                app.upsert(ingressID, ingress)
                break
              }
              case 'Progressing': {
                app.upsert(ingressID, ingress)
                break
              }
              case 'Available': {
                app.upsert(ingressID, ingress)
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
  const allIngresses = new Map()
  const content = document.querySelector('#content')

  function render() {
    const ingresses = Array.from(allIngresses.values())
    if (ingresses.length === 0) {
      return
    }
    const ingressesByNamespace = groupBy(ingresses, (it) => it.namespace)
    const namespaceTemplates = Object.keys(ingressesByNamespace).map((namespace) => {
      const ingresses = ingressesByNamespace[namespace]
      return [
        '<div class="bg-blue center mv4 ba b--black-10 br2 shadow-1" style="width:70%;">',
          `<h3 class="white mh6">${namespace}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<div class="center mv2 bg-white br2" style="width:90%;">',
            '<table class="mv4 center" style="width:100%;">',
              '<tr class="striped--light-gray">',
                '<th>INGRESS NAME</th>',
                '<th>RULES</th>',
                '<th>HOSTS</th>',
                '<th>ADDRESS</th>',
                '<th>PORTS</th>',
              '</tr>',
              `${renderNamespace(ingresses)}`,
            '</table>',
          '</div>',
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${namespaceTemplates.join('')}</ul>`

    function renderNamespace(ingresses) {
      return [
        ingresses
          .map((ingress) =>
            [
              '<tr class="striped--light-gray">',
                `<td style="width:30%;"><a href="#popup${ingress.name}">${ingress.name}</a></td>`,
                `<td style="width:30%;text-align:center;">${ingress.rules}</td>`,
                `<td style="width:10%;text-align:center;">${ingress.hosts}</td>`,
                `<td style="width:10%;text-align:center;">${ingress.address}</td>`,
                `<td style="width:10%;text-align:center;">${ingress.ports}</td>`,
              '</tr>',
              `<div id="popup${ingress.name}" class="overlay">`,
                `<div class="popup">`,
                  `<h2>Ingress Logs - ${ingress.name}</h2>`,
                  `<a class="close" href="#">&times;</a>`,
                  `<div class="content">`,
                    `<p>${ingress.logMessage}</p>`,
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
    upsert(ingressID, ingress) {
      var ruleList = [];
      var hostList = [];
      var portList = [];
      var ipaddress = "NONE";
      var ingressLog = [];
      var host = "NONE";
      var path = "NONE";
      var portNum = "NONE";
      var serviceName = "NONE";
      var logArray = [];
      if (!ingress.metadata.name) {
        return
      }
      if (ingress.spec.rules) {
        for (i = 0; i < ingress.spec.rules.length; i++) {
          if (ingress.spec.rules[i].host) {
            host = ingress.spec.rules[i].host;
          } else {
            host = "*";
          }
          hostList.push(host);
          for (j = 0; j < ingress.spec.rules[i].http.paths.length; j++) {
            path = ingress.spec.rules[i].http.paths[j].path;
            serviceName = ingress.spec.rules[i].http.paths[j].backend.service.name;
            portNum = ingress.spec.rules[i].http.paths[j].backend.service.port.number;
            if (ingress.spec.rules[i].http.paths[j].backend.service.address) {
              ipaddress = ingress.spec.rules[i].http.paths[j].backend.service.address;
            }
            portList.push(portNum);
            if (host == "*") {
              ruleList.push("http://*" + path + " -> " + serviceName + ":" + portNum);
            } else {
              ruleList.push("http://" + host + path + " -> " + serviceName + ":" + portNum);
            }
          }
        }
      }
      if (ingress.spec.defaultBackend) {
        host = "*";
        portNum = ingress.spec.defaultBackend.service.port.number;
        hostList.push(host);
        portList.push(portNum);
      }
      if (ingress.metadata) {
        ingressLog.push("UID: " + ingress.metadata.uid + "<br />");
        ingressLog.push("Resource Version: " + ingress.metadata.resourceVersion + "<br />");
        ingressLog.push("Generation: " + ingress.metadata.generation + "<br />");
        ingressLog.push("Creation Timestamp: " + ingress.metadata.creationTimestamp + "<br />");
        var logArray = ingressLog.join(' ');
      }
      allIngresses.set(ingressID, {
        name: ingress.metadata.name,
        namespace: ingress.metadata.namespace,
        rules: ruleList,
        hosts: hostList,
        address: ipaddress,
        ports: portList,
        logMessage: logArray,
      })
      render()
    },
    remove(ingressID) {
      allIngresses.delete(ingressID)
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