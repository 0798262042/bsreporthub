import {GraduationCap} from 'lucide-react';
import {useSiteSettings} from './SettingsProvider';
import {mediaUrl} from '@/lib/system/settings';
export function BrandMark({location}:{location:'nav'|'auth'|'landing'}){const s=useSiteSettings();const enabled=location==='nav'?s.brand.navLogo:location==='auth'?s.brand.authLogo:s.brand.landingLogo;return enabled&&s.brand.logo?<img src={mediaUrl(s.brand.logo)} alt={s.brand.name} className="h-11 w-28 object-contain"/>:<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><GraduationCap className="h-5 w-5"/></div>}
