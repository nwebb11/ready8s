const app = App()
let lastResourceVersion

let totalDeployments = 0
let totalRunningDeployments = 0
let totalPendingDeployments = 0

fetch(`/apis/apps/v1/deployments`)
  .then((response) => response.json())
  .then((response) => {
    const deployments = response.items
    lastResourceVersion = response.metadata.resourceVersion
    deployments.forEach((deploy) => {
      const deployID = `${deploy.metadata.namespace}-${deploy.metadata.name}`
      app.upsert(deployID, deploy)
      console.log('DEPLOYMENT:', deployID)
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
                app.update()
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
        '<div class="bg-blue center mb4 ba b--black-10 br2 shadow-1" style="width:70%;">',
          `<h3 class="white mh6">${namespace}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<div class="center mv2 bg-white br2" style="width:90%;">',
            '<table class="mv4 center" style="width:100%;">',
              '<tr class="striped--light-gray">',
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
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${namespaceTemplates.join('')}</ul>`

    displayRunningChart();
    displayTotalChart();
    displayPendingChart();

    function renderNamespace(deployments) {
      return [
        deployments
          .map((deploy) =>
            [
              '<tr class="striped--light-gray">',
                `<td style="width:30%;"><a href="#popup${deploy.name}">${deploy.name}</a></td>`,
                `<td style="width:10%;text-align:center;">${deploy.readyReplicas}/${deploy.replicas}</td>`,
                `<td style="width:10%;text-align:center;">${deploy.updatedReplicas}</td>`,
                `<td style="width:10%;text-align:center;">${deploy.availableReplicas}</td>`,
                `<td style="width:20%;text-align:center;">${deploy.containers}</td>`,
                `<td style="width:20%;text-align:center;">${deploy.images}</td>`,
              '</tr>',
              `<div id="popup${deploy.name}" class="overlay">`,
                `<div class="popup">`,
                  `<h2>Deployment Logs - ${deploy.name}</h2>`,
                  `<a class="close" href="#">&times;</a>`,
                  `<div class="content">`,
                    `<p>${deploy.logMessage}</p>`,
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
    upsert(deployID, deploy) {
      var containerName = "NONE";
      var imageName = "NONE";
      var deployLog = [];
      var totalReady = 0;
      var totalAvailable = 0;
      if (deploy.spec.template.spec.containers) {
        containerName = deploy.spec.template.spec.containers[0].name;
        imageName = deploy.spec.template.spec.containers[0].image;
      }
      if (!deploy.status.replicas) {
        return
      }
      if (deploy.status.readyReplicas) {
        totalReady = deploy.status.readyReplicas;
      }
      if (deploy.status.availableReplicas) {
        totalAvailable = deploy.status.availableReplicas;
      }
      if (deploy.metadata) {
        var i;
        deployLog.push("UID: " + deploy.metadata.uid + "<br />");
        deployLog.push("Resource Version: " + deploy.metadata.resourceVersion + "<br />");
        deployLog.push("Creation Timestamp: " + deploy.metadata.creationTimestamp + "<br />");
        deployLog.push("<br />");
        if (deploy.status.conditions) {
          for (i = 0; i < deploy.status.conditions.length; i++) {
            deployLog.push(deploy.status.conditions[i].type + "<br />");
            deployLog.push("Status: " + deploy.status.conditions[i].status + "<br />");
            deployLog.push("Transition Time: " + deploy.status.conditions[i].lastTransitionTime + "<br />");
            deployLog.push("Reason: " + deploy.status.conditions[i].reason + "<br />");
            deployLog.push("Message: " + deploy.status.conditions[i].message + "<br />");
            deployLog.push("<br />");
          }
        }
        var logArray = [];
        logArray = deployLog.join(' ');
      }
      if (deploy.status.readyReplicas && deploy.status.replicas) {
        totalRunningDeployments += 1;
        if (totalPendingDeployments > 0) {
          totalPendingDeployments -= 1;
        }
      } else {
        totalPendingDeployments += 1;
      }
      totalDeployments = totalRunningDeployments + totalPendingDeployments;
      allDeployments.set(deployID, {
        name: deploy.metadata.name,
        namespace: deploy.metadata.namespace,
        replicas: deploy.status.replicas,
        readyReplicas: totalReady,
        updatedReplicas: deploy.status.updatedReplicas,
        availableReplicas: totalAvailable,
        containers: containerName,
        images: imageName,
        logMessage: logArray,
      })
      render()
    },
    update() {
      if (totalPendingDeployments > 0) {
        totalPendingDeployments -= 1;
        render();
      }
    },
    remove(deployID) {
      totalRunningDeployments -= 1;
      totalDeployments = totalRunningDeployments + totalPendingDeployments;
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

function displayRunningChart() {
    var ctx = document.getElementById('runningChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalRunningDeployments],
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
                text: 'Running Deployments'
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
                data: [totalDeployments],
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
                text: 'Total Deployments'
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
                data: [totalPendingDeployments],
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
                text: 'Pending Deployments'
            },
            animation: {
                animateScale: true,
                animateRotate: false
            }
        }
    });
}