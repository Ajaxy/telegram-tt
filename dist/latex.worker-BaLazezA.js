(function(){let e=/<[^>]*>|[^<]+/g,t;self.onmessage=({data:e})=>{if(e.type===`init`){n(e.moduleUrl);return}self.postMessage({type:`result`,markup:r(e.source,e.isBlock)})};async function n(e){try{t=(await import(
/* @vite-ignore */
e)).default,self.postMessage({type:`ready`})}catch{self.postMessage({type:`error`})}}function r(n,r){try{let i=t.renderToString(n,{displayMode:r,throwOnError:!0,trust:!1});if(i.length>65536)return;let a=0;for(let[t]of i.matchAll(e))if(!t.startsWith(`</`)&&(a++,a>1024))return;return i}catch{return}}})();
//# sourceMappingURL=latex.worker-BaLazezA.js.map