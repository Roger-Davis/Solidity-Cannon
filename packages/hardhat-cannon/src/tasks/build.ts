import path from 'path';
import { task } from 'hardhat/config';
import { TASK_COMPILE } from 'hardhat/builtin-tasks/task-names';
import { ethers } from 'ethers';
import { build, runRpc, parseSettings, loadCannonfile } from '@usecannon/cli';
import { TASK_BUILD } from '../task-names';
import { CANNON_NETWORK_NAME } from '../constants';
import { augmentProvider } from '../internal/augment-provider';
import { getHardhatSigners } from '../internal/get-hardhat-signers';
import { getProvider, RpcOptions} from '@usecannon/cli/dist/src/rpc';
import { CannonWrapperGenericProvider } from '@usecannon/builder';
import { HttpNetworkConfig } from 'hardhat/types';

import { yellow } from 'chalk';

task(TASK_BUILD, 'Assemble a defined chain and save it to to a state which can be used later')
  .addPositionalParam('cannonfile', 'Path to a cannonfile to build', 'cannonfile.toml')
  .addOptionalVariadicPositionalParam('settings', 'Custom settings for building the cannonfile', [])
  .addOptionalParam(
    'upgradeFrom',
    'Wipe the deployment files, and use the deployment files from another cannon package as base'
  )
  .addOptionalParam('preset', 'The preset label for storing the build with the given settings', 'main')
  .addOptionalParam('writeDeployments', 'Path to write the deployments data (address and ABIs), like "./deployments"')
  .addOptionalParam('impersonate', 'When dry running, uses forked signers rather than actual signing keys')
  .addFlag('noCompile', 'Do not execute hardhat compile before build')
  .addFlag('dryRun', 'Run a shadow deployment on a local forked node instead of actually deploying')
  .addFlag('wipe', 'Do not reuse any previously built artifacts')
  .setAction(async ({ cannonfile, settings, upgradeFrom, preset, noCompile, wipe, writeDeployments, dryRun, impersonate }, hre) => {

    if (!noCompile) {
      await hre.run(TASK_COMPILE);
      console.log('');
    }

    // If the first param is not a cannonfile, it should be parsed as settings
    if (typeof cannonfile === 'string' && !cannonfile.endsWith('.toml')) {
      settings.unshift(cannonfile);
      cannonfile = 'cannonfile.toml';
    }

    const cannonfilePath = path.resolve(hre.config.paths.root, cannonfile);
    const parsedSettings = parseSettings(settings);

    const { name, version } = await loadCannonfile(path.join(hre.config.paths.root, cannonfile));

    const providerUrl = (hre.network.config as HttpNetworkConfig).url;

    let provider = new CannonWrapperGenericProvider({}, new ethers.providers.JsonRpcProvider(providerUrl));

    if (dryRun || hre.network.name === 'cannon') {
      const opts: RpcOptions = { port: hre.config.networks.cannon.port };

      if (dryRun) {
        opts.chainId = (await hre.ethers.provider.getNetwork()).chainId;
        opts.forkUrl = providerUrl;
      }

      const node = await runRpc(opts);
      provider = getProvider(node);
    }

    let signers: ethers.Signer[] = [];
    if (!impersonate) {
      signers = getHardhatSigners(hre, provider);
    }

    let defaultSigner: ethers.Signer | null = null;
    if (impersonate) {
      await provider.send('hardhat_impersonateAccount', [impersonate]);
      await provider.send('hardhat_setBalance', [impersonate, `0x${(1e22).toString(16)}`]);
      defaultSigner = provider.getSigner(impersonate);
    } else if (hre.network.name !== CANNON_NETWORK_NAME) {
      defaultSigner = signers[0].connect(provider);
    }

    if (defaultSigner) {
      // print out any live deployment info that might be relevant
      console.log(yellow(`default signer is ${await defaultSigner.getAddress()}`));
    }

    const params = {
      cannonfilePath,
      provider,
      packageDefinition: {
        name,
        version,
        settings: parsedSettings,
      },
      getArtifact: (contractName: string) => hre.artifacts.readArtifact(contractName),
      async getSigner(addr: string) {
        if (impersonate) {
          // on test network any user can be conjured
          await provider.send('hardhat_impersonateAccount', [addr]);
          await provider.send('hardhat_setBalance', [addr, `0x${(1e22).toString(16)}`]);
          return provider.getSigner(addr);
        } else {
          // return the actual signer with private key
          for (const signer of signers) {
            if (addr.toLowerCase() === (await signer.getAddress()).toLowerCase()) {
              return signer.connect(provider);
            }
          }
      
          throw new Error(
            `the current step requests usage of the signer with address ${addr}, but this signer is not found. Please either supply the private key, or change the cannon configuration to use a different signer.`
          );
        }
      },
      getDefaultSigner: defaultSigner ? async () => defaultSigner! : undefined,
      projectDirectory: hre.config.paths.root,
      preset,
      upgradeFrom,
      wipe,
      deploymentPath: writeDeployments ? path.resolve(writeDeployments) : undefined,
      persist: !dryRun
    } as const;

    const { outputs } = await build(params);

    //const signers: ethers.Signer[] = [];

    augmentProvider(hre, outputs);

    return { outputs, provider, signers };
  });
