const fs = require('fs'),
  { parse } = require('csv-parse'),
  qlabCore = require('./qlab/core.js'),
  qlabCue = require('./qlab/cue.js'),
  helper = require('./helper.js'),
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

        return resolve(await prompts([
          {
            type: 'text',
            name: 'csvfilepath',
            message: `CSV Filepath:`,
            initial: 'csvfilepath' in existingSettings ? existingSettings['csvfilepath'] : '',
            validate: csvfilepath => csvfilepath === '' ? 'Cannot be blank' : true,
            format: csvfilepath => csvfilepath
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
        ], { onCancel }));
      })();

    })
  }

  const settings = await getNewSettings();
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
  let csvoutput = []
  let rowcount = 1
  let validationErrors = []

  if (settings['csvType'] == "song") {
    csvDelimiter = '\t';
    csvCueNameField = 0;
  } else if (settings['csvType'] == "show") {
    csvDelimiter = ','
    csvCueNameField = 1;
  }

  fs.createReadStream(settings['csvfilepath'])
    .on('error', (error) => {
      helper.showErrorAndExit(`Unable to import - ${error}`)
    })
    .pipe(parse({
      delimiter: csvDelimiter
    }))
    // On every row, validate the data
    .on('data', (row) => {
      let cuename = row[csvCueNameField].trim()

      if (rowcount != 1) {
        if (cuename.startsWith("OSC -")) {
          csvoutput.push(row)
        } else if (!(Object.keys(lightCues).includes(cuename))) {
          validationErrors.push(`'${cuename}' [Line ${rowcount}] - Could not find cue in qLab with matching name`)
        } else {
          csvoutput.push(row)
        }
      }
      rowcount++;
    })
    // Once the file has been read, start processing the data!
    .on('end', async () => {
      if (validationErrors.length == 0) {
        const scriptStart = new Date()

        console.log('Starting processing...\n')
        await helper.processCSVData(settings['csvfilepath'], csvoutput, settings['chaseFixtureRemovalOnMatchingFixture'], settings['csvType'])
        const scriptEnd = new Date()
        console.log(`\nFinished processing - Took ${(scriptEnd - scriptStart) / 1000} seconds`)

        process.exit(0)
      } else {
        console.log(`\x1b[31m[Error] Unable to import - Errors found in CSV ${settings['csvfilepath']}:`)
        for (const error of validationErrors) {
          console.log(`  ${error} `)
        }
        console.log('\nExiting...')
        process.exit(1)
      }
    });

})();