const fs = require("fs"),
  path = require("path"),
  cliProgress = require("cli-progress"),
  qlabCue = require("./qlab/cue.js");
const { Console, group } = require("console");
const { exit } = require("process");
const { channel } = require("diagnostics_channel");

var qlabworkspaceid = "";
var progresBarActive = false;
var warnings = [];

/**
 * Converts timestamps to seconds.microsends
 * @param {string} timestamp Timestamp in format M:ss.mmm
 * @returns {string} Timestamp in format sss.mmm
 */
function processTimestamp(timestamp) {
  // Split the time string into minutes, seconds, and milliseconds
  const [minutesPart, secondsPart] = timestamp.split(":");
  const seconds = secondsPart.split(".")[0];
  const milliseconds = secondsPart.split(".")[1] || "0";

  // Convert minutes, seconds, and milliseconds to integers
  const minutesInt = parseInt(minutesPart, 10);
  const secondsInt = parseInt(seconds, 10);
  const millisecondsInt = parseInt(milliseconds, 10);

  // Calculate total milliseconds
  const totalMilliseconds =
    minutesInt * 60 * 1000 + secondsInt * 1000 + millisecondsInt;

  return totalMilliseconds;
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
      if (
        splitFixtureString[fixture] != "" &&
        splitFixtureString[fixture].trim().length
      ) {
        fixtureSetting = splitFixtureString[fixture].split("=")[0].trim();
        fixtureValue = parseInt(
          splitFixtureString[fixture].split("=")[1].trim()
        );
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
    fixturesInListAsString =
      fixturesInListAsString +
      fixture +
      " = " +
      fixtureList[fixture].toString() +
      "\n";
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
      lightCues[sceneName]["lightstring"] = await qlabCue.getLightString(
        lightCues[sceneName]["number"]
      );
      if (!lightCues[sceneName]["lightstring"]) {
        showErrorAndExit(`Light string blank for ${sceneName}`);
      }
    }

    let fixtures = stringOfFixturesToListOfFixtures(
      lightCues[sceneName]["lightstring"]
    );
    for (fixture in fixtures) {
      fixtureValue = fixtures[fixture];

      if (!(fixture in fixturesInScene)) {
        fixturesInScene[fixture] = fixtureValue;
      } else {
        if (fixtureValue >= fixturesInScene[fixture]) {
          fixturesInScene[fixture] = fixtureValue;
        } else {
          warnings.push(
            `Dropping fixture ${fixture} from ${
              sceneList[scene]
            } as ${fixtureValue} < ${
              fixturesInScene[fixture]
            } (Combined scenes ${sceneList.join(", ")})`
          );
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
 * @param {string} duration The duration to fade in the scene (sss.mmm, defaults to 00.000)
 */
async function createLightCueFromScene(
  groupKey,
  sceneName,
  start,
  cueID,
  duration = "00.000"
) {
  if (!("lightstring" in lightCues[sceneName])) {
    lightCues[sceneName]["lightstring"] = await qlabCue.getLightString(
      lightCues[sceneName]["number"]
    );
    if (!lightCues[sceneName]["lightstring"]) {
      showErrorAndExit(`Light string blank for ${sceneName}`);
    }
  }

  let newcue = await qlabCue.create("light");
  if (cueID) {
    await qlabCue.setNumber("selected", cueID);
  }
  await qlabCue.setName("selected", sceneName);

  await qlabCue.setLightString("selected", lightCues[sceneName]["lightstring"]);
  await qlabCue.setDuration("selected", duration);
  await qlabCue.setPreWait("selected", await start);
  await qlabCue.move(newcue, groupKey);
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
async function createOSCCueFromString(
  groupKey,
  commandPatch,
  cueLabel,
  command,
  start,
  cueID
) {
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
 * @param {string} csvType The type of CSV being processed (i.e Song or Show)
 */
async function createCueFromChaser(
  groupKey,
  chaserName,
  start,
  duration,
  existingFixtures,
  chaseFixtureRemovalOnMatchingFixture,
  existingFixturesSceneName,
  cueID,
  csvType
) {
  const parentChaseGroupKey = await createGroup(chaserName + " CONTAINER");
  await qlabCue.collapse("selected");
  await qlabCue.setPreWait("selected", start);

  if (cueID) {
    await qlabCue.setNumber("selected", cueID);
  }

  const chasegroupKey = await createGroup(chaserName);
  await qlabCue.collapse("selected");
  await qlabCue.setMode("selected", 1);

  for (chasestate in lightCues[chaserName]["chasestates"]) {
    statedata = lightCues[chaserName]["chasestates"][chasestate];
    if (statedata["type"] == "Light") {
      if (
        !("lightstring" in lightCues[chaserName]["chasestates"][chasestate])
      ) {
        lightCues[chaserName]["chasestates"][chasestate]["lightstring"] =
          await qlabCue.getLightString(
            lightCues[chaserName]["chasestates"][chasestate]["number"]
          );
        if (!lightCues[chaserName]["chasestates"][chasestate]["lightstring"]) {
          showErrorAndExit(
            `Light string blank for ${lightCues[chaserName]["chasestates"][chasestate]["name"]}`
          );
        }
      }

      fixtureList = stringOfFixturesToListOfFixtures(
        lightCues[chaserName]["chasestates"][chasestate]["lightstring"]
      );
      if (existingFixtures) {
        for (fixture in fixtureList) {
          if (fixture in existingFixtures) {
            if (chaseFixtureRemovalOnMatchingFixture) {
              delete fixtureList[fixture];
              warnings.push(
                `Chase "${statedata["name"]}" (start ${start} / duration ${duration}) fixture ${fixture} was removed as it would have overridden the scene ${existingFixturesSceneName}`
              );
            } else {
              warnings.push(
                `Chase "${statedata["name"]}" (start ${start} / duration ${duration}) fixture ${fixture} will override the scene ${existingFixturesSceneName}`
              );
            }
          }
        }
      }

      let newcue = await qlabCue.create("light");
      if (chasestate == 0) {
        firstcueid = newcue;
      }

      await qlabCue.setName("selected", statedata["name"]);
      await qlabCue.setLightString(
        "selected",
        listOfFixturesToStringOfFixtures(fixtureList)
      );
      await qlabCue.setDuration("selected", statedata["duration"]);
      await qlabCue.setContinueMode("selected", 2);
      await qlabCue.move(newcue, chasegroupKey);
      lastfixturename = statedata["name"];
      lastfixtureindex = chasestate;
    } else if (statedata["type"] == "Wait") {
      let newcue = await qlabCue.create("wait");

      await qlabCue.setDuration(
        "selected",
        await qlabCue.getDuration(
          lightCues[chaserName]["chasestates"][chasestate]["number"]
        )
      );
      await qlabCue.setContinueMode("selected", 2);
      await qlabCue.move(newcue, chasegroupKey);
    }
  }

  loopgroup = await qlabCue.create("group");
  await qlabCue.collapse("selected");
  await qlabCue.setName("selected", "Loop Group/Reset");
  // If we're creating a show, we don't want Auto-Follow as we don't have the
  // CHASE DURATION CONTAINER that we need to "follow" into
  if (csvType != "show") {
    await qlabCue.setMode("selected", 2);
  }

  startcue = await qlabCue.create("start");
  await qlabCue.setName("selected", "Loop");
  await qlabCue.setTargetID("selected", firstcueid);
  await qlabCue.setContinueMode("selected", 2);
  await qlabCue.move(startcue, loopgroup);

  fixturesettingstouse =
    lightCues[chaserName]["chasestates"][lastfixtureindex]["lightstring"];
  const splitLightString = fixturesettingstouse.split("\n");
  fixturesInScene = [];
  for (light in splitLightString) {
    // If we have blank lines, sometimes caused by using the "text" view when editing lights, ignore the blank line
    if (!splitLightString[light] || !splitLightString[light].trim().length) {
      continue;
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

  let durationGroupKey;
  if (csvType != "show") {
    durationGroupKey = await createGroup("CHASE DURATION CONTAINER");
    await qlabCue.collapse("selected");
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
  }

  await qlabCue.move(chasegroupKey, parentChaseGroupKey);
  if (csvType != "show") {
    await qlabCue.move(durationGroupKey, parentChaseGroupKey);
  }

  await qlabCue.move(parentChaseGroupKey, groupKey);

  return parentChaseGroupKey;
}

/**
 * Extracts data from the CSVs and parses to relevant types
 * @param {array} csvData
 * @returns {array}
 */
function extractAndParseCsvData(csvData) {
  const parsedCsvData = [];

  for (row in csvData) {
    const cuename = csvData[row][0];
    const start = parseFloat(processTimestamp(csvData[row][1])) * 10;
    let duration;
    if (parseFloat(processTimestamp(csvData[row][2])) == 0) {
      duration = 0;
    } else {
      duration = parseFloat(processTimestamp(csvData[row][2])) * 10 - 1;
    }
    const end = parseFloat(start) + parseFloat(duration);
    parsedCsvData.push([[cuename], start, duration, end]);
  }

  return parsedCsvData;
}

/**
 * Combine cues where the start time and duration match
 * @param {array} parsedCsvData
 * @returns {array}
 */
function combineCuesByStartAndDuration(parsedCsvData) {
  combinedCuesByStartAndDuration = [];

  // Loop over every cue in the CSV data
  for (item in parsedCsvData) {
    cueNames = [];

    // Add the cue name to the "holding store"
    for (i in parsedCsvData[item][0]) {
      cueNames.push(parsedCsvData[item][0][i]);
    }

    // Loop over all preceding cues
    for (var i = parseInt(item) + 1; i < parsedCsvData.length; i++) {
      // If the next cue has a matching start & duration, add the cue name to the "holding store" and
      // remove it from parsedCsvData as we don't need to go over it again
      if (
        parsedCsvData[item][1] == parsedCsvData[i][1] &&
        parsedCsvData[item][2] == parsedCsvData[i][2]
      ) {
        for (x in parsedCsvData[i][0]) {
          cueNames.push(parsedCsvData[i][0][x]);
        }
        parsedCsvData.splice(i, 1);
        i--;
        // If it doesn't have a matching start & duration, no subequent cues will either so break out and move onto the next "start time"/next item
      } else {
        continue;
      }
    }

    // Create the combined cue with the list of names from the "holding store" and the time values from the first hit -
    // They'll be the same for everything in cueNames
    combinedCuesByStartAndDuration.push([
      cueNames,
      parsedCsvData[item][1],
      parsedCsvData[item][2],
      parsedCsvData[item][3],
    ]);
  }

  return combinedCuesByStartAndDuration;
}

/**
 * Creates the master cue list for onward processing by determining which cues should fire at which second and for how long
 * @param {array} combinedCuesByStartAndDuration
 * @returns {array}
 */
function createMasterCueList(combinedCuesByStartAndDuration) {
  var endTime =
    combinedCuesByStartAndDuration[
      combinedCuesByStartAndDuration.length - 1
    ][3];

  var cuesNamesByStartTime = [];
  // Loop over every ms (millisecond) from 1 to the final ms / endTime ms
  for (var i = 1; i < endTime + 1; i++) {
    cueNames = [];
    // Loop over every cue
    // Push cue names that should be active at this ms
    // (current loop ms is equal to or greater than the cue start time AND current loop ms is equal to or less than the cue end time)
    for (x in combinedCuesByStartAndDuration) {
      if (
        i >= combinedCuesByStartAndDuration[x][1] &&
        i <= combinedCuesByStartAndDuration[x][3]
      ) {
        cueNames.push(...combinedCuesByStartAndDuration[x][0]);
      }
    }

    // Insert into the dictionary if there are cue names to insert, and the cues aren't the same as the previous ms (I.E there is a change)
    if (
      cueNames.length !== 0 &&
      (cuesNamesByStartTime.length == 0 ||
        JSON.stringify(
          cuesNamesByStartTime[cuesNamesByStartTime.length - 1]["cueNames"]
        ) !== JSON.stringify(cueNames))
    ) {
      cuesNamesByStartTime.push({
        startTimeSeconds: (i / 10000).toFixed(3),
        cueNames: cueNames,
      });
    }
  }

  // Create new array in cueName, startTime, duration format
  masterList = [];
  for (x in cuesNamesByStartTime) {
    // TODO - Work out the duration properly so that something ending on a chase will work properly.
    if (parseInt(x) + 1 == cuesNamesByStartTime.length) {
      duration = cuesNamesByStartTime[x]["startTimeSeconds"];
    } else {
      duration = (
        cuesNamesByStartTime[parseInt(x) + 1]["startTimeSeconds"] -
        cuesNamesByStartTime[x]["startTimeSeconds"]
      ).toFixed(3);
    }
    if (duration != "0.00") {
      masterList.push([
        cuesNamesByStartTime[x]["cueNames"],
        cuesNamesByStartTime[x]["startTimeSeconds"],
        duration,
      ]);
    }
  }

  return masterList;
}

/**
 * Generate an internal "cache" of Scenes & Chasers from qLab
 * @param {array} masterCueLists Array of all cues from qLab
 * @param {string} lightcuelistcachefile Path to file where the cache is saved
 * @returns {array} Array of scenes & chasers
 */
async function generateInternalLightCueList(
  masterCueLists,
  lightcuelistcachefile
) {
  lightCues = {};
  var errors = [];

  const cuelistGenerationStart = new Date();
  for (masterCueList of masterCueLists) {
    if (masterCueList["listName"] == "Light Cues") {
      for (lightParentCueList of masterCueList["cues"]) {
        for (lightChildCueList of lightParentCueList["cues"]) {
          if (["Scenes", "Chases"].includes(lightParentCueList["listName"])) {
            if (lightChildCueList["listName"] in lightCues) {
              errors.push(
                `"${lightChildCueList["listName"]}" exists more than once. Please ensure all light cues are individually named.`
              );
              continue;
            }

            lightCues[lightChildCueList["listName"]] = {};
            if (lightParentCueList["listName"] == "Scenes") {
              lightCues[lightChildCueList["listName"]]["type"] = "Scenes";
            } else if (lightParentCueList["listName"] == "Chases") {
              lightCues[lightChildCueList["listName"]]["type"] = "Chases";
            }
            lightCues[lightChildCueList["listName"]]["id"] =
              lightChildCueList["uniqueID"];
            lightCues[lightChildCueList["listName"]]["number"] =
              lightChildCueList["number"];

            if (lightChildCueList["number"] == "") {
              errors.push(
                `"${lightChildCueList["listName"]}" has no number. Please ensure all light cues have a number.`
              );
              continue;
            }

            if (lightParentCueList["listName"] == "Chases") {
              lightCues[lightChildCueList["listName"]]["chasestates"] = [];
              for (chaseCue of lightChildCueList["cues"]) {
                // We'll make the Loop Group/Reset ourself rather than try and copy it
                if (
                  chaseCue["name"] != "Loop" &&
                  chaseCue["name"] != "Loop Group/Reset"
                ) {
                  if (chaseCue["number"] == "") {
                    errors.push(
                      `"${chaseCue["name"]}" has no number. Please ensure all light cues have a number.`
                    );
                    continue;
                  }

                  stateData = {
                    name: chaseCue["name"],
                    id: chaseCue["uniqueID"],
                    number: chaseCue["number"],
                    type: chaseCue["type"],
                    duration: await qlabCue.getDuration(chaseCue["number"]),
                  };
                  lightCues[lightChildCueList["listName"]]["chasestates"].push(
                    stateData
                  );
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
    console.log("\n\x1b[31mExiting...\x1b[0m");
    process.exit(1);
  } else {
    fs.writeFileSync(lightcuelistcachefile, JSON.stringify(lightCues));

    const cuelistGenerationEnd = new Date();
    console.log(
      `Finished generating light cue list - Took ${
        (cuelistGenerationEnd - cuelistGenerationStart) / 1000
      } seconds\n`
    );

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
async function processCSVData(
  fileName,
  csvData,
  chaseFixtureRemovalOnMatchingFixture,
  csvType,
  destinationCueList,
  replaceIfAlreadyExists
) {
  warnings = [];

  if (csvType == "song") {
    parsedCsvData = extractAndParseCsvData(csvData);

    combinedCuesByStartAndDuration =
      combineCuesByStartAndDuration(parsedCsvData);

    const micCues = [];
    // Loop over the array in reverse order so that splicing out whole items won’t affect the loop
    for (let i = combinedCuesByStartAndDuration.length - 1; i >= 0; i--) {
      const item = combinedCuesByStartAndDuration[i];
      const cues = item[0]; // this is the array of cue strings

      // Extract only the cues that include "MIC"
      const extracted = cues.filter((cue) => cue.includes("MIC"));

      // Keep only cues that do NOT include "MIC"
      const remaining = cues.filter((cue) => !cue.includes("MIC"));

      // If there are any extracted cues, push an item with the same timing info into micCues
      if (extracted.length > 0) {
        micCues.push([extracted, item[1], item[2], item[3]]);
      }

      if (remaining.length > 0) {
        // Update the cues list with the non-MIC cues
        item[0] = remaining;
      } else {
        // If there are no remaining cues, remove this item completely from the original array
        combinedCuesByStartAndDuration.splice(i, 1);
      }
    }

    masterCueList = createMasterCueList(combinedCuesByStartAndDuration);
    for (micCue in micCues.reverse()) {
      masterCueList.push([
        micCues[micCue][0],
        (micCues[micCue][1] / 10000).toFixed(3),
        "0.000",
      ]);
    }
  } else if (csvType == "show") {
    masterCueList = {};
    for (const row of csvData) {
      // Use the first column as the key.
      const key = row[0];

      // For each remaining column:
      // 1. Trim the value.
      // 2. Filter out blank values.
      const values = row
        .slice(1)
        .map((value) => value.trim())
        .filter((value) => value !== "");

      // If the key already exists, add each value to its set.
      // Otherwise, create a new Set for this key.
      if (masterCueList[key]) {
        values.forEach((value) => masterCueList[key].add(value));
      } else {
        masterCueList[key] = new Set(values);
      }
    }

    for (const key in masterCueList) {
      masterCueList[key] = Array.from(masterCueList[key]);
    }
  }

  // Find the destination cue list and exit if doesn't exist
  destinationcuelistid = false;
  for (list of masterCueLists) {
    if (list["listName"] == destinationCueList) {
      destinationcuelistid = list["uniqueID"];
      await qlabCue.selectById(destinationcuelistid);
      break;
    }
  }
  if (!destinationcuelistid) {
    showErrorAndExit(
      `Unable to find destination cue list "${destinationCueList}"`
    );
  }

  // Essentially select the last item in the cue list
  await qlabCue.selectByNumber("9999999999");

  regexMatch = fileName.match(/\[(.*)\].*/);

  // If the cue already exists, and replaceIfAlreadyExists is set, delete the existing cue first
  var setCueName = false;
  if (regexMatch) {
    existingCUEId = await qlabCue.getCueID(regexMatch[1]);
    if (existingCUEId && replaceIfAlreadyExists) {
      console.log(
        `\x1b[33mCue '${regexMatch[1]}' already exists and replaceIfAlreadyExists is true - Replacing the existing cue \x1b[0m\n`
      );
      setCueName = true;
      await qlabCue.deleteCueID(regexMatch[1]);
    } else if (existingCUEId) {
      console.log(
        `\x1b[33mCue '${regexMatch[1]}' already exists but replaceIfAlreadyExists is false - Not replacing the existing cue \x1b[0m\n`
      );
    } else {
      // cue name is defined in the file, but doesn't already exist in qLab
      setCueName = true;
    }
  }

  // Create 'master' group for this audio timeline
  const groupKey = await createGroup(
    path.basename(fileName, path.extname(fileName))
  );

  await qlabCue.collapse("selected");

  if (setCueName) {
    await qlabCue.setNumber("selected", regexMatch[1]);
  }

  const progressBar = new cliProgress.SingleBar(
    {
      format: "{bar} {value} of {total} ({percentage}%)",
    },
    cliProgress.Presets.shades_classic
  );
  progresBarActive = true;

  if (csvType == "song") {
    progressBar.start(masterCueList.length);
  } else if (csvType == "show") {
    progressBar.start(Object.keys(masterCueList).length);
  }

  let loopCounter = 1;
  let previousChaseCueThatNeedsStopping;
  let chaseKey;
  for (cue in masterCueList) {
    progressBar.update(loopCounter);
    if (csvType == "song") {
      // Group cues by start time and duration
      cueid = null;
      cuelist = masterCueList[cue][0];
      start = masterCueList[cue][1];
      duration = masterCueList[cue][2];
    } else if (csvType == "show") {
      cueid = cue;
      cuelist = masterCueList[cue];
      start = "00.00";
      duration = "00.00";
    }

    // If there is only one light in the cue, we don't need to get fancy...
    // Otherwise, we'll get fancy and combine them!
    let childGroupKey;
    if (cuelist.length == 1) {
      childGroupKey = groupKey;
      if (csvType == "show") {
        childGroupKey = await createGroup(cueid);
        await qlabCue.setNumber("selected", cueid);
        await qlabCue.collapse("selected");
      }
      if (/^MIC(?:\d\d|ALL)\s-\s(?:ON|OFF)/.test(cuelist[0])) {
        const regex = /^MIC(\d\d|ALL)\s-\s(ON|OFF)/;
        const match = regex.exec(cuelist[0]);
        const channelNumber = match[1];
        const action = match[2];

        let actionNum;
        if (action == "OFF") {
          actionNum = 0;
        } else {
          actionNum = 1;
        }

        if (channelNumber == "ALL") {
          for (i = 1; i <= 16; i++) {
            let paddedNumber = i.toString().padStart(2, "0");
            command = `/ch/${paddedNumber}/mix/on ${actionNum}`;
            await createOSCCueFromString(
              childGroupKey,
              "1",
              `MIC${paddedNumber} - ${action}`,
              command,
              start,
              null
            );
            if (csvType == "show") {
              await qlabCue.move(childGroupKey, groupKey);
            }
          }
        } else {
          let paddedNumber = channelNumber.toString().padStart(2, "0");
          command = `/ch/${paddedNumber}/mix/on ${actionNum}`;
          await createOSCCueFromString(
            childGroupKey,
            "1",
            `MIC${paddedNumber} - ${action}`,
            command,
            start,
            null
          );
          if (csvType == "show") {
            await qlabCue.move(childGroupKey, groupKey);
          }
        }
      } else if (lightCues[cuelist[0]]["type"] == "Scenes") {
        if (csvType == "show") {
          await createLightCueFromScene(
            childGroupKey,
            cuelist[0],
            start,
            null,
            "00.250"
          );
          await qlabCue.move(childGroupKey, groupKey);
        } else {
          await createLightCueFromScene(childGroupKey, cuelist[0], start);
        }
      } else if (lightCues[cuelist[0]]["type"] == "Chases") {
        chaseKey = await createCueFromChaser(
          childGroupKey,
          cuelist[0],
          start,
          duration,
          null,
          false,
          null,
          null,
          csvType
        );
        if (csvType == "show") {
          await qlabCue.move(childGroupKey, groupKey);
        }
      }
    } else {
      // Determine if we've got multiple cues of the same type, or mixed (I.E Scenes, Chasers or Scenes & Chasers)
      let type = "";
      for (cue in cuelist) {
        if (cue == 0) {
          if (/^MIC(?:\d\d|ALL)\s-\s(?:ON|OFF)/.test(cuelist[cue])) {
            type = "MIC";
          } else {
            type = lightCues[cuelist[cue]]["type"];
          }
        } else {
          if (/^MIC(?:\d\d|ALL)\s-\s(?:ON|OFF)/.test(cuelist[cue])) {
            cuetype = "MIC";
          } else {
            cuetype = lightCues[cuelist[cue]]["type"];
          }
          if (cuetype != type) {
            type = "Mixed";
            break;
          }
        }
      }

      cueName = cuelist.join(" + ");

      childGroupKey = groupKey;
      if (csvType == "show") {
        childGroupKey = await createGroup(cueid);
        await qlabCue.setNumber("selected", cueid);
        await qlabCue.collapse("selected");
      }

      if (type == "Scenes") {
        // Create a scene with all of the lights combined
        let newcue = await qlabCue.create("light");
        await qlabCue.setName("selected", cueName);
        await qlabCue.setLightString(
          "selected",
          listOfFixturesToStringOfFixtures(await combineSceneFixtures(cuelist))
        );
        if (csvType == "show") {
          await qlabCue.setDuration("selected", "00.250");
        } else {
          await qlabCue.setDuration("selected", "00.000");
        }
        await qlabCue.setPreWait("selected", start);

        await qlabCue.move(newcue, childGroupKey);
      } else if (type == "Chases") {
        // Create a group containing all of the chasers
        parent = await createGroup(cueName);
        await qlabCue.collapse("selected");

        if (cuelist.length > 0) {
          warnings.push(
            `More than two chases (${cuelist.join(
              ", "
            )}) are combined in a group (start ${start} / duration ${duration}). You will need to manually check no fixtures overlap.`
          );
        }

        for (lfx in cuelist) {
          await createCueFromChaser(
            parent,
            cuelist[lfx],
            start,
            duration,
            null,
            false,
            null,
            null,
            csvType
          );
        }
        await qlabCue.move(parent, childGroupKey);
        chaseKey = parent;
      } else if (type == "Mixed" || type == "MIC") {
        // Create a group containing the scenes & chasers
        parent = await createGroup(cueName);
        await qlabCue.collapse("selected");

        MICList = [];
        sceneList = [];
        chaseList = [];
        for (cue in cuelist) {
          if (/^MIC(?:\d\d|ALL)\s-\s(?:ON|OFF)/.test(cuelist[cue])) {
            MICList.push(cuelist[cue]);
          } else if (lightCues[cuelist[cue]]["type"] == "Scenes") {
            sceneList.push(cuelist[cue]);
          } else if (lightCues[cuelist[cue]]["type"] == "Chases") {
            chaseList.push(cuelist[cue]);
          }
        }

        let lightsInScene = await combineSceneFixtures(sceneList);
        if (sceneList.length != 0) {
          let newcue = await qlabCue.create("light");
          let sceneName = sceneList.join(" + ");
          await qlabCue.setName("selected", sceneName);
          await qlabCue.setLightString(
            "selected",
            listOfFixturesToStringOfFixtures(lightsInScene)
          );
          if (csvType == "show") {
            await qlabCue.setDuration("selected", "00.250");
          } else {
            await qlabCue.setDuration("selected", "00.000");
          }
          await qlabCue.setPreWait("selected", start);
          await qlabCue.move(newcue, parent);
        }

        if (chaseList.length > 1) {
          warnings.push(
            `More than two chases (${chaseList.join(
              ", "
            )}) are combined in a group (start ${start} / duration ${duration}). You will need to manually check no fixtures overlap.`
          );
        }

        if (chaseList.length != 0) {
          // Chase container is used to handle easy stopping of chases. Only needed in "mixed" scenarios, otherwise a chase container should already exist
          chaseParent = await createGroup("CHASE CONTAINER");
          await qlabCue.collapse("selected");

          for (chase in chaseList) {
            await createCueFromChaser(
              chaseParent,
              chaseList[chase],
              start,
              duration,
              lightsInScene,
              chaseFixtureRemovalOnMatchingFixture,
              sceneName,
              null,
              csvType
            );
          }

          chaseKey = chaseParent;
          await qlabCue.move(chaseParent, parent);
        }

        for (cue in MICList) {
          const regex = /^MIC(\d\d|ALL)\s-\s(ON|OFF)/;
          const match = regex.exec(MICList[cue]);
          const channelNumber = match[1];
          const action = match[2];

          let actionNum;
          if (action == "OFF") {
            actionNum = 0;
          } else {
            actionNum = 1;
          }

          if (channelNumber == "ALL") {
            for (i = 1; i <= 16; i++) {
              let paddedNumber = i.toString().padStart(2, "0");
              command = `/ch/${paddedNumber}/mix/on ${actionNum}`;
              await createOSCCueFromString(
                parent,
                "1",
                `MIC${paddedNumber} - ${action}`,
                command,
                start,
                null
              );
            }
          } else {
            let paddedNumber = channelNumber.toString().padStart(2, "0");
            command = `/ch/${paddedNumber}/mix/on ${actionNum}`;
            await createOSCCueFromString(
              parent,
              "1",
              `MIC${paddedNumber} - ${action}`,
              command,
              start,
              null
            );
          }
        }

        await qlabCue.move(parent, childGroupKey);
      }
      if (csvType == "show") {
        await qlabCue.move(childGroupKey, groupKey);
      }
    }
    if (csvType == "show") {
      if (previousChaseCueThatNeedsStopping) {
        let newstopcue = await qlabCue.create("stop");
        await qlabCue.setTargetID(
          "selected",
          previousChaseCueThatNeedsStopping
        );
        await qlabCue.move(newstopcue, childGroupKey);
        previousChaseCueThatNeedsStopping = null;
        chaseKey = null;
      }

      previousChaseCueThatNeedsStopping = chaseKey;
    }
    loopCounter = loopCounter + 1;
  }
  progressBar.stop();
  progresBarActive = false;

  return warnings;
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
module.exports.listOfFixturesToStringOfFixtures =
  listOfFixturesToStringOfFixtures;
module.exports.createGroup = createGroup;
module.exports.createLightCueFromScene = createLightCueFromScene;
module.exports.createOSCCueFromString = createOSCCueFromString;
module.exports.createCueFromChaser = createCueFromChaser;
module.exports.stringOfFixturesToListOfFixtures =
  stringOfFixturesToListOfFixtures;
module.exports.combineSceneFixtures = combineSceneFixtures;
module.exports.extractAndParseCsvData = extractAndParseCsvData;
module.exports.createMasterCueList = createMasterCueList;
module.exports.combineCuesByStartAndDuration = combineCuesByStartAndDuration;
module.exports.generateInternalLightCueList = generateInternalLightCueList;
module.exports.processCSVData = processCSVData;
module.exports.showErrorAndExit = showErrorAndExit;

exports.qlabworkspaceid = qlabworkspaceid;
exports.progresBarActive = progresBarActive;
