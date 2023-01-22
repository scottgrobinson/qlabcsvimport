const { Console } = require("console");
const fs = require("fs"),
  path = require("path"),
  cliProgress = require("cli-progress"),
  qlabCue = require("./qlab/cue.js");
const { exit } = require("process");

var qlabworkspaceid = "";
var progresBarActive = false;
var warnings = [];
var appleScript = [];

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
 * @param {string} cueID The ID of the scene to use (can be null so the ID is auto generated)
 */
async function createLightCueFromScene(groupKey, sceneName, start, cueID) {
  if (!("lightstring" in lightCues[sceneName])) {
    lightCues[sceneName]["lightstring"] = await qlabCue.getLightString(lightCues[sceneName]["number"]);
    if (!lightCues[sceneName]["lightstring"]) {
      showErrorAndExit(`Light string blank for ${sceneName}`);
    }
  }

  let newcue = await qlabCue.create("light");
  appleScript.push(`make type "Light"`)
  appleScript.push(`set newLightCue to last item of(selected as list)`)
  appleScript.push(`set newLightCueID to uniqueID of newLightCue`)

  if (cueID) {
    await qlabCue.setNumber("selected", cueID);
    appleScript.push(`set q number of parentGroupCue to "${cueID}"`)
  }
  await qlabCue.setName("selected", sceneName);
  appleScript.push(`set q name of newLightCue to "${sceneName}"`)

  await qlabCue.setLightString("selected", lightCues[sceneName]["lightstring"]);
  appleScript.push(`set command text of newLightCue to "${lightCues[sceneName]["lightstring"]}"`)
  await qlabCue.setDuration("selected", "00.000");
  appleScript.push(`set duration of newLightCue to "00.000"`)
  await qlabCue.setPreWait("selected", await start);
  appleScript.push(`set pre wait of newLightCue to "${start}"`)
  await qlabCue.move(newcue, groupKey);
  appleScript.push(`move cue id newLightCueID of parent of newLightCue to end of newGroupCue`)
}

/**
 * XX
 * @param {string} groupKey The key of the group to move the network cue into
 * @param {string} commandPatch XX
 * @param {string} cueName XX
 * @param {string} command XX
 * @param {string} start The start time of the cue (sss.mmm)
 * @param {string} cueID XX
 */
async function createOSCCueFromString(groupKey, commandPatch, cueLabel, command, start, cueID) {
  let newcue = await qlabCue.create("network");
  if (cueID) {
    await qlabCue.setNumber("selected", cueID);
  }
  await qlabCue.setName("selected", cueLabel);
  await qlabCue.setNetworkString("selected", command);
  await qlabCue.setNetworkPatch("selected", parseInt(commandPatch));
  await qlabCue.setDuration("selected", "00.000");
  await qlabCue.setPreWait("selected", start);
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
 * @param {string} cueID The ID of the chaser to use (can be null so the ID is auto generated)
 */
async function createCueFromChaser(groupKey, chaserName, start, duration, existingFixtures, chaseFixtureRemovalOnMatchingFixture, existingFixturesSceneName, cueID) {
  const parentChaseGroupKey = await createGroup(chaserName + " CONTAINER");
  appleScript.push(`make type "Group"`)
  appleScript.push(`set chaserContainerGroupCue to last item of(selected as list)`)
  appleScript.push(`set chaserContainerGroupCueID to uniqueID of chaserContainerGroupCue`)
  appleScript.push(`set q name of chaserContainerGroupCue to "${chaserName} CONTAINER"`)
  appleScript.push(`set mode of chaserContainerGroupCue to cue_list`)

  await qlabCue.setPreWait("selected", start);
  appleScript.push(`set pre wait of chaserContainerGroupCue to "${start}"`)

  if (cueID) {
    await qlabCue.setNumber("selected", cueID);
    appleScript.push(`set q number of chaserContainerGroupCue to "${cueID}"`)
  }

  const chasegroupKey = await createGroup(chaserName);
  appleScript.push(`make type "Group"`)
  appleScript.push(`set chaserGroupCue to last item of(selected as list)`)
  appleScript.push(`set chaserGroupCueID to uniqueID of chaserGroupCue`)
  appleScript.push(`set q name of chaserGroupCue to "${chaserName}"`)
  appleScript.push(`set mode of chaserGroupCue to fire_first_enter_group`)
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
      appleScript.push(`make type "Light"`)
      appleScript.push(`set lightCue to last item of(selected as list)`)
      appleScript.push(`set lightCueID to uniqueID of lightCue`)
      if (chasestate == 0) {
        firstcueid = newcue;
      }

      await qlabCue.setName("selected", statedata["name"]);
      appleScript.push(`set q name of lightCue to "${statedata["name"]}"`)
      await qlabCue.setLightString("selected", listOfFixturesToStringOfFixtures(fixtureList));
      appleScript.push(`set command text of lightCue to "${listOfFixturesToStringOfFixtures(fixtureList)}"`)
      await qlabCue.setDuration("selected", statedata["duration"]);
      appleScript.push(`set duration of lightCue to "${statedata["duration"]}"`)
      await qlabCue.setContinueMode("selected", 2);
      appleScript.push(`set continue mode of lightCue to auto_continue`)
      await qlabCue.move(newcue, chasegroupKey);
      appleScript.push(`move cue id lightCueID of parent of lightCue to end of chaserGroupCue`)
      lastfixturename = statedata["name"];
      lastfixtureindex = chasestate;
    } else if (statedata["type"] == "Wait") {
      let newcue = await qlabCue.create("wait");
      appleScript.push(`make type "Light"`)

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
    // If we have blank lines, sometimes caused by using the "text" view when editing lights, ignore the blank line
    if (!splitLightString[light]) {
      continue
    }
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
    const cuename = incomingData[row][0];
    const start = parseFloat(processTimestamp(incomingData[row][1])).toFixed(2);
    const duration = parseFloat(processTimestamp(incomingData[row][2])).toFixed(2);
    const end = (parseFloat(start) + parseFloat(duration)).toFixed(2);
    if (typeof newData[newData.length - 1] !== "undefined" && newData[newData.length - 1][1] == start && newData[newData.length - 1][2] == duration) {
      newData[newData.length - 1][0].push(cuename);
    } else {
      newData.push([[cuename], start, duration, end]);
    }
  }

  newData3 = [];
  for (item in newData) {
    let foundChildren = false;
    parentitem = newData[item];
    parentitemno = item;
    for (item in newData) {
      if (parseFloat(newData[item][1]) >= parseFloat(parentitem[1]) && parseFloat(newData[item][3]) < parseFloat(parentitem[3])) {
        // Create list of cuenames
        nameList = [];
        for (cuename in parentitem[0]) {
          if (!nameList.includes(parentitem[0][cuename])) {
            nameList.push(parentitem[0][cuename]);
          }
        }
        for (cuename in newData[item][0]) {
          if (!nameList.includes(newData[item][0][cuename])) {
            nameList.push(newData[item][0][cuename]);
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
          if (["Scenes", "Chases"].includes(lightParentCueList["listName"])) {
            if (lightChildCueList["listName"] in lightCues) {
              errors.push(`"${lightChildCueList["listName"]}" exists more than once. Please ensure all light cues are individually named.`);
              continue;
            }

            lightCues[lightChildCueList["listName"]] = {};
            if (lightParentCueList["listName"] == "Scenes") {
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
 * @param {boolean} csvType Wether the CSV is a "song" CSV (from an Audition export), or a "show" CSV
 * @param {string} destinationCueList The cue list where new cues will be created
 * @param {string} replaceIfAlreadyExists Replace the destination cue list if it already exists (If a cue number is included in the filename)
*/
async function processCSVData(fileName, csvData, chaseFixtureRemovalOnMatchingFixture, csvType, destinationCueList, replaceIfAlreadyExists) {
  warnings = [];
  appleScript.push(`tell application id "com.figure53.qlab.4" to tell front workspace`)

  if (csvType == "song") {
    combinedCues = combineCuesByStartAndDuration(csvData);
  } else if (csvType == "show") {
    combinedCues = {}
    for (cue in csvData) {
      if (csvData[cue][0] in combinedCues) {
        combinedCues[csvData[cue][0]].push(csvData[cue][1])
      } else {
        combinedCues[csvData[cue][0]] = [csvData[cue][1]]
      }
    }
  }

  // Find the destination cue list and exit if doesn't exist
  destinationcuelistid = false;
  for (list of masterCueLists) {
    if (list["listName"] == destinationCueList) {
      destinationcuelistid = list["uniqueID"];
      await qlabCue.selectById(destinationcuelistid)
      appleScript.push(`set current cue list to first cue list whose q name is "${destinationCueList}"`)
      break;
    }
  }
  if (!destinationcuelistid) {
    showErrorAndExit(`Unable to find destination cue list "${destinationCueList}"`);
  }

  // Essentially select the last item in the cue list
  await qlabCue.selectByNumber("9999999999");

  regexMatch = fileName.match(/\[(.*)\].*/)

  // If the cue already exists, and replaceIfAlreadyExists is set, delete the existing cue first
  if (regexMatch) {
    existingCUEId = await qlabCue.getCueID(regexMatch[1])
    if (existingCUEId && replaceIfAlreadyExists) {
      console.log(`\x1b[33mCue '${regexMatch[1]}' already exists and replaceIfAlreadyExists is true - Replacing the existing cue \x1b[0m\n`);
      await qlabCue.deleteCueID(regexMatch[1])
    } else if (existingCUEId) {
      console.log(`\x1b[33mCue '${regexMatch[1]}' already exists but replaceIfAlreadyExists is false - Not replacing the existing cue \x1b[0m\n`);
    }
  }

  // Create 'master' group for this audio timeline
  const groupKey = await createGroup(path.basename(fileName, path.extname(fileName)));
  appleScript.push(`make type "Group"`)
  appleScript.push(`set newGroupCue to last item of(selected as list)`)
  appleScript.push(`set q name of newGroupCue to "${path.basename(fileName, path.extname(fileName))}"`)

  // If filename matches [XX]XX then use values inside [] as the cue ID
  if (regexMatch) {
    await qlabCue.setNumber("selected", regexMatch[1])
    appleScript.push(`set q number of newGroupCue to "${path.basename(fileName, path.extname(fileName))}"`)
  }

  const progressBar = new cliProgress.SingleBar(
    {
      format: "{bar} {value} of {total} ({percentage}%)",
    },
    cliProgress.Presets.shades_classic
  );
  progresBarActive = true;

  if (csvType == "song") {
    progressBar.start(combinedCues.length);
  } else if (csvType == "show") {
    progressBar.start(Object.keys(combinedCues).length);
  }

  let loopCounter = 1
  for (cue in combinedCues) {
    progressBar.update(loopCounter);
    if (csvType == "song") {
      // Group cues by start time and duration
      cueid = null;
      cuelist = combinedCues[cue][0];
      start = combinedCues[cue][1];
      duration = combinedCues[cue][2];
    } else if (csvType == "show") {
      cueid = cue;
      cuelist = combinedCues[cue];
      start = "00.00"
      duration = "00.00"
    }

    // If there is only one light in the cue, we don't need to get fancy...
    // Otherwise, we'll get fancy and combine them!
    if (cuelist.length == 1) {
      if (cuelist[0].startsWith("OSC -")) {
        oscvars = cuelist[0].split("___")
        commanddestination = oscvars[0].replace('OSC - ', '')
        cuelabel = oscvars[1]
        command = oscvars[2]
        await createOSCCueFromString(groupKey, commanddestination, cuelabel, command, start, cueid);
      } else if (lightCues[cuelist[0]]["type"] == "Scenes") {
        await createLightCueFromScene(groupKey, cuelist[0], start, cueid);
      } else if (lightCues[cuelist[0]]["type"] == "Chases") {
        await createCueFromChaser(groupKey, cuelist[0], start, duration, null, false, null, cueid);
      }
    } else {
      // Determine if we've got multiple cues of the same type, or mixed (I.E Scenes, Chasers or Scenes & Chasers)
      let type = "";
      for (cue in cuelist) {
        if (cue == 0) {
          if (cuelist[cue].startsWith("OSC -")) {
            type = "OSC"
          } else {
            type = lightCues[cuelist[cue]]["type"];
          }
        } else {
          if (cuelist[cue].startsWith("OSC -")) {
            cuetype = "OSC"
          } else {
            cuetype = lightCues[cuelist[cue]]["type"]
          }
          if (cuetype != type) {
            type = "Mixed";
            break;
          }
        }
      }

      formattedCueNames = []
      for (cue in cuelist) {
        if (cuelist[cue].startsWith("OSC -")) {
          formattedCueNames.push(cuelist[cue].split("___")[1])
        } else {
          formattedCueNames.push(cuelist[cue])
        }
      }
      cueName = formattedCueNames.join(" + ");

      if (type == "Scenes") {
        // Create a scene with all of the lights combined
        let newcue = await qlabCue.create("light");
        await qlabCue.setName("selected", cueName);

        if (cueid) {
          await qlabCue.setNumber("selected", cueid);
        }

        await qlabCue.setLightString("selected", listOfFixturesToStringOfFixtures(await combineSceneFixtures(cuelist)));
        await qlabCue.setDuration("selected", "00.000");
        await qlabCue.setPreWait("selected", start);
        await qlabCue.move(newcue, groupKey);
      } else if (type == "Chases") {
        // Create a group containing all of the chasers
        parent = await createGroup(cueName);

        if (cuelist.length > 0) {
          warnings.push(`More than two chases (${cuelist.join(", ")}) are combined in a group (start ${start} / duration ${duration}). You will need to manually check no fixtures overlap.`);
        }

        for (lfx in cuelist) {
          await createCueFromChaser(parent, cuelist[lfx], start, duration, null, false, null, cueid);
        }
        await qlabCue.move(parent, groupKey);
      } else if (type == "Mixed" || type == "OSC") {
        // Create a group containing the scenes & chasers
        parent = await createGroup(cueName);

        if (cueid) {
          await qlabCue.setNumber("selected", cueid);
        }

        OSCList = [];
        sceneList = [];
        chaseList = [];
        for (cue in cuelist) {
          if (cuelist[cue].startsWith("OSC -")) {
            OSCList.push(cuelist[cue]);
          } else if (lightCues[cuelist[cue]]["type"] == "Scenes") {
            sceneList.push(cuelist[cue]);
          } else if (lightCues[cuelist[cue]]["type"] == "Chases") {
            chaseList.push(cuelist[cue]);
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
          await createCueFromChaser(parent, chaseList[chase], start, duration, lightsInScene, chaseFixtureRemovalOnMatchingFixture, sceneName, null);
        }

        for (cue in OSCList) {
          oscvars = OSCList[cue].split("___")
          commanddestination = oscvars[0].replace('OSC - ', '')
          cuelabel = oscvars[1]
          command = oscvars[2]
          await createOSCCueFromString(parent, commanddestination, cuelabel, command, start, null);
        }

        await qlabCue.move(parent, groupKey);
      }
    }
    loopCounter = loopCounter + 1
  }
  progressBar.stop();
  progresBarActive = false;

  appleScript.push(`end tell`)
  //for (line in appleScript) {
  //  console.log(appleScript[line])
  //}
  return warnings
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
module.exports.createLightCueFromScene = createLightCueFromScene;
module.exports.createOSCCueFromString = createOSCCueFromString;
module.exports.createCueFromChaser = createCueFromChaser;
module.exports.stringOfFixturesToListOfFixtures = stringOfFixturesToListOfFixtures;
module.exports.combineSceneFixtures = combineSceneFixtures;
module.exports.combineCuesByStartAndDuration = combineCuesByStartAndDuration;
module.exports.generateInternalLightCueList = generateInternalLightCueList;
module.exports.processCSVData = processCSVData;
module.exports.showErrorAndExit = showErrorAndExit;

exports.qlabworkspaceid = qlabworkspaceid;
exports.progresBarActive = progresBarActive;
