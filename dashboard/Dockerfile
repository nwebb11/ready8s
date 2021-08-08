FROM alpine:latest

#WORKDIR $HOME/home

ADD https://storage.googleapis.com/kubernetes-release/release/v1.21.1/bin/linux/amd64/kubectl /usr/local/bin/kubectl
RUN chmod +x /usr/local/bin/kubectl

ADD . /

EXPOSE 8001

CMD kubectl proxy --www=. --address='0.0.0.0' --accept-hosts='^*$'