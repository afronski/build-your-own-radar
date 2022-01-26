/* eslint no-constant-condition: "off" */

const d3 = require('d3')
const Papa = require('papaparse')
const _ = {
  map: require('lodash/map'),
  uniqBy: require('lodash/uniqBy'),
  capitalize: require('lodash/capitalize'),
  each: require('lodash/each')
}

const InputSanitizer = require('./inputSanitizer')
const Radar = require('../models/radar')
const Quadrant = require('../models/quadrant')
const Ring = require('../models/ring')
const Blip = require('../models/blip')
const GraphingRadar = require('../graphing/radar')
const QueryParams = require('./queryParamProcessor')
const MalformedDataError = require('../exceptions/malformedDataError')
const SheetNotFoundError = require('../exceptions/sheetNotFoundError')
const ContentValidator = require('./contentValidator')
const Sheet = require('./sheet')
const ExceptionMessages = require('./exceptionMessages')
const GoogleAuth = require('./googleAuth')

const chooseRingOrder = function (ringName) {
  switch(ringName.toLowerCase()) {
    case "adopt": return 0;
    case "trial": return 1;
    case "assess": return 2;
    case "hold": return 3;

    default: throw new Error("Unknown ring name: " + ringName);
  }
}

const plotRadar = function (title, blips, currentRadarName, alternativeRadars) {
  if (title.endsWith('.csv')) {
    title = title.substring(0, title.length - 4)
  }
  document.title = 'TechRadar by Wojciech Gawroński :: BIG DATA, DATA ANALYTICS AND AI TECHNOLOGY RADAR VOL. 1'
  d3.selectAll('.loading').remove()

  var rings = _.map(_.uniqBy(blips, 'ring'), 'ring')
  var ringMap = []
  var maxRings = 4

  _.each(rings, function (ringName, i) {
    if (i === maxRings) {
      throw new MalformedDataError(ExceptionMessages.TOO_MANY_RINGS)
    }

    if (ringName.toLowerCase() == "adopt") {
      ringMap[0] = new Ring(ringName, 0)
    }

    if (ringName.toLowerCase() == "trial") {
      ringMap[1] = new Ring(ringName, 1)
    }

    if (ringName.toLowerCase() == "assess") {
      ringMap[2] = new Ring(ringName, 2)
    }

    if (ringName.toLowerCase() == "hold") {
      ringMap[3] = new Ring(ringName, 3)
    }
  })

  var quadrants = {}
  _.each(blips, function (blip) {
    if (!quadrants[blip.quadrant]) {
      quadrants[blip.quadrant] = new Quadrant(_.capitalize(blip.quadrant))
    }
    quadrants[blip.quadrant].add(new Blip(blip.name, ringMap[chooseRingOrder(blip.ring)], blip.isNew.toLowerCase() === 'true', blip.topic, blip.description))
  })

  var radar = new Radar()
  _.each(quadrants, function (quadrant) {
    radar.addQuadrant(quadrant)
  })

  if (alternativeRadars !== undefined || true) {
    alternativeRadars.forEach(function (sheetName) {
      radar.addAlternative(sheetName)
    })
  }

  if (currentRadarName !== undefined || true) {
    radar.setCurrentSheet(currentRadarName)
  }

  var size = (window.innerHeight - 133) < 620 ? 620 : window.innerHeight - 133

  new GraphingRadar(size, radar).init().plot()
}

const FileName = function (url) {
  var search = /([^\\/]+)$/
  var match = search.exec(decodeURIComponent(url.replace(/\+/g, ' ')))

  if (match != null) {
    var str = match[1]
    return str
  }

  return url
}

const CSVDocument = function (url) {
  var self = {}

  self.build = function () {
    d3.csv(url).then(createBlips)
  }

  var createBlips = function (data) {
    try {
      var columnNames = data.columns
      delete data.columns
      var contentValidator = new ContentValidator(columnNames)
      contentValidator.verifyContent()
      contentValidator.verifyHeaders()
      var blips = _.map(data, new InputSanitizer().sanitize)
      plotRadar(FileName(url), blips, 'CSV File', [])
    } catch (exception) {
      plotErrorMessage(exception)
    }
  }

  self.init = function () {
    plotLoading()
    return self
  }

  return self
}

const GoogleSheetInput = function () {
  var self = {}
  var sheet

  self.build = function () {
    sheet = CSVDocument('https://docs.google.com/spreadsheets/d/e/2PACX-1vTqU8RFjAy3Rv0swunvZ6fgSgm_c6fNd-XKngTTe0D-r23tMyxi1C5dINTw07dmdSOJuDC5-HJ3Pn0E/pub?output=csv')

    sheet.init().build()
  }

  return self
}

function setDocumentTitle () {
  document.title = 'TechRadar by Wojciech Gawroński :: BIG DATA, DATA ANALYTICS AND AI TECHNOLOGY RADAR VOL. 1'
}

function plotLoading (content) {
  content = d3.select('body')
    .append('div')
    .attr('class', 'loading')
    .append('div')
    .attr('class', 'input-sheet')

  setDocumentTitle()
}

function plotErrorMessage (exception) {
  var message = 'Oops! It seems like there are some problems with loading your data. '

  var content = d3.select('body')
    .append('div')
    .attr('class', 'input-sheet')
  setDocumentTitle()

  d3.selectAll('.loading').remove()
  message = "Oops! We can't find the Google Sheet you've entered"
  
	if (exception instanceof MalformedDataError) {
    message = message.concat(exception.message)
  } else if (exception instanceof SheetNotFoundError) {
    message = exception.message
  } else {
    console.error(exception)
  }

  const container = content.append('div').attr('class', 'error-container')
  var errorContainer = container.append('div')
    .attr('class', 'error-container__message')
  errorContainer.append('div').append('p')
    .html(message)

  var homePageURL = window.location.protocol + '//' + window.location.hostname
  homePageURL += (window.location.port === '' ? '' : ':' + window.location.port)
  var homePage = '<a href=' + homePageURL + '>GO BACK</a>'

  errorContainer.append('div').append('p')
    .html(homePage)
}

module.exports = GoogleSheetInput
