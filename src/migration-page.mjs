import {planMigration,commitMigration} from './migration.mjs';
const $=id=>document.getElementById(id);let plan=null;
function message(text){$('migrationStatus').textContent=text;}
function clear(){plan=null;$('applyMigration').disabled=true;}
function review(kind,text){
  clear();try{plan=planMigration(localStorage,kind,text);message(plan.summary+' Select Import reviewed data to continue.');$('applyMigration').disabled=false;}
  catch(e){message(e.message);}
}
$('reviewPatients').onclick=()=>review('patients');
$('reviewCalibration').onclick=()=>review('calibration');
$('migrationKind').onchange=()=>{clear();$('migrationFile').value='';message('Choose a JSON backup to review.');};
$('migrationFile').onchange=async()=>{
  clear();const file=$('migrationFile').files?.[0];if(!file)return;
  try{if(file.size>5*1024*1024)throw Error('File must be smaller than 5 MiB.');review($('migrationKind').value,await file.text());}
  catch(e){message(e.message);}
};
$('applyMigration').onclick=()=>{
  if(!plan)return;
  try{message('Imported. '+commitMigration(localStorage,plan)+' Reload any open Oculid tabs to use the imported data.');clear();}
  catch(e){clear();message(e.message);}
};
