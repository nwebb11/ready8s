let pielastResourceVersion

var totalPodCapacity = 0
var totalRunningPods = 0

let totalCPUCapacity = 0
let totalCPUAllocate = 0

let totalRAMCapacity = 0
let totalRAMAllocate = 0

let totalDeployments = 0
let totalReadyDeployments = 0

let totalServices = 0
let totalReadyServices = 0

let totalStatefulsets = 0
let totalReadyStatefulsets = 0

let totalDaemonsets = 0
let totalReadyDaemonsets = 0

let totalJobs = 0
let totalCompletedJobs = 0
let totalRunningJobs = 0

let totalCronjobs = 0
let totalScheduledCronjobs = 0

function getPieUpdates() {
  fetch(`/api/v1/nodes`)
    .then((response) => response.json())
    .then((response) => {
      const nodes = response.items
      pielastResourceVersion = response.metadata.resourceVersion
      totalCPUCapacity = 0
      totalCPUAllocate = 0
      totalRAMCapacity = 0
      totalRAMAllocate = 0
      totalPodCapacity = 0
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
}

function getRunningPods() {
    fetch(`/api/v1/pods`)
      .then((response) => response.json())
      .then((response) => {
        const pods = response.items
        lastResourceVersion = response.metadata.resourceVersion
        totalRunningPods = 0
        pods.forEach((pod) => {
          const podId = `${pod.metadata.namespace}-${pod.metadata.name}`
          totalRunningPods += 1;
          console.log('PODS:', podId)
          console.log('piechart: ', totalRunningPods);
        })
    })
    .then(() => getReadyDeployments())
}

function getReadyDeployments() {
  fetch(`/apis/apps/v1/deployments`)
    .then((response) => response.json())
    .then((response) => {
      const deployments = response.items
      totalDeployments = 0
      totalReadyDeployments = 0
      deployments.forEach((deployment) => {
        const deployID = `${deployment.metadata.namespace}-${deployment.metadata.name}`
        totalDeployments += 1;
        if (deployment.status.readyReplicas && deployment.status.readyReplicas != "0") {
          totalReadyDeployments += 1;
        }
        console.log('DEPLOYMENTS:', deployID)
      })
  })
  .then(() => getReadyServices())
}

function getReadyServices() {
  fetch(`/api/v1/services`)
    .then((response) => response.json())
    .then((response) => {
      const services = response.items
      totalServices = 0
      totalReadyServices = 0
      services.forEach((service) => {
        const serviceID = `${service.metadata.namespace}-${service.metadata.name}`
        totalServices += 1;
        if (service.spec.ports[0]) {
          if (service.spec.ports[0].port) {
            totalReadyServices += 1;
          }
        }
        console.log('SERVICES:', serviceID)
      })
  })
  .then(() => getReadyStatefulsets())
}

function getReadyStatefulsets() {
  fetch(`/apis/apps/v1/statefulsets`)
    .then((response) => response.json())
    .then((response) => {
      const statefulsets = response.items
      totalStatefulsets = 0
      totalReadyStatefulsets = 0
      statefulsets.forEach((statefulset) => {
        const statefulsetID = `${statefulset.metadata.namespace}-${statefulset.metadata.name}`
        totalStatefulsets += 1;
        if (statefulset.status.readyReplicas && statefulset.status.readyReplicas != "0") {
          totalReadyStatefulsets += 1;
        }
        console.log('STATEFUL SETS:', statefulsetID)
      })
  })
  .then(() => getReadyDaemonsets())
}

function getReadyDaemonsets() {
  fetch(`/apis/apps/v1/daemonsets`)
    .then((response) => response.json())
    .then((response) => {
      const daemonsets = response.items
      totalDaemonsets = 0
      totalReadyDaemonsets = 0
      daemonsets.forEach((daemonset) => {
        const daemonsetID = `${daemonset.metadata.namespace}-${daemonset.metadata.name}`
        totalDaemonsets += 1;
        if (daemonset.status.numberReady && daemonset.status.numberReady != "0" && daemonset.status.numberReady == daemonset.status.desiredNumberScheduled) {
          totalReadyDaemonsets += 1;
        }
        console.log('DAEMON SETS:', daemonsetID)
      })
  })
  .then(() => getAllJobs())
}

function getAllJobs() {
  fetch(`/apis/batch/v1/jobs`)
    .then((response) => response.json())
    .then((response) => {
      const jobs = response.items
      totalJobs = 0
      totalCompletedJobs = 0
      totalRunningJobs = 0
      jobs.forEach((job) => {
        const jobID = `${job.metadata.namespace}-${job.metadata.name}`
        totalJobs += 1;
        if (job.status.conditions[0]) {
          if (job.status.conditions[0].type = "Complete") {
            totalCompletedJobs += 1;
          }
        } else if (!job.status.conditions[0] && job.status.active) {
          totalRunningJobs += 1;
        }
        console.log('JOBS:', jobID)
      })
  })
  .then(() => getAllCronjobs())
}

function getAllCronjobs() {
  fetch(`/apis/batch/v1beta1/cronjobs`)
    .then((response) => response.json())
    .then((response) => {
      const cronjobs = response.items
      totalCronjobs = 0
      totalScheduledCronjobs = 0
      cronjobs.forEach((cronjob) => {
        const cronjobID = `${cronjob.metadata.namespace}-${cronjob.metadata.name}`
        totalCronjobs += 1;
        if (cronjob.spec.schedule) {
          totalScheduledCronjobs += 1
        }
        console.log('CRONJOBS:', cronjobID)
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
    displayRAMChart()
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
    displayDeploymentsChart();
}

function displayDeploymentsChart() {
    var ctx = document.getElementById('deploymentChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalReadyDeployments,totalDeployments],
                backgroundColor: [
                    'rgba(210,77,87,1)',
                    'rgba(65,131,215,1)',
                ],
                label: 'Dataset 1'
            }],
            labels: [
                'Ready',
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
                text: 'Running Deployments'
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
    displayServicesChart();
}

function displayServicesChart() {
    var ctx = document.getElementById('serviceChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalReadyServices,totalServices],
                backgroundColor: [
                    'rgba(210,77,87,1)',
                    'rgba(65,131,215,1)',
                ],
                label: 'Dataset 1'
            }],
            labels: [
                'Ready',
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
                text: 'Running Services'
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
    displayStatefulsetsChart();
}

function displayStatefulsetsChart() {
    var ctx = document.getElementById('statefulsetChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalReadyStatefulsets,totalStatefulsets],
                backgroundColor: [
                    'rgba(210,77,87,1)',
                    'rgba(65,131,215,1)',
                ],
                label: 'Dataset 1'
            }],
            labels: [
                'Ready',
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
                text: 'Running Stateful Sets'
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
    displayDaemonsetsChart();
}

function displayDaemonsetsChart() {
    var ctx = document.getElementById('daemonsetChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalReadyDaemonsets,totalDaemonsets],
                backgroundColor: [
                    'rgba(210,77,87,1)',
                    'rgba(65,131,215,1)',
                ],
                label: 'Dataset 1'
            }],
            labels: [
                'Ready',
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
                text: 'Running Daemon Sets'
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
    displayJobsChart();
}

function displayJobsChart() {
    var ctx = document.getElementById('jobChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalRunningJobs,totalCompletedJobs,totalJobs],
                backgroundColor: [
                    'rgba(210,77,87,1)',
                    'rgba(123,239,178,1)',
                    'rgba(65,131,215,1)',
                ],
                label: 'Dataset 1'
            }],
            labels: [
                'Running',
                'Completed',
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
                text: 'Jobs'
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
    displayCronjobsChart();
}

function displayCronjobsChart() {
    var ctx = document.getElementById('cronjobChart').getContext('2d');
    var myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [totalScheduledCronjobs,totalCronjobs],
                backgroundColor: [
                    'rgba(210,77,87,1)',
                    'rgba(65,131,215,1)',
                ],
                label: 'Dataset 1'
            }],
            labels: [
                'Scheduled',
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
                text: 'CronJobs'
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
    setTimeout(getPieUpdates, 30000)
}

getPieUpdates();