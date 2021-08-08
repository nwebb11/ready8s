# ready8s
Automate the deployment of on-premise, highly available, production-ready, Kubernetes clusters. Whilst also integrating a frontend web application for monitoring.

## HA

Using HAProxy to act as load balancer on each master node, which provides the API Endpoint that redirects to localhost:443. Each node in the cluster is configured with localhost:443 as its endpoint URL. This provices a HA control plane with an external load balancer.

## Instructions

Edit hosts.ini & defaults/main.yaml to meet user requirements.

Run main.yaml playbook:

```
ansible-playbook -i hosts.ini -f 10 main.yaml
```

Edit the hosts.ini file to select different network plugins and disable untainting on multi-master clusters.
