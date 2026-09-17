const path = require('path');
const { build, Platform, Arch } = require('electron-builder');

const projectPath = '/home/claude/rec/lw/proj';
const appPath = '/home/claude/rec/lw/app';
const outputPath = '/home/claude/rec/lw/out';

// Disable code signing auto-discovery for both platforms
process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';

const commonConfig = {
  appId: 'com.lanowrites.desktop',
  productName: 'LanoWrites',
  copyright: 'Copyright (c) 2026 anbulano — MIT License',
  electronVersion: '40.10.6',
  directories: {
    output: outputPath,
    buildResources: path.join(projectPath, 'assets')
  },
  fileAssociations: [
    {
      ext: 'lanowrites',
      name: 'LanoWrites Project',
      description: 'LanoWrites screenplay project',
      icon: path.join(projectPath, 'assets/icon.ico'),
      role: 'Editor'
    },
    {
      ext: 'scenecraft',
      name: 'LanoWrites Project (older format)',
      description: 'Older SceneCraft screenplay project',
      icon: path.join(projectPath, 'assets/icon.ico'),
      role: 'Editor'
    }
  ],
  publish: null
};

// Windows-specific configuration
const windowsConfig = {
  ...commonConfig,
  win: {
    target: ['nsis'],
    icon: path.join(projectPath, 'assets/icon.ico'),
    executableName: 'LanoWrites',
    signAndEditExecutable: false,
    signExecutable: false,
    requestedExecutionLevel: 'asInvoker'
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'LanoWrites',
    runAfterFinish: true,
    deleteAppDataOnUninstall: false,
    license: path.join(projectPath, 'LICENSE.txt'),
    include: path.join(projectPath, 'build', 'file-association.nsh'),
    artifactName: 'LanoWrites-Setup-${version}.${ext}'
  }
};

// macOS-specific configuration
const macConfig = {
  ...commonConfig,
  mac: {
    target: ['dmg'],
    icon: path.join(projectPath, 'assets/icon.icns'),
    category: 'public.app-category.productivity',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    signAndEditExecutable: false,
    signExecutable: false,
    identity: null
  },
  dmg: {
    contents: [
      {
        x: 110,
        y: 150,
        type: 'file'
      },
      {
        x: 240,
        y: 150,
        type: 'link',
        path: '/Applications'
      }
    ],
    window: {
      width: 540,
      height: 380
    }
  }
};

// Build targets: Windows and macOS
const buildTargets = [
  { platform: Platform.WINDOWS, arch: Arch.x64, config: windowsConfig, name: 'Windows' },
  { platform: Platform.MAC, arch: Arch.x64, config: macConfig, name: 'macOS' }
];

// Sequential builds for Windows and macOS
async function buildAll() {
  for (const target of buildTargets) {
    console.log(`\n========================================`);
    console.log(`Building for ${target.name}...`);
    console.log(`========================================\n`);

    try {
      await build({
        projectDir: projectPath,
        prepackaged: appPath,
        targets: target.platform.createTarget(
          target.platform === Platform.WINDOWS ? 'nsis' : 'dmg',
          target.arch
        ),
        config: target.config
      });

      console.log(`✅ ${target.name} build completed successfully\n`);
    } catch (error) {
      console.error(`❌ ${target.name} build failed:`);
      console.error(error);
      process.exit(1);
    }
  }

  console.log(`\n========================================`);
  console.log(`✅ All builds completed successfully!`);
  console.log(`========================================`);
  console.log(`Output location: ${outputPath}`);
  process.exit(0);
}

buildAll().catch(error => {
  console.error('Build process failed:', error);
  process.exit(1);
});
