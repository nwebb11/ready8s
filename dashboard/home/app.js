const app = App()
let lastResourceVersion
var podCounter = 0;

fetch(`/api/v1/pods`)
  .then((response) => response.json())
  .then((response) => {
    const pods = response.items
    lastResourceVersion = response.metadata.resourceVersion
    pods.forEach((pod) => {
      const podId = `${pod.metadata.namespace}-${pod.metadata.name}`
      app.upsert(podId, pod)
      console.log('PODS:', podId)
   })
})
.then(() => streamUpdates())

function streamUpdates() {
  fetch(`/api/v1/pods?watch=1&resourceVersion=${lastResourceVersion}`)
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
            const pod = event.object
            const podId = `${pod.metadata.namespace}-${pod.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, pod.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                app.upsert(podId, pod)
                break
              }
              case 'DELETED': {
                app.remove(podId)
                break
              }
              case 'MODIFIED': {
                app.upsert(podId, pod)
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
  const allPods = new Map()
  const content = document.querySelector('#content')

  function render() {
    const pods = Array.from(allPods.values())
    if (pods.length === 0) {
      return
    }
    const podsByNode = groupBy(pods, (it) => it.nodeName)
    const nodeTemplates = Object.keys(podsByNode).map((nodeName) => {
      const pods = podsByNode[nodeName]
      return [
        '<li class="w5 mv3 center">',
          '<div class="bg-white ba b--black-10 br3 shadow-1" style="height:105%;width:110%;">',
            '<div>',
              '</br>',
              `<p class="gray ttu tc f3 mv3">${nodeName}</p>`,
              `<div class="bg-lightest-blue ba bw3 b--blue w5 h5 center">${renderNode(pods)}</div>`,
            '</div>',
          '</div>',
        '</li>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${nodeTemplates.join('')}</ul>`

    function renderNode(pods) {
      return [
        '<ul class="list pl0 flex flex-wrap center">',
        pods
          .map((pod) =>
            [
              '<li>',
              `<a href="#${pod.name}" title="${pod.name}"><div class="ma1 w2 h2 bg-green" data-tooltip="${pod.name}"></div></a>`,
              '</li>',
              `<div id="${pod.name}" class="overlay">`,
                `<div class="popup">`,
                  `<h2>Pod Logs - ${pod.name}</h2>`,
                  `<a class="close" href="#">&times;</a>`,
                  `<div class="content">`,
                    `<p>${pod.logMessage}</p>`,
                  `</div>`,
                `</div>`,
              `</div>`,
            ].join(''),
          )
          .join(''),
        '</ul>',
      ].join('')
    }
  }

  return {
    upsert(podId, pod) {
      let podLog = [];
      if (!pod.spec.nodeName) {
        return
      } else {
        podCounter += 1;
      }
      if (pod.metadata) {
        var i;
        podLog.push("UID: " + pod.metadata.uid + "<br />");
        podLog.push("Resource Version: " + pod.metadata.resourceVersion + "<br />");
        podLog.push("Creation Timestamp: " + pod.metadata.creationTimestamp + "<br />");
        podLog.push("<br />");
        if (pod.status.conditions) {
          for (i = 0; i < pod.status.conditions.length; i++) {
            podLog.push(pod.status.conditions[i].type + "<br />");
            podLog.push("Status: " + pod.status.conditions[i].status + "<br />");
            podLog.push("Transition Time: " + pod.status.conditions[i].lastTransitionTime + "<br />");
            podLog.push("<br />");
          }
        }
        var logArray = [];
        logArray = podLog.join(' ');
      }
      allPods.set(podId, {
        name: pod.metadata.name,
        namespace: pod.metadata.namespace,
        nodeName: pod.spec.nodeName,
        logMessage: logArray,
        podNum: podCounter,
      })
      render()
    },
    remove(podId) {
      allPods.delete(podId)
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