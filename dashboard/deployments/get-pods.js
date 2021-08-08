const app = App()
let lastResourceVersion

let totalPods = 0;
let totalRunningPods = 0;
let totalSucceededPods = 0;
let totalPendingPods = 0;

fetch(`/api/v1/pods`)
  .then((response) => response.json())
  .then((response) => {
    const pods = response.items
    lastResourceVersion = response.metadata.resourceVersion
    pods.forEach((pod) => {
      const podID = `${pod.metadata.namespace}-${pod.metadata.name}`
      app.upsert(podID, pod)
      console.log('POD:', podID)
   })
})
.then(() => streamUpdates())

function streamUpdates(apiString) {
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
            const podID = `${pod.metadata.namespace}-${pod.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, pod.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                app.upsert(podID, pod)
                break
              }
              case 'DELETED': {
                app.remove(podID)
                break
              }
              case 'MODIFIED': {
                app.update()
                app.upsert(podID, pod)
                break
              }
              case 'Progressing': {
                //app.upsert(podID, pod)
                break
              }
              case 'Available': {
                //app.upsert(podID, pod)
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
    const podsByNamespace = groupBy(pods, (it) => it.namespace)
    const namespaceTemplates = Object.keys(podsByNamespace).map((namespace) => {
      const pods = podsByNamespace[namespace]
      return [
        '<div class="bg-blue center mb4 ba b--black-10 br2 shadow-1" style="width:70%;">',
          `<h3 class="white mh6">${namespace}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<div class="center mv2 bg-white br2" style="width:90%;">',
            '<table class="mv4 center" style="width:100%;">',
              '<tr class="striped--light-gray">',
                '<th>POD NAME</th>',
                '<th>READY</th>',
                '<th>STATUS</th>',
                '<th>RESTARTS</th>',
                '<th>IP ADDRESS</th>',
                '<th>NODE</th>',
                '<th>CONTROLLED BY</th>',
                '<th>QOS</th>',
              '</tr>',
              `${renderNamespace(pods)}`,
            '</table>',
          '</div>',
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${namespaceTemplates.join('')}</ul>`

    displayRunningChart();
    displayTotalChart();
    displaySucceededChart();
    displayPendingChart();

    function renderNamespace(pods) {
      return [
        pods
          .map((pod) =>
            [
              '<tr class="striped--light-gray">',
                `<td style="width:30%;"><a href="#popup${pod.name}">${pod.name}</a></td>`,
                `<td style="width:10%;text-align:center;">${pod.currentReady}/${pod.totalReady}</td>`,
                `<td style="width:10%;text-align:center;">${pod.status}</td>`,
                `<td style="width:10%;text-align:center;">${pod.restarts}</td>`,
                `<td style="width:20%;text-align:center;">${pod.podIP}</td>`,
                `<td style="width:10%;text-align:center;">${pod.nodeName}</td>`,
                `<td style="width:10%;text-align:center;">${pod.controlledby}</td>`,
                `<td style="width:20%;text-align:center;">${pod.qosClass}</td>`,
              '</tr>',
              `<div id="popup${pod.name}" class="overlay">`,
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
      ].join('')
    }
  }

  return {
    upsert(podID, pod) {
      let podLog = [];
      var currPod = "0";
      var totalPod = "0";
      var totalRestarts = "0";
      var ipaddress = "NONE";
      var node = "NONE";
      var controller = "NONE";
      var qos = "NONE";
      if (!pod.metadata.name) {
        return
      }
      if (pod.status.containerStatuses) {
        if (pod.status.containerStatuses[0].ready) {
          currPod = "1";
        }
        if (pod.status.containerStatuses[0].restartCount) {
          totalRestarts = pod.status.containerStatuses[0].restartCount;
        }
      }
      if (pod.status.phase) {
        totalPod = "1";
      }
      if (pod.status.podIP) {
        ipaddress = pod.status.podIP;
      }
      if (pod.spec.nodeName) {
        node = pod.spec.nodeName;
      }
      if (pod.metadata.ownerReferences) {
        controller = pod.metadata.ownerReferences[0].kind;
      }
      if (pod.status.qosClass) {
        qos = pod.status.qosClass;
      }
      if (pod.status.phase) {
        if (pod.status.phase == "Running" && pod.status.containerStatuses[0].ready == true) {
          totalRunningPods += 1;
          if (totalPendingPods > 0) {
            totalPendingPods -= 1;
          }
        } else if (pod.status.phase == "Succeeded") {
          totalSucceededPods += 1;
        } else if (pod.status.phase == "Pending") {
          totalPendingPods += 1;
        }
      }
      totalPods = totalRunningPods + totalPendingPods + totalSucceededPods;
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
        var podName = pod.metadata.name;
        var spaceName = pod.metadata.namespace;
        var logArray = [];
        $.getJSON(`/apis/metrics.k8s.io/v1beta1/namespaces/${spaceName}/pods/${podName}`, function(data) {
          podLog.unshift("<br />");
          podLog.unshift('<hr style="width:99%;">');
          podLog.unshift("Memory Usage: " + data.containers[0].usage.memory + "<br />");
          podLog.unshift("CPU Usage: " + data.containers[0].usage.cpu + "<br />");
          logArray = podLog.join(' ');
          allPods.set(podID, {
            name: pod.metadata.name,
            namespace: pod.metadata.namespace,
            currentReady: currPod,
            totalReady: totalPod,
            status: pod.status.phase,
            restarts: totalRestarts,
            podIP: ipaddress,
            nodeName: node,
            controlledby: controller,
            qosClass: qos,
            logMessage: logArray,
          })
          render();
        });
        logArray = podLog.join(' ');
      }
      allPods.set(podID, {
        name: pod.metadata.name,
        namespace: pod.metadata.namespace,
        currentReady: currPod,
        totalReady: totalPod,
        status: pod.status.phase,
        restarts: totalRestarts,
        podIP: ipaddress,
        nodeName: node,
        controlledby: controller,
        qosClass: qos,
        logMessage: logArray,
      })
      render()
    },
    update() {
      if (totalPendingPods > 0) {
        totalPendingPods -= 1;
        render();
      }
    },
    remove(podID) {
      totalRunningPods -= 3;
      //totalSucceededPods -= 1;
      totalPods = totalRunningPods + totalPendingPods + totalSucceededPods;
      allPods.delete(podID)
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

function grabMetrics(podName, namespace) {
  $.getJSON(`/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods/${podName}`, function(data) {
    var apiV = data.apiVersion
    myArray.shift();
    myArray.push(apiV);
        return;
  });
}

function displayRunningChart() {
    var ctx = document.getElementById('runningChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalRunningPods],
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
                text: 'Running Pods'
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
                data: [totalPods],
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
                text: 'Total Pods'
            },
            animation: {
                animateScale: true,
                animateRotate: false
            }
        }
    });
}

function displaySucceededChart() {
    var ctx = document.getElementById('succeededChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalSucceededPods],
                backgroundColor: [
                    'rgba(123,239,178,1)',
                ],
                label: 'Dataset 1'
            }],
            labels: [
                'Succeeded'
            ]
        },
        options: {
            responsive: true,
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Succeeded Pods'
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
                data: [totalPendingPods],
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
                text: 'Pending Pods'
            },
            animation: {
                animateScale: true,
                animateRotate: false
            }
        }
    });
}