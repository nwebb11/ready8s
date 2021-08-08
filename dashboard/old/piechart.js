let pielastResourceVersion

let totalPodCapacity = 0
let totalRunningPods = 0

let totalCPUCapacity = 0
let totalCPUAllocate = 0

let totalRAMCapacity = 0
let totalRAMAllocate = 0

fetch(`/api/v1/nodes`)
  .then((response) => response.json())
  .then((response) => {
    const nodes = response.items
    pielastResourceVersion = response.metadata.resourceVersion
    nodes.forEach((node) => {
      let podAmountConvert = parseInt(`${node.status.capacity.pods}`);
      totalCPUCapacity += parseInt(`${node.status.capacity.cpu}`);
      totalCPUAllocate += parseInt(`${node.status.allocatable.cpu}`);
      totalRAMCapacity += parseInt(`${node.status.capacity.memory}`);
      totalRAMAllocate += parseInt(`${node.status.allocatable.memory}`);
      totalPodCapacity += podAmountConvert;      
    })
    totalRAMCapacity = totalRAMCapacity / 1000000
    totalRAMAllocate = totalRAMAllocate / 1000000
})
.then(() => getRunningPods())

function getRunningPods() {
    fetch(`/api/v1/pods`)
      .then((response) => response.json())
      .then((response) => {
        const pods = response.items
        lastResourceVersion = response.metadata.resourceVersion
        pods.forEach((pod) => {
          const podId = `${pod.metadata.namespace}-${pod.metadata.name}`
          totalRunningPods += 1;
          console.log('PODS:', podId)
          console.log('piechart: ', totalRunningPods);
        })
    })
    .then(() => displayPodChart())
}

function displayPodChart() {
    var ctx = document.getElementById('podChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalRunningPods,totalPodCapacity],
                backgroundColor: [
                    'rgba(210,77,87,1)',
                    'rgba(65,131,215,1)',
                ],
                label: 'Dataset 1'
            }],
            labels: [
                'Running',
                'Capacity'
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
                animateRotate: true
            }
        }
    });
    displayCPUChart()
    displayRAMChart()
}

function displayCPUChart() {
    var ctx = document.getElementById('cpuChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalCPUAllocate,totalCPUCapacity],
                backgroundColor: [
                    'rgba(210,77,87,1)',
                    'rgba(65,131,215,1)',
                ],
                label: 'Dataset 1'
            }],
            labels: [
                'Allocatable',
                'Capacity'
            ]
        },
        options: {
            responsive: true,
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Total CPUs'
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
}

function displayRAMChart() {
    var ctx = document.getElementById('ramChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalRAMAllocate,totalRAMCapacity],
                backgroundColor: [
                    'rgba(210,77,87,1)',
                    'rgba(65,131,215,1)',
                ],
                label: 'Dataset 1'
            }],
            labels: [
                'Allocatable',
                'Capacity'
            ]
        },
        options: {
            responsive: true,
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: 'Total Memory (GB)'
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
}
