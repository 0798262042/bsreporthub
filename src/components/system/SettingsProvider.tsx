import {createContext,useContext,useEffect,type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {defaults,contrastText,mediaUrl,type SiteSettings} from '@/lib/system/settings';
import {getPublishedSettings} from '@/lib/system/settings.functions';
const Context=createContext<SiteSettings>(defaults);
export const useSiteSettings=()=>useContext(Context);
export function SettingsPreview({settings,children}:{settings:SiteSettings;children:ReactNode}){return <Context.Provider value={settings}>{children}</Context.Provider>}
export function SettingsProvider({children}:{children:ReactNode}){
 const {data=defaults}=useQuery({queryKey:['published-settings'],queryFn:()=>getPublishedSettings(),refetchInterval:60000,staleTime:10000});
 useEffect(()=>{
 const root=document.documentElement;root.classList.toggle('dark',data.theme.mode==='dark');
 const pairs=[['primary',data.theme.button||data.theme.primary],['secondary',data.theme.secondary],['background',data.theme.background]];
 for(const [token,value]of pairs){if(value){root.style.setProperty(`--${token}`,value);if(token!=='background')root.style.setProperty(`--${token}-foreground`,contrastText(value));else root.style.setProperty('--foreground',contrastText(value));}else{root.style.removeProperty(`--${token}`);root.style.removeProperty(`--${token==='background'?'foreground':token+'-foreground'}`);}}
 if(data.theme.primary){root.style.setProperty('--gradient-brand',`linear-gradient(135deg, ${data.theme.primary}, ${data.theme.primary})`);root.style.setProperty('--ring',data.theme.primary);}else{root.style.removeProperty('--gradient-brand');root.style.removeProperty('--ring');}
 let icon=document.querySelector<HTMLLinkElement>('link[rel="icon"]');if(!icon){icon=document.createElement('link');icon.rel='icon';document.head.append(icon);}icon.href=mediaUrl(data.brand.favicon)||'/favicon.ico';
 },[data]);
 return <Context.Provider value={data}>{children}</Context.Provider>;
}
