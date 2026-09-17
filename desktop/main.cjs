const {app,BrowserWindow,ipcMain,dialog,Menu,shell}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises'),crypto=require('node:crypto');
app.setName('LanoWrites');app.setAppUserModelId('com.lanowrites.desktop');
// One-time migration: copy the library/settings of an earlier SceneCraft install (never moves or deletes it).
if(!process.env.SCENECRAFT_TEST_DATA){try{const fsx=require('node:fs');const base=app.getPath('appData');const from=path.join(base,'SceneCraft','profile1'),to=path.join(base,'LanoWrites','profile1');
 if(fsx.existsSync(from)&&!fsx.existsSync(to)){const skip=new Set(['Cache','Code Cache','GPUCache','DawnGraphiteCache','DawnWebGPUCache','Crashpad','blob_storage','Shared Dictionary','SingletonLock','SingletonCookie','SingletonSocket','lockfile']);
  fsx.cpSync(from,to,{recursive:true,filter:src=>!skip.has(path.basename(src))});}}catch(e){console.error('migration',e.message);}}
if(process.env.SCENECRAFT_TEST_DATA)app.setPath('userData',process.env.SCENECRAFT_TEST_DATA);
// Move to a dedicated profile subfolder. A corrupted Chromium disk cache/LevelDB store
// (e.g. from the OS or a previous crash killing the process mid-write) can make Electron's
// renderer fail to paint anything at all on every future launch, with no JS error to catch.
// Isolating our data in a subfolder lets that be recovered from by clearing just this folder,
// without touching saved screenplay data, which lives in library.json/file-bindings.json here.
else app.setPath('userData',path.join(app.getPath('userData'),'profile1'));
let win,bindings={},queue=Promise.resolve();
const MAX=50*1024*1024;
const TAGS=[['cast','Cast'],['extras','Extras / background'],['stunts','Stunts'],['props','Props'],['wardrobe','Wardrobe / costume'],['makeup','Makeup / hair'],['vehicles','Vehicles'],['animals','Animals'],['sfx','Special effects'],['vfx','Visual effects'],['sound','Sound / music'],['sets','Set dressing'],['equipment','Special equipment'],['notes','Production notes']];
const PROJ_RX=/\.(lanowrites|scenecraft)$/i;
const OPEN_EXTS=['.lanowrites','.scenecraft','.kit','.kitsp','.fdx','.osf','.fadein','.fountain','.txt'];
function argvFile(argv){for(const a of argv.slice(1)){if(OPEN_EXTS.includes(path.extname(a).toLowerCase()))return a;}return null;}
let pendingOpenPath=argvFile(process.argv);
async function atomic(file,text,backup=false){await fs.mkdir(path.dirname(file),{recursive:true});const tmp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(tmp,text,'utf8');if(backup){try{await fs.copyFile(file,file+'.bak');}catch(e){if(e.code!=='ENOENT')throw e;}}await fs.rename(tmp,file);}finally{await fs.unlink(tmp).catch(()=>{});}}
const gotLock=app.requestSingleInstanceLock();
if(!gotLock){app.quit();}else{
app.on('second-instance',(event,argv)=>{
  if(!win)return;
  if(win.isMinimized())win.restore();
  win.focus();
  const file=argvFile(argv);
  if(file)openFileForRenderer(file).then(payload=>{if(payload)win.webContents.send('open-file',payload);}).catch(()=>{});
});
async function openFileForRenderer(file){
  const stat=await fs.stat(file);if(stat.size>MAX)throw Error('Please open a file smaller than 50 MB.');
  let fileId=null;if(PROJ_RX.test(file)){fileId=crypto.randomUUID();bindings[fileId]=file;const bindingPath=path.join(app.getPath('userData'),'file-bindings.json');await atomic(bindingPath,JSON.stringify(bindings));}
  return {name:path.basename(file),bytes:new Uint8Array(await fs.readFile(file)),fileId};
}
app.whenReady().then(async()=>{
 const libraryPath=path.join(app.getPath('userData'),'library.json'),bindingPath=path.join(app.getPath('userData'),'file-bindings.json');
 try{bindings=JSON.parse(await fs.readFile(bindingPath,'utf8'));}catch{}
 win=new BrowserWindow({width:1500,height:1000,minWidth:900,minHeight:650,show:!process.env.SCENECRAFT_TEST_DATA,title:'LanoWrites',icon:path.join(__dirname,'../assets/icon.ico'),backgroundColor:'#ffffff',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 const check=(event)=>{if(event.sender!==win.webContents)throw Error('Invalid sender');};
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());
 // The screenplay page has its own zoom. Keep the application chrome at 100% so Ctrl+wheel, pinch
 // and Ctrl+/- only zoom the paper (handled in the renderer).
 Menu.setApplicationMenu(Menu.buildFromTemplate([
   {label:'Edit',submenu:[{role:'cut'},{role:'copy'},{role:'paste'},{role:'pasteAndMatchStyle'},{role:'selectAll'}]},
   {label:'View',submenu:[{role:'toggleDevTools',accelerator:'Ctrl+Shift+I'},{role:'togglefullscreen'}]},
 ]));
 win.webContents.setVisualZoomLevelLimits(1,1).catch(()=>{});
 win.webContents.on('did-finish-load',()=>{win.webContents.setZoomFactor(1);});
 win.webContents.on('zoom-changed',()=>{win.webContents.setZoomFactor(1);});
 const ses=win.webContents.session,dataDir=app.getPath('userData');
 // ---------- Spell check & writing tools ----------
 const prefsPath=path.join(dataDir,'writing-tools.json');
 let writing={spellcheck:true,languages:['en-US']};
 try{writing={...writing,...JSON.parse(await fs.readFile(prefsPath,'utf8'))};}catch{}
 const applySpell=()=>{try{ses.setSpellCheckerEnabled(!!writing.spellcheck);const available=ses.availableSpellCheckerLanguages||[];const langs=(writing.languages||[]).filter(l=>!available.length||available.includes(l));if(langs.length)ses.setSpellCheckerLanguages(langs);}catch(e){console.error('spellcheck',e.message);}};
 applySpell();
 ipcMain.handle('writing-get',async event=>{check(event);let words=[];try{words=await ses.listWordsInSpellCheckerDictionary();}catch{}return {...writing,available:ses.availableSpellCheckerLanguages||[],words:words.sort((a,b)=>a.localeCompare(b))};});
 ipcMain.handle('writing-set',async(event,value)=>{check(event);if(!value||typeof value!=='object')throw Error('Invalid settings');writing={spellcheck:!!value.spellcheck,languages:Array.isArray(value.languages)?value.languages.filter(l=>typeof l==='string'&&l.length<12).slice(0,6):['en-US']};applySpell();await atomic(prefsPath,JSON.stringify(writing));return true;});
 ipcMain.handle('dictionary-add',(event,words)=>{check(event);const list=(Array.isArray(words)?words:[words]).filter(w=>typeof w==='string'&&w.trim()&&w.length<60).slice(0,2000);let added=0;for(const w of list){try{if(ses.addWordToSpellCheckerDictionary(w.trim()))added++;}catch{}}return added;});
 ipcMain.handle('dictionary-remove',(event,word)=>{check(event);if(typeof word!=='string')return false;try{return ses.removeWordFromSpellCheckerDictionary(word);}catch{return false;}});
 win.webContents.on('context-menu',(event,params)=>{
   const items=[];
   if(params.misspelledWord){
     for(const suggestion of params.dictionarySuggestions.slice(0,6))items.push({label:suggestion,click:()=>win.webContents.replaceMisspelling(suggestion)});
     if(!params.dictionarySuggestions.length)items.push({label:'No spelling suggestions',enabled:false});
     items.push({label:`Add "${params.misspelledWord}" to dictionary`,click:()=>{ses.addWordToSpellCheckerDictionary(params.misspelledWord);win.webContents.send('context-action',{type:'dictionary-changed'});}},{type:'separator'});
   }
   if(params.isEditable&&params.selectionText.trim()){
     items.push({label:'Tag as production element',submenu:TAGS.map(([id,label])=>({label,click:()=>win.webContents.send('context-action',{type:'tag',cat:id})})).concat([{type:'separator'},{label:'Remove tag',click:()=>win.webContents.send('context-action',{type:'tag',cat:null})}])},{type:'separator'});
   }
   if(params.isEditable||params.selectionText)items.push({role:'cut',enabled:params.editFlags.canCut},{role:'copy',enabled:params.editFlags.canCopy},{role:'paste',enabled:params.editFlags.canPaste},{type:'separator'},{role:'selectAll'});
   if(params.isEditable&&params.selectionText.trim())items.push({type:'separator'},{label:'Find in script',click:()=>win.webContents.send('context-action',{type:'find',text:params.selectionText.slice(0,120)})});
   if(items.length)Menu.buildFromTemplate(items).popup({window:win});
 });
 // ---------- Version history (one folder per project, one file per version) ----------
 const historyRoot=path.join(dataDir,'history');
 const projectDir=id=>{if(typeof id!=='string'||!/^[-\w]{1,128}$/.test(id))throw Error('Invalid project id');return path.join(historyRoot,id);};
 const versionFile=(pid,vid)=>{if(typeof vid!=='string'||!/^[-\w]{1,128}$/.test(vid))throw Error('Invalid version id');return path.join(projectDir(pid),vid+'.json');};
 const indexFile=pid=>path.join(projectDir(pid),'index.json');
 const readIndex=async pid=>{try{return JSON.parse(await fs.readFile(indexFile(pid),'utf8'));}catch{return [];}};
 let historyQueue=Promise.resolve();
 ipcMain.handle('history-list',async(event,pid)=>{check(event);return readIndex(pid);});
 ipcMain.handle('history-load',async(event,pid,vid)=>{check(event);try{return await fs.readFile(versionFile(pid,vid),'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}});
 ipcMain.handle('history-save',(event,pid,text,limit)=>{check(event);if(typeof text!=='string'||text.length>MAX)throw Error('Invalid version');const v=JSON.parse(text);if(v.projectId!==pid)throw Error('Version does not match project');
   historyQueue=historyQueue.catch(()=>{}).then(async()=>{await atomic(versionFile(pid,v.id),text);const {data,...meta}=v;let index=[meta,...(await readIndex(pid)).filter(x=>x.id!==v.id)];const max=Math.max(10,Math.min(500,Number(limit)||150));
     const keep=[],drop=[];for(const item of index){(keep.length<max||item.kind==='manual'?keep:drop).push(item);}
     for(const item of drop)await fs.unlink(versionFile(pid,item.id)).catch(()=>{});await atomic(indexFile(pid),JSON.stringify(keep));});
   return historyQueue;});
 // ---------- Backups beside the opened project: "<Project> Backups/<Project> 2026-09-17 10-45 (Autosave).lanowrites"
 const BACKUP_RX=/ - Backup (\d{2})-(\d{2})-(\d{4}) (\d{2})-(\d{2})-(\d{2}) (AM|PM) - (.*)\.(?:lanowrites|scenecraft)$/i;
 const parseStamp=f=>{const m=f.match(BACKUP_RX);if(!m)return 0;let h=Number(m[4])%12;if(m[7].toUpperCase()==='PM')h+=12;return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),h,Number(m[5]),Number(m[6])).getTime();};
 const backupDir=fileId=>{const target=typeof fileId==='string'?bindings[fileId]:null;if(!target)return null;const base=path.basename(target).replace(PROJ_RX,'');return {dir:path.join(path.dirname(target),base+' Backups'),base};};
 const safeName=name=>{if(typeof name!=='string'||!/^[^\\/:*?"<>|]{1,200}\.(?:lanowrites|scenecraft)$/i.test(name))throw Error('Invalid backup name');return name;};
 ipcMain.handle('backup-info',(event,fileId)=>{check(event);const b=backupDir(fileId);return b?{folder:b.dir}:null;});
 ipcMain.handle('backup-write',async(event,fileId,text,label)=>{check(event);const b=backupDir(fileId);if(!b)return null;if(typeof text!=='string'||Buffer.byteLength(text)>MAX)throw Error('Invalid backup');JSON.parse(text);
   const d=new Date(),pad=n=>String(n).padStart(2,'0');const h12=d.getHours()%12||12;const stamp=`${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()} ${pad(h12)}-${pad(d.getMinutes())}-${pad(d.getSeconds())} ${d.getHours()<12?'AM':'PM'}`;
   const clean=String(label||'Backup').replace(/[\\/:*?"<>|()]/g,' ').replace(/\s+/g,' ').trim().slice(0,60);
   const name=`${b.base} - Backup ${stamp} - ${clean}.lanowrites`;await atomic(path.join(b.dir,name),text);
   const files=(await fs.readdir(b.dir).catch(()=>[])).filter(f=>PROJ_RX.test(f)).sort();
   const autos=files.filter(f=>/ - (Autosave|Opened[^.]*|Before closing|Switched project)\.(?:lanowrites|scenecraft)$/i.test(f)).map(f=>({f,t:parseStamp(f)})).sort((x,y)=>x.t-y.t).map(x=>x.f);
   for(const f of autos.slice(0,Math.max(0,autos.length-200)))await fs.unlink(path.join(b.dir,f)).catch(()=>{});
   return {name,folder:b.dir};});
 ipcMain.handle('backup-list',async(event,fileId)=>{check(event);const b=backupDir(fileId);if(!b)return [];const files=(await fs.readdir(b.dir).catch(()=>[])).filter(f=>PROJ_RX.test(f));
   const out=[];for(const f of files){try{const st=await fs.stat(path.join(b.dir,f));const m=f.match(BACKUP_RX);const t=parseStamp(f);out.push({name:f,size:st.size,createdAt:new Date(t||st.mtime).toISOString(),label:m?m[8]:f.replace(PROJ_RX,'')});}catch{}}
   return out.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));});
 ipcMain.handle('backup-read',async(event,fileId,name)=>{check(event);const b=backupDir(fileId);if(!b)return null;return fs.readFile(path.join(b.dir,safeName(name)),'utf8');});
 ipcMain.handle('backup-delete',async(event,fileId,name)=>{check(event);const b=backupDir(fileId);if(!b)return false;await fs.unlink(path.join(b.dir,safeName(name))).catch(()=>{});return true;});
 ipcMain.handle('backup-open-folder',async(event,fileId)=>{check(event);const b=backupDir(fileId);if(!b)return false;await fs.mkdir(b.dir,{recursive:true});await shell.openPath(b.dir);return true;});
 ipcMain.handle('save-many',async(event,files)=>{check(event);if(!Array.isArray(files)||!files.length||files.length>60)throw Error('Invalid files');const r=await dialog.showOpenDialog(win,{title:'Choose a folder for the reports',properties:['openDirectory','createDirectory']});if(r.canceled)return 0;let n=0;for(const f of files){if(typeof f?.name!=='string'||typeof f?.text!=='string'||Buffer.byteLength(f.text)>MAX)continue;const name=f.name.replace(/[\\/:*?"<>|\x00-\x1F]/g,'-').slice(0,180);await atomic(path.join(r.filePaths[0],name),f.text);n++;}return n;});
 ipcMain.handle('history-remove',(event,pid,vid)=>{check(event);historyQueue=historyQueue.catch(()=>{}).then(async()=>{await fs.unlink(versionFile(pid,vid)).catch(()=>{});await atomic(indexFile(pid),JSON.stringify((await readIndex(pid)).filter(x=>x.id!==vid)));});return historyQueue;});
 ipcMain.handle('load-library',async event=>{check(event);try{return await fs.readFile(libraryPath,'utf8');}catch(e){if(e.code==='ENOENT')return null;throw e;}});
 ipcMain.handle('save-library',(event,text)=>{check(event);if(typeof text!=='string'||text.length>MAX)throw Error('Invalid library');JSON.parse(text);queue=queue.catch(()=>{}).then(()=>atomic(libraryPath,text));return queue;});
 ipcMain.handle('open-project',async event=>{
   check(event);const result=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Screenplays',extensions:['lanowrites','scenecraft','kit','kitsp','fdx','osf','fadein','fountain','txt','json']}]});
   if(result.canceled)return null;return await openFileForRenderer(result.filePaths[0]);
 });
 ipcMain.handle('get-pending-open',async event=>{check(event);const file=pendingOpenPath;pendingOpenPath=null;if(!file)return null;try{return await openFileForRenderer(file);}catch(e){return null;}});
 ipcMain.handle('save-project',async(event,{text,name,fileId,saveAs})=>{
   check(event);if(typeof text!=='string'||Buffer.byteLength(text)>MAX||typeof name!=='string')throw Error('Invalid project');const p=JSON.parse(text);if(p.version!==1||!Array.isArray(p.blocks))throw Error('Invalid LanoWrites project');
   let target=typeof fileId==='string'?bindings[fileId]:null;
   const asNew=p=>String(p).replace(PROJ_RX,'')+'.lanowrites';
   // Projects opened from an older .scenecraft file are saved as a .lanowrites file next to it; the old file is left untouched.
   if(target&&!saveAs&&/\.scenecraft$/i.test(target)){const up=asNew(target);let exists=true;try{await fs.access(up);}catch{exists=false;}if(exists)saveAs=true;else{target=up;fileId=crypto.randomUUID();}}
   if(!target||saveAs){const result=await dialog.showSaveDialog(win,{defaultPath:asNew(target||name),filters:[{name:'LanoWrites project',extensions:['lanowrites']}]});if(result.canceled)return null;target=asNew(result.filePath);fileId=crypto.randomUUID();}
   await atomic(target,text,true);bindings[fileId]=target;await atomic(bindingPath,JSON.stringify(bindings));return {fileId,name:path.basename(target)};
 });
 ipcMain.handle('save-file',async(event,{text,name})=>{check(event);if(typeof text!=='string'||Buffer.byteLength(text)>MAX||typeof name!=='string')throw Error('Invalid export');const ext=path.extname(name).slice(1)||'txt';const result=await dialog.showSaveDialog(win,{defaultPath:name,filters:[{name:ext.toUpperCase(),extensions:[ext]}]});if(result.canceled)return false;await atomic(result.filePath,text);return true;});
 ipcMain.handle('export-pdf',async(event,{name,pageSize,landscape})=>{
   check(event);if(typeof name!=='string')throw Error('Invalid export name');
   const result=await dialog.showSaveDialog(win,{defaultPath:name.toLowerCase().endsWith('.pdf')?name:name+'.pdf',filters:[{name:'PDF document',extensions:['pdf']}]});
   if(result.canceled)return false;
   // Generate the PDF via Electron's own Chromium PDF writer instead of routing through the OS print
   // dialog: some third-party virtual print drivers (e.g. Adobe PDF) mis-rasterize this app's CSS layout,
   // silently dropping content and leaving large blank areas on the page. printToPDF renders the same
   // way the on-screen preview does, and preferCSSPageSize honors the @page rule this app sets for the
   // chosen paper size, so the exported page always matches what was actually laid out.
   const data=await win.webContents.printToPDF({pageSize:pageSize==='Letter'?'Letter':'A4',preferCSSPageSize:true,printBackground:true,margins:{marginType:'none'},landscape:!!landscape});
   await fs.writeFile(result.filePath,data);
   return true;
 });
 win.loadFile(path.join(__dirname,'../dist/index.html'));
});
app.on('window-all-closed',()=>{queue.finally(()=>app.quit());});
}
