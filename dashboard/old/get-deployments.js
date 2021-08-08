const app = App()
let lastResourceVersion

fetch(`/apis/apps/v1/deployments`)
  .then((response) => response.json())
  .then((response) => {
    const deployments = response.items
    lastResourceVersion = response.metadata.resourceVersion
    deployments.forEach((deploy) => {
      const deployID = `${deploy.metadata.namespace}-${deploy.metadata.name}`
      app.upsert(deployID, deploy)
      console.log('DEPLOYMENTS:', deployID)
   })
})
.then(() => streamUpdates())

function streamUpdates(apiString) {
  fetch(`/apis/apps/v1/deployments?watch=1&resourceVersion=${lastResourceVersion}`)
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
            const deploy = event.object
            const deployID = `${deploy.metadata.namespace}-${deploy.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, deploy.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                app.upsert(deployID, deploy)
                break
              }
              case 'DELETED': {
                app.remove(deployID)
                break
              }
              case 'MODIFIED': {
                app.upsert(deployID, deploy)
                break
              }
              case 'Progressing': {
                app.upsert(deployID, deploy)
                break
              }
              case 'Available': {
                app.upsert(deployID, deploy)
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
  const allDeployments = new Map()
  const content = document.querySelector('#content')

  function render() {
    const deployments = Array.from(allDeployments.values())
    if (deployments.length === 0) {
      return
    }
    const deploymentsByNamespace = groupBy(deployments, (it) => it.namespace)
    const namespaceTemplates = Object.keys(deploymentsByNamespace).map((namespace) => {
      const deployments = deploymentsByNamespace[namespace]
      return [
        '<div class="bg-blue center mv4 ba b--black-10 br2 shadow-1 grow" style="width:70%;">',
          `<h3 class="white mh6">${namespace}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<table class="mv4 center bg-light-blue" style="width:85%;">',
            '<tr>',
              '<th>DEPLOYMENT NAME</th>',
              '<th>READY</th>',
              '<th>UP-TO-DATE</th>',
              '<th>AVAILABLE</th>',
              '<th>CONTAINERS</th>',
              '<th>IMAGES</th>',
            '</tr>',
            `${renderNamespace(deployments)}`,
          '</table>',
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${namespaceTemplates.join('')}</ul>`

    function renderNamespace(deployments) {
      return [
        deployments
          .map((deploy) =>
            [
              '<tr>',
                `<td style="width:30%;">${deploy.name}</td>`,
                `<td style="width:10%;text-align:center;">${deploy.readyReplicas}/${deploy.replicas}</td>`,
                `<td style="width:10%;text-align:center;">${deploy.updatedReplicas}</td>`,
                `<td style="width:10%;text-align:center;">${deploy.availableReplicas}</td>`,
                `<td style="width:20%;text-align:center;">${deploy.containers}</td>`,
                `<td style="width:20%;text-align:center;">${deploy.images}</td>`,
              '</tr>',
            ].join(''),
          )
          .join(''),
      ].join('')
    }
  }

  return {
    upsert(deployID, deploy) {
      var containerName = "NONE";
      var imageName = "NONE";
      if (deploy.spec.template.spec.containers) {
        containerName = deploy.spec.template.spec.containers[0].name;
        imageName = deploy.spec.template.spec.containers[0].image;
      }
      if (!deploy.status.replicas) {
        return
      }
      allDeployments.set(deployID, {
        name: deploy.metadata.name,
        namespace: deploy.metadata.namespace,
        replicas: deploy.status.replicas,
        readyReplicas: deploy.status.readyReplicas,
        updatedReplicas: deploy.status.updatedReplicas,
        availableReplicas: deploy.status.availableReplicas,
        containers: containerName,
        images: imageName,
      })
      render()
    },
    remove(deployID) {
      allDeployments.delete(deployID)
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
