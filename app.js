const fs = require('fs');
const os = require('os');
const { parse } = require('csv-parse');

const makeQlabConnection = require('./qlab/connection.js');
const methods_cue = require('./qlab/methods/cue.js');
const methods_light = require('./qlab/methods/light.js');

const config = require('./config.js');

let cuelists = [];

// Wait for QLab connection, then we'll start the magic!
(async () => {
  async function getCurrentSettings(settingsfile) {
    try {
      return JSON.parse(fs.readFileSync(settingsfile));
    } catch (err) {
      let srobinsonqlabtools_data = {
        filepath: '',
        qlabip: '',
        qlabworkspaceid: ''
      };
      return JSON.stringify(srobinsonqlabtools_data)
    }
  }

  async function getNewSettings(currentsettings) {
    return new Promise((resolve, reject) => {
      const get_filepath = async function() {
        readline.question(`Enter CSV Filepath [${currentsettings['filepath']}]:`, (filepath) => {
          if (!filepath) {
            if (currentsettings['filepath']) {
              filepath = currentsettings['filepath']
              console.log(`  Using stored value '${filepath}'`)
            } else {
              console.log(`  Error - Filepath cannot be blank`)
              get_filepath();
            }
          }

          // Might be a bit hacky? Who knows. Probably is a bit crap....
          if(os.platform == "darwin"){
            filepath = filepath.replace(/\\/g, '')
          }
  
          const get_qlabip = function() {
            readline.question(`Enter QLab IP [${currentsettings['qlabip']}]:`, (qlabip) => {
              if (!qlabip) {
                if (currentsettings['qlabip']) {
                  qlabip = currentsettings['qlabip']
                  console.log(`  Using stored value '${qlabip}'`)
                } else {
                  console.log(`  Error - QLab IP cannot be blank`)
                  get_qlabip();
                }
              }
  
              const get_qlabworkspaceid = function() {
  
                readline.question(`Enter QLab workspace ID [${currentsettings['qlabworkspaceid']}]:`, (qlabworkspaceid) => {
                  if (!qlabworkspaceid) {
                    if (currentsettings['qlabworkspaceid']) {
                      qlabworkspaceid = currentsettings['qlabworkspaceid']
                      console.log(`  Using stored value '${qlabworkspaceid}'`)
                    } else {
                      console.log(`  Error - QLab workspace ID cannot be blank`)
                      get_qlabworkspaceid();
                    }
                  }
  
                  const homedir = require('os').homedir();
                  let srobinsonqlabtools_data = {
                    filepath: filepath,
                    qlabip: qlabip,
                    qlabworkspaceid: qlabworkspaceid
                  };
                  fs.writeFileSync(homedir + '/.srobinsonqlabtools_data.json', JSON.stringify(srobinsonqlabtools_data));
                  config.qlabworkspaceid = qlabworkspaceid

                  readline.close()
                  return resolve(srobinsonqlabtools_data)
                });
              }
              get_qlabworkspaceid();
  
            });
          }
          get_qlabip();
        });
      }
      get_filepath();
    })
    

  }

  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const homedir = require('os').homedir();
  const settingsfile = homedir + '/.srobinsonqlabtools_data.json';

  const currentsettings = await getCurrentSettings(settingsfile);
  console.log()

  const newsettings = await getNewSettings(currentsettings);
  console.log()
  
  let qlabconn = await makeQlabConnection(newsettings['qlabip']);
  console.log()

  cuelists = await methods_cue.list(qlabconn);

  lightCues = []
  lightCuesWithData = []
  
  for(list of cuelists) {
    if(list['listName'] == 'Light Cues'){
      for(cue1 of list['cues']){
        for(cue2 of cue1['cues']){
          if(['Scenes', 'Chases'].includes(cue1['listName'])){
            lightCuesWithData[cue2['listName']] = []
            if(cue1['listName'] == 'Scenes'){
              lightCuesWithData[cue2['listName']]['type'] = 'Scenes'
            } else if(cue1['listName'] == 'Chases'){
              lightCuesWithData[cue2['listName']]['type'] = 'Chases'
            }
            lightCuesWithData[cue2['listName']]['id'] = cue2['uniqueID']
            lightCuesWithData[cue2['listName']]['number'] = cue2['number']
            if(cue1['listName'] == "Chases"){
              lightCuesWithData[cue2['listName']]['chasestates'] = []
              for(chaseCue of cue2['cues']){
                // We'll make the Loop Group/Reset ourself rather than try and copy it
                if(chaseCue['name'] != "Loop" && chaseCue['name'] != "Loop Group/Reset"){
                  stateData = []
                  stateData['name'] = chaseCue['name']
                  stateData['id'] = chaseCue['uniqueID']
                  stateData['number'] = chaseCue['number']
                  stateData['type'] = chaseCue['type']
                  stateData['duration'] = await methods_cue.get_duration(qlabconn, chaseCue['number'])
                  lightCuesWithData[cue2['listName']]['chasestates'].push(stateData)
                }
              }
            }
            lightCues.push(cue2['listName'])
          }
        }
      }
    }
  }
  

  if(lightCues.length == 0){
    console.log('Error - Unable to find light cues. Ensure \'Light Cues > Scenes\' & \'Light Cues > Chases\' cue lists exist.')
    process.exit(1)
  }

  // Start processing the data... If we can
  let csvoutput = []
  let rowcount = 1
  let validation_errors = []
  fs.createReadStream(newsettings['filepath'])
    .on('error', (error) => {
      console.log(`Unable to import - Error reading CSV file (${error})`)
      process.exit(1)
    })
    .pipe(parse({
      delimiter: '\t'
    }))
    .on('data', (row) => {
      let lfxname = row[0].trim()

      if (rowcount != 1) {
        if(!(lightCues.includes(lfxname))){
          validation_errors.push(`'${lfxname}' [${rowcount}] - Invalid LFX`)
        } else {
          csvoutput.push(row)
        }
      }
      rowcount++;
    })
    .on('end', (data) => {
      if (validation_errors.length == 0) {
        process_csv_data(qlabconn, newsettings['filepath'], csvoutput)
      } else {
        console.log('Unable to import - Errors found in CSV:')
        for (const error of validation_errors) {
          console.log(`  ${error}`)
        }
        process.exit(1)
      }
    });

})();

// Process the CSV row data
async function process_csv_data(qlabconn, songname, data) {

  async function create_group(qlabconn, groupkey){
    function sleep(ms){
        return new Promise(resolve=>{
            setTimeout(resolve,ms)
        })
    }

    await sleep(250) // Seems to need a sleep when creating groups in quick succession

    group_key_cue = await methods_cue.create(qlabconn, 'group')
    await methods_cue.set_name(qlabconn, 'selected', `${groupkey}`);
    await methods_cue.set_mode(qlabconn, 'selected', 3); 

    return group_key_cue
  }

  async function process_timestamp(timestamp){
    if(timestamp.split(':')[0] == 0){
      seconds = timestamp.split(':')[1].split('.')[0]
    } else {
      seconds = parseInt((timestamp.split(':')[0] * 60)) + parseInt(timestamp.split(':')[1].split('.')[0])
    }

    microseconds = timestamp.split(':')[1].split('.')[1].padEnd(3, 0)
    return seconds.toString() + '.' + microseconds
  }

  async function create_scene(groupkey, lfxname, start){
    if(!('lightstring' in lightCuesWithData[lfxname])){
      lightCuesWithData[lfxname]['lightstring'] = await methods_light.get_lightstring(qlabconn, lightCuesWithData[lfxname]['number'])
      if(!lightCuesWithData[lfxname]['lightstring']){
        console.log(`  Error - Light string blank for ${lightCuesWithData[lfxname]}`)
        process.exit(1)
      }
    }

    let newcue = await methods_cue.create(qlabconn, 'light')
    await methods_cue.set_name(qlabconn, 'selected', lfxname)
    await methods_light.set_lightstring(qlabconn, 'selected', lightCuesWithData[lfxname]['lightstring'])
    await methods_cue.set_duration(qlabconn, 'selected', '00.000')
    await methods_cue.set_prewait(qlabconn, 'selected', await start)
    await methods_cue.move(qlabconn, newcue, groupkey)
  }

  async function create_chaser(groupkey, lfxname, start, duration){
    const parentchasegroupkey = await create_group(qlabconn, lfxname + ' CONTAINER')
    await methods_cue.set_prewait(qlabconn, 'selected', await start)

    const chasegroupkey = await create_group(qlabconn, lfxname)
    await methods_cue.set_mode(qlabconn, 'selected', 1)

    for(chasestate in lightCuesWithData[lfxname]['chasestates']){
      statedata = lightCuesWithData[lfxname]['chasestates'][chasestate]
      if(statedata['type'] == "Light"){
        if(!('lightstring' in lightCuesWithData[lfxname]['chasestates'][chasestate])){
          lightCuesWithData[lfxname]['chasestates'][chasestate]['lightstring'] = await methods_light.get_lightstring(qlabconn, lightCuesWithData[lfxname]['chasestates'][chasestate]['number'])
          if(!lightCuesWithData[lfxname]['chasestates'][chasestate]['lightstring']){
            console.log(`  Error - Light string blank for ${lightCuesWithData[lfxname]['chasestates'][chasestate]['name']}`)
            process.exit(1)
          }
        }
        
        let newcue = await methods_cue.create(qlabconn, 'light')
        if(chasestate == 0){
          firstcueid = newcue
        }
  
        console.log(statedata)
        await methods_cue.set_name(qlabconn, 'selected', statedata['name'])
        await methods_light.set_lightstring(qlabconn, 'selected', lightCuesWithData[lfxname]['chasestates'][chasestate]['lightstring'])
        await methods_cue.set_duration(qlabconn, 'selected', statedata['duration'])
        await methods_cue.set_continue_mode(qlabconn, 'selected', 2)
        await methods_cue.move(qlabconn, newcue, chasegroupkey)
        lastfixturename = statedata['name']
        lastfixtureindex = chasestate
      } else if(statedata['type'] == "Wait"){
        let newcue = await methods_cue.create(qlabconn, 'wait')
        await methods_cue.set_duration(qlabconn, 'selected', await methods_cue.get_duration(qlabconn, lightCuesWithData[lfxname]['chasestates'][chasestate]['number']))
        await methods_cue.set_continue_mode(qlabconn, 'selected', 2)
        await methods_cue.move(qlabconn, newcue, chasegroupkey)
      }
    }

    // START LG
    loopgroup = await methods_cue.create(qlabconn, 'group')
    await methods_cue.set_name(qlabconn, 'selected', 'Loop Group/Reset');
    await methods_cue.set_mode(qlabconn, 'selected', 2); 

    startcue = await methods_cue.create(qlabconn, 'start');
    await methods_cue.set_name(qlabconn, 'selected', 'Loop');
    await methods_cue.set_target_id(qlabconn, 'selected', firstcueid);
    await methods_cue.set_continue_mode(qlabconn, 'selected', 2)
    await methods_cue.move(qlabconn, startcue, loopgroup)

    fixturesettingstouse = lightCuesWithData[lfxname]['chasestates'][lastfixtureindex]['lightstring']
    const splitLightString = fixturesettingstouse.split("\n")
    lightsInScene = []
    for(light in splitLightString){
      fixturesetting = splitLightString[light].split("=")[0].trim()
      fixturevalue = parseInt(splitLightString[light].split("=")[1].trim())
      if(!(fixturesetting in lightsInScene)){
        lightsInScene[fixturesetting] = fixturevalue
      } else {
        if(fixturevalue >= lightsInScene[fixturesetting]){
          lightsInScene[fixturesetting] = fixturevalue
        }
      }
    }

    resetLights = []
    for(light in lightsInScene){
      if(lightsInScene[light] != 0){
        resetLights[light] = 0
      }
    }

    lightsInSceneAsString = ''
    // convert back to string
    for(light in resetLights){
      lightsInSceneAsString = lightsInSceneAsString + light + " = " + resetLights[light].toString() + "\n"
    }

    lightcue = await methods_cue.create(qlabconn, 'light')
    await methods_cue.set_duration(qlabconn, 'selected', '00.00')
    await methods_light.set_lightstring(qlabconn, 'selected', lightsInSceneAsString)
    await methods_cue.set_name(qlabconn, 'selected', `Reset ${lastfixturename}`);
    await methods_cue.move(qlabconn, lightcue, loopgroup)

    await methods_cue.move(qlabconn, loopgroup, chasegroupkey);
    // END LG

    const durationgroupkey = await create_group(qlabconn, 'CHASE DURATION CONTAINER')
    await methods_cue.set_mode(qlabconn, 'selected', 1)
    let waitcue = await methods_cue.create(qlabconn, 'wait')
    let calculatedduration = await duration;
    await methods_cue.set_name(qlabconn, 'selected', `Wait ${calculatedduration} Seconds`)
    await methods_cue.set_duration(qlabconn, 'selected', calculatedduration)
    await methods_cue.set_continue_mode(qlabconn, 'selected', 2)
    await methods_cue.move(qlabconn, waitcue, durationgroupkey)
    let stopcue = await methods_cue.create(qlabconn, 'stop')
    await methods_cue.set_name(qlabconn, 'selected', 'Stop Chase')
    await methods_cue.set_target_id(qlabconn, 'selected', chasegroupkey)
    await methods_cue.move(qlabconn, stopcue, durationgroupkey)

    await methods_cue.move(qlabconn, chasegroupkey, parentchasegroupkey)
    await methods_cue.move(qlabconn, durationgroupkey, parentchasegroupkey)

    await methods_cue.move(qlabconn, parentchasegroupkey, groupkey)
  }

  console.log('Starting qlab processing...')

  // Combine LFX where the start time and duration are the same
  const newData = []
  for(item in data){
    const lfxname = data[item][0];
    const start = parseFloat(await process_timestamp(data[item][1])).toFixed(2);
    const duration = parseFloat(await process_timestamp(data[item][2])).toFixed(2);
    const end = (parseFloat(start) + parseFloat(duration)).toFixed(2);
    if(typeof newData[newData.length-1] !== 'undefined' && newData[newData.length-1][1] == start && newData[newData.length-1][2] == duration){
      newData[newData.length-1][0].push(lfxname)
    } else {
      newData.push([[lfxname], start, duration, end])
    }
  }
  data = newData

  newData3 = []
  for(item in data){
    let foundChildren = false
    parentitem = data[item]
    parentitemno = item
    for(item in data){
      if(parseFloat(data[item][1]) >= parseFloat(parentitem[1]) && parseFloat(data[item][3]) < parseFloat(parentitem[3])){
        // Create list of lfxnames
        nameList = []
        for(lfxname in parentitem[0]){
          if(!(nameList.includes(parentitem[0][lfxname]))){
            nameList.push(parentitem[0][lfxname])
          }
        }
        for(lfxname in data[item][0]){
          if(!(nameList.includes(data[item][0][lfxname]))){
            nameList.push(data[item][0][lfxname])
          }
        }
        newData3.push([nameList, data[item][1], data[item][2], data[item][3]])
        foundChildren = true
        data[item]['used'] = true
      }
    }
    if(foundChildren != true){
      newData3.push(parentitem)
    }
  }
  data = newData3;

  newdata4 = []
  for(item in data){
    if(!(data[item]['used'])){
      newdata4.push(data[item]);
    }
  }

  data = newdata4;

  // Find the temporary "dump" cue list
  dumpcuelistid = false
  for(list of cuelists) {
    if(list['listName'] == 'Script Dump - DO NOT USE'){
      dumpcuelistid = list['uniqueID']
    }
  }
  if(!dumpcuelistid){
    console.log('Error - Unable to temporary dump cue list \'Script Dump - DO NOT USE\'')
    process.exit(1)
  }

  await methods_cue.select(qlabconn, dumpcuelistid) // Select the dump cue list so we are creating everything in the right place!
  const groupkey = await create_group(qlabconn, songname) // Create 'master' group for this audio timeline

  for(item in data){
    const lfxlist = data[item][0];
    const start = data[item][1];
    const duration = data[item][2];

    // Only one item with the same duration
    if(lfxlist.length == 1){
      if(lightCuesWithData[lfxlist[0]]['type'] == "Scenes"){
        await create_scene(groupkey, lfxlist[0], start);
      } else if(lightCuesWithData[lfxlist[0]]['type'] == "Chases"){
        await create_chaser(groupkey, lfxlist[0], start, duration);
      } else {
        console.log(`  Error - Light cue type '${lightCuesWithData[lfxlist[0]]['type']}' not supported. Not quite sure how we\'ve got here.... Oopsie!`)
      }
    // Multiple items with the same duration
    } else {
      // Determine if our list is multiple scenes, muiltiple chasers, or multiple mixed (scenes/chasers)
      let type = '';
      for(lfx in lfxlist){
        if(lfx == 0){
          type = lightCuesWithData[lfxlist[lfx]]['type']
        } else {
          if(lightCuesWithData[lfxlist[lfx]]['type'] != type){
            type = 'Mixed'
          }
        }
      }

      // I had some issue with the setting of names here which is probably why you're confused of my ordering!
      const name = []
      for(lfx in lfxlist){
        name.push(lfxlist[lfx])
      }

      if(type == "Scenes"){
        lightsInScene = []
        for(lfx in lfxlist){
          lfxname = lfxlist[lfx]
          if(!('lightstring' in lightCuesWithData[lfxname])){
            lightCuesWithData[lfxname]['lightstring'] = await methods_light.get_lightstring(qlabconn, lightCuesWithData[lfxname]['number'])
            if(!lightCuesWithData[lfxname]['lightstring']){
              console.log(`  Error - Light string blank for ${lightCuesWithData[lfxname]}`)
              process.exit(1)
            }
          }
          
          const splitLightString = lightCuesWithData[lfxname]['lightstring'].split("\n")
          for(light in splitLightString){
            fixturesetting = splitLightString[light].split("=")[0].trim()
            fixturevalue = parseInt(splitLightString[light].split("=")[1].trim())
            if(!(fixturesetting in lightsInScene)){
              lightsInScene[fixturesetting] = fixturevalue
            } else {
              if(fixturevalue >= lightsInScene[fixturesetting]){
                lightsInScene[fixturesetting] = fixturevalue
              }
            }
          }
        }

        lightsInSceneAsString = ''
        // convert back to string
        for(light in lightsInScene){
          lightsInSceneAsString = lightsInSceneAsString + light + " = " + lightsInScene[light].toString() + "\n"
        }

        let newcue = await methods_cue.create(qlabconn, 'light')
        await methods_cue.set_name(qlabconn, 'selected', name.join(' + '))
        //await methods_cue.set_color(qlabconn, 'selected', 'red')
        await methods_light.set_lightstring(qlabconn, 'selected', lightsInSceneAsString)
        await methods_cue.set_duration(qlabconn, 'selected', '00.000')
        await methods_cue.set_prewait(qlabconn, 'selected', await start)
        await methods_cue.move(qlabconn, newcue, groupkey)
      } else if(type == "Chases"){
        parent = await create_group(qlabconn, 'COMBINE ME CHASES - ' + name.join(' + '))
        await methods_cue.set_color(qlabconn, 'selected', 'red')

        for(lfx in lfxlist){
          await create_chaser(parent, lfxlist[lfx], start, duration);
        }
        await methods_cue.move(qlabconn, parent, groupkey)
      } else if(type == "Mixed"){
        parent = await create_group(qlabconn, 'COMBINE ME MIXED - ' + name.join(' + '))
        await methods_cue.set_color(qlabconn, 'selected', 'red')

        for(lfx in lfxlist){
          if(lightCuesWithData[lfxlist[lfx]]['type'] == "Scenes"){
            await create_scene(parent, lfxlist[lfx], start);
          } else if(lightCuesWithData[lfxlist[lfx]]['type'] == "Chases"){
            await create_chaser(parent, lfxlist[lfx], start, duration);
          }
        }
        await methods_cue.move(qlabconn, parent, groupkey)
      }
    }
  }

  console.log('Finished qlab processing!')
  process.exit(0)

}