const fs = require("fs"),
  path = require("path"),
  cliProgress = require("cli-progress"),
  qlabCue = require("./qlab/cue.js");

var qlabworkspaceid = "";
var progresBarActive = false;
var warnings = [];

/**
 * Converts timestamps to seconds.microsends
 * @param {string} timestamp Timestamp in format M:ss.mmm
 * @returns {string} Timestamp in format sss.mmm
 */
function processTimestamp(timestamp) {
  if (timestamp.split(":")[0] == 0) {
    seconds = timestamp.split(":")[1].split(".")[0];
  } else {
    seconds = parseInt(timestamp.split(":")[0] * 60) + parseInt(timestamp.split(":")[1].split(".")[0]);
  }

  microseconds = timestamp.split(":")[1].split(".")[1].padEnd(3, 0);
  return seconds.toString() + "." + microseconds;
}

/**
 * Converts a string of fixtures and there values from a light cue, to a list of fixtures and there values
 * @param {string} fixtureString The list of fixtures from a light cue as a string
 * @returns {array} The list of fixtures from a light cue as a list
 */
function stringOfFixturesToListOfFixtures(fixtureString) {
  fixtureList = {};

  if (fixtureString) {
    const splitFixtureString = fixtureString.split("\n");
    for (fixture in splitFixtureString) {
      if (splitFixtureString[fixture] != "") {
        fixtureSetting = splitFixtureString[fixture].split("=")[0].trim();
        fixtureValue = parseInt(splitFixtureString[fixture].split("=")[1].trim());
        fixtureList[fixtureSetting] = fixtureValue;
      }
    }
  }

  return fixtureList;
}

/**
 * Converts a list of fixtures and there values from a light cue, to a string of fixtures and there values
 * @param {array} fixtureList The list of fixtures from a light cue as a list
 * @returns {string} The list of fixtures from a light cue as a string
 */
function listOfFixturesToStringOfFixtures(fixtureList) {
  let fixturesInListAsString = "";

  for (fixture in fixtureList) {
    fixturesInListAsString = fixturesInListAsString + fixture + " = " + fixtureList[fixture].toString() + "\n";
  }

  return fixturesInListAsString;
}

/**
 * Combines fixtures from multiple scenes into one fixture list. Where duplicate fixtures exist, the higher value will be used.
 * @param {array} sceneList The list of scenes to pull fixtures from
 * @returns {array} The list of combined fixtures from the supplied scenes
 */
async function combineSceneFixtures(sceneList) {
  fixturesInScene = [];

  for (scene in sceneList) {
    sceneName = sceneList[scene];
    if (!("lightstring" in lightCues[sceneName])) {
      lightCues[sceneName]["lightstring"] = await qlabCue.getLightString(lightCues[sceneName]["number"]);
      if (!lightCues[sceneName]["lightstring"]) {
        showErrorAndExit(`Light string blank for ${sceneName}`);
      }
    }

    let fixtures = stringOfFixturesToListOfFixtures(lightCues[sceneName]["lightstring"]);
    for (fixture in fixtures) {
      fixtureValue = fixtures[fixture];

      if (!(fixture in fixturesInScene)) {
        fixturesInScene[fixture] = fixtureValue;
      } else {
        if (fixtureValue >= fixturesInScene[fixture]) {
          fixturesInScene[fixture] = fixtureValue;
        } else {
          warnings.push(`Dropping fixture ${fixture} from ${sceneList[scene]} as ${fixtureValue} < ${fixturesInScene[fixture]} (Combined scenes ${sceneList.join(", ")})`);
        }
      }
    }
  }

  return fixturesInScene;
}

/**
 * Creates & selects a qLab group cue
 * @param {string} groupKey The group key
 * @returns The key of the created group cue
 */
async function createGroup(groupKey) {
  groupKeyCue = await qlabCue.create("group");
  await qlabCue.setName("selected", groupKey);
  await qlabCue.setMode("selected", 3);

  return groupKeyCue;
}

/**
 * Creates a cue in an existing group from a scene
 * @param {string} groupKey The key of the group to move the scene into
 * @param {string} sceneName The name of the scene to use
 * @param {string} start The start time of the cue (sss.mmm)
 */
async function createCueFromScene(groupKey, sceneName, start) {
  if (!("lightstring" in lightCues[sceneName])) {
    lightCues[sceneName]["lightstring"] = await qlabCue.getLightString(lightCues[sceneName]["number"]);
    if (!lightCues[sceneName]["lightstring"]) {
      showErrorAndExit(`Light string blank for ${sceneName}`);
    }
  }

  let newcue = await qlabCue.create("light");
  await qlabCue.setName("selected", sceneName);
  await qlabCue.setLightString("selected", lightCues[sceneName]["lightstring"]);
  await qlabCue.setDuration("selected", "00.000");
  await qlabCue.setPreWait("selected", await start);
  await qlabCue.move(newcue, groupKey);
}

/**
 * Creates a cue in an existing group from a chaser
 * @param {string} groupKey The key of the group to move the chaser into
 * @param {string} chaserName The name of the chaser to use
 * @param {string} start The start time of the cue (sss.mmm)
 * @param {string} duration The duration of the cue (sss.mmm)
 * @param {array} existingFixtures List of existing fixtures in use when added to a group with scenes
 * @param {boolean} chaseFixtureRemovalOnMatchingFixture Remove fixtures from a chase if combined in a group with a scene that has a fixture contained within the chase
 * @param {string} existingFixturesSceneName The name of the scene where existingFixtures are taken from
 */
async function createCueFromChaser(groupKey, chaserName, start, duration, existingFixtures, chaseFixtureRemovalOnMatchingFixture, existingFixturesSceneName) {
  const parentChaseGroupKey = await createGroup(chaserName + " CONTAINER");
  await qlabCue.setPreWait("selected", await start);

  const chasegroupKey = await createGroup(chaserName);
  await qlabCue.setMode("selected", 1);

  for (chasestate in lightCues[chaserName]["chasestates"]) {
    statedata = lightCues[chaserName]["chasestates"][chasestate];
    if (statedata["type"] == "Light") {
      if (!("lightstring" in lightCues[chaserName]["chasestates"][chasestate])) {
        lightCues[chaserName]["chasestates"][chasestate]["lightstring"] = await qlabCue.getLightString(lightCues[chaserName]["chasestates"][chasestate]["number"]);
        if (!lightCues[chaserName]["chasestates"][chasestate]["lightstring"]) {
          showErrorAndExit(`Light string blank for ${lightCues[chaserName]["chasestates"][chasestate]["name"]}`);
        }
      }

      fixtureList = stringOfFixturesToListOfFixtures(lightCues[chaserName]["chasestates"][chasestate]["lightstring"]);
      if (existingFixtures) {
        for (fixture in fixtureList) {
          if (fixture in existingFixtures) {
            if (chaseFixtureRemovalOnMatchingFixture) {
              delete fixtureList[fixture];
              warnings.push(`Chase "${statedata["name"]}" (start ${start} / duration ${duration}) fixture ${fixture} was removed as it would have overridden the scene ${existingFixturesSceneName}`);
            } else {
              warnings.push(`Chase "${statedata["name"]}" (start ${start} / duration ${duration}) fixture ${fixture} will override the scene ${existingFixturesSceneName}`);
            }
          }
        }
      }

      let newcue = await qlabCue.create("light");
      if (chasestate == 0) {
        firstcueid = newcue;
      }

      await qlabCue.setName("selected", statedata["name"]);
      await qlabCue.setLightString("selected", listOfFixturesToStringOfFixtures(fixtureList));
      await qlabCue.setDuration("selected", statedata["duration"]);
      await qlabCue.setContinueMode("selected", 2);
      await qlabCue.move(newcue, chasegroupKey);
      lastfixturename = statedata["name"];
      lastfixtureindex = chasestate;
    } else if (statedata["type"] == "Wait") {
      let newcue = await qlabCue.create("wait");
      await qlabCue.setDuration("selected", await qlabCue.getDuration(lightCues[chaserName]["chasestates"][chasestate]["number"]));
      await qlabCue.setContinueMode("selected", 2);
      await qlabCue.move(newcue, chasegroupKey);
    }
  }

  loopgroup = await qlabCue.create("group");
  await qlabCue.setName("selected", "Loop Group/Reset");
  await qlabCue.setMode("selected", 2);

  startcue = await qlabCue.create("start");
  await qlabCue.setName("selected", "Loop");
  await qlabCue.setTargetID("selected", firstcueid);
  await qlabCue.setContinueMode("selected", 2);
  await qlabCue.move(startcue, loopgroup);

  fixturesettingstouse = lightCues[chaserName]["chasestates"][lastfixtureindex]["lightstring"];
  const splitLightString = fixturesettingstouse.split("\n");
  fixturesInScene = [];
  for (light in splitLightString) {
    fixtureSetting = splitLightString[light].split("=")[0].trim();
    fixtureValue = parseInt(splitLightString[light].split("=")[1].trim());
    if (!(fixtureSetting in fixturesInScene)) {
      fixturesInScene[fixtureSetting] = fixtureValue;
    } else {
      if (fixtureValue >= fixturesInScene[fixtureSetting]) {
        fixturesInScene[fixtureSetting] = fixtureValue;
      }
    }
  }

  resetFixtures = [];
  for (fixture in fixturesInScene) {
    if (fixturesInScene[fixture] != 0) {
      resetFixtures[fixture] = 0;
    }
  }

  lightcue = await qlabCue.create("light");
  await qlabCue.setDuration("selected", "00.00");
  await qlabCue.setLightString("selected", listOfFixturesToStringOfFixtures(resetFixtures));
  await qlabCue.setName("selected", `Reset ${lastfixturename} `);
  await qlabCue.move(lightcue, loopgroup);

  await qlabCue.move(loopgroup, chasegroupKey);

  const durationGroupKey = await createGroup("CHASE DURATION CONTAINER");
  await qlabCue.setMode("selected", 1);
  let waitcue = await qlabCue.create("wait");
  let calculatedDuration = await duration;
  await qlabCue.setName("selected", `Wait ${calculatedDuration} Seconds`);
  await qlabCue.setDuration("selected", calculatedDuration);
  await qlabCue.setContinueMode("selected", 2);
  await qlabCue.move(waitcue, durationGroupKey);
  let stopcue = await qlabCue.create("stop");
  await qlabCue.setName("selected", "Stop Chase");
  await qlabCue.setTargetID("selected", chasegroupKey);
  await qlabCue.move(stopcue, durationGroupKey);

  await qlabCue.move(chasegroupKey, parentChaseGroupKey);
  await qlabCue.move(durationGroupKey, parentChaseGroupKey);

  await qlabCue.move(parentChaseGroupKey, groupKey);
}

/**
 * Combine cues where the start time and duration match
 * @param {array} incomingData
 * @returns {array}
 */
function combineCuesByStartAndDuration(incomingData) {
  const newData = [];
  for (row in incomingData) {
    const lfxname = incomingData[row][0];
    const start = parseFloat(processTimestamp(incomingData[row][1])).toFixed(2);
    const duration = parseFloat(processTimestamp(incomingData[row][2])).toFixed(2);
    const end = (parseFloat(start) + parseFloat(duration)).toFixed(2);
    if (typeof newData[newData.length - 1] !== "undefined" && newData[newData.length - 1][1] == start && newData[newData.length - 1][2] == duration) {
      newData[newData.length - 1][0].push(lfxname);
    } else {
      newData.push([[lfxname], start, duration, end]);
    }
  }

  newData3 = [];
  for (item in newData) {
    let foundChildren = false;
    parentitem = newData[item];
    parentitemno = item;
    for (item in newData) {
      if (parseFloat(newData[item][1]) >= parseFloat(parentitem[1]) && parseFloat(newData[item][3]) < parseFloat(parentitem[3])) {
        // Create list of lfxnames
        nameList = [];
        for (lfxname in parentitem[0]) {
          if (!nameList.includes(parentitem[0][lfxname])) {
            nameList.push(parentitem[0][lfxname]);
          }
        }
        for (lfxname in newData[item][0]) {
          if (!nameList.includes(newData[item][0][lfxname])) {
            nameList.push(newData[item][0][lfxname]);
          }
        }
        newData3.push([nameList, newData[item][1], newData[item][2], newData[item][3]]);
        foundChildren = true;
        newData[item]["used"] = true;
      }
    }
    if (foundChildren != true) {
      newData3.push(parentitem);
    }
  }

  outgoingData = [];
  for (item in newData3) {
    if (!newData3[item]["used"]) {
      outgoingData.push(newData3[item]);
    }
  }

  return outgoingData;
}

/**
 * Generate an internal "cache" of Scenes & Chasers from qLab
 * @param {array} masterCueLists Array of all cues from qLab
 * @param {string} lightcuelistcachefile Path to file where the cache is saved
 * @returns {array} Array of scenes & chasers
 */
async function generateInternalLightCueList(masterCueLists, lightcuelistcachefile) {
  lightCues = {};
  var errors = [];

  const cuelistGenerationStart = new Date();
  for (masterCueList of masterCueLists) {
    if (masterCueList["listName"] == "Light Cues") {
      for (lightParentCueList of masterCueList["cues"]) {
        for (lightChildCueList of lightParentCueList["cues"]) {
          if (["Scenes (Inc. All Off)", "Chases"].includes(lightParentCueList["listName"])) {
            if (lightChildCueList["listName"] in lightCues) {
              errors.push(`"${lightChildCueList["listName"]}" exists more than once. Please ensure all light cues are individually named.`);
              continue;
            }

            lightCues[lightChildCueList["listName"]] = {};
            if (lightParentCueList["listName"] == "Scenes (Inc. All Off)") {
              lightCues[lightChildCueList["listName"]]["type"] = "Scenes";
            } else if (lightParentCueList["listName"] == "Chases") {
              lightCues[lightChildCueList["listName"]]["type"] = "Chases";
            }
            lightCues[lightChildCueList["listName"]]["id"] = lightChildCueList["uniqueID"];
            lightCues[lightChildCueList["listName"]]["number"] = lightChildCueList["number"];

            if (lightChildCueList["number"] == '') {
              errors.push(`"${lightChildCueList["listName"]}" has no number. Please ensure all light cues have a number.`);
              continue;
            }

            if (lightParentCueList["listName"] == "Chases") {
              lightCues[lightChildCueList["listName"]]["chasestates"] = [];
              for (chaseCue of lightChildCueList["cues"]) {
                // We'll make the Loop Group/Reset ourself rather than try and copy it
                if (chaseCue["name"] != "Loop" && chaseCue["name"] != "Loop Group/Reset") {

                  if (chaseCue["number"] == '') {
                    errors.push(`"${chaseCue["name"]}" has no number. Please ensure all light cues have a number.`);
                    continue;
                  }

                  stateData = {
                    name: chaseCue["name"],
                    id: chaseCue["uniqueID"],
                    number: chaseCue["number"],
                    type: chaseCue["type"],
                    duration: await qlabCue.getDuration(chaseCue["number"]),
                  };
                  lightCues[lightChildCueList["listName"]]["chasestates"].push(stateData);
                }
              }
            }
          }
        }
      }
      break;
    }
  }

  if (errors.length > 0) {
    for (error in errors) {
      console.log(`\x1b[31m[Error] - ${errors[error]}\x1b[0m`);
    }
    console.log("\n\x1b[31mExiting...\x1b[0m")
    process.exit(1)
  } else {
    fs.writeFileSync(lightcuelistcachefile, JSON.stringify(lightCues));

    const cuelistGenerationEnd = new Date();
    console.log(`Finished generating light cue list - Took ${(cuelistGenerationEnd - cuelistGenerationStart) / 1000} seconds\n`);

    return lightCues;
  }

}

/**
 * Processes the data from the CSV file
 * TODO: Break this down futher to make it more readable
 * @param {string} fileName The filename of the CSV used to determine the group title
 * @param {array} csvData Array of data from CSV file
 * @param {boolean} chaseFixtureRemovalOnMatchingFixture Remove fixtures from a chase if combined in a group with a scene that has a fixture contained within the chase
 */
async function processCSVData(fileName, csvData, chaseFixtureRemovalOnMatchingFixture) {
  // Group cues by start time and duration
  let combinedCues = combineCuesByStartAndDuration(csvData);

  // Find the temporary "dump" cue list and exit if doesn't exist
  dumpcuelistid = false;
  for (list of masterCueLists) {
    if (list["listName"] == "Script Dump - DO NOT USE") {
      dumpcuelistid = list["uniqueID"];
      break;
    }
  }
  if (!dumpcuelistid) {
    showErrorAndExit("Unable to temporary dump cue list 'Script Dump - DO NOT USE'");
  }

  // Essentially select the last item in the cue list
  await qlabCue.selectByNumber("9999999999");
  // Create 'master' group for this audio timeline
  const groupKey = await createGroup(path.basename(fileName, path.extname(fileName)));
  const progressBar = new cliProgress.SingleBar(
    {
      format: "{bar} {value} of {total} ({percentage}%)",
    },
    cliProgress.Presets.shades_classic
  );
  progresBarActive = true;
  progressBar.start(combinedCues.length);
  for (cue in combinedCues) {
    progressBar.update(parseInt(cue) + 1 / 2);
    const lfxlist = combinedCues[cue][0];
    const start = combinedCues[cue][1];
    const duration = combinedCues[cue][2];

    // If there is only one light in the cue, we don't need to get fancy...
    // Otherwise, we'll get fancy and combine them!
    if (lfxlist.length == 1) {
      if (lightCues[lfxlist[0]]["type"] == "Scenes") {
        await createCueFromScene(groupKey, lfxlist[0], start);
      } else if (lightCues[lfxlist[0]]["type"] == "Chases") {
        await createCueFromChaser(groupKey, lfxlist[0], start, duration, null, false, null);
      }
    } else {
      // Determine if we've got multiple cues of the same type, or mixed (I.E Scenes, Chasers or Scenes & Chasers)
      let type = "";
      for (lfx in lfxlist) {
        if (lfx == 0) {
          type = lightCues[lfxlist[lfx]]["type"];
        } else {
          if (lightCues[lfxlist[lfx]]["type"] != type) {
            type = "Mixed";
            break;
          }
        }
      }

      cueName = lfxlist.join(" + ");
      if (type == "Scenes") {
        // Create a scene with all of the lights combined
        let newcue = await qlabCue.create("light");
        await qlabCue.setName("selected", cueName);
        await qlabCue.setLightString("selected", listOfFixturesToStringOfFixtures(await combineSceneFixtures(lfxlist)));
        await qlabCue.setDuration("selected", "00.000");
        await qlabCue.setPreWait("selected", start);
        await qlabCue.move(newcue, groupKey);
      } else if (type == "Chases") {
        // Create a group containing all of the chasers
        parent = await createGroup(cueName);

        if (lfxlist.length > 0) {
          warnings.push(`More than two chases (${lfxlist.join(", ")}) are combined in a group (start ${start} / duration ${duration}). You will need to manually check no fixtures overlap.`);
        }

        for (lfx in lfxlist) {
          await createCueFromChaser(parent, lfxlist[lfx], start, duration, null, false, null);
        }
        await qlabCue.move(parent, groupKey);
      } else if (type == "Mixed") {
        // Create a group containing the scenes & chasers
        parent = await createGroup(cueName);

        sceneList = [];
        chaseList = [];
        for (lfx in lfxlist) {
          if (lightCues[lfxlist[lfx]]["type"] == "Scenes") {
            sceneList.push(lfxlist[lfx]);
          } else if (lightCues[lfxlist[lfx]]["type"] == "Chases") {
            chaseList.push(lfxlist[lfx]);
          }
        }

        let lightsInScene = await combineSceneFixtures(sceneList);
        let newcue = await qlabCue.create("light");
        let sceneName = sceneList.join(" + ");
        await qlabCue.setName("selected", sceneName);
        await qlabCue.setLightString("selected", listOfFixturesToStringOfFixtures(lightsInScene));
        await qlabCue.setDuration("selected", "00.000");
        await qlabCue.setPreWait("selected", start);
        await qlabCue.move(newcue, parent);

        if (chaseList.length > 1) {
          warnings.push(`More than two chases (${chaseList.join(", ")}) are combined in a group (start ${start} / duration ${duration}). You will need to manually check no fixtures overlap.`);
        }

        for (chase in chaseList) {
          await createCueFromChaser(parent, chaseList[chase], start, duration, lightsInScene, chaseFixtureRemovalOnMatchingFixture, sceneName);
        }

        await qlabCue.move(parent, groupKey);
      }
    }
    progressBar.update(parseInt(cue) + 1);
  }
  progressBar.stop();
  progresBarActive = false;

  if (warnings.length > 0) {
    console.log("\n");
    for (warning in warnings) {
      console.log(`\x1b[33m[Warning] - ${warnings[warning]}\x1b[0m`);
    }
  }
}

/**
 * Displays error message in red then exits
 * @param {string} message Message to display
 */
function showErrorAndExit(message) {
  if (progresBarActive) {
    console.log(`\n\x1b[31m[Error] ${message}. Exiting...\x1b[0m`);
  } else {
    console.log(`\x1b[31m[Error] ${message}. Exiting...\x1b[0m`);
  }
  process.exit(1);
}

module.exports.processTimestamp = processTimestamp;
module.exports.listOfFixturesToStringOfFixtures = listOfFixturesToStringOfFixtures;
module.exports.createGroup = createGroup;
module.exports.createCueFromScene = createCueFromScene;
module.exports.createCueFromChaser = createCueFromChaser;
module.exports.stringOfFixturesToListOfFixtures = stringOfFixturesToListOfFixtures;
module.exports.combineSceneFixtures = combineSceneFixtures;
module.exports.combineCuesByStartAndDuration = combineCuesByStartAndDuration;
module.exports.generateInternalLightCueList = generateInternalLightCueList;
module.exports.processCSVData = processCSVData;
module.exports.showErrorAndExit = showErrorAndExit;

exports.qlabworkspaceid = qlabworkspaceid;
exports.progresBarActive = progresBarActive;
