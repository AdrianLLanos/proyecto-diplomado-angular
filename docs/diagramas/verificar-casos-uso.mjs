import { chromium } from 'playwright';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const dir=path.dirname(fileURLToPath(import.meta.url));
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();
 await page.goto(pathToFileURL(path.join(dir,'casos-de-uso.html')).href);
 const measurements=[];
 for(const [width,height] of [[1440,900],[1600,1000],[1920,1080],[2048,1320]]){
  await page.setViewportSize({width,height});
  measurements.push(await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight})));
 }
 assert(measurements.every(m=>m.scrollWidth<=m.width&&m.scrollHeight<=m.height));
 assert.equal(await page.locator('.use-case').count(),9);
 assert.equal(await page.locator('.actor').count(),3);
 assert.equal(await page.locator('.association').count(),10);
 const fit=await page.locator('.use-case').evaluateAll(groups=>groups.every(g=>{const e=g.querySelector('ellipse').getBBox(),t=g.querySelector('text').getBBox();return t.x>e.x&&t.x+t.width<e.x+e.width&&t.y>e.y&&t.y+t.height<e.y+e.height}));
 assert(fit,'Labels must fit inside ellipses');
 await page.pdf({path:path.join(dir,'casos-de-uso.pdf'),format:'Letter',printBackground:true,preferCSSPageSize:true,margin:{top:0,right:0,bottom:0,left:0}});
 await page.setViewportSize({width:1000,height:1250});
 await page.locator('svg').screenshot({path:path.join(dir,'casos-de-uso.png')});
 const receipt={diagram_type:'uml-use-case',validation:'Custom semantic and browser checks passed: 3 actors, 9 use cases, 10 associations; labels fit.',archify_validation:'Not applicable: installed Archify schemas do not support UML use-case notation. Custom SVG adaptation.',browser_evidence:'Supplementary Playwright inspection; not an Archify visual-check receipt.',measurements,visual_review:'pending',artifacts:Object.fromEntries(['json','html','svg','pdf','png'].map(ext=>{const name='casos-de-uso.'+ext,b=fs.readFileSync(path.join(dir,name));return [name,{bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}]}))};
 fs.writeFileSync(path.join(dir,'casos-de-uso.verificacion.json'),JSON.stringify(receipt,null,2));
 console.log(JSON.stringify(receipt,null,2));
} finally {await browser.close();}
