let currentCPUusage = 0;
let currentRAMusage = 0;

var dataArray = [];
var dataArrayRAM = [];

var timeFormat = 'MM/DD/YYYY HH:mm';

var timeCounter = 0;
//var timeArray = [newDate(0), newDate(15), newDate(30), newDate(45), newDate(60), newDate(75)];
var timeArray = [];

//startMetrics();

function startMetrics() {
    fetch(`/apis/metrics.k8s.io/v1beta1/nodes`)
      .then((response) => response.json())
      .then((response) => {
        const nodes = response.items
        currentCPUusage = 0
        currentRAMusage = 0
        nodes.forEach((node) => {
          currentCPUusage += parseInt(`${node.usage.cpu}`);
          currentRAMusage += parseInt(`${node.usage.memory}`);
          console.log('NODES:', currentCPUusage)
          console.log('NODES:', currentRAMusage)
        })
        if (dataArray.length >= 12) {
            dataArray.shift()
            timeArray.shift()
        }
        var totalCoreUsage = currentCPUusage / (totalCPUAllocate * 100000000)
        var totalMemoryUsage = currentRAMusage  / 1000000
        dataArray.push(totalCoreUsage)
        dataArrayRAM.push(totalMemoryUsage)
        timeArray.push(newDate(0))
    })
    .then(() => displayUsageLine())
}

function newDate(minutes) {
    return moment().add(minutes, 'm').toDate();
}

function newDateString(days) {
    return moment().add(days, 'd').format(timeFormat);
}

function displayUsageLine() {
    var ctx = document.getElementById('cpuLineChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeArray,
            datasets: [{
                label: 'Core Usage',
                fill: false,
                backgroundColor: 'rgba(210,77,87,1)',
                borderColor: 'rgba(210,77,87,1)',
                data: dataArray,
            }]
        },
        options: {
            responsive: true,
            title: {
                display: true,
                text: 'Current CPU Usage (Cores)'
            },
            tooltips: {
                mode: 'index',
                intersect: false,
            },
            hover: {
                mode: 'nearest',
                intersect: true
            },
            scales: {
                xAxes: [{
                    type: 'time',
                    time: {
                        unit: 'minute'
                    }
                }],
                yAxes: [{
                    ticks: {
                        beginAtZero: false
                    }
                }]
            }
        }
    });
        displayRAMUsageLine()
}

function displayRAMUsageLine() {
    var ctx = document.getElementById('ramLineChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeArray,
            datasets: [{
                label: 'RAM Usage',
                fill: false,
                backgroundColor: 'rgba(65,131,215,1)',
                borderColor: 'rgba(65,131,215,1)',
                data: dataArrayRAM,
            }]
        },
        options: {
            responsive: true,
            title: {
                display: true,
                text: 'Current RAM Usage (GB)'
            },
            tooltips: {
                mode: 'index',
                intersect: false,
            },
            hover: {
                mode: 'nearest',
                intersect: true
            },
            scales: {
                xAxes: [{
                    type: 'time',
                    time: {
                        unit: 'minute'
                    }
                }],
                yAxes: [{
                    ticks: {
                        beginAtZero: false
                    }
                }]
            }
        }
    });
    setTimeout(startMetrics, 30000)
}

startMetrics();