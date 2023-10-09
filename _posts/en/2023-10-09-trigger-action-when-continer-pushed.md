---
title: "Using webhooks to trigger actions when a docker image are pushed to a private docker registry"
date: 2023-10-09T18:50:00+0200
last_modified_at: 2023-10-09T18:50:00+0200
layout: single
lang: en
categories:
   - frontend
tags:
   - docker
   - docker-registry
   - webhooks
toc: false
author_profile: true
classes: wide
---
Start by setting up your own docker registry. Here is a little shell script doing it for you

```shell
#/bin/sh

docker pull registry:2
docker stop registry
docker rm registry

docker run -d \
  -p 5000:5000 \
  --restart=always \
  --name registry \
  -v ./registry:/var/lib/registry \
  -v ./config.yml:/etc/docker/registry/config.yml \
  registry:2
```
As you can see we are mounting a directory for the registry and a config file. Lets dig into the config file

```yaml
version: 0.1
log:
  fields:
    service: registry
storage:
  cache:
    blobdescriptor: inmemory
  filesystem:
    rootdirectory: /var/lib/registry
http:
  addr: :5000
  headers:
    X-Content-Type-Options: [nosniff]
health:
  storagedriver:
    enabled: true
    interval: 10s
notifications:
  endpoints:
    - name: alistener
      url: http://localhost:9000/hooks/redeploy-webhook
      timeout: 500ms
      threshold: 5
      backoff: 1s
```
The secret to trigger something when you push to the registry is the notifications part in the end.

So lets continue with setup a simple webhook on your machine. For that we are using, [webhook by Adnan Hajdarević](https://github.com/adnanh/webhook). 
There are several ways of install the software on your machine, I recommend docker or apt depending on your use case.

```shell
sudo apt-get install webhook
```

Now lets continue configure webhook software. Create a directory for it 

```shell
mkdir /etc/webhook
```

Create a file named hooks.json and a directory named hooks and a file named git-redeploy.sh

```shell
touch /etc/webhook/hooks.json
mkdir /etc/webhook/hooks
touch /etc/webhook/hooks/git-redeploy.sh
```
Add the following content to the hooks.json file, don't forget change the names and number of the docker images you 
ant to perform some actions when a new image are pushed.

__hooks.json__
```json
[
  {
    "id": "redeploy-webhook",
    "execute-command": "/etc/webhook/hooks/git-redeploy.sh",
    "command-working-directory": "/etc/webhook/hooks",
    "pass-arguments-to-command": [
      {
        "source": "payload",
        "name": "events.0.target.repository"
      }
    ],
    "trigger-rule": {
      "and": [
        {
          "match": {
            "type": "value",
            "parameter": {
              "source": "payload",
              "name": "events.0.action"
            },
            "value": "push"
          }
        },
        {
          "or": [
            {
              "match": {
                "type": "value",
                "parameter": {
                  "source": "payload",
                  "name": "events.0.target.repository"
                },
                "value": "my-docker-image-1"
              }
            },
            {
              "match": {
                "type": "value",
                "parameter": {
                  "source": "payload",
                  "name": "events.0.target.repository"
                },
                "value": "my-docker-image-1"
              }
            }
          ]
        },
        {
          "match": {
            "type": "value",
            "parameter": {
              "source": "payload",
              "name": "events.0.target.tag"
            },
            "value": "latest"
          }
        }
      ]
    }
  }
]
```
__git-redeploy.sh__
```shell
#!/bin/sh

git_repository=$1


echo "Redeploying $git_repository container..."
cd /home/admin/docker
echo -n "Current working directory: "
echo `pwd`
echo ""
if [[ "$git_repository" = "my-docker-image-1" ]]; then
  echo "Redeploying my-docker-service-1..."
  docker pull localhost:5000/my-docker-image-1:latest
  docker stop my-docker-service-1
  docker rm my-docker-service-1
  docker run  --name my-docker-service-1 localhost:5000/my-docker-image-1:latest
  echo "Redeploying $git_repository container done!"
elif [[ "$git_repository" = "my-docker-image-2" ]]; then
  echo "Redeploying my-docker-service-2..."
  docker pull localhost:5000/my-docker-image-2:latest
  docker stop my-docker-service-2
  docker rm my-docker-service-2
  docker run  --name my-docker-service-2 localhost:5000/my-docker-image-2:latest
  echo "Redeploying $git_repository container done!"
else
  echo ""                                           
  echo "ERROR: Redeploy of unknown repository  $git_repository failed !!!"
  exit -1
fi

exit 0
```
The webhook software could be executed as a service, how to achieve that depends heavily on your OS.
This is an example for alpine linux.

__/etc/init.d/webhook__
```shell
#!/sbin/openrc-run

name="webhook"
command="/usr/bin/webhook"
command_args="-hooks /etc/webhook/hooks.json -verbose -logfile=/var/log/webhook.log tunnel run &"
pidfile="/var/run/webhook.pid"

depend() {
        need net localmount
        after firewall
}
```
Enable startup of service at boot time and then start it up

```shell
# Start service ay boot time
rc-update add webhook default

# Start service
rc-service webhook start
```