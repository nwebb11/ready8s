const app = App()
let lastResourceVersion

let totalJobs = 0;
let totalRunningJobs = 0;
let totalCompletedJobs = 0;

fetch(`/apis/batch/v1/jobs`)
  .then((response) => response.json())
  .then((response) => {
    const jobs = response.items
    lastResourceVersion = response.metadata.resourceVersion
    jobs.forEach((job) => {
      const jobID = `${job.metadata.namespace}-${job.metadata.name}`
      app.upsert(jobID, job)
      console.log('JOB:', jobID)
   })
})
.then(() => streamUpdates())

function streamUpdates(apiString) {
  fetch(`/apis/batch/v1/jobs?watch=1&resourceVersion=${lastResourceVersion}`)
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
            const job = event.object
            const jobID = `${job.metadata.namespace}-${job.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, job.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                app.upsert(jobID, job)
                break
              }
              case 'DELETED': {
                app.remove(jobID)
                break
              }
              case 'MODIFIED': {
                app.update()
                app.upsert(jobID, job)
                break
              }
              case 'Progressing': {
                app.upsert(jobID, job)
                break
              }
              case 'Available': {
                app.upsert(jobID, job)
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
  const allJobs = new Map()
  const content = document.querySelector('#content')

  function render() {
    const jobs = Array.from(allJobs.values())
    if (jobs.length === 0) {
      return
    }
    const jobsByNamespace = groupBy(jobs, (it) => it.namespace)
    const namespaceTemplates = Object.keys(jobsByNamespace).map((namespace) => {
      const jobs = jobsByNamespace[namespace]
      return [
        '<div class="bg-blue center mb4 ba b--black-10 br2 shadow-1" style="width:70%;">',
          `<h3 class="white mh6">${namespace}</h3>`,
          '<hr class="white" style="width:90%;">',
          '<div class="center mv2 bg-white br2" style="width:90%;">',
            '<table class="mv4 center" style="width:100%;">',
              '<tr class="striped--light-gray">',
                '<th>JOB NAME</th>',
                '<th>COMPLETIONS</th>',
                '<th>START TIME</th>',
                '<th>FINISH TIME</th>',
                '<th>CONDITIONS</th>',
                '<th>CONTAINERS</th>',
                '<th>IMAGES</th>',
              '</tr>',
              `${renderNamespace(jobs)}`,
            '</table>',
          '</div>',
        '</div>',
      ].join('')
    })

    content.innerHTML = `<ul class="list pl0 flex flex-wrap center">${namespaceTemplates.join('')}</ul>`

    displayCompletedChart();
    displayTotalChart();
    displayRunningChart();

    function renderNamespace(jobs) {
      return [
        jobs
          .map((job) =>
            [
              '<tr class="striped--light-gray">',
                `<td style="width:30%;"><a href="#popup${job.name}">${job.name}</a></td>`,
                `<td style="width:10%;text-align:center;">${job.complete}/${job.completions}</td>`,
                `<td style="width:10%;text-align:center;">${job.starttime}</td>`,
                `<td style="width:10%;text-align:center;">${job.finishtime}</td>`,
                `<td style="width:20%;text-align:center;">${job.conditions}</td>`,
                `<td style="width:20%;text-align:center;">${job.containers}</td>`,
                `<td style="width:20%;text-align:center;">${job.images}</td>`,
              '</tr>',
              `<div id="popup${job.name}" class="overlay">`,
                `<div class="popup">`,
                  `<h2>Job Logs - ${job.name}</h2>`,
                  `<a class="close" href="#">&times;</a>`,
                  `<div class="content">`,
                    `<p>${job.logMessage}</p>`,
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
    upsert(jobID, job) {
      var jobLog = [];
      var jobComplete = "0";
      var containerName = "NONE";
      var imageName = "NONE";
      var start = "NONE";
      var finish = "NONE";
      var currCondition = "Not Complete";
      if (!job.metadata.name) {
        return
      }
      if (job.status.conditions) {
        if  (job.status.conditions[0].type == "Complete") {
          jobComplete = "1";
          start = job.status.startTime;
          finish = job.status.completionTime;
          currCondition = job.status.conditions[0].type;
        }
      } else if (job.status.startTime) {
        start = job.status.startTime;
      }
      if (job.spec.template.spec.containers) {
        containerName = job.spec.template.spec.containers[0].name;
        imageName = job.spec.template.spec.containers[0].image;
      }
      if (job.metadata) {
        jobLog.push("UID: " + job.metadata.uid + "<br />");
        jobLog.push("Resource Version: " + job.metadata.resourceVersion + "<br />");
        jobLog.push("Creation Timestamp: " + job.metadata.creationTimestamp + "<br />");
        var logArray = jobLog.join(' ');
      }
      if (job.status.conditions) {
        if (job.status.conditions[0].type == "Complete" && job.status.conditions[0].status == "True") {
          totalCompletedJobs += 1;
          if (totalRunningJobs > 0) {
            totalRunningJobs -= 1;
          }
        }
      } else if (job.status.active) {
        totalRunningJobs += 1;
      }
      totalJobs = totalCompletedJobs + totalRunningJobs;
      allJobs.set(jobID, {
        name: job.metadata.name,
        namespace: job.metadata.namespace,
        complete: jobComplete,
        completions: job.spec.completions,
        starttime: start,
        finishtime: finish,
        conditions: currCondition,
        containers: containerName,
        images: imageName,
        logMessage: logArray,
      })
      render()
    },
    update() {
      if (totalRunningJobs > 0) {
        totalRunningJobs -= 1;
        render();
      }
    },
    remove(jobID) {
      totalCompletedJobs -= 1;
      totalJobs = totalCompletedJobs + totalRunningJobs;
      allJobs.delete(jobID)
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
                data: [totalRunningJobs],
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
                text: 'Running Jobs'
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
                data: [totalJobs],
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
                text: 'Total Jobs'
            },
            animation: {
                animateScale: true,
                animateRotate: false
            }
        }
    });
}

function displayCompletedChart() {
    var ctx = document.getElementById('completedChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalCompletedJobs],
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
                text: 'Succeeded Jobs'
            },
            animation: {
                animateScale: true,
                animateRotate: false
            }
        }
    });
}