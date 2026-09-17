const path=require('path');const {build,Platform,Arch}=require('/home/claude/rec/bld/node_modules/electron-builder');
const P='/home/claude/rec/lw/proj';process.env.CSC_IDENTITY_AUTO_DISCOVERY='false';
build({projectDir:P,prepackaged:'/home/claude/rec/lw/app',targets:Platform.WINDOWS.createTarget('nsis',Arch.x64),config:{
 appId:'com.lanowrites.desktop',productName:'LanoWrites',copyright:'Copyright (c) 2026 anbulano — MIT License',electronVersion:'40.10.6',
 directories:{output:'/home/claude/rec/lw/out',buildResources:path.join(P,'assets')},
 fileAssociations:[{ext:'lanowrites',name:'LanoWrites Project',description:'LanoWrites screenplay project',icon:path.join(P,'assets/icon.ico'),role:'Editor'},{ext:'scenecraft',name:'LanoWrites Project (older format)',description:'Older SceneCraft screenplay project',icon:path.join(P,'assets/icon.ico'),role:'Editor'}],
 win:{target:['nsis'],icon:path.join(P,'assets/icon.ico'),executableName:'LanoWrites',signAndEditExecutable:false,signExecutable:false,requestedExecutionLevel:'asInvoker'},
 nsis:{oneClick:false,perMachine:false,allowElevation:false,allowToChangeInstallationDirectory:true,createDesktopShortcut:true,createStartMenuShortcut:true,shortcutName:'LanoWrites',runAfterFinish:true,deleteAppDataOnUninstall:false,license:'/home/claude/rec/lw/LICENSE.txt',include:path.join(P,'build','file-association.nsh'),artifactName:'LanoWrites-Setup-${version}.${ext}'},
 publish:null}}).then(()=>console.log('done')).catch(e=>{console.error(e);process.exit(1)});
