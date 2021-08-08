[AllNodesProfile-TCP]
title=Ports need to be open on all hosts - tcp
description=These ports are required to setup and initiate a K8s cluster
ports=22,80,443,179,10250,6783/tcp

[AllNodesProfile-UDP]
title=Ports need to be open on all hosts - udp
description=These ports are required to setup and initiate a K8s cluster
ports=53,161,6783,6784/udp

[MasterNodeProfile-TCP]
title=Ports need to be open on master hosts - tcp
description=These ports are required to setup and initiate a K8s cluster
ports=8080,6443,2379:2380,10251,10252/tcp

[WorkerNodeProfile-TCP]
title=Ports need to be open on worker hosts - tcp
description=These ports are required to setup and initiate a K8s cluster
ports=30000:32767/tcp
