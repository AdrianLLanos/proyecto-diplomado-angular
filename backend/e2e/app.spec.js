import {test,expect} from '@playwright/test';
test('sitio público, acceso y pantallas administrativas',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');await expect(page.locator('body')).toContainText('Reservar');
 await page.goto('/login');await page.getByLabel('Correo electrónico').fill('admin@example.test');await page.getByLabel('Contraseña',{exact:true}).fill('Testing-only-123!');await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page).toHaveURL(/dashboard/);
 for(const route of ['modulos/medicos','modulos/pacientes','modulos/citas','modulos/recetas','perfil','configuracion','roles']){
  await page.goto('/'+route);await expect(page.locator('h1').first()).toBeVisible();await expect(page.locator('.error-banner')).toHaveCount(0);
 }
 await expect(page.locator('.nav-item').first()).toHaveCSS('display','flex');
 await page.screenshot({path:'test-results/administracion.png',fullPage:true});expect(errors).toEqual([]);
});
