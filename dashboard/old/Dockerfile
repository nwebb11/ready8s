FROM alpine:latest

WORKDIR $HOME/sidecar

ADD https://storage.googleapis.com/kubernetes-release/release/v1.20.2/bin/linux/amd64/kubectl /usr/local/bin/kubectl
RUN chmod +x /usr/local/bin/kubectl

ADD https://raw.githubusercontent.com/nathanwebb11/ready8s/sidecar-proxy/sidecar-proxy/index.html?token=AK6QGMU2Y5WGTAKBQSZAMVLAHEIUO index.html
ADD https://raw.githubusercontent.com/nathanwebb11/ready8s/sidecar-proxy/sidecar-proxy/deployments.html?token=AK6QGMT5KSBMHC3BGWH7TQLAHENHQ deployments.html
ADD https://raw.githubusercontent.com/nathanwebb11/ready8s/sidecar-proxy/sidecar-proxy/app.js?token=AK6QGMS7PYVWDVVUTJVAAYLAHEIWY app.js
ADD https://raw.githubusercontent.com/nathanwebb11/ready8s/sidecar-proxy/sidecar-proxy/get-deployments.js?token=AK6QGMWHAH7NG7R3CXIOTFDAHEM4K get-deployments.js

EXPOSE 8001

CMD kubectl proxy --www=. --address='0.0.0.0' --accept-hosts='^*$'
