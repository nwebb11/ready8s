const app = App()
let lastResourceVersion

let totalReplicasets = 0;
let totalRunningReplicasets = 0;
let totalPendingReplicasets = 0;

fetch(`/apis/apps/v1/replicasets`)
  .then((response) => response.json())
  .then((response) => {
    const replicasets = response.items
    lastResourceVersion = response.metadata.resourceVersion
    replicasets.forEach((replicaset) => {
      const replicasetID = `${replicaset.metadata.namespace}-${replicaset.metadata.name}`
      app.upsert(replicasetID, replicaset)
      console.log('REPLICASET:', replicasetID)
   })
})
.then(() => streamUpdates())

function streamUpdates(apiString) {
  fetch(`/apis/apps/v1/replicasets?watch=1&resourceVersion=${lastResourceVersion}`)
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
            const replicaset = event.object
            const replicasetID = `${replicaset.metadata.namespace}-${replicaset.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, replicaset.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                app.upsert(replicasetID, replicaset)
                break
              }
              case 'DELETED': {
                app.remove(replicasetID)
                break
              }
              case 'MODIFIED': {
                app.update()
                app.upsert(replicasetID, replicaset)
                break
              }
              case 'Progressing': {
                app.upsert(replicasetID, replicaset)
                break
              }
              case 'Available': {
                app.upsert(replicasetID, replicaset)
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
  const allReplicasets = new Map()
  const content = document.querySelector('#content')

  function render() {
    const replicasets = Array.from(allReplicasets.values())
    if (replicasets.length === 0) {
      return
    }
    const replicasetsByNamespace = groupBy(replicasets, (it) => it.namespace)
    const namespaceTemplates = Object.keys(replicasetsByNamespace).map((namespace) => {
      const replicasets = replicasetsByNamespace[namespace]
      return [
        '<div class="bg-blue center mb4 ba b--black-10 br2 shadow-1" style="width:70%;">',
          `<h3 class="white mh6">${namespace}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<div class="center mv2 bg-white br2" style="width:90%;">',
            '<table class="mv4 center" style="width:100%;">',
              '<tr class="striped--light-gray">',
                '<th>REPLICA SET NAME</th>',
                '<th>DESIRED</th>',
                '<th>CURRENT</th>',
                '<th>READY</th>',
                '<th>CONTAINERS</th>',
                '<th>IMAGES</th>',
                '<th>SELECTOR</th>',
              '</tr>',
              `${renderNamespace(replicasets)}`,
            '</table>',
          '</div>',
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${namespaceTemplates.join('')}</ul>`

    displayRunningChart();
    displayTotalChart();
    displayPendingChart();

    function renderNamespace(replicasets) {
      return [
        replicasets
          .map((replicaset) =>
            [
              '<tr class="striped--light-gray">',
                `<td style="width:30%;"><a href="#popup${replicaset.name}">${replicaset.name}</a></td>`,
                `<td style="width:10%;text-align:center;">${replicaset.desired}</td>`,
                `<td style="width:10%;text-align:center;">${replicaset.current}</td>`,
                `<td style="width:10%;text-align:center;">${replicaset.ready}</td>`,
                `<td style="width:20%;text-align:center;">${replicaset.containers}</td>`,
                `<td style="width:20%;text-align:center;">${replicaset.images}</td>`,
                `<td style="width:20%;text-align:center;">${replicaset.selector}</td>`,
              '</tr>',
              `<div id="popup${replicaset.name}" class="overlay">`,
                `<div class="popup">`,
                  `<h2>Replica Set Logs - ${replicaset.name}</h2>`,
                  `<a class="close" href="#">&times;</a>`,
                  `<div class="content">`,
                    `<p>${replicaset.logMessage}</p>`,
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
    upsert(replicasetID, replicaset) {
      var replicasetLog = [];
      var containerName = "NONE";
      var imageName = "NONE";
      var selectorHash = "NONE";
      if (!replicaset.metadata.name) {
        return
      }
      if (replicaset.spec.template.spec.containers) {
        containerName = replicaset.spec.template.spec.containers[0].name;
        imageName = replicaset.spec.template.spec.containers[0].image;
      }
      if (replicaset.spec.selector.matchLabels) {
        var selectorName = "NONE";
        var componentName = "NONE";
        if (replicaset.spec.selector.matchLabels.k8s-app) {
          selectorName = replicaset.spec.selector.matchLabels.k8s-app;
        } else if (replicaset.spec.selector.matchLabels.app) {
          selectorName = replicaset.spec.selector.matchLabels.app;
        } else if (replicaset.spec.selector.matchLabels.name) {
          selectorName = replicaset.spec.selector.matchLabels.app;
        }
        if (replicaset.metadata.labels.component) {
          componentName = replicaset.metadata.labels.component;
          selectorHash = selectorName + ", component=" + componentName;
        } else {
          selectorHash = selectorName;
        }
      }
      if (replicaset.metadata) {
        replicasetLog.push("UID: " + replicaset.metadata.uid + "<br />");
        replicasetLog.push("Resource Version: " + replicaset.metadata.resourceVersion + "<br />");
        replicasetLog.push("Generation: " + replicaset.metadata.generation + "<br />");
        replicasetLog.push("Creation Timestamp: " + replicaset.metadata.creationTimestamp + "<br />");
        var logArray = replicasetLog.join(' ');
      }
      if (replicaset.status.readyReplicas) {
        if (replicaset.status.readyReplicas == replicaset.status.replicas) {
          totalRunningReplicasets += 1;
          if (totalPendingReplicasets > 0) {
            totalPendingReplicasets -= 1;
          }
        }
      } else if (replicaset.status.replicas) {
        totalPendingReplicasets += 1;
      }
      totalReplicasets = totalRunningReplicasets + totalPendingReplicasets;
      allReplicasets.set(replicasetID, {
        name: replicaset.metadata.name,
        namespace: replicaset.metadata.namespace,
        desired: replicaset.spec.replicas,
        current: replicaset.status.availableReplicas,
        ready: replicaset.status.readyReplicas,
        containers: containerName,
        images: imageName,
        selector: selectorHash,
        logMessage: logArray,
      })
      render()
    },
    update() {
      if (totalPendingReplicasets > 0) {
        totalPendingReplicasets -= 1;
        render();
      }
    },
    remove(replicasetID) {
      totalRunningReplicasets -= 1;
      totalReplicasets = totalRunningReplicasets + totalPendingReplicasets;
      allReplicasets.delete(replicasetID)
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
                data: [totalRunningReplicasets],
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
                text: 'Running Replica Sets'
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
                data: [totalReplicasets],
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
                text: 'Total Replica Sets'
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
                data: [totalPendingReplicasets],
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
                text: 'Pending Replica Sets'
            },
            animation: {
                animateScale: true,
                animateRotate: false
            }
        }
    });
}