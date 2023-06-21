---
title: "Skapa en REST baserad sensor för Home Assistant med hjälp an pyscript integrationen"
date: 2023-06-19T17:30:00+0200
last_modified_at: 2023-06-19T17:30:00+02:00
layout: single
lang: sv
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

Har du känt att att [RESTful Sensorn](https://www.home-assistant.io/integrations/sensor.rest/) i [Home Assistant](https://www.home-assistant.io) inte räcker till. Är REST API bakom nån form av inloggningsflöde du behöver gå igenom innan du kan anropa API'et, eller du kanske vill kombinera data från flera REST anrop till en sensor. Du kan alltid skapa din egen kustomiserade integratiom, men det är rätt omstädnigt.

Det finns en integration tillgänglig via [HACS](https://hacs.xyz) som heter [pyscript](https://github.com/custom-components/pyscript) som låter dig enkelt skapa sensorer och mycket mer.

För att köra igång pyscript i din Home Assistant installation genom att följa instruktionen nedan:

1. Först installera [HACS](https://hacs.xyz/) om du inte redan gjort det.
2. Hitta [pyscript](https://github.com/custom-components/pyscript) integrationen i HACS och installera den.
3. Lägg till pyscript integration genom lägga till följande konfiguration
   ```yaml
   pyscript:
   allow_all_imports: true
   hass_is_global: true
   ```
4. SKapa en katalog som heter pyscript i rooten av din home assistant konfigurationskatalog
   ```
   cd /path/to/home-assisant/config
   mkdir pyscript
   ```
5. Starta om Home Assistant för att aktivera integrationen.
6. Skapa en fil för din REST sensor i <ha-config-dir>/pyscrupt/my-rest-sensor.py
7. Installera en riktig python kapabel editor, som Visual Studio Code (valfritt)

Det finns många sätt konfigurera pyscript, men med exmplet ovan så kommer pyscript hitta alla python filer i katalogen. Varje gång en fil ändras så kommer integration automatiskt ladda om filen. Håll ett öga på home-assistant.log filen efter fel medans du kodar.

Här är ett fullt exempel på en sensor som hämtar data från [Svenska Krisinformations API Version 3](https://api.krisinformation.se/v3/) API. Sensorn är kompatibel med [krisinfo-card](https://github.com/isabellaalstrom/krisinfo-card) kortet men använder senste versionen av API'et till skillnad från orginal integrationen.

Koden definierar en service metod för manuel uppdatering av sensor informationen samt en skedulerad uppdatering som pollar efter nytt data var 30e minut. Som man kan se så är det ganska enkelt skapa sensorer eller service metoder jämfört med skapa en fullständigt egen integration. Pyscript låter dig fokusera på logiken.

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

Lycka till och lycklig pyscript hackande ! :smiley:
