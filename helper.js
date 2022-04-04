const fs = require('fs');

const qlabCue = require('./qlab/methods/cue.js');
const qlabLightCue = require('./qlab/methods/light.js');

var qlabworkspaceid = '';

/**
 * Converts timestamps to seconds.microsends
 * @param {string} timestamp Timestamp in format M:ss.mmm
 * @returns {string} Timestamp in format sss.mmm
 */
function processTimestamp(timestamp) {
  if (timestamp.split(':')[0] == 0) {
    seconds = timestamp.split(':')[1].split('.')[0]
  } else {
    seconds = parseInt((timestamp.split(':')[0] * 60)) + parseInt(timestamp.split(':')[1].split('.')[0])
  }

  microseconds = timestamp.split(':')[1].split('.')[1].padEnd(3, 0)
  return seconds.toString() + '.' + microseconds
}

/**
 * Converts a list of fixtures and there values from a light cue, to a list of fixtures and there values
 * @param {string} fixtureString The list of fixtures from a light cue as a string
 * @returns {array} The list of fixtures from a light cue as a list
 */
function stringOfFixturesToListOfFixtures(fixtureString) {
  fixtureList = {}

  if (fixtureString) {
    const splitFixtureString = fixtureString.split("\n")
    for (fixture in splitFixtureString) {
      if (splitFixtureString[fixture] != '') {
        fixturesetting = splitFixtureString[fixture].split("=")[0].trim()
        fixturevalue = parseInt(splitFixtureString[fixture].split("=")[1].trim())
        fixtureList[fixturesetting] = fixturevalue
      }
    }
  }

  return fixtureList
}

function lightListToStringOfLights(lfxlist) {
  let lightsInSceneAsString = ''

  for (light in lfxlist) {
    lightsInSceneAsString = lightsInSceneAsString + light + " = " + lfxlist[light].toString() + "\n"
  }

  return lightsInSceneAsString
}

async function combineScenes(lfxlist) {
  fixturesInScene = []

  for (lfx in lfxlist) {
    lfxname = lfxlist[lfx]
    if (!('lightstring' in lightCues[lfxname])) {
      lightCues[lfxname]['lightstring'] = await qlabLightCue.getLightString(lightCues[lfxname]['number'])
      if (!lightCues[lfxname]['lightstring']) {
        console.log(`  Error - Light string blank for ${lightCues[lfxname]}`)
        process.exit(1)
      }
    }

    let fixtures = stringOfFixturesToListOfFixtures(lightCues[lfxname]['lightstring'])
    for (fixture in fixtures) {
      fixturevalue = fixtures[fixture]

      if (!(fixture in fixturesInScene)) {
        fixturesInScene[fixture] = fixturevalue
      } else {
        if (fixturevalue >= fixturesInScene[fixture]) {
          fixturesInScene[fixture] = fixturevalue
        }
      }
    }
  }

  return fixturesInScene
}

async function createGroup(groupkey) {
  group_key_cue = await qlabCue.create('group')
  await qlabCue.setName('selected', `${groupkey} `);
  await qlabCue.setMode('selected', 3);

  return group_key_cue
}

async function createScene(groupkey, lfxname, start) {
  if (!('lightstring' in lightCues[lfxname])) {
    lightCues[lfxname]['lightstring'] = await qlabLightCue.getLightString(lightCues[lfxname]['number'])
    if (!lightCues[lfxname]['lightstring']) {
      console.log(`  Error - Light string blank for ${lightCues[lfxname]}`)
      process.exit(1)
    }
  }

  let newcue = await qlabCue.create('light')
  await qlabCue.setName('selected', lfxname)
  await qlabLightCue.setLightString('selected', lightCues[lfxname]['lightstring'])
  await qlabCue.setDuration('selected', '00.000')
  await qlabCue.setPreWait('selected', await start)
  await qlabCue.move(newcue, groupkey)
  return lightCues[lfxname]['lightstring']
}

async function createChaser(groupkey, lfxname, start, duration, existinglights) {
  const parentchasegroupkey = await createGroup(lfxname + ' CONTAINER')
  await qlabCue.setPreWait('selected', await start)

  const chasegroupkey = await createGroup(lfxname)
  await qlabCue.setMode('selected', 1)

  for (chasestate in lightCues[lfxname]['chasestates']) {
    statedata = lightCues[lfxname]['chasestates'][chasestate]
    if (statedata['type'] == "Light") {
      if (!('lightstring' in lightCues[lfxname]['chasestates'][chasestate])) {
        lightCues[lfxname]['chasestates'][chasestate]['lightstring'] = await qlabLightCue.getLightString(lightCues[lfxname]['chasestates'][chasestate]['number'])
        if (!lightCues[lfxname]['chasestates'][chasestate]['lightstring']) {
          console.log(`  Error - Light string blank for ${lightCues[lfxname]['chasestates'][chasestate]['name']}`)
          process.exit(1)
        }

        if (existinglights) {
          lightList = stringOfFixturesToListOfFixtures(lightCues[lfxname]['chasestates'][chasestate]['lightstring'])
          for (light in lightList) {
            if (light in existinglights) {
              console.log(`Warning - Chase "${statedata['name']}" (s${start} / d${duration}) light ${light} will override the parent scene`)
            }
          }
        }
      }

      let newcue = await qlabCue.create('light')
      if (chasestate == 0) {
        firstcueid = newcue
      }

      await qlabCue.setName('selected', statedata['name'])
      await qlabLightCue.setLightString('selected', lightCues[lfxname]['chasestates'][chasestate]['lightstring'])
      await qlabCue.setDuration('selected', statedata['duration'])
      await qlabCue.setContinueMode('selected', 2)
      await qlabCue.move(newcue, chasegroupkey)
      lastfixturename = statedata['name']
      lastfixtureindex = chasestate
    } else if (statedata['type'] == "Wait") {
      let newcue = await qlabCue.create('wait')
      await qlabCue.setDuration('selected', await qlabCue.getDuration(lightCues[lfxname]['chasestates'][chasestate]['number']))
      await qlabCue.setContinueMode('selected', 2)
      await qlabCue.move(newcue, chasegroupkey)
    }
  }

  // START LG
  loopgroup = await qlabCue.create('group')
  await qlabCue.setName('selected', 'Loop Group/Reset');
  await qlabCue.setMode('selected', 2);

  startcue = await qlabCue.create('start');
  await qlabCue.setName('selected', 'Loop');
  await qlabCue.setTargetID('selected', firstcueid);
  await qlabCue.setContinueMode('selected', 2)
  await qlabCue.move(startcue, loopgroup)

  fixturesettingstouse = lightCues[lfxname]['chasestates'][lastfixtureindex]['lightstring']
  const splitLightString = fixturesettingstouse.split("\n")
  lightsInScene = []
  for (light in splitLightString) {
    fixturesetting = splitLightString[light].split("=")[0].trim()
    fixturevalue = parseInt(splitLightString[light].split("=")[1].trim())
    if (!(fixturesetting in lightsInScene)) {
      lightsInScene[fixturesetting] = fixturevalue
    } else {
      if (fixturevalue >= lightsInScene[fixturesetting]) {
        lightsInScene[fixturesetting] = fixturevalue
      }
    }
  }

  resetLights = []
  for (light in lightsInScene) {
    if (lightsInScene[light] != 0) {
      resetLights[light] = 0
    }
  }

  lightsInSceneAsString = ''
  // convert back to string
  for (light in resetLights) {
    lightsInSceneAsString = lightsInSceneAsString + light + " = " + resetLights[light].toString() + "\n"
  }

  lightcue = await qlabCue.create('light')
  await qlabCue.setDuration('selected', '00.00')
  await qlabLightCue.setLightString('selected', lightsInSceneAsString)
  await qlabCue.setName('selected', `Reset ${lastfixturename} `);
  await qlabCue.move(lightcue, loopgroup)

  await qlabCue.move(loopgroup, chasegroupkey);
  // END LG

  const durationgroupkey = await createGroup('CHASE DURATION CONTAINER')
  await qlabCue.setMode('selected', 1)
  let waitcue = await qlabCue.create('wait')
  let calculatedduration = await duration;
  await qlabCue.setName('selected', `Wait ${calculatedduration} Seconds`)
  await qlabCue.setDuration('selected', calculatedduration)
  await qlabCue.setContinueMode('selected', 2)
  await qlabCue.move(waitcue, durationgroupkey)
  let stopcue = await qlabCue.create('stop')
  await qlabCue.setName('selected', 'Stop Chase')
  await qlabCue.setTargetID('selected', chasegroupkey)
  await qlabCue.move(stopcue, durationgroupkey)

  await qlabCue.move(chasegroupkey, parentchasegroupkey)
  await qlabCue.move(durationgroupkey, parentchasegroupkey)

  await qlabCue.move(parentchasegroupkey, groupkey)
}

function combineCuesByStartAndDuration(incomingData) {
  const newData = []
  for (row in incomingData) {
    const lfxname = incomingData[row][0];
    const start = parseFloat(processTimestamp(incomingData[row][1])).toFixed(2);
    const duration = parseFloat(processTimestamp(incomingData[row][2])).toFixed(2);
    const end = (parseFloat(start) + parseFloat(duration)).toFixed(2);
    if (typeof newData[newData.length - 1] !== 'undefined' && newData[newData.length - 1][1] == start && newData[newData.length - 1][2] == duration) {
      newData[newData.length - 1][0].push(lfxname)
    } else {
      newData.push([[lfxname], start, duration, end])
    }
  }

  newData3 = []
  for (item in newData) {
    let foundChildren = false
    parentitem = newData[item]
    parentitemno = item
    for (item in newData) {
      if (parseFloat(newData[item][1]) >= parseFloat(parentitem[1]) && parseFloat(newData[item][3]) < parseFloat(parentitem[3])) {
        // Create list of lfxnames
        nameList = []
        for (lfxname in parentitem[0]) {
          if (!(nameList.includes(parentitem[0][lfxname]))) {
            nameList.push(parentitem[0][lfxname])
          }
        }
        for (lfxname in newData[item][0]) {
          if (!(nameList.includes(newData[item][0][lfxname]))) {
            nameList.push(newData[item][0][lfxname])
          }
        }
        newData3.push([nameList, newData[item][1], newData[item][2], newData[item][3]])
        foundChildren = true
        newData[item]['used'] = true
      }
    }
    if (foundChildren != true) {
      newData3.push(parentitem)
    }
  }

  outgoingData = []
  for (item in newData3) {
    if (!(newData3[item]['used'])) {
      outgoingData.push(newData3[item]);
    }
  }

  return outgoingData
}

async function generateInternalLightCueList(masterCueLists, lightcuelistcachefile) {
  lightCues = {}

  const cuelistGenerationStart = new Date()
  for (masterCueList of masterCueLists) {
    if (masterCueList['listName'] == 'Light Cues') {
      for (lightParentCueList of masterCueList['cues']) {
        for (lightChildCueList of lightParentCueList['cues']) {
          if (['Scenes (Inc. All Off)', 'Chases'].includes(lightParentCueList['listName'])) {
            lightCues[lightChildCueList['listName']] = {}
            if (lightParentCueList['listName'] == 'Scenes (Inc. All Off)') {
              lightCues[lightChildCueList['listName']]['type'] = 'Scenes'
            } else if (lightParentCueList['listName'] == 'Chases') {
              lightCues[lightChildCueList['listName']]['type'] = 'Chases'
            }
            lightCues[lightChildCueList['listName']]['id'] = lightChildCueList['uniqueID']
            lightCues[lightChildCueList['listName']]['number'] = lightChildCueList['number']
            if (lightParentCueList['listName'] == "Chases") {
              lightCues[lightChildCueList['listName']]['chasestates'] = []
              for (chaseCue of lightChildCueList['cues']) {
                // We'll make the Loop Group/Reset ourself rather than try and copy it
                if (chaseCue['name'] != "Loop" && chaseCue['name'] != "Loop Group/Reset") {
                  stateData = {}
                  stateData['name'] = chaseCue['name']
                  stateData['id'] = chaseCue['uniqueID']
                  stateData['number'] = chaseCue['number']
                  stateData['type'] = chaseCue['type']
                  stateData['duration'] = await qlabCue.getDuration(chaseCue['number'])
                  lightCues[lightChildCueList['listName']]['chasestates'].push(stateData)
                }
              }
            }
          }
        }
      }
      break
    }
  }

  fs.writeFileSync(lightcuelistcachefile, JSON.stringify(lightCues))

  const cuelistGenerationEnd = new Date()
  console.log(`Finished generating light cue list - Took ${(cuelistGenerationEnd - cuelistGenerationStart) / 1000} seconds\n`)

  return lightCues
}

// Process the CSV row data
async function processCSVData(songname, csvData) {
  // Group cues by start time and duration
  let combinedCues = combineCuesByStartAndDuration(csvData)

  // Find the temporary "dump" cue list and exit if doesn't exist
  dumpcuelistid = false
  for (list of masterCueLists) {
    if (list['listName'] == 'Script Dump - DO NOT USE') {
      dumpcuelistid = list['uniqueID']
      break
    }
  }
  if (!dumpcuelistid) {
    console.log('Error - Unable to temporary dump cue list \'Script Dump - DO NOT USE\'')
    process.exit(1)
  }

  // Select the dump cue list so we are creating everything in the right place
  await qlabCue.select(dumpcuelistid)
  // Create 'master' group for this audio timeline
  const groupkey = await createGroup(songname)
  for (cue in combinedCues) {
    const lfxlist = combinedCues[cue][0];
    const start = combinedCues[cue][1];
    const duration = combinedCues[cue][2];

    // If there is only one light in the cue, we don't need to get fancy... 
    // Otherwise, we'll get fancy and combine them!
    if (lfxlist.length == 1) {
      if (lightCues[lfxlist[0]]['type'] == "Scenes") {
        await createScene(groupkey, lfxlist[0], start);
      } else if (lightCues[lfxlist[0]]['type'] == "Chases") {
        await createChaser(groupkey, lfxlist[0], start, duration, null);
      } else {
        console.log(`  Error - Light cue type '${lightCues[lfxlist[0]]['type']}' not supported.Not quite sure how we\'ve got here.... Oopsie!`)
      }
    } else {
      // Determine if we've got multiple cues of the same type, or mixed (I.E Scenes, Chasers or Scenes & Chasers)
      let type = '';
      for (lfx in lfxlist) {
        if (lfx == 0) {
          type = lightCues[lfxlist[lfx]]['type']
        } else {
          if (lightCues[lfxlist[lfx]]['type'] != type) {
            type = 'Mixed'
            break
          }
        }
      }

      name = lfxlist.join(' + ')
      if (type == "Scenes") {
        // Create a scene with all of the lights combined
        let newcue = await qlabCue.create('light')
        await qlabCue.setName('selected', name)
        await qlabLightCue.setLightString('selected', lightListToStringOfLights(await combineScenes(lfxlist)))
        await qlabCue.setDuration('selected', '00.000')
        await qlabCue.setPreWait('selected', start)
        await qlabCue.move(newcue, groupkey)
      } else if (type == "Chases") {
        // Create a group containing all of the chasers
        parent = await createGroup('COMBINE ME CHASES - ' + name)
        await qlabCue.setColor('selected', 'red')

        for (lfx in lfxlist) {
          await createChaser(parent, lfxlist[lfx], start, duration, null);
        }
        await qlabCue.move(parent, groupkey)
      } else if (type == "Mixed") {
        // Create a group containing the scenes & chasers
        parent = await createGroup('COMBINE ME MIXED - ' + name)
        await qlabCue.setColor('selected', 'red')

        sceneList = []
        chaseList = []
        for (lfx in lfxlist) {
          if (lightCues[lfxlist[lfx]]['type'] == "Scenes") {
            sceneList.push(lfxlist[lfx])
          } else if (lightCues[lfxlist[lfx]]['type'] == "Chases") {
            chaseList.push(lfxlist[lfx])
          }
        }

        let lightsInScene = await combineScenes(sceneList)
        let newcue = await qlabCue.create('light')
        await qlabCue.setName('selected', sceneList.join(' + '))
        await qlabLightCue.setLightString('selected', lightListToStringOfLights(lightsInScene))
        await qlabCue.setDuration('selected', '00.000')
        await qlabCue.setPreWait('selected', start)
        await qlabCue.move(newcue, parent)

        for (chase in chaseList) {
          await createChaser(parent, chaseList[chase], start, duration, lightsInScene);
        }

        await qlabCue.move(parent, groupkey)
      }
    }
  }
}

module.exports.processTimestamp = processTimestamp
module.exports.lightListToStringOfLights = lightListToStringOfLights
module.exports.createGroup = createGroup
module.exports.createScene = createScene
module.exports.createChaser = createChaser
module.exports.stringOfFixturesToListOfFixtures = stringOfFixturesToListOfFixtures
module.exports.combineScenes = combineScenes
module.exports.combineCuesByStartAndDuration = combineCuesByStartAndDuration
module.exports.generateInternalLightCueList = generateInternalLightCueList
module.exports.processCSVData = processCSVData

exports.qlabworkspaceid = qlabworkspaceid;