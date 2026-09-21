import {defineConfig} from '@playwright/test';
import fs from 'node:fs';
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
export default defineConfig({testDir:'./e2e',workers:1,timeout:30000,use:{baseURL:'http://127.0.0.1:3002',headless:true,launchOptions:fs.existsSync(edge)?{executablePath:edge}:{}},webServer:{command:'node scripts/test-server.js',url:'http://127.0.0.1:3002/api/health',timeout:60000,reuseExistingServer:false}});
