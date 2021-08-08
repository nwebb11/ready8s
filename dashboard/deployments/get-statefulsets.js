const app = App()
let lastResourceVersion

let totalStatefulsets = 0;
let totalRunningStatefulsets = 0;
let totalPendingStatefulsets = 0;

fetch(`/apis/apps/v1/statefulsets`)
  .then((response) => response.json())
  .then((response) => {
    const statefulsets = response.items
    lastResourceVersion = response.metadata.resourceVersion
    statefulsets.forEach((statefulset) => {
      const statefulsetID = `${statefulset.metadata.namespace}-${statefulset.metadata.name}`
      app.upsert(statefulsetID, statefulset)
      console.log('STATEFULSET:', statefulsetID)
   })
})
.then(() => streamUpdates())

function streamUpdates(apiString) {
  fetch(`/apis/apps/v1/statefulsets?watch=1&resourceVersion=${lastResourceVersion}`)
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
            const statefulset = event.object
            const statefulsetID = `${statefulset.metadata.namespace}-${statefulset.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, statefulset.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                app.upsert(statefulsetID, statefulset)
                break
              }
              case 'DELETED': {
                app.remove(statefulsetID)
                break
              }
              case 'MODIFIED': {
                app.update()
                app.upsert(statefulsetID, statefulset)
                break
              }
              case 'Progressing': {
                app.upsert(statefulsetID, statefulset)
                break
              }
              case 'Available': {
                app.upsert(statefulsetID, statefulset)
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
  const allStatefulsets = new Map()
  const content = document.querySelector('#content')

  function render() {
    const statefulsets = Array.from(allStatefulsets.values())
    if (statefulsets.length === 0) {
      return
    }
    const statefulsetsByNamespace = groupBy(statefulsets, (it) => it.namespace)
    const namespaceTemplates = Object.keys(statefulsetsByNamespace).map((namespace) => {
      const statefulsets = statefulsetsByNamespace[namespace]
      return [
        '<div class="bg-blue center mb4 ba b--black-10 br2 shadow-1" style="width:70%;">',
          `<h3 class="white mh6">${namespace}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<div class="center mv2 bg-white br2" style="width:90%;">',
            '<table class="mv4 center" style="width:100%;">',
              '<tr class="striped--light-gray">',
                '<th>STATEFUL SET NAME</th>',
                '<th>READY</th>',
                '<th>REPLICAS</th>',
                '<th>CONTAINERS</th>',
                '<th>IMAGES</th>',
              '</tr>',
              `${renderNamespace(statefulsets)}`,
            '</table>',
          '</div>',
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${namespaceTemplates.join('')}</ul>`

    displayRunningChart();
    displayTotalChart();
    displayPendingChart();

    function renderNamespace(statefulsets) {
      return [
        statefulsets
          .map((statefulset) =>
            [
              '<tr class="striped--light-gray">',
                `<td style="width:30%;"><a href="#popup${statefulset.name}">${statefulset.name}</a></td>`,
                `<td style="width:10%;text-align:center;">${statefulset.readyReplicas}/${statefulset.replicas}</td>`,
                `<td style="width:10%;text-align:center;">${statefulset.replicas}</td>`,
                `<td style="width:10%;text-align:center;">${statefulset.containers}</td>`,
                `<td style="width:20%;text-align:center;">${statefulset.images}</td>`,
              '</tr>',
              `<div id="popup${statefulset.name}" class="overlay">`,
                `<div class="popup">`,
                  `<h2>Stateful Set Logs - ${statefulset.name}</h2>`,
                  `<a class="close" href="#">&times;</a>`,
                  `<div class="content">`,
                    `<p>${statefulset.logMessage}</p>`,
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
    upsert(statefulsetID, statefulset) {
      var statefulsetLog = [];
      var containerName = "NONE";
      var imageName = "NONE";
      if (!statefulset.metadata.name) {
        return
      }
      if (statefulset.spec.template.spec.containers) {
        containerName = statefulset.spec.template.spec.containers[0].name;
        imageName = statefulset.spec.template.spec.containers[0].image;
      }
      if (statefulset.metadata) {
        statefulsetLog.push("UID: " + statefulset.metadata.uid + "<br />");
        statefulsetLog.push("Resource Version: " + statefulset.metadata.resourceVersion + "<br />");
        statefulsetLog.push("Generation: " + statefulset.metadata.generation + "<br />");
        statefulsetLog.push("Creation Timestamp: " + statefulset.metadata.creationTimestamp + "<br />");
        var logArray = statefulsetLog.join(' ');
      }
      if (statefulset.status.readyReplicas == statefulset.status.replicas) {
        totalRunningStatefulsets += 1;
        if (totalPendingStatefulsets > 0) {
         totalPendingStatefulsets -= 1;
        }
      } else {
        totalPendingStatefulsets += 1;
      }
      totalStatefulsets = totalRunningStatefulsets + totalPendingStatefulsets;
      allStatefulsets.set(statefulsetID, {
        name: statefulset.metadata.name,
        namespace: statefulset.metadata.namespace,
        readyReplicas: statefulset.status.readyReplicas,
        replicas: statefulset.status.replicas,
        containers: containerName,
        images: imageName,
        logMessage: logArray,
      })
      render()
    },
    update() {
      if (totalPendingStatefulsets > 0) {
        totalPendingStatefulsets -= 1;
        render();
      }
    },
    remove(statefulsetID) {
      totalRunningStatefulsets -= 1;
      totalStatefulsets = totalRunningStatefulsets + totalPendingStatefulsets;
      allStatefulsets.delete(statefulsetID)
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

function displayRunningChart() {
    var ctx = document.getElementById('runningChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalRunningStatefulsets],
                backgroundColor: [
                    'rgba(123,239,178,1)',
                ],
                label: 'Dataset 1'
            }],
            labels: [
                'Running'
            ]
        },
        options: {
            responsive: true,
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Running Stateful Sets'
            },
            animation: {
                animateScale: true,
                animateRotate: false
            }
        }
    });
}

function displayTotalChart() {
    var ctx = document.getElementById('totalChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalStatefulsets],
                backgroundColor: [
                    'rgba(65,131,215,1)',
                ],
                label: 'Dataset 1'
            }],
            labels: [
                'Total'
            ]
        },
        options: {
            responsive: true,
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Total Stateful Sets'
            },
            animation: {
                animateScale: true,
                animateRotate: false
            }
        }
    });
}

function displayPendingChart() {
    var ctx = document.getElementById('pendingChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalPendingStatefulsets],
                backgroundColor: [
                    'rgba(245,171,53,1)',
                ],
                label: 'Dataset 1'
            }],
            labels: [
                'Pending'
            ]
        },
        options: {
            responsive: true,
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Pending Stateful Sets'
            },
            animation: {
                animateScale: true,
                animateRotate: false
            }
        }
    });
}