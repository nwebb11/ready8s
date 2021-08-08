const app = App()
let lastResourceVersion

fetch(`/api/v1/services`)
  .then((response) => response.json())
  .then((response) => {
    const services = response.items
    lastResourceVersion = response.metadata.resourceVersion
    services.forEach((service) => {
      const serviceID = `${service.metadata.namespace}-${service.metadata.name}`
      app.upsert(serviceID, service)
      console.log('SERVICES:', serviceID)
   })
})
.then(() => streamUpdates())

function streamUpdates(apiString) {
  fetch(`/api/v1/services?watch=1&resourceVersion=${lastResourceVersion}`)
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
            const service = event.object
            const serviceID = `${service.metadata.namespace}-${service.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, service.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                app.upsert(serviceID, service)
                break
              }
              case 'DELETED': {
                app.remove(serviceID)
                break
              }
              case 'MODIFIED': {
                app.upsert(serviceID, service)
                break
              }
              case 'Progressing': {
                app.upsert(serviceID, service)
                break
              }
              case 'Available': {
                app.upsert(serviceID, service)
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
  const allServices = new Map()
  const content = document.querySelector('#content')

  function render() {
    const services = Array.from(allServices.values())
    if (services.length === 0) {
      return
    }
    const servicesByNamespace = groupBy(services, (it) => it.namespace)
    const namespaceTemplates = Object.keys(servicesByNamespace).map((namespace) => {
      const services = servicesByNamespace[namespace]
      return [
        '<div class="bg-blue center mv4 ba b--black-10 br2 shadow-1" style="width:70%;">',
          `<h3 class="white mh6">${namespace}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<div class="center mv2 bg-white br2" style="width:90%;">',
            '<table class="mv4 center" style="width:100%;">',
              '<tr class="striped--light-gray">',
                '<th>SERVICE NAME</th>',
                '<th>TYPE</th>',
                '<th>CLUSTER-IP</th>',
                '<th>EXTERNAL-IP</th>',
                '<th>PORTS</th>',
                '<th>BOUND PORTS</th>',
                '<th>SELECTOR</th>',
              '</tr>',
              `${renderNamespace(services)}`,
            '</table>',
          '</div>',
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${namespaceTemplates.join('')}</ul>`

    function renderNamespace(services) {
      return [
        services
          .map((service) =>
            [
              '<tr class="striped--light-gray">',
                `<td style="width:40%;"><a href="#popup${service.name}">${service.name}</a></td>`,
                `<td style="width:10%;text-align:center;">${service.type}</td>`,
                `<td style="width:10%;text-align:center;">${service.clusterIP}</td>`,
                `<td style="width:10%;text-align:center;">${service.externalIP}</td>`,
                `<td style="width:10%;text-align:center;">${service.ports}</td>`,
                `<td style="width:10%;text-align:center;">${service.nodePort}</td>`,
                `<td style="width:10%;text-align:center;">${service.app}</td>`,
              '</tr>',
              `<div id="popup${service.name}" class="overlay">`,
                `<div class="popup">`,
                  `<h2>Service Logs - ${service.name}</h2>`,
                  `<a class="close" href="#">&times;</a>`,
                  `<div class="content">`,
                    `<p>${service.logMessage}</p>`,
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
    upsert(serviceID, service) {
      var extIP = "NONE";
      var appSelect = "NONE";
      var portNum = [];
      var nodePortNum = "NONE";
          var serviceLog = [];
      if (!service.metadata.name) {
        return
      }
      if (service.spec.type == "LoadBalancer") {
        extIP = service.status.loadBalancer.ingress[0].ip;
        nodePortNum = service.spec.ports[0].port + ":" + service.spec.ports[0].nodePort;
      } else {
        nodePortNum = "NONE"
      }
      if (service.spec.ports) {
        var i;
        var appSelect = [];
        for (i = 0; i < service.spec.ports.length; i++) {
          portNum.push(service.spec.ports[i].port + "/" + service.spec.ports[i].protocol);
        }
      }
      if (service.spec.selector) {
        if (service.spec.selector.app) {
          appSelect = service.spec.selector.app;
        } else if (service.spec.selector.name) {
          appSelect = service.spec.selector.name;
        } else if (service.spec.selector.k8s-app) {
          appSelect = service.spec.selector.k8s-app;
        } else {
          appSelect = "NONE";
        }
      }
      if (service.metadata) {
        serviceLog.push("UID: " + service.metadata.uid + "<br />");
        serviceLog.push("Resource Version: " + service.metadata.resourceVersion + "<br />");
        serviceLog.push("Creation Timestamp: " + service.metadata.creationTimestamp + "<br />");
        var logArray = serviceLog.join(' ');
      }
      allServices.set(serviceID, {
        name: service.metadata.name,
        namespace: service.metadata.namespace,
        type: service.spec.type,
        clusterIP: service.spec.clusterIP,
        externalIP: extIP,
        ports: portNum,
        nodePort: nodePortNum,
        app: appSelect,
        logMessage: logArray,
      })
      render()
    },
    remove(serviceID) {
      allServices.delete(serviceID)
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