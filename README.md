# Ready8s
Automate the deployment of on-premise, highly available, production-ready, Kubernetes clusters. Whilst also integrating a frontend web application for monitoring.

Ready8s offers and supports the following features:

•	Automate the deployment and configuration of Kubernetes clusters, with the use of Ansible and Kubeadm.

•	Develop a web-based dashboard, monitoring statistics, logs, events and different components of a Kubernetes cluster.

•	Support multiple Linux based operating systems and machine configurations.

•	Incorporate redundancy and load balancing within the cluster control plane (connection between master nodes), by utilising HAProxy with custom configurations.

•	Provide a redundant storage solution across multiple nodes by implementing Ceph (Rook) to enable replication, to prevent data loss.

•	Offer a choice of CNI (Container Network Interface) plugins to the consumer: Calico, Weave and Flannel.

•	Support the latest software and hardware versions, maintaining an always up-to-date system to avoid security flaws or vulnerabilities.

# License

[![CC BY 4.0][cc-by-shield]][cc-by]


[cc-by]: http://creativecommons.org/licenses/by/4.0/
[cc-by-shield]: https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg


<a rel="license" href="http://creativecommons.org/licenses/by/4.0/"><img alt="Creative Commons Licence" style="border-width:0" src="https://i.creativecommons.org/l/by/4.0/88x31.png" /></a><br /><span xmlns:dct="http://purl.org/dc/terms/" property="dct:title">Ready8s</span> by <a xmlns:cc="http://creativecommons.org/ns#" href="https://github.com/nwebb11" property="cc:attributionName" rel="cc:attributionURL">Nathan Webb</a> is licensed under a <a rel="license" href="http://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 International License</a>.<br />Based on a work at <a xmlns:dct="http://purl.org/dc/terms/" href="https://github.com/nwebb11/ready8s" rel="dct:source">https://github.com/nwebb11/ready8s</a>.

## HA - HAPROXY

Using HAProxy to act as load load balancer on each master node, which provides the API Endpoint that redirects to localhost:443. Each node in the cluster is configured with localhost:443 as its endpoint URL. This provices a HA control plane with an external load balancer.

To disable or enable multi master load balancing, if only one master is only deployed within a cluster. Open the hosts.ini file and edit the 'multimaster' parameter; true (enable) or false (disable).

hosts.ini, multimaster:
```
[master:vars]
multimaster=true
```

## METALLB

MetalLB has been incorporated into Ready8s cluster deployments, acting as an external bare metal load-balancer. Offering IP addresses to pods and services defined within a IP address range.

To change the MetalLB IP address range, edit 'roles/metallb/defaults/main.yml' file.

roles/metallb/defaults/main.yml:
```
---
loadbalancer_ip_range: 192.168.88.230-192.168.88.240
```

## NETWORK PLUGINS

Calico, Weave and Flannel are all supported within Ready8s. Open the hosts.ini file and edit the 'networkplugin' parameter.

hosts.ini, networkplugin:
```
[master:vars]
networkplugin=calico
```

The pod subnet will also need adjusting depending on the plugin used. Below are the supported IP ranges for each network plugin:

• Calico - 192.168.0.0/16

• Weave - 10.0.0.0/8

• Flannel - 10.244.0.0/16

The 'roles/common/defaults/main.yaml' file contains the 'pod_subnet' variable, which should be altered with the correct IP range from above.

roles/common/defaults/main.yaml:
```
---
service_subnet: 10.96.0.0/12
pod_subnet: 192.168.0.0/16
dnsdomain: myclusterdnsdomain.local
kube_version: 1.21.1
policy: enabled
cluster_name: myclustername
certsans:
  - name: localhost
  - name: myclustername.domain

system_reserved_memory: 512Mi
kube_reserved_memory: 128Mi
```

## REPLICATION ROOK (CEPH)

Rook can be deployed within a Kubernetes cluster offering replicated storage across nodes. At least two RAW disks on different nodes need to be configured, preferably the same size.

Open the hosts.ini file and alter the 'replicatestorage' parameter to enable or disable Rook, using true or false.

hosts.ini, replicatestorage:
```
[master:vars]
replicatestorage=true
```

## REAL-TIME DASHBOARD

Deployment YAML can be found under the first master within the 'Dashboard' directory. The dashboard is automatically deployed with Ready8s clusters, to disable the dashboard open the 'hosts.ini' file and edit the 'dashboard' parameter to false.

hosts.ini:
```
[master:vars]
dashboard=true
```

The dashboard web address can be found under the following location:

```
http://sidecar-service-ipaddress:8001/static/home
```

The Dockerfile for the dashboard can be found at the following address and under the 'dashboard' folder within this repo: https://hub.docker.com/repository/docker/nathanw97/dashboard 

The following command will help to identify the IP address of the dashboard (sidecar-service, external-ip):

```
kubectl get svc
```

## DEPLOYMENT INSTRUCTIONS

Edit 'hosts.ini' & 'roles/common/defaults/main.yaml' to meet user requirements, following the steps above.

Sample 'hosts.ini' file:

```
#example of hosts.ini file
[all]
#define hostname/ip of each node
master1 ansible_host=192.168.88.188 ip=192.168.88.188
master2 ansible_host=192.168.88.189 ip=192.168.88.189
master3 ansible_host=192.168.88.190 ip=192.168.88.190
worker1 ansible_host=192.168.88.191 ip=192.168.88.191
worker2 ansible_host=192.168.88.192 ip=192.168.88.192
worker3 ansible_host=192.168.88.193 ip=192.168.88.193

[all:vars]
#ansible machine host user
ansible_user=kube
#ssh key location, should be copy on to each node before hand
ansible_ssh_private_key_file=/home/njhw/.ssh/id_rsa
#set the ansible interpreter, should always be python3
ansible_python_interpreter=/usr/bin/python3
host_key_checking=True

[master]
#define each master to its group
master1
master2
master3

#Edit the following parameters to add/remove features
[master:vars]
#Calico, Weave, Flannel
networkplugin=weave
multimaster=true
replicatestorage=true
dashboard=true

[worker]
#define each worker to it group
worker1
worker2
worker3
```

Sample 'roles/common/defaults/main.yaml' file:

```
---
service_subnet: 10.96.0.0/12
pod_subnet: 192.168.0.0/16
dnsdomain: myclusterdnsdomain.local
kube_version: 1.21.1
policy: enabled
cluster_name: myclustername
certsans:
  - name: localhost
  - name: myclustername.domain

system_reserved_memory: 512Mi
kube_reserved_memory: 128Mi
```

SSH keys are a needed requirement for Ansible to run commands over SSH. Steps can be found here if SSH keys have not been created: https://www.digitalocean.com/community/tutorials/how-to-set-up-ssh-keys-2 

If SSH keys have been previsouly created, the following command will copy the keys to a host:

```
ssh-copy-id kube@master1
```

If a specific user is required to access and run Kubernetes commands, the 'playbooks/ssh.yml' file can be ran to create a Kube user on each node with the correct permissions - SSH keys need to be configured first

How to run 'playbooks/ssh.yml':

```
ansible-playbook -i hosts.ini -f 10 playbooks/ssh.yml -K
```

The following command will start the automation, then build and deploy a Kubernetes cluster from the specification provided by the user:

```
ansible-playbook -i hosts.ini -f 10 main.yaml
```
