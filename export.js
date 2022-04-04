const fs = require('fs');

const qlabCore = require('./qlab/core.js');
const qlabCue = require('./qlab/methods/cue.js');
const qlabLightCue = require('./qlab/methods/light.js');

const helper = require('./helper.js');

const homedir = require('os').homedir();
const settingsfile = homedir + '/.srobinsonqlabtools_comparedata.json';

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
          },
          {
            type: 'text',
            name: 'outputdir',
            message: `Output directory:`,
            initial: 'outputdir' in currentSettings ? currentSettings['outputdir'] : '',
            validate: outputdir => outputdir === '' ? 'Cannot be blank' : true
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

  console.log(`Starting export of workspace ${settings['qlabworkspaceid']}`)

  // Loop over all elements in the "Script Dump - DO NOT USE" cue list and export them to JSON
  data = {}
  for (list of masterCueLists) {
    if (list['listName'] == 'Script Dump - DO NOT USE') {
      for (cueL1 in list['cues']) {
        cueL1Name = list['cues'][cueL1]['name']

        console.log(`Starting export of workspace ${settings['qlabworkspaceid']}/${cueL1Name}`)

        data[cueL1Name] = []
        for (cueL2 in list['cues'][cueL1]['cues']) {
          cueL2Data = {}
          cueL2Name = list['cues'][cueL1]['cues'][cueL2]['name']
          cueL2Type = list['cues'][cueL1]['cues'][cueL2]['type']
          cueL2Num = list['cues'][cueL1]['cues'][cueL2]['number']
          cueL2Data[cueL2Name] = {
            "type": cueL2Type,
            "duration": await qlabCue.getDuration(cueL2Num),
            "prewait": await qlabCue.getPreWait(cueL2Num),
            "components": [],
          }
          if (cueL2Type == "Light") {
            cueL2Data[cueL2Name]["fixtures"] = await helper.stringOfFixturesToListOfFixtures(await qlabLightCue.getLightString(cueL2Num))
          }
          for (cueL3 in list['cues'][cueL1]['cues'][cueL2]['cues']) {
            cueL3Data = {}
            cueL3Name = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['name']
            cueL3Type = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['type']
            cueL3Num = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['number']
            cueL3Data[cueL3Name] = {
              "type": cueL3Type,
              "duration": await qlabCue.getDuration(cueL3Num),
              "prewait": await qlabCue.getPreWait(cueL3Num),
              "components": []
            }
            if (cueL3Type == "Light") {
              cueL3Data[cueL3Name]["fixtures"] = await helper.stringOfFixturesToListOfFixtures(await qlabLightCue.getLightString(cueL3Num))
            }
            cueL2Data[cueL2Name]["components"].push(cueL3Data)
            for (cueL4 in list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues']) {
              cueL4Data = {}
              cueL4Name = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['name']
              cueL4Type = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['type']
              cueL4Num = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['number']
              cueL4Data[cueL4Name] = {
                "type": cueL4Type,
                "duration": await qlabCue.getDuration(cueL4Num),
                "prewait": await qlabCue.getPreWait(cueL4Num),
                "components": []
              }
              if (cueL4Type == "Light") {
                cueL4Data[cueL4Name]["fixtures"] = await helper.stringOfFixturesToListOfFixtures(await qlabLightCue.getLightString(cueL4Num))
              }
              cueL3Data[cueL3Name]["components"].push(cueL4Data)
              for (cueL5 in list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['cues']) {
                cueL5Data = {}
                cueL5Name = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['cues'][cueL5]['name']
                cueL5Type = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['cues'][cueL5]['type']
                cueL5Num = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['cues'][cueL5]['number']
                cueL5Data[cueL5Name] = {
                  "type": cueL5Type,
                  "duration": await qlabCue.getDuration(cueL5Num),
                  "prewait": await qlabCue.getPreWait(cueL5Num),
                  "components": []
                }
                if (cueL5Type == "Light") {
                  cueL5Data[cueL5Name]["fixtures"] = await helper.stringOfFixturesToListOfFixtures(await qlabLightCue.getLightString(cueL5Num))
                }
                cueL4Data[cueL4Name]["components"].push(cueL5Data)
                for (cueL6 in list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['cues'][cueL5]['cues']) {
                  cueL6Data = {}
                  cueL6Name = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['cues'][cueL5]['cues'][cueL6]['name']
                  cueL6Type = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['cues'][cueL5]['cues'][cueL6]['type']
                  cueL6Num = list['cues'][cueL1]['cues'][cueL2]['cues'][cueL3]['cues'][cueL4]['cues'][cueL5]['cues'][cueL6]['number']
                  cueL6Data[cueL6Name] = {
                    "type": cueL6Type,
                    "duration": await qlabCue.getDuration(cueL6Num),
                    "prewait": await qlabCue.getPreWait(cueL6Num),
                  }
                  if (cueL6Type == "Light") {
                    cueL6Data[cueL6Name]["fixtures"] = await helper.stringOfFixturesToListOfFixtures(await qlabLightCue.getLightString(cueL6Num))
                  }
                  cueL5Data[cueL5Name]["components"].push(cueL6Data)
                }
              }
            }
          }
          data[cueL1Name].push(cueL2Data)
        }
      }
    }
  }

  let outputpath = settings['outputdir'] + settings['qlabworkspaceid'] + '.json'
  fs.writeFileSync(outputpath, JSON.stringify(data, null, 4));
  console.log(`Output workspace ${settings['qlabworkspaceid']} to ${outputpath}\n`)

  process.exit(0)

})();