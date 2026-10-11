import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const dir=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(new URL('../../backend/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},acceptDownloads:true,colorScheme:'light'});
 await page.goto(pathToFileURL(path.join(dir,'arquitectura.html')).href+'?theme=light');
 for(const [format,file]of [['png','arquitectura-original.png'],['svg','arquitectura.svg']]){
  await page.getByRole('button',{name:/^Export/}).click();
  const downloading=page.waitForEvent('download');
  await page.locator(`button[data-format="${format}"]`).click();
  await (await downloading).saveAs(path.join(dir,file));
 }
 const original=fs.readFileSync(path.join(dir,'arquitectura-original.png')).toString('base64');
 const result=await page.evaluate(async base64=>{
  const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1920,1080);
  const scale=Math.min(1920/img.width,1080/img.height);const w=img.width*scale,h=img.height*scale;
  ctx.drawImage(img,(1920-w)/2,(1080-h)/2,w,h);
  return {data:canvas.toDataURL('image/png').split(',')[1],original:[img.width,img.height]};
 },original);
 fs.writeFileSync(path.join(dir,'arquitectura-actualizada.png'),Buffer.from(result.data,'base64'));
 console.log(JSON.stringify({png:'arquitectura-actualizada.png',size:[1920,1080],original:result.original,vector:'arquitectura.svg'}));
}finally{await browser.close();}
