const { ipcMain } = require('electron');
const { connect } = require('hadouken-js-adapter');

exports = module.exports = new OpenFin();

let runtimes = {};
let processes = {};

function OpenFin() {}

ipcMain.on('openfin-connect', async (event, data) => {
  let version = await Connect(data.runtime);
  event.sender.send('openfin-connected', { runtime: data.runtime, version: version });
});

ipcMain.on('openfin-disconnect', async (event, data) => {
  await Disconnect(data.runtime);
  event.sender.send('openfin-disconnected', { runtime: data.runtime });
});

ipcMain.on('openfin-disconnect-all', async event => {
  for (let runtime in runtimes) {
    console.log(`Disconnecting from ${runtime}`);
    await Disconnect(runtime);
  }
});

ipcMain.on('openfin-subscribe', async (event, data) => {
  await Subscribe(event.sender, data.runtime, data.uuid, data.topic);
});

ipcMain.on('openfin-publish', async (event, data) => {
  await Publish(event.sender, data.runtime, data.topic, data.data);
});

ipcMain.on('openfin-send', async (event, data) => {
  await Send(event.sender, data.runtime, data.uuid, data.topic, data.data);
});

ipcMain.on('openfin-get-process', async (event, data) => {
  await GetProcessInfo(event.sender, data.runtime, data.uuid);
});

async function Connect(runtime) {
  let options = {
    uuid: `openfin-visualizer-${runtime}`,
    runtime: { version: runtime }
  };

  let version;
  try {
    let fin = await connect(options);
    version = await fin.System.getVersion();
    runtimes[runtime] = fin;
    console.log(`Connected to OpenFin version ${version} with runtime ${runtime}`);
  } catch(e) {
    console.log(e);
  }
  return version;
}

async function Disconnect(runtime) {
  try {
    await runtimes[runtime].System.exit();
    console.log(`Disconnected from OpenFin runtime ${runtime}`);
    delete runtimes[runtime];
  } catch(e) {
    console.log(e);
  }
}

async function Subscribe(sender, runtime, targetUuid, topic) {
  await runtimes[runtime].InterApplicationBus.subscribe({ uuid: targetUuid }, topic, (data, uuid, name) => {
    sender.send('openfin-subscribed', {
      runtime: runtime,
      targetUuid: targetUuid,
      uuid: uuid,
      topic: topic,
      message: JSON.stringify(data)
    });
  }).then(() => {
    console.log(`Subscribed to uuid [${targetUuid}] on channel [${runtime}] with topic [${topic}]`);
  }).catch(err => {
    console.log(err);
    sender.send('openfin-subscribe-error', { data: err });
  });
}

async function Publish(sender, runtime, topic, data) {
  await runtimes[runtime].InterApplicationBus.publish(topic, data).then(() => {
    console.log(`Published data [${data}] on channel [${runtime}] with topic [${topic}]`);
  }).catch(err =>  {
    console.log(err);
    sender.send('openfin-publish-error', { data: err });
  });
}

// TODO* not yet working for some reason...
async function Send(sender, runtime, targetUuid, topic, data) {
  await runtimes[runtime].InterApplicationBus.send(targetUuid, topic, data).then(() => {
    console.log(`Sent data [${data}] to uuid [${targetUuid}] on channel [${runtime}] with topic [${topic}]`);
  }).catch(err =>  {
    console.log(err);
    sender.send('openfin-send-error', { data: err });
  });
}

// TODO* getProcessList -> get all objects on current runtime
// OR: getAll[External]Applications for generic application info (uuid, isRunning, and parentUuid)
// TODO* the function is successfully called but getProcessList() is not
async function GetProcessInfo(sender, runtime, uuid) {
    await runtimes[runtime].System.getProcessList(list => {
      let info = list.find(process => {
        return process.uuid === uuid;
      });
      sender.send('openfin-got-process', { runtime: runtime, uuid: uuid, info: info });
    });
}

exports.disconnectAll = async () => {
  for (let runtime in runtimes) {
    // Await disconnect call to ensure OpenFin receives the command
    console.log(`Disconnecting from ${runtime}`);
    await Disconnect(runtime);
  }
}
