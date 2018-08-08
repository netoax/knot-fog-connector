/* eslint-disable no-console */
// Infrastructure
import Settings from 'data/Settings';
import DeviceStore from 'data/DeviceStore';
import ConnectorFactory from 'network/ConnectorFactory';
import FogConnector from 'network/FogConnector';

// Domain
import UpdateDevices from 'interactors/UpdateDevices';
import LoadDevices from 'interactors/LoadDevices';
import UpdateChanges from 'interactors/UpdateChanges';
import DevicesService from 'services/DevicesService';

const settings = new Settings();
const deviceStore = new DeviceStore();

async function main() {
  const fogCredentials = await settings.getFogCredentials();
  const fogAddress = await settings.getFogAddress();
  const cloudSettings = await settings.getCloudSettings();
  const cloudType = await settings.getCloudType();

  try {
    let fog;
    const cloud = ConnectorFactory.create(cloudType, cloudSettings);
    if (fogCredentials.uuid && fogCredentials.token) {
      fog = new FogConnector(
        fogAddress.host,
        fogAddress.port,
        fogCredentials.uuid,
        fogCredentials.token,
      );

      await fog.connect();
      await cloud.start();
    } else {
      throw Error('Missing uuid and token');
    }

    const updateDevices = new UpdateDevices(deviceStore, fog, cloud);
    const loadDevices = new LoadDevices(deviceStore, cloud);
    const updateChanges = new UpdateChanges(deviceStore, cloud);
    const devicesService = new DevicesService(updateDevices, loadDevices, updateChanges);

    await devicesService.load();

    await fog.on('config', async (device) => {
      const deviceMapped = _.omit(device, ['uuid', '_id', 'owner', 'type', 'ipAddress', 'token', 'meshblu', 'discoverWhitelist', 'configureWhitelist']);
      console.log('---config---');
      console.log(deviceMapped);
      await devicesService.updateProperties();
    });

    setInterval(devicesService.update.bind(devicesService), 5000);
  } catch (err) {
    console.error(err);
  }
}

main();
