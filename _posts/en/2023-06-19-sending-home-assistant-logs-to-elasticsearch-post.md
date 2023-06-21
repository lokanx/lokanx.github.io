---
title: "Sending Home Assistant logs to Elasticsearch (ELK)"
date: 2023-06-19T18:25:00+0200
last_modified_at: 2023-06-19T18:25:00+02:00
layout: single
lang: en
categories:
   - "home-assistant"
tags:
   - "home-assistant"
   - ELK
   - elasticsearch
   - kibana
   - logstash
toc: false
author_profile: true
classes: wide
---

Do you want a better overview of you [Home Assiatant](https://www.home-assistant.io) logs? Do you want the home assistant logs to be searchable over time? Then you can export then to [Elasticsearch and use Kibana](https://www.elastic.co/elastic-stack) for query the log data.

1. First you need to have an installed ELK stack (Elasticsearch, Logstash and Kibana). I went for an installation using docker with help of [docker-elk](https://github.com/deviantony/docker-elk) github project.

2. Second you have to install [Home Assiatant](https://www.home-assistant.io) [Logspout add-on](https://github.com/bertbaron/hassio-addons).

3. Configure the logspout add-on

   ```yaml
   routes:
      - multiline+logstash+tcp://mykibana.example.com:50000
   env:
      - name: SYSLOG_HOSTNAME
        value: homeassistant
      - name: INACTIVITY_TIMEOUT
        value: 1m
      - name: MULTILINE_PATTERN
        value: >-
           (\d\d(\d\d)?[-/]\d\d[-/]\d\d[T
           ]\d\d:\d\d:\d\d)|(^s6-rc:)|(^\[\d\d:\d\d:\d\d\])|(\d\d:\d\d:\d\d\
           -)|(^[TDIWEF]:)
      - name: MULTILINE_MATCH
        value: first
      - name: INCLUDE_CONTAINERS
        value: homeassistant
      - name: LOGSTASH_FIELDS
        value: source=my-home-assistant
   ```

   Note that default all docker container logs in HAOS is sent to logstash for insertion into elasticsearch.

4. Configure logstash to parse the log data that comes in.
   My logstash.conf file looks like this:

   ```config

   input {
      beats {
         port => 5044
      }

      tcp {
         port => 50000
         codec => json
      }

      udp {
         port  => 5000
         codec => json
      }
   }

   ## Add your filters / logstash plugins configuration here
   filter {
         if ([source] == "my-home-assistant") {
            if ([docker][name] == "/homeassistant") {
               grok {
                  patterns_dir => ["/usr/share/logstash/pipeline/patterns"]
                  match => { "message" => "%{LOGLEVEL:log_level}%{SPACE}\(%{GREEDYDATA:log_thread}\)%{SPACE}\[%{LOGGER_NAME:log_name}\]%{SPACE}%{GREEDYDATA:log_message}" }
               }
               mutate {
         gsub => [ "log_message", "\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[m|M|K]", "" ]
               }
               if [log_message] =~ /\n/ {
                  mutate {
                     copy => { "log_message" => "log_trace" }
                  }
                  mutate {
                     gsub => [ "log_message", "(?m)^([^\n]*)$.*", "\1" ]
                  }

               }
            } else {
               drop { }
            }
         }
   }

   output {
      elasticsearch {
         hosts => "elasticsearch:9200"
         user => "logstash_internal"
         password => "${LOGSTASH_INTERNAL_PASSWORD}"
      }
   }
   ```

   and my custom patterns file looks like this:

   ```config
   LOGGER_NAME [a-zA-Z0-9._-]+
   UNICODE_START [\\u]
   ```

All incomming data tagged with _my-home-assistant_ will be processed by the filter. It will also drop all data that comes from other than the HAOS home assistant docker container.

If you want to properly process data from other docker containers in the HAOS install, you will have to write more [grok](https://www.elastic.co/guide/en/logstash/current/plugins-filters-grok.html) patterns.
