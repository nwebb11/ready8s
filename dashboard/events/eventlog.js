const app = App()
let lastResourceVersion

let totalWarningEvents = 0;
let totalNormalEvents = 0;
let totalEvents = 0;

fetch(`/api/v1/events`)
  .then((response) => response.json())
  .then((response) => {
    const eventLogs = response.items
    lastResourceVersion = response.metadata.resourceVersion
    eventLogs.forEach((eventLog) => {
      const eventLogID = `${eventLog.metadata.namespace}-${eventLog.metadata.name}`
      app.upsert(eventLogID, eventLog)
      console.log('EVENT:', eventLogID)
   })
})
.then(() => streamUpdates())

function streamUpdates(apiString) {
  fetch(`/api/v1/events?watch=1&resourceVersion=${lastResourceVersion}`)
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
            const eventLog = event.object
            const eventLogID = `${eventLog.metadata.namespace}-${eventLog.metadata.name}`
            console.log('PROCESSING EVENT: ', event.type, eventLog.metadata.name)
            switch (event.type) {
              case 'ADDED' : {
                app.upsert(eventLogID, eventLog)
                break
              }
              case 'DELETED': {
                app.remove(eventLogID, eventLog)
                break
              }
              case 'MODIFIED': {
                app.upsert(eventLogID, eventLog)
                break
              }
              case 'Progressing': {
                app.upsert(eventLogID, eventLog)
                break
              }
              case 'Available': {
                app.upsert(eventLogID, eventLog)
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
  const allEventLogs = new Map()
  const content = document.querySelector('#content')

  function render() {
    const eventLogs = Array.from(allEventLogs.values())
    if (eventLogs.length === 0) {
      return
    }

    //console.log('EVENT:', eventLogs)
    var somearray = eventLogs.map(a => a.value);
    $(document).ready(function() {
        $('#event_table').DataTable( {
            destroy: true,
            scrollY: 500,
            scrollX: true,
            data: eventLogs,
            "processing": true,
            columns: [
              {data:'type', title: 'Type'},
              {data:'name', title: 'Name'},
              {data:'reason', title: 'Reason'},
              {data:'message', title: 'Message'},
              {data:'object', title: 'Object'},
              {data:'kind', title: 'Kind'},
              {data:'namespace', title: 'Namespace'},
              {data:'source', title: 'Source'},
              {data:'count', title: 'Count'},
              {data:'lastSeen', title: 'Last Seen'},
              {data:'logMessage', title: 'Log Message'},
            ]
        } );
    } );
    displayWarningChart();
    displayNormalChart();
    displayTotalChart();
  }

  return {
    upsert(eventLogID, eventLog) {
      var sComponents = "NONE";
      var eventDetails = [];
      var eventCount = "NONE";
      var eventTimestamp = "NONE";
      var eventObject = "NONE";
      if (!eventLog.metadata.name) {
        return
      }
      if (eventLog.source.host) {
        sComponents = eventLog.source.component + " " + eventLog.source.host;
      } else if (eventLog.source.component) {
        sComponents = eventLog.source.component;
      }
      if (eventLog.count) {
        eventCount = eventLog.count;
      }
      if (eventLog.lastTimestamp) {
        eventTimestamp = eventLog.lastTimestamp;
      }
      if (eventLog.involvedObject.name) {
        eventObject = eventLog.involvedObject.name
      }
      if (eventLog.metadata) {
        eventDetails.push("UID: " + eventLog.metadata.uid + "<br />");
        eventDetails.push("Resource Version: " + eventLog.metadata.resourceVersion + "<br />");
        eventDetails.push("Creation Timestamp: " + eventLog.metadata.creationTimestamp + "<br />");
        var logArray = eventDetails.join(' ');
      }
      if (eventLog.type == "Warning") {
        totalWarningEvents += 1;
      } else if (eventLog.type = "Normal") {
        totalNormalEvents += 1;
      }
      totalEvents = totalWarningEvents + totalNormalEvents;
      allEventLogs.set(eventLogID, {
        type: eventLog.type,
        name: eventLog.metadata.name,
        reason: eventLog.reason,
        message: eventLog.message,
        object: eventObject,
        kind: eventLog.involvedObject.kind,
        namespace: eventLog.metadata.namespace,
        source: sComponents,
        count: eventCount,
        lastSeen: eventTimestamp,
        logMessage: logArray,
      })
      render()
    },
    remove(eventLogID, eventLog) {
      if (eventLog.type == "Warning") {
        totalWarningEvents += 1;
      } else if (eventLog.type = "Normal") {
        totalNormalEvents += 1;
      }
      totalEvents = totalWarningEvents + totalNormalEvents;
      allEventLogs.delete(eventLogID)
      render()
    },
  }
}

function displayWarningChart() {
    var ctx = document.getElementById('warningChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalWarningEvents],
                backgroundColor: [
                    'rgba(245,171,53,1)',
                ],
                label: 'Dataset 1'
            }],
            labels: [
                'Warning'
            ]
        },
        options: {
            responsive: true,
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Warning Events'
            },
            animation: {
                animateScale: true,
                animateRotate: false
            }
        }
    });
}

function displayNormalChart() {
    var ctx = document.getElementById('normalChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalNormalEvents],
                backgroundColor: [
                    'rgba(65,131,215,1)',
                ],
                label: 'Dataset 1'
            }],
            labels: [
                'Normal'
            ]
        },
        options: {
            responsive: true,
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Normal Events'
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
                data: [totalEvents],
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
                text: 'Total Events'
            },
            animation: {
                animateScale: true,
                animateRotate: false
            }
        }
    });
}