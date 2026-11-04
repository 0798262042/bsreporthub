import { createFileRoute } from '@tanstack/react-router';
import { mediaPaths,parseSettings } from '@/lib/system/settings';
export const Route=createFileRoute('/api/public/site-media')({server:{handlers:{GET:async({request})=>{
 const path=new URL(request.url).searchParams.get('path')??'';
 if(!/^[a-f0-9-]+\.(png|jpg|webp|ico)$/.test(path))return new Response('Not found',{status:404});
 // Only media explicitly referenced by published settings can be served publicly.
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data,error}=await supabaseAdmin.from('site_settings').select('content').eq('id','website').maybeSingle();
 if(error||!mediaPaths(parseSettings(data?.content)).includes(path))return new Response('Not found',{status:404});
 const file=await supabaseAdmin.storage.from('site-media').download(path);
 if(file.error||!file.data)return new Response('Not found',{status:404});
 return new Response(file.data,{headers:{'Content-Type':file.data.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}}}});
