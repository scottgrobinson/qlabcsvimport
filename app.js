const fs = require('fs'),
  { parse } = require('csv-parse'),
  qlabCore = require('./qlab/core.js'),
  qlabCue = require('./qlab/cue.js'),
  helper = require('./helper.js'),
  path = require('path')
const { exit } = require('process');

homedir = require('os').homedir();

const settingsFile = homedir + '/.qlabtools_data.json';
const lightcuelistcachefile = homedir + '/.qlabtools_lightcuelistcachefile.json';

let existingSettings = (function () {
  try {
    return JSON.parse(fs.readFileSync(settingsFile));
  } catch (err) {
    return {}
  }
})();

(async () => {
  // Ask the user to specify the parameters required, trying to read from the defined settings file first
  async function getNewSettings() {
    return new Promise((resolve, reject) => {
      const prompts = require('prompts');

      // Ask the questions
      (async () => {
        const onCancel = prompt => {
          process.exit(1)
        }

        csvTypes = [
          { title: 'Song', value: 'song' },
          { title: 'Show', value: 'show' }
        ]

        promptQuestions = [
          {
            type: 'text',
            name: 'csvpath',
            message: `CSV File/Folder Path:`,
            initial: 'csvpath' in existingSettings ? existingSettings['csvpath'] : '',
            validate: csvpath => csvpath === '' ? 'Cannot be blank' : true,
            format: csvpath => csvpath
          },
          {
            type: 'select',
            name: 'csvType',
            message: 'CSV Type:',
            choices: csvTypes,
            initial: 'csvType' in existingSettings ? csvTypes.findIndex(x => x.value === existingSettings['csvType']) : 1,
          },
          {
            type: 'text',
            name: 'qlabip',
            message: `qLab IP:`,
            initial: 'qlabip' in existingSettings ? existingSettings['qlabip'] : '',
            validate: qlabip => qlabip === '' ? 'Cannot be blank' : true
          },
          {
            type: 'text',
            name: 'qlabworkspaceid',
            message: `qLab Workspace ID:`,
            initial: 'qlabworkspaceid' in existingSettings ? existingSettings['qlabworkspaceid'] : '',
            validate: qlabworkspaceid => qlabworkspaceid === '' ? 'Cannot be blank' : true
          },
          {
            type: 'toggle',
            name: 'uselightcuecache',
            message: `Use light cue cache?:`,
            initial: 'uselightcuecache' in existingSettings ? existingSettings['uselightcuecache'] : true,
            active: 'yes',
            inactive: 'no'
          },
          {
            type: 'toggle',
            name: 'chaseFixtureRemovalOnMatchingFixture',
            message: `Remove fixtures from a chase if combined in a group with a scene that has a fixture contained within the chase?:`,
            initial: 'chaseFixtureRemovalOnMatchingFixture' in existingSettings ? existingSettings['chaseFixtureRemovalOnMatchingFixture'] : false,
            active: 'remove',
            inactive: 'warn'
          },
          {
            type: 'text',
            name: 'destinationCueList',
            message: `Cue list name where the created cues will be created:`,
            initial: 'destinationCueList' in existingSettings ? existingSettings['destinationCueList'] : '',
            validate: destinationCueList => destinationCueList === '' ? 'Cannot be blank' : true
          }
        ]

        return resolve(await prompts(promptQuestions, { onCancel }));
      })();

    })
  }

  const settings = await getNewSettings();

  // Remove quotes from the  path which can happen when we drag and drop from MacOS Finder into terminal
  if (settings['csvpath'].slice(0, 1) == '\'' && settings['csvpath'].slice(-1) == '\'') {
    settings['csvpath'] = settings['csvpath'].slice(1, -1)
  }

  fs.writeFileSync(settingsFile, JSON.stringify(Object.assign({}, existingSettings, settings)));
  helper.qlabworkspaceid = settings['qlabworkspaceid']
  console.log()

  await qlabCore.init(settings['qlabip']);
  console.log()

  masterCueLists = await qlabCue.list();

  if (settings['uselightcuecache']) {
    try {
      lightCues = JSON.parse(fs.readFileSync(lightcuelistcachefile))
      console.log(`Using light cue cache file ${lightcuelistcachefile}\n`)
    } catch (err) {
      console.log('Unable to use light cue cache file - Generating light cues list (This may take upto 60 seconds, hold tight!)...\n')
      lightCues = await helper.generateInternalLightCueList(masterCueLists, lightcuelistcachefile)
    }
  } else {
    console.log('Generating light cues list (This may take upto 60 seconds, hold tight!)...\n')
    lightCues = await helper.generateInternalLightCueList(masterCueLists, lightcuelistcachefile)
  }

  if (Object.keys(lightCues).length == 0) {
    helper.showErrorAndExit('Unable to find light cues. Ensure \'Light Cues > Scenes\' & \'Light Cues > Chases\' cue lists exist')
  }

  // Start processing the CSV data
  if (settings['csvType'] == "song") {
    csvDelimiter = '\t';
    csvCueNameField = 0;
  } else if (settings['csvType'] == "show") {
    csvDelimiter = ','
    csvCueNameField = 1;
  }

  csvsForProcessing = []
  if (fs.lstatSync(settings['csvpath']).isDirectory()) {
    fs.readdirSync(settings['csvpath']).forEach(file => {
      if (path.extname(file) == '.csv') {
        csvsForProcessing.push(settings['csvpath'] + '/' + file)
      }
    })
    if (settings['csvType'] == "show") {
      helper.showErrorAndExit('Folder mode only supports importing of songs files, not show files')
    }
  } else {
    csvsForProcessing = [settings['csvpath']]
  }

  csvData = {}
  csvErrors = {}
  csvsHaveError = false
  function validateCSVFile(csvPath) {
    let rowcount = 1
    return new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .on('error', (error) => {
          csvErrors[csvPath].push(`Unable to import - ${error}`)
        })
        .pipe(parse({
          delimiter: csvDelimiter
        }))
        // On every row, validate the data
        .on('data', (row) => {
          let cuename = row[csvCueNameField].trim()
          row[csvCueNameField] = row[csvCueNameField].trim()

          if (rowcount != 1) {
            if (cuename.startsWith("OSC -")) {
              csvData[csvPath].push(row)
            } else if (!(Object.keys(lightCues).includes(cuename))) {
              csvsHaveError = true
              csvErrors[csvPath].push(`'${cuename}' [Line ${rowcount}] - Could not find cue in qLab with matching name`)
            } else {
              csvData[csvPath].push(row)
            }
          }
          rowcount++;
        })
        .on('end', () => {
          resolve();
        })
    })
  }

  async function validateCSVs(csvsForProcessing) {
    for (i in csvsForProcessing) {
      csvPath = csvsForProcessing[i]
      csvData[csvPath] = []
      csvErrors[csvPath] = []
      console.log(`Attempting to validate ${csvPath}`)
      await validateCSVFile(csvPath)
    }
  }

  await validateCSVs(csvsForProcessing)
  console.log("")
  if (csvsHaveError) {
    for (csv in csvErrors) {
      if (csvErrors[csv].length) {
        console.log(csv)
        for (error in csvErrors[csv]) {
          console.log(`\x1b[31m[Error] ${csvErrors[csv][error]}\x1b[0m`);
        }
        console.log("")
      }
    }
    helper.showErrorAndExit('Errors were found whilst validating the CSV data.')
  } else {
    processedCSVMessages = {}
    csvProcessingCount = 1
    for (csvPath in csvData) {
      processedCSVMessages[csvPath] = []
      const scriptStart = new Date()
      console.log(`Starting processing of ${csvPath} (${csvProcessingCount} of ${Object.keys(csvData).length})\n`)
      processedCSVMessages[csvPath] = await helper.processCSVData(csvPath, csvData[csvPath], settings['chaseFixtureRemovalOnMatchingFixture'], settings['csvType'], settings['destinationCueList'])
      const scriptEnd = new Date()
      console.log(`\nFinished processing of ${csvPath} (${csvProcessingCount} of ${Object.keys(csvData).length}) - Took ${(scriptEnd - scriptStart) / 1000} seconds`)
      console.log("")
      csvProcessingCount++
    }
    for (csvPath in processedCSVMessages) {
      if (processedCSVMessages[csvPath].length) {
        console.log(csvPath)
        for (message in processedCSVMessages[csvPath]) {
          console.log(`\x1b[33m${processedCSVMessages[csvPath][message]}\x1b[0m`);
        }
        console.log("")
      }
    }
    console.log("Finished!")
    process.exit(0)
  }

})();