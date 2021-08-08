const app = App()
let lastResourceVersion

let totalCronjobs = 0;
let totalRunningCronjobs = 0;
let totalScheduledCronjobs = 0;

fetch(`/apis/batch/v1beta1/cronjobs`)
  .then((response) => response.json())
  .then((response) => {
    const cronjobs = response.items
    lastResourceVersion = response.metadata.resourceVersion
    cronjobs.forEach((cronjob) => {
      const cronjobID = `${cronjob.metadata.namespace}-${cronjob.metadata.name}`
      app.upsert(cronjobID, cronjob)
      console.log('CRONJOB:', cronjobID)
   })
})
.then(() => streamUpdates())

function streamUpdates(apiString) {
  fetch(`/apis/batch/v1beta1/cronjobs?watch=1&resourceVersion=${lastResourceVersion}`)
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
            const cronjob = event.object
            const cronjobID = `${cronjob.metadata.namespace}-${cronjob.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, cronjob.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                app.upsert(cronjobID, cronjob)
                break
              }
              case 'DELETED': {
                app.remove(cronjobID)
                break
              }
              case 'MODIFIED': {
                app.update()
                app.upsert(cronjobID, cronjob)
                break
              }
              case 'Progressing': {
                app.upsert(cronjobID, cronjob)
                break
              }
              case 'Available': {
                app.upsert(cronjobID, cronjob)
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
  const allCronjobs = new Map()
  const content = document.querySelector('#content')

  function render() {
    const cronjobs = Array.from(allCronjobs.values())
    if (cronjobs.length === 0) {
      return
    }
    const cronjobsByNamespace = groupBy(cronjobs, (it) => it.namespace)
    const namespaceTemplates = Object.keys(cronjobsByNamespace).map((namespace) => {
      const cronjobs = cronjobsByNamespace[namespace]
      return [
        '<div class="bg-blue center mb4 ba b--black-10 br2 shadow-1" style="width:70%;">',
          `<h3 class="white mh6">${namespace}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<div class="center mv2 bg-white br2" style="width:90%;">',
            '<table class="mv4 center" style="width:100%;">',
              '<tr class="striped--light-gray">',
                '<th>CRONJOB NAME</th>',
                '<th>SCHEDULE</th>',
                '<th>SUSPEND</th>',
                '<th>ACTIVE</th>',
                '<th>LAST SCHEDULE</th>',
                '<th>CONTAINERS</th>',
                '<th>IMAGES</th>',
              '</tr>',
              `${renderNamespace(cronjobs)}`,
            '</table>',
          '</div>',
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${namespaceTemplates.join('')}</ul>`

    displayScheduledChart();
    displayTotalChart();
    displayRunningChart();

    function renderNamespace(cronjobs) {
      return [
        cronjobs
          .map((cronjob) =>
            [
              '<tr class="striped--light-gray">',
                `<td style="width:30%;"><a href="#popup${cronjob.name}">${cronjob.name}</a></td>`,
                `<td style="width:10%;text-align:center;">${cronjob.schedule}</td>`,
                `<td style="width:10%;text-align:center;">${cronjob.suspend}</td>`,
                `<td style="width:10%;text-align:center;">${cronjob.active}</td>`,
                `<td style="width:20%;text-align:center;">${cronjob.lastschedule}</td>`,
                `<td style="width:20%;text-align:center;">${cronjob.containers}</td>`,
                `<td style="width:20%;text-align:center;">${cronjob.images}</td>`,
              '</tr>',
              `<div id="popup${cronjob.name}" class="overlay">`,
                `<div class="popup">`,
                  `<h2>Cronjob Logs - ${cronjob.name}</h2>`,
                  `<a class="close" href="#">&times;</a>`,
                  `<div class="content">`,
                    `<p>${cronjob.logMessage}</p>`,
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
    upsert(cronjobID, cronjob) {
      var cronjobLog = [];
      var containerName = "NONE";
      var imageName = "NONE";
      var cronActive = "0";
      if (!cronjob.metadata.name) {
        return
      }
      if (cronjob.status.active) {
        cronActive = "1";
      }
      if (cronjob.spec.jobTemplate.spec.template.spec.containers) {
        containerName = cronjob.spec.jobTemplate.spec.template.spec.containers[0].name;
        imageName = cronjob.spec.jobTemplate.spec.template.spec.containers[0].image;
      }
      if (cronjob.metadata) {
        cronjobLog.push("UID: " + cronjob.metadata.uid + "<br />");
        cronjobLog.push("Resource Version: " + cronjob.metadata.resourceVersion + "<br />");
        cronjobLog.push("Creation Timestamp: " + cronjob.metadata.creationTimestamp + "<br />");
        var logArray = cronjobLog.join(' ');
      }
      if (cronjob.status.lastScheduleTime && !cronjob.status.active) {
        totalScheduledCronjobs += 1;
        if (totalRunningCronjobs > 0) {
          totalRunningCronjobs -= 1;
        }
      } else if (cronjob.status.active) {
        totalRunningCronjobs += 1;
        if (totalScheduledCronjobs > 0) {
          totalScheduledCronjobs -= 1;
        }
      }
      totalCronjobs = totalScheduledCronjobs + totalRunningCronjobs;
      allCronjobs.set(cronjobID, {
        name: cronjob.metadata.name,
        namespace: cronjob.metadata.namespace,
        schedule: cronjob.spec.schedule,
        suspend: cronjob.spec.suspend,
        active: cronActive,
        lastschedule: cronjob.status.lastScheduleTime,
        containers: containerName,
        images: imageName,
        logMessage: logArray,
      })
      render()
    },
    update() {
      if (totalRunningCronjobs > 0) {
        totalRunningCronjobs -= 1;
        render();
      }
    },
    remove(cronjobID) {
      totalScheduledCronjobs -= 1;
      totalCronjobs = totalScheduledCronjobs + totalRunningCronjobs;
      allCronjobs.delete(cronjobID)
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

function displayScheduledChart() {
    var ctx = document.getElementById('scheduledChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalScheduledCronjobs],
                backgroundColor: [
                    'rgba(65,131,215,1)',
                ],
                label: 'Dataset 1'
            }],
            labels: [
                'Scheduled'
            ]
        },
        options: {
            responsive: true,
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Scheduled CronJobs'
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
                data: [totalCronjobs],
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
                text: 'Total CronJobs'
            },
            animation: {
                animateScale: true,
                animateRotate: false
            }
        }
    });
}

function displayRunningChart() {
    var ctx = document.getElementById('runningChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalRunningCronjobs],
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
                text: 'Running CronJobs'
            },
            animation: {
                animateScale: true,
                animateRotate: false
            }
        }
    });
}