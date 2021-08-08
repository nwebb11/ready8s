const app = App()
let lastResourceVersion

let totalDaemonsets = 0;
let totalRunningDaemonsets = 0;
let totalPendingDaemonsets = 0;

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
                app.update()
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
        '<div class="bg-blue center mb4 ba b--black-10 br2 shadow-1" style="width:70%;">',
          `<h3 class="white mh6">${namespace}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<div class="center mv2 bg-white br2" style="width:90%;">',
            '<table class="mv4 center" style="width:100%;">',
              '<tr class="striped--light-gray">',
                '<th>DAEMON SET NAME</th>',
                '<th>DESIRED</th>',
                '<th>CURRENT</th>',
                '<th>READY</th>',
                '<th>UP-TO-DATE</th>',
                '<th>AVAILABLE</th>',
                '<th>CONTAINERS</th>',
                '<th>IMAGES</th>',
              '</tr>',
              `${renderNamespace(daemonsets)}`,
            '</table>',
          '</div>',
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${namespaceTemplates.join('')}</ul>`

    displayRunningChart();
    displayTotalChart();
    displayPendingChart();

    function renderNamespace(daemonsets) {
      return [
        daemonsets
          .map((daemonset) =>
            [
              '<tr class="striped--light-gray">',
                `<td style="width:20%;"><a href="#popup${daemonset.name}">${daemonset.name}</a></td>`,
                `<td style="width:8%;text-align:center;">${daemonset.desiredNumberScheduled}</td>`,
                `<td style="width:8%;text-align:center;">${daemonset.currentNumberScheduled}</td>`,
                `<td style="width:8%;text-align:center;">${daemonset.numberReady}</td>`,
                `<td style="width:8%;text-align:center;">${daemonset.updatedNumberScheduled}</td>`,
                `<td style="width:8%;text-align:center;">${daemonset.numberAvailable}</td>`,
                `<td style="width:20%;text-align:center;">${daemonset.containers}</td>`,
                `<td style="width:20%;text-align:center;">${daemonset.images}</td>`,
              '</tr>',
              `<div id="popup${daemonset.name}" class="overlay">`,
                `<div class="popup">`,
                  `<h2>Daemon Set Logs - ${daemonset.name}</h2>`,
                  `<a class="close" href="#">&times;</a>`,
                  `<div class="content">`,
                    `<p>${daemonset.logMessage}</p>`,
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
    upsert(daemonsetID, daemonset) {
      var containerName = "NONE";
      var imageName = "NONE";
      var daemonsetLog = [];
      if (!daemonset.status.desiredNumberScheduled) {
        return
      }
      if (daemonset.spec.template.spec.containers) {
        containerName = daemonset.spec.template.spec.containers[0].name;
        imageName = daemonset.spec.template.spec.containers[0].image;
      }
      if (daemonset.metadata) {
        daemonsetLog.push("UID: " + daemonset.metadata.uid + "<br />");
        daemonsetLog.push("Resource Version: " + daemonset.metadata.resourceVersion + "<br />");
        daemonsetLog.push("Generation: " + daemonset.metadata.generation + "<br />");
        daemonsetLog.push("Creation Timestamp: " + daemonset.metadata.creationTimestamp + "<br />");
        var logArray = daemonsetLog.join(' ');
      }
      if (daemonset.status.numberReady == daemonset.status.currentNumberScheduled) {
        totalRunningDaemonsets += 1;
        if (totalPendingDaemonsets > 0) {
          totalPendingDaemonsets -= 1;
        }
      } else {
        totalPendingDaemonsets += 1;
      }
      console.log('totalPendingDaemonsets:', totalPendingDaemonsets)
      totalDaemonsets = totalRunningDaemonsets + totalPendingDaemonsets;
      allDaemonsets.set(daemonsetID, {
        name: daemonset.metadata.name,
        namespace: daemonset.metadata.namespace,
        desiredNumberScheduled: daemonset.status.desiredNumberScheduled,
        currentNumberScheduled: daemonset.status.currentNumberScheduled,
        numberReady: daemonset.status.numberReady,
        updatedNumberScheduled: daemonset.status.updatedNumberScheduled,
        numberAvailable: daemonset.status.numberAvailable,
        containers: containerName,
        images: imageName,
        logMessage: logArray,
      })
      render()
    },
    update() {
      if (totalPendingDaemonsets > 0) {
        totalPendingDaemonsets -= 1;
        render();
      }
    },
    remove(daemonsetID) {
      totalRunningDaemonsets -= 1;
      totalDaemonsets = totalRunningDaemonsets + totalPendingDaemonsets;
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

function displayRunningChart() {
    var ctx = document.getElementById('runningChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalRunningDaemonsets],
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
                text: 'Running Daemonsets'
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
                data: [totalDaemonsets],
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
                text: 'Total Daemonsets'
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
                data: [totalPendingDaemonsets],
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
                text: 'Pending Daemonsets'
            },
            animation: {
                animateScale: true,
                animateRotate: false
            }
        }
    });
}