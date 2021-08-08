const nodeapp = App()
let nodelastResourceVersion

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
    const nodes = Array.from(allNodes.values())
    if (nodes.length === 0) {
      return
    }
    const nodesByName = groupBy(nodes, (it) => it.name)
    const nameTemplates = Object.keys(nodesByName).map((name) => {
      const nodes = nodesByName[name]
      return [
        '<div class="bg-blue center mv4 ba b--black-10 br2 shadow-1 grow" style="width:20%;">',
          `<h3 class="white mh6">${name}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<div class="mv4 center bg-white ba b--black-10 br2 shadow-1" style="width:85%;">',
            `${renderNamespace(nodes)}`,
          '</div>',
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${nameTemplates.join('')}</ul>`

    function renderNamespace(nodes) {
      return [
        nodes
          .map((node) =>
            [
              ` <h4>CPUs: </h4>${node.cpu}`,
              ` <h4>MEMORY: </h4>${node.memory}`,
              ` <h4>POD CAPACITY: </h4>${node.pods}`,
              ` <h4>IP ADDRESS: </h4>${node.address}`,
              ` <h4>OS IMAGE: </h4>${node.osImage}`,
              ` <h4>RUNTIME: </h4>${node.containerRuntimeVersion}`,
              ` <h4>KUBELET VERSION: </h4>${node.kubeletVersion}`,
              ` <h4>OPERATING SYSTEM: </h4>${node.operatingSystem}`,
              ` <h4>ARCHITECTURE: </h4>${node.architecture}`,
            ].join(''),
          )
          .join(''),
      ].join('')
    }
  }

  return {
    upsert(nodeID, node) {
      var ipaddress = "NONE";
      if (!node.metadata.name) {
        return
      }
      if (node.status.addresses) {
        ipaddress = node.status.addresses[0].address;
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
