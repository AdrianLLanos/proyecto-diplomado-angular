import {createClient} from '@supabase/supabase-js';
import {config} from './config.js';
import {fail} from './validation.js';

let client;
export function radiographyStorage(){
 if(!config.supabaseUrl||!config.supabaseSecretKey) fail('El almacenamiento de radiografías aún no está configurado',503);
 client ||= createClient(config.supabaseUrl,config.supabaseSecretKey,{auth:{autoRefreshToken:false,persistSession:false}});
 return client.storage.from(config.storageBucket);
}
