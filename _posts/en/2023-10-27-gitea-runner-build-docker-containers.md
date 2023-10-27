---
date: 2023-10-27T14:30:00+0200
title: "How to build docker containers using gitea runners"
last_modified_at: 2023-10-27T14:30:00+0200
layout: single
lang: en
categories:
   - ci/cd
   - docker
tags:
   - docker
   - docker-registry
   - gitea
   - ci/cd
toc: false
author_profile: true
classes: wide
---
Gitea has pretty recently introduced actions, which is basically CI/CD pipelines. 
They work very match as [Gitlab Actions](https://docs.gitlab.com/ee/ci/). 
In fact a Gitea CI/CD pipeline is almost fully compatible with a Gitlab pipeline except a few minor details and limitations.
You can even use Gitlab actions in your Gitea CI/CD pipeline build steps.

This article is about how to make your Gitea CI/CD pipeline build docker images.

Start by setting up gitea, [installation with docker](https://docs.gitea.com/next/installation/install-with-docker).
Don't forget to enable actions in Gitea configuration file.

```
[actions]
ENABLED=true
```
I also suggest you setup HTTPS with a valid certificate, you will run into problems else in your builds with 
complains about insecure stuff. How to do that is out of scope for this blog post, but you can read more
about it [here](https://docs.gitea.com/administration/https-setup?_highlight=https).

After that it's time to [set up the runners](https://docs.gitea.com/next/usage/actions/quickstart). 
The documentation do not say anything about how to build different kind of artifacts. What you can build with a runner
is defined by it's LABELS. A label maps to a docker container performing the build step in the CI/CD pipeline. If you
not specify any LABELS you get the default that can NOT build docker containers. To get that capability you can
make use of the [catthehacker docker images Github project](https://github.com/catthehacker/docker_images).

Anyway this is how I setup my runners

1. Create directory for your runners
   ```
   mkdir gitea-runners
   ```
2. Then create a initial config file for the runner, binary could be downloaded [here](https://dl.gitea.com/act_runner/).
   ```
   ./act_runner generate-config > config1.yaml
   ```
3. Now lets create a basic script file for fire up you runner docker container. 
   How to get the token is covered by the [Gitea Action Quick start](https://docs.gitea.com/next/usage/actions/quickstart) guide.
   ```shell
   #!/bin/sh 
   docker pull gitea/act_runner:latest
   docker stop nazgul-runner-1
   docker rm nazgul-runner-1
   docker run \
   --restart always \
   -v $PWD/config1.yaml:/config.yaml \
   -v $PWD/data1:/data \
   -v /var/run/docker.sock:/var/run/docker.sock:rw \
   -e CONFIG_FILE=/config.yaml \
   -e GITEA_INSTANCE_URL=https://<gitea.mydomain.con>/ \
   -e GITEA_RUNNER_REGISTRATION_TOKEN=<MyGiteaRunnerToken> \
   -e GITEA_RUNNER_NAME=gitea-runner-1 \
   -e GITEA_RUNNER_LABELS=ubuntu-latest:docker://node:16-bullseye,ubuntu-22.04:docker://node:16-bullseye,ubuntu-20.04:docker://node:16-bullseye,ubuntu-18.04:docker://node:16-buster,cth-ubuntu-latest:docker://catthehacker/>
   --name nazgul-runner-1 \
   -d gitea/act_runner:latest \
   --privileged
   ```
4. Now you should have your first runner up and running, check in Gitea that it's actually popped up.
5. Enable actions for all your git repositories that you want, it's a checkbox named actions under git repository basic settings. 

Now lets create a CI/CD pipeline for your git repository. I assume you are capable of creating the Dockerfile needed yourself.
The example bellow I took from a project with node backend using the express framework.
```yaml
#
# .gitea/gitea-ci.yaml
#

name: Build And Test
run-name: ${{ gitea.actor }} is runs ci pipeline
on: [ push ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: https://github.com/actions/checkout@v4
      - name: Use Node.js
        uses: https://github.com/actions/setup-node@v3
        with:
          node-version: '18.17'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build:prod
        env:
           NODE_OPTIONS: --max_old_space_size=4096

  publish:
    runs-on: cth-ubuntu-latest
    needs: build
    if: gitea.ref == 'refs/heads/main'
    steps:
      - uses: https://github.com/actions/checkout@v4
      - name: Set up Docker Buildx
        uses: https://github.com/docker/setup-buildx-action@v3
        with:
          config-inline: |
            [registry."<my-private-unsecure-git-repository-ip-address>:5000"]
              http = true
              insecure = true            
      - name: Build and push Docker image
        uses: https://github.com/docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: "<my-private-unsecure-git-repository-ip-address>:5000/<my-docker-image>:${{gitea.sha}},<my-private-unsecure-git-repository-ip-address>:5000/<my-docker-image>:latest"
```

So the build pipeline contains two steps, build and publish. The first step executes for all pushes to all branches, 
the second step only for main branch. Pay attention to the second step runs on *cth-ubuntu-latest*. 
Which is one of the custom LABELS we added for our runner.

And here is a basic Dockerfile as reference.
```
#
# Dockerfile
#

FROM node:alpine
WORKDIR /usr/app
RUN apk update && apk add libstdc++ && apk add build-base && apk add python3 && apk add bash && apk add git
COPY package.json .
COPY package-lock.json .
COPY src/app/public public
RUN npm ci
COPY . .
RUN npm run clean
RUN npm run build

CMD ["npm", "run", "prod"]
```