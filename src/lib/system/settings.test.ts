import {describe,test} from 'node:test';
import {strict as assert} from 'node:assert';
import {defaults,settingsSchema,safeLink,mediaPaths,parseSettings,contrastText} from './settings';
describe('System Management safety',()=>{
 test('rejects executable and external protocol-relative CTA destinations',()=>{for(const url of ['javascript:alert(1)','//evil.test','/\\evil.test','data:text/html,a'])assert.equal(safeLink.safeParse(url).success,false);assert.equal(safeLink.safeParse('/auth').success,true);});
 test('only referenced logo favicon and landing images are eligible for public delivery',()=>{const s=structuredClone(defaults);s.brand.logo='abc.png';s.brand.favicon='def.ico';s.landing.image='ghi.jpg';assert.deepEqual(mediaPaths(s),['abc.png','def.ico','ghi.jpg']);assert.equal(mediaPaths(s).includes('draft.png'),false);});
 test('rejects SVG and file paths in media settings',()=>{const s=structuredClone(defaults);s.brand.logo='image.svg';assert.equal(settingsSchema.safeParse(s).success,false);s.brand.logo='../private.png';assert.equal(settingsSchema.safeParse(s).success,false);});
 test('supports private draft changes without changing defaults',()=>{const draft=structuredClone(defaults);draft.landing.heading='New heading';assert.equal(defaults.landing.heading,'Attendra');assert.equal(settingsSchema.parse(draft).landing.heading,'New heading');});
 test('missing settings preserve the current website',()=>assert.equal(parseSettings(null).footer.copyright,'© {year} {name}.'));
 test('theme colours select readable foregrounds',()=>{assert.equal(contrastText('#ffffff'),'oklch(0.15 0 0)');assert.equal(contrastText('#000000'),'oklch(0.99 0 0)');});
});
