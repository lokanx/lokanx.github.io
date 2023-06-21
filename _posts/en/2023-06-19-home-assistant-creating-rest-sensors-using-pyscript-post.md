---
title: "Creating REST based sensors for Home Assistant using the custom pyscript integration"
date: 2023-06-19T17:30:00+0200
last_modified_at: 2023-06-19T17:30:00+02:00
layout: single
lang: en
categories:
   - "home-assistant"
tags:
   - rest
   - "home-assistant"
   - pyscript
   - python
toc: false
author_profile: true
classes: wide
---

Have you felt that the [RESTful Sensor](https://www.home-assistant.io/integrations/sensor.rest/) in [Home Assistant](https://www.home-assistant.io) is somewhat limited. Is the REST API behind some kind of login flow you need to complete to be able to do calls, or you want to combine data from several REST calls into one sensor. You could always create your own (custom) integration, but it is a bit cumbersome.

There is an custom integration available via [HACS](https://hacs.xyz) called [pyscript](https://github.com/custom-components/pyscript) which lets you more easily and straight forward create sensorns and mutch more.

To get pyscript going in your Home Assistant installation complete the following steps.

1. First install [HACS](https://hacs.xyz/) if you have not done it yet.
2. Find the [pyscript](https://github.com/custom-components/pyscript) integration within HACS and install it.
3. Enable the pyscript integration by adding
   ```yaml
   pyscript:
   allow_all_imports: true
   hass_is_global: true
   ```
4. Create a directory called pyscript in the root of your home assistant configuration directory
   ```
   cd /path/to/home-assisant/config
   mkdir pyscript
   ```
5. Restart Home Assistant to enable the pyscript integration.
6. Create a file for you rest sensor in <ha-config-dir>/pyscrupt/my-rest-sensor.py
7. Get a descent python capable editor, such as Visual Studio Code (optional)

There are many ways to configure pyscript, but with the snippet above it will pick up all python files in the newly created pyscript directory. Every time a file change the integration will automatically pick up the changes. Keep an eye of the home-assistant.log file for errors while coding.

Here is full example of sensor that polls for data from the [Swedish Krisinformations API Version 3](https://api.krisinformation.se/v3/) API. The sensor is compatbile with the [krisinfo-card](https://github.com/isabellaalstrom/krisinfo-card) card but uses the latest version of the API compared to the original custom integration.

The code snippet defines one service method to manual update the sensor data and one sceduled updater that triggers every 30'th minute. As you could see it's quite straight forward creating sensors or service methods compared to build a full blown integration. Pyscript lets you focus on the logic.

```python
import requests
from math import radians, sin, cos, acos

URL = "https://api.krisinformation.se/v3/news?days={days}&counties={counties}"
RADIUS = "50"
SLAT = f'{hass.config.latitude}'
SLON = f'{hass.config.longitude}'
DAYS = 7
COUNTY_GOTHENBURG = 14

def getUrl(days, counties):
    return URL.format(days=days, counties=counties)


def fetchData(url):
    log.info(f"Fetching data from: {url}")
    response = task.executor(requests.get, url)
    if response.status_code != 200:
        log.error(f"Failure: {response.status_code}")
        return None

    return response.json()

def make_object(attributes, index, element):
    message = {}
    message['Area'] = []

    distance = None
    within_range = False
    is_in_county = False
    is_in_country = False

    for count, area in enumerate(element['Area']):
        message['Area'].append({ "Type" : area['Type'], "Description" : area['Description'], "Coordinate" : area['Coordinate']})

        if area['Type'] == 'Country':
            is_in_country = True

        if area['Type'] == 'County':
            is_in_county = True

        distance = calculate_distance(coords = area['Coordinate'])
        if float(distance) < float(RADIUS):
            within_range = True

    if within_range or is_in_county or is_in_country:
        message['ID'] = element['Identifier']
        message['Message'] = element['PushMessage']
        message['Updated'] = element['Updated']
        message['Published'] = element['Published']
        message['Headline'] = element['Headline']
        message['Preamble'] = element['Preamble']
        message['BodyText'] = element['BodyText']
        message['Web'] = element['Web']
        message['Language'] = element['Language']
        message['Event'] = element['Event']
        message['SenderName'] = element['SenderName']
        message['Links'] = []
        if element['BodyLinks'] is not None:
            for numbers, link in enumerate(element['BodyLinks']):
                message['Links'].append(link['Url'])
        message['SourceID'] = element['SourceID']

        attributes["messages"].append(message)

        if element['Event'] == "Alert":
            attributes["alert_count"] += 1
        else:
            attributes["news_count"] += 1
        attributes["total_count"] += 1
    else:
        attributes["filtered_count"] += 1


def calculate_distance(coords):
    coords = coords.split()
    coords = coords[0].split(',')
    elon = coords[0]
    elat = coords[1]

    #Convert coordinates to radians
    elat2 = radians(float(elat))
    slat2 = radians(float(SLAT))
    elon2 = radians(float(elon))
    slon2 = radians(float(SLON))

    #Calculate the distance between them
    dist = 6371.01 * acos(sin(slat2)*sin(elat2) + cos(slat2)*cos(elat2)*cos(slon2 - elon2))

    return dist


def parseData(json_data):
    attributes = {}
    attributes["messages"] = []
    attributes["news_count"] = 0
    attributes["alert_count"] = 0
    attributes["total_count"] = 0
    attributes["filtered_count"] = 0
    attributes["display_state"] = "No new messages"
    attributes["display_icon"] = "mdi:check-circle-outline"
    attributes["attribution"] = "krisinformation.se"

    for index, element in enumerate(json_data):
        attributes["filtered_count"] =+ 1
        make_object(attributes = attributes, index = index, element = element)

        if (attributes["news_count"]>0):
            attributes["display_state"] = f"{attributes['news_count']} News Messages"
            attributes["display_icon"] = "mdi:alert-circle-outline"

        if (attributes["alert_count"]>0):
            attributes["display_state"] = f"{attributes['alert_count']} Alert Messages"
            attributes["display_icon"] = "mdi:alert-circle"

    return attributes


def updateSensor(url, sensor_name, friendly_name):
    log.debug(f"Fetching data from: {url}")
    json_data = fetchData(url)
    if json_data == None:
        state.set(sensor_name, 0)
        return

    log.debug(f"Got: {json_data}")
    current_state = 0
    if sensor_name in state.names('sensor'):
        current_state = state.get(sensor_name)
    else:
        state.set(sensor_name, 0)

    attributes = parseData(json_data)
    attributes['friendly_name'] = friendly_name

    new_state = f"{attributes['total_count']}"

    if current_state == new_state:
        log.debug(f'State unchanged for: {sensor_name}')
        return

    log.info(f'Updating state: {sensor_name}')
    state.set(sensor_name, new_state, attributes)


@time_trigger("cron(*/30 * * * *)")
def krisinformation_gbg():
    url = getUrl(DAYS, COUNTY_GOTHENBURG)
    updateSensor(url, 'sensor.krisinformation_goteborg', 'Krisinformation Göteborg')


@service
def krisinformation_testing():
    krisinformation_gbg()
```

Good luck and happy pyscript hacking! :smiley:
