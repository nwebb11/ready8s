const nodeapp = App()
let nodelastResourceVersion
var nodeCounter = 0;

fetch(`/api/v1/nodes`)
  .then((response) => response.json())
  .then((response) => {
    const nodes = response.items
    nodelastResourceVersion = response.metadata.resourceVersion
    nodes.forEach((node) => {
      const nodeID = `${node.metadata.name}-${node.metadata.name}`
      nodeapp.upsert(nodeID, node)
      console.log('NODES:', nodeID)
   })
})
.then(() => streamUpdates())

function streamUpdates(apiString) {
  fetch(`/api/v1/nodes?watch=1&resourceVersion=${nodelastResourceVersion}`)
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
            const node = event.object
            const nodeID = `${node.metadata.name}-${node.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, node.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                nodeapp.upsert(nodeID, node)
                break
              }
              case 'DELETED': {
                nodeapp.remove(nodeID)
                break
              }
              case 'MODIFIED': {
                nodeapp.upsert(nodeID, node)
                break
              }
              case 'Progressing': {
                nodeapp.upsert(nodeID, node)
                break
              }
              case 'Available': {
                nodeapp.upsert(nodeID, node)
                break
              }
              default:
                break
            }
            nodelastResourceVersion = event.object.metadata.resourceVersion
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
  const allNodes = new Map()
  const content = document.querySelector('#node-content')

  function render() {
    var counter = 0;
    const nodes = Array.from(allNodes.values())
    if (nodes.length === 0) {
      return
    }
    //const nodesByName = groupBy(nodes, (it) => it.name)
    //const nameTemplates = Object.keys(nodes).map(() => {
      //const nodes = nodesByName[name]
    const myTemp = [
        '<div class="center bg-white ba b--black-10 br2 shadow-3" style="width:90%;">',
          '<div class="ml4">',
            '<h3>Node Specifications</h3>',
          '</div>',
          '<div class="center mb3 bg-white br2" style="width:95%;">',
            '<table class="mv4 center" style="width:100%;font-size:125%;">',
              '<tr class="striped--light-gray">',
                '<th>NAME</th>',
                '<th>CPUs</th>',
                '<th>MEMORY</th>',
                '<th>POD CAPACITY</th>',
                '<th>IP ADDRESS</th>',
                '<th>OS IMAGE</th>',
                '<th>RUNTIME</th>',
                '<th>KUBELET VERSION</th>',
                '<th>OPERATING SYSTEM</th>',
                '<th>ARCHITECTURE</th>',
              '</tr>',
              `${renderNamespace(nodes)}`,
            '</table>',
          '</div>',
        '</div>',
    ].join('')

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${myTemp}</ul>`

    function renderNamespace(nodes) {
      return [
        nodes
          .map((node) =>
            [
              '<tr class="striped--light-gray">',
                `<td style="width:30%;"><a href="#popup${node.nodeNum}">${node.name}</a></td>`,
                `<td style="width:10%;text-align:center;">${node.cpu}</td>`,
                `<td style="width:10%;text-align:center;">${node.memory}</td>`,
                `<td style="width:10%;text-align:center;">${node.pods}</td>`,
                `<td style="width:10%;text-align:center;">${node.address}</td>`,
                `<td style="width:20%;text-align:center;">${node.osImage}</td>`,
                `<td style="width:10%;text-align:center;">${node.containerRuntimeVersion}</td>`,
                `<td style="width:10%;text-align:center;">${node.kubeletVersion}</td>`,
                `<td style="width:20%;text-align:center;">${node.operatingSystem}</td>`,
                `<td style="width:20%;text-align:center;">${node.architecture}</td>`,
              '</tr>',
              `<div id="popup${node.nodeNum}" class="overlay">`,
                `<div class="popup">`,
                  `<h2>Node Logs - ${node.name}</h2>`,
                  `<a class="close" href="#">&times;</a>`,
                  `<div class="content">`,
                    `<p>${node.logMessage}</p>`,
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
    upsert(nodeID, node) {
      var ipaddress = "NONE";
      var nodeLog = [];
      if (!node.metadata.name) {
        return
      } else {
          nodeCounter += 1;
      }
      if (node.status.addresses) {
        ipaddress = node.status.addresses[0].address;
      }
      if (node.status.conditions) {
        var i;
        for (i = 0; i < node.status.conditions.length; i++) {
          nodeLog.push("Type: " + node.status.conditions[i].type + "<br />");
          nodeLog.push("Status: " + node.status.conditions[i].status + "<br />");
          nodeLog.push("Transition time: " + node.status.conditions[i].lastTransitionTime + "<br />");
          nodeLog.push("Reason: " + node.status.conditions[i].reason + "<br />");
          nodeLog.push("Message: " + node.status.conditions[i].message + "<br />");
          nodeLog.push("<br />");
        }
        var logArray = [];
        var nodeName = node.metadata.name;
        //logArray = nodeLog.join(' ');
        $.getJSON(`/apis/metrics.k8s.io/v1beta1/nodes/${nodeName}`, function(data) {
          nodeLog.unshift("<br />");
          nodeLog.unshift('<hr style="width:99%;">');
          nodeLog.unshift("Memory Usage: " + data.usage.memory + "<br />");
          nodeLog.unshift("CPU Usage: " + data.usage.cpu + "<br />");
          logArray = nodeLog.join(' ');
          allNodes.set(nodeID, {
            name: node.metadata.name,
            cpu: node.status.capacity.cpu,
            memory: node.status.capacity.memory,
            pods: node.status.capacity.pods,
            address: ipaddress,
            osImage: node.status.nodeInfo.osImage,
            containerRuntimeVersion: node.status.nodeInfo.containerRuntimeVersion,
            kubeletVersion: node.status.nodeInfo.kubeletVersion,
            operatingSystem: node.status.nodeInfo.operatingSystem,
            architecture: node.status.nodeInfo.architecture,
            logMessage: logArray,
            nodeNum: nodeCounter,
          })
          render();
        });
        logArray = nodeLog.join(' ');
      }
      allNodes.set(nodeID, {
        name: node.metadata.name,
        cpu: node.status.capacity.cpu,
        memory: node.status.capacity.memory,
        pods: node.status.capacity.pods,
        address: ipaddress,
        osImage: node.status.nodeInfo.osImage,
        containerRuntimeVersion: node.status.nodeInfo.containerRuntimeVersion,
        kubeletVersion: node.status.nodeInfo.kubeletVersion,
        operatingSystem: node.status.nodeInfo.operatingSystem,
        architecture: node.status.nodeInfo.architecture,
        logMessage: logArray,
        nodeNum: nodeCounter,
      })
      render()
    },
    remove(nodeID) {
      allNodes.delete(nodeID)
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