var tileUrl = 'https://api.mapbox.com/styles/v1/nypllabs/ciqs7ai4a0000cwm4663mv4x7/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoibnlwbGxhYnMiLCJhIjoiSFVmbFM0YyJ9.sl0CRaO71he1XMf_362FZQ'

var center = [41.91, -73.85]
var zoom = 9

var hoverDisabled = false

// var hudsonStyle = {
//   color: '#FF8100',
//   weight: 0,
//   opacity: 0.7,
//   fillOpacity: .9
// }

var hudsonStyle = {
  color: '#FF8100',
  weight: 2,
  opacity: 1,
  fillOpacity: 0
}


var outlineStyle = {
  color: '#39484c',
  weight: 3,
  opacity: 0.7,
  fillOpacity: 0
}

var mapStyle = {
  color: '#39484c',
  fillColor: 'white',
  weight: 3,
  opacity: 1,
  fillOpacity: 0.4
}

var map = L.map('map', {
  scrollWheelZoom: false,
  touchZoom: false,
  minZoom: zoom,
  maxZoom: zoom + 3
}).setView(center, zoom)

L.tileLayer(tileUrl, {
  opacity: 0.5
}).addTo(map)

var mapLayer = L.geoJson([], {
  style: mapStyle
}).addTo(map)

var groupedLayer
var mapwarperLayer

d3.json('data/hudson.geojson', function (err, geojson) {
  L.geoJson(geojson, {
    style: hudsonStyle
  }).addTo(map)
})

d3.json('data/grouped.geojson', function (err, geojson) {
  groupedLayer = L.tileLayer(tileUrl, {
    opacity: 0.3
  }).addTo(map)

  enableHover()

  L.geoJson(geojson, {
    style: outlineStyle
  }).addTo(map)

  mapwarperLayer = L.tileLayer('', {
  }).addTo(map)
})

var tree
var maps

d3.json('data/all.geojson', function (err, geojson) {
  maps = geojson.features

  tree = rbush(maps.length)

  tree.load(
    maps.map(function(map, i) {
      return {
        minX: map.properties.boundingbox[0],
        minY: map.properties.boundingbox[1],
        maxX: map.properties.boundingbox[2],
        maxY: map.properties.boundingbox[3],
        index: i
      }
    })
  )
})

function urnToMapId (urn) {
  return urn.replace('urn:hgid:mapwarper/', '')
}

function disableHover (event) {
  mapLayer.off('click', disableHover)
  map.on('click', enableHover)
  groupedLayer.on('click', enableHover)
  hoverDisabled = true
}

function enableHover (event) {
  map.off('click', enableHover)
  groupedLayer.off('click', enableHover)
  mapLayer.on('click', disableHover)
  hoverDisabled = false
}

function findMaps (latlng, callback) {
  if (!tree || !tree.search) {
    callback([])
    return
  }

  var results = tree.search({
    minX: latlng.lng,
    minY: latlng.lat,
    maxX: latlng.lng,
    maxY: latlng.lat
  })

  mapLayer.clearLayers()

  var hoveredMaps = []
  if (results.length) {
    hoveredMaps = results
      .map(function (result) {
        return maps[result.index]
      })
    .filter(function (feature) {
      const point = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [
            latlng.lng,
            latlng.lat
          ]
        }
      }
      return turf.inside(point, feature)
    })

    if (hoveredMaps.length) {
      mapLayer.addData(hoveredMaps)
      callback(hoveredMaps)
    } else {
      callback([])
    }
  } else {
    callback([])
  }
}

function fillList (selector, hoveredMaps) {
  var mapList = d3.select(selector).selectAll('li')
    .data(hoveredMaps, function (d) {
      return d.properties.id
    })

  var mapListItem = mapList.enter().append('li')

  var title = mapListItem.append('h2')

  title.append('span')
    .attr('class', 'map-title')
    .attr('title', function (d) {
      return d.properties.name
    })
    .html(function (d) {
      return d.properties.name
    })

  title.append('span')
    .attr('class', 'map-year')
    .html(function (d) {
      var year = d.properties.validsince || d.properties.validuntil
      if (year) {
        return '(' + year + ')'
      }
    })

  mapListItem.append('img')
    .attr('alt', function (d) {
      return d.properties.name
    })
    .attr('src', function (d) {
      return 'http://images.nypl.org/index.php?id=' + d.properties.digital_id + '&t=w'
    })

  var buttons = mapListItem.append('div')
    .attr('class', 'buttons')

  buttons.append('a')
    .attr('href', 'javascript:void(0)')
    .text('View on map')
    .on('click', function(d) {
      var tileUrl = 'http://maps.nypl.org/warper/maps/tile/' + urnToMapId(d.properties.id) + '/{z}/{x}/{y}.png'
      mapwarperLayer.setUrl(tileUrl)
    })


  buttons.append('a')
    .attr('target', '_blank')
    .attr('href', function (d) {
      return 'http://maps.nypl.org/warper/maps/' + urnToMapId(d.properties.id)
    })
    .text('Map Warper')

  buttons.append('a')
    .attr('target', '_blank')
    .attr('href', function (d) {
      return d.properties.url
    })
    .text('Digital Collections')

  mapList.exit().remove()
}

function throttle(fn, threshhold, scope) {
  threshhold || (threshhold = 250);
  var last,
      deferTimer;
  return function () {
    var context = scope || this;

    var now = +new Date,
        args = arguments;
    if (last && now < last + threshhold) {
      // hold on to it
      clearTimeout(deferTimer);
      deferTimer = setTimeout(function () {
        last = now;
        fn.apply(context, args);
      }, threshhold);
    } else {
      last = now;
      fn.apply(context, args);
    }
  };
}

map.on('mousemove', throttle(mapMouseMove, 50))

function mapMouseMove (event) {
  if (hoverDisabled) {
    return
  }

  findMaps(event.latlng, function (hoveredMaps) {
    fillList('#left ul', hoveredMaps.filter(function (d, i) {
      return i % 2 === 0
    }))

    fillList('#right ul', hoveredMaps.filter(function (d, i) {
      return i % 2 === 1
    }))
  })
}

// document.onkeydown = function(e) {
//   e = e || window.event
//   if (e.keyCode == 27) {
//   }
// }
