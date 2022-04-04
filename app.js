const fs = require('fs');
const { parse } = require('csv-parse');

const qlabCore = require('./qlab/core.js');
const qlabCue = require('./qlab/methods/cue.js');

const helper = require('./helper.js');

const homedir = require('os').homedir();
const settingsfile = homedir + '/.srobinsonqlabtools_data.json';
const lightcuelistcachefile = homedir + '/.srobinsonqlabtools_lightcuelistcachefile.json';

(async () => {
  // Ask the user to specify the parameters required, trying to read from the defined settings file first
  async function getSettings() {
    return new Promise((resolve, reject) => {

      let currentSettings = (function () {
        try {
          return JSON.parse(fs.readFileSync(settingsfile));
        } catch (err) {
          return {}
        }
      })();

      const prompts = require('prompts');

      // Ask the questions
      (async () => {
        const onCancel = prompt => {
          process.exit(1)
        }

        return resolve(await prompts([
          {
            type: 'text',
            name: 'filepath',
            message: `CSV Filepath:`,
            initial: 'filepath' in currentSettings ? currentSettings['filepath'] : '',
            validate: filepath => filepath === '' ? 'Cannot be blank' : true
          },
          {
            type: 'text',
            name: 'qlabip',
            message: `qLab IP:`,
            initial: 'qlabip' in currentSettings ? currentSettings['qlabip'] : '',
            validate: qlabip => qlabip === '' ? 'Cannot be blank' : true
          },
          {
            type: 'text',
            name: 'qlabworkspaceid',
            message: `qLab Workspace ID:`,
            initial: 'qlabworkspaceid' in currentSettings ? currentSettings['qlabworkspaceid'] : '',
            validate: qlabworkspaceid => qlabworkspaceid === '' ? 'Cannot be blank' : true
          }
        ], { onCancel }));
      })();

    })
  }

  const settings = await getSettings();
  fs.writeFileSync(settingsfile, JSON.stringify(settings));
  helper.qlabworkspaceid = settings['qlabworkspaceid']
  console.log()

  await qlabCore.init(settings['qlabip']);
  console.log()

  masterCueLists = await qlabCue.list();

  try {
    lightCues = JSON.parse(fs.readFileSync(lightcuelistcachefile))
    console.log(`Using light cue cache file ${lightcuelistcachefile}\n`)
  } catch (err) {
    console.log('Unable to use light cue cache file - Generating light cues list...\n')
    lightCues = await helper.generateInternalLightCueList(masterCueLists, lightcuelistcachefile)
  }

  if (Object.keys(lightCues).length == 0) {
    console.log('Error - Unable to find light cues. Ensure \'Light Cues > Scenes\' & \'Light Cues > Chases\' cue lists exist.')
    process.exit(1)
  }

  // Start processing the CSV data
  let csvoutput = []
  let rowcount = 1
  let validationErrors = []
  fs.createReadStream(settings['filepath'])
    .on('error', (error) => {
      console.log(`Unable to import - Error reading CSV file(${error})`)
      process.exit(1)
    })
    .pipe(parse({
      delimiter: '\t'
    }))
    // On every row, validate the data
    .on('data', (row) => {
      let lfxname = row[0].trim()

      if (rowcount != 1) {
        if (!(Object.keys(lightCues).includes(lfxname))) {
          validationErrors.push(`'${lfxname}'[${rowcount}] - Invalid LFX`)
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
        await helper.processCSVData(settings['filepath'], csvoutput)
        const scriptEnd = new Date()
        console.log(`Finished processing - Took ${(scriptEnd - scriptStart) / 1000} seconds`)

        process.exit(0)
      } else {
        console.log('Unable to import - Errors found in CSV:')
        for (const error of validationErrors) {
          console.log(`  ${error} `)
        }
        process.exit(1)
      }
    });

})();