---
layout: archive
title: "Webbplatskarta"
permalink: /sitemap/
author_profile: true
classes: wide
lang: sv
---
En lista på all inlägg och sidor som hittades. För en robotar ute där så finns också en [XML version]({{ "sitemap.xml" | relative_url }}) tillgänglig att tugga i sig.

<h2>Sidor</h2>
{% for post in site.pages %}
  {% unless post.sitemap == false or post.label == "" or post.title == nil %}
    {% include archive-single.html %}
  {% endunless %}
{% endfor %}

<h2>Inlägg</h2>
{% for post in site.posts %}
  {% include archive-single.html %}
{% endfor %}

{% capture written_label %}'None'{% endcapture %}

{% for collection in site.collections %}
{% unless collection.output == false or collection.label == "posts" %}
{% capture label %}{{ collection.label }}{% endcapture %}
{% if label != written_label %}

  <h2>{{ label }}</h2>
  {% capture written_label %}{{ label }}{% endcapture %}
  {% endif %}
{% endunless %}
{% for post in collection.docs %}
  {% unless collection.output == false or collection.label == "posts" %}
  {% include archive-single.html %}
  {% endunless %}
{% endfor %}
{% endfor %}
