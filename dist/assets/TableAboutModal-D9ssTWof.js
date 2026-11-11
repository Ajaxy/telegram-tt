const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./diamond-aWBKikoG.js","./teact-BD1gfDbn.js","./fasterdom-ooBN1Guv.js","./core-wqAUrhUS.js","./rolldown-runtime-hePW80VL.js","./useBackgroundMode-Z5cbDc4F.js","./math-BFWfKrQs.js","./animation-DpBqDx4t.js","./FullNameTitle-D_w9POcR.js","./InputText-BASGpy5X.js","./colors-CinBGooJ.js","./buffer-CJ4aTzVB.js","./base64-NShRejUv.js","./preload-helper-CRzLMJPS.js","./InputText-CmlujDKi.css","./Transition-BbIKht1W.js","./Transition-Cf1E0Pnr.css","./FullNameTitle-DJnmq8Dr.css","./WalletAppIcon-BPwuXkhz.js","./PasswordForm-ZGhDh50i.js","./Modal-Fwe8eZTv.js","./index-NZuicSjB.js","./useMultiaccountInfo-CHk0Vkb9.js","./captureEscKeyListener-lD0wafWr.js","./cycleRestrict-Bb2qNUJe.js","./launchMediaWorkers-DM5x7TSe.js","./messageSummary-wTgybeU3.js","./Checkbox-WYWC-Jrf.js","./codeLanguages-CQGpvknJ.js","./useModuleLoader-Cb12x2ac.js","./Checkbox-CL2oP3aV.css","./index-B8Zv3aFQ.css","./Modal-O-QVlnfS.css","./WalletAppIcon-DOlZ15vj.css","./model-BtR6XA3W.js","./gpu-BIvIJDyG.js"])))=>i.map(i=>d[i]);
import{Ch as e,Jt as t,P as n,Sh as r,Un as i,W as a,m as o,mh as s,n as c,p as l,qt as u,r as d,wm as f,xh as p}from"./InputText-BASGpy5X.js";import{cn as m,r as h,t as g}from"./fasterdom-ooBN1Guv.js";import{C as _,b as v,f as y,v as ee,x as b}from"./teact-BD1gfDbn.js";import{T as x,mt as S}from"./colors-CinBGooJ.js";import{s as C,t as w}from"./useBackgroundMode-Z5cbDc4F.js";import{t as T}from"./preload-helper-CRzLMJPS.js";import{d as E,ht as D,z as O}from"./Transition-BbIKht1W.js";import{c as k}from"./FullNameTitle-D_w9POcR.js";import{t as A}from"./ListItem-BoqqtY3S.js";import{v as j}from"./Modal-Fwe8eZTv.js";import{w as M}from"./WalletAppIcon-BPwuXkhz.js";var N=y(({ref:t,id:n,className:i,value:o,label:s,error:l,success:u,disabled:d,readOnly:p,placeholder:v,autoComplete:y,inputMode:x,maxLength:S,maxLengthIndicator:w,hasLengthIndicator:T,tabIndex:E,onChange:D,onInput:O,onKeyPress:k,onKeyDown:A,onBlur:j,onPaste:M,noReplaceNewlines:N})=>{let P=_();t&&(P=t);let F=a(),I=l||u||s,L=f(`input-group`,o&&`touched`,l?`error`:u&&`success`,d&&`disabled`,p&&`disabled`,I&&`with-label`,i),R=_(),z=C(e=>{R.current=e.value,h(()=>{e.style.height=`0`,g(()=>{let t=e.scrollHeight;return()=>{e.style.height=`${t}px`}})})});b(()=>{let e=P.current;e&&e.value!==R.current&&z(e)},[o]);let B=ee(e=>{let t=e.currentTarget;if(!N){let e=t.selectionEnd;t.value=t.value.replace(/\n/g,` `),t.selectionEnd=e}z(t),D?.(e)},[N,D]);return e(`div`,{className:L,dir:F.isRtl?`rtl`:void 0,children:[r(`textarea`,{ref:P,className:`form-control`,id:n,dir:`auto`,value:o||``,tabIndex:E,placeholder:v,maxLength:S,autoComplete:y,spellCheck:!m&&void 0,inputMode:x,disabled:d,readOnly:p,onChange:B,onInput:O,onKeyPress:k,onKeyDown:A,onBlur:j,onPaste:M,"aria-label":I}),I&&r(`label`,{htmlFor:n,children:I}),(w||T&&S!==void 0)&&r(`div`,{className:`max-length-indicator`,children:r(c,{text:w||Math.max(0,S-(o||``).length).toString()})})]})}),P=x(`#0098EA`),F={blue:P,blueGradient:[x(`#0158AF`),x(`#67D0FF`)],purple:x(`#966FFE`),purpleGradient:[x(`#6B93FF`),x(`#E46ACE`)],gold:x(`#FFBF0A`),goldGradient:[x(`#FDEB32`),x(`#D75902`)]},I={particleCount:5,distanceLimit:1,fadeInTime:.05,minLifetime:3,maxLifetime:3,maxStartTimeDelay:0,selfDestroyTime:3,minSpawnRadius:5,maxSpawnRadius:50},L={width:350,height:230,particleCount:100,color:P,speed:18,baseSize:6,minSpawnRadius:35,maxSpawnRadius:70,distanceLimit:.7,fadeInTime:.25,fadeOutTime:1,minLifetime:4,maxLifetime:6,maxStartTimeDelay:3,edgeFadeZone:50,centerShift:[0,0],accelerationFactor:3,selfDestroyTime:0},R=.67,z=1.33,B=2.2,V=new Map;function H(e,t){let n=V.get(e);return n||(n=te(e),V.set(e,n)),n.addSystem(t)}function te(e){let t=e.getContext(`webgl`,{alpha:!0,antialias:!1,preserveDrawingBuffer:!1});if(!t)throw Error(`WebGL not supported`);let n=U(t,t.VERTEX_SHADER,ne),r=U(t,t.FRAGMENT_SHADER,re);if(!n||!r)throw Error(`Failed to create shaders`);let i=ie(t,n,r);if(!i)throw Error(`Failed to create shader program`);let a=window.devicePixelRatio||1,o=new Map,s={attributes:{startPosition:t.getAttribLocation(i,`a_startPosition`),velocity:t.getAttribLocation(i,`a_velocity`),startTime:t.getAttribLocation(i,`a_startTime`),lifetime:t.getAttribLocation(i,`a_lifetime`),size:t.getAttribLocation(i,`a_size`),baseOpacity:t.getAttribLocation(i,`a_baseOpacity`),color:t.getAttribLocation(i,`a_color`)},uniforms:{resolution:t.getUniformLocation(i,`u_resolution`),time:t.getUniformLocation(i,`u_time`),canvasWidth:t.getUniformLocation(i,`u_canvasWidth`),canvasHeight:t.getUniformLocation(i,`u_canvasHeight`),accelerationFactor:t.getUniformLocation(i,`u_accelerationFactor`),fadeInTime:t.getUniformLocation(i,`u_fadeInTime`),fadeOutTime:t.getUniformLocation(i,`u_fadeOutTime`),edgeFadeZone:t.getUniformLocation(i,`u_edgeFadeZone`),rotationMatrices:t.getUniformLocation(i,`u_rotationMatrices`),spawnCenter:t.getUniformLocation(i,`u_spawnCenter`)}},c,l;function u(e){let n=new ae(e.seed),{config:r}=e,i=new Float32Array(r.particleCount*2),o=new Float32Array(r.particleCount*2),s=new Float32Array(r.particleCount),c=new Float32Array(r.particleCount),l=new Float32Array(r.particleCount),u=new Float32Array(r.particleCount),d=new Float32Array(r.particleCount*3);for(let t=0;t<r.particleCount;t++){let f=n.next()*Math.PI*2,p=n.nextBetween(r.minSpawnRadius,r.maxSpawnRadius),m=Math.cos(f),h=Math.sin(f),g=e.centerX+m*p,_=e.centerY+h*p;i[t*2]=g*a,i[t*2+1]=_*a,c[t]=n.nextBetween(r.minLifetime,r.maxLifetime),s[t]=n.next()*r.maxStartTimeDelay;let v=n.nextBetween(e.avgDistance*r.distanceLimit*.5,e.avgDistance*r.distanceLimit)/c[t]*a;o[t*2]=m*v,o[t*2+1]=h*v;let y=n.next();y<.3?l[t]=r.baseSize*R*a:y<.7?l[t]=r.baseSize*z*a:l[t]=r.baseSize*B*a,u[t]=n.nextBetween(.3,.8);let[ee,b,x]=se(r.color,n).coords;d[t*3]=ee||0,d[t*3+1]=b||0,d[t*3+2]=x||0}t.bindBuffer(t.ARRAY_BUFFER,e.buffers.startPosition),t.bufferData(t.ARRAY_BUFFER,i,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.velocity),t.bufferData(t.ARRAY_BUFFER,o,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.startTime),t.bufferData(t.ARRAY_BUFFER,s,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.lifetime),t.bufferData(t.ARRAY_BUFFER,c,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.size),t.bufferData(t.ARRAY_BUFFER,l,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.baseOpacity),t.bufferData(t.ARRAY_BUFFER,u,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.color),t.bufferData(t.ARRAY_BUFFER,d,t.STATIC_DRAW)}function d(){let n=0,r=0;o.forEach(e=>{n=Math.max(n,e.config.width),r=Math.max(r,e.config.height)}),o.size===0&&(n=L.width,r=L.height),(e.width!==n*a||e.height!==r*a)&&(e.width=n*a,e.height=r*a,e.style.width=n+`px`,e.style.height=r+`px`),t.viewport(0,0,e.width,e.height)}function f(){t.useProgram(i),t.uniform2f(s.uniforms.resolution,e.width,e.height),t.uniformMatrix2fv(s.uniforms.rotationMatrices,!1,oe()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.clearColor(0,0,0,0)}function p(e){c&&=(t.clear(t.COLOR_BUFFER_BIT),o.forEach(n=>{let r=(e-n.startTime)/1e3;t.uniform1f(s.uniforms.time,r),t.uniform1f(s.uniforms.canvasWidth,n.config.width*a),t.uniform1f(s.uniforms.canvasHeight,n.config.height*a),t.uniform1f(s.uniforms.accelerationFactor,n.config.accelerationFactor),t.uniform1f(s.uniforms.fadeInTime,n.config.fadeInTime),t.uniform1f(s.uniforms.fadeOutTime,n.config.fadeOutTime),t.uniform1f(s.uniforms.edgeFadeZone,n.config.edgeFadeZone*a),t.uniform2f(s.uniforms.spawnCenter,n.centerX*a,n.centerY*a),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.startPosition),t.enableVertexAttribArray(s.attributes.startPosition),t.vertexAttribPointer(s.attributes.startPosition,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.velocity),t.enableVertexAttribArray(s.attributes.velocity),t.vertexAttribPointer(s.attributes.velocity,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.startTime),t.enableVertexAttribArray(s.attributes.startTime),t.vertexAttribPointer(s.attributes.startTime,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.lifetime),t.enableVertexAttribArray(s.attributes.lifetime),t.vertexAttribPointer(s.attributes.lifetime,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.size),t.enableVertexAttribArray(s.attributes.size),t.vertexAttribPointer(s.attributes.size,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.baseOpacity),t.enableVertexAttribArray(s.attributes.baseOpacity),t.vertexAttribPointer(s.attributes.baseOpacity,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.color),t.enableVertexAttribArray(s.attributes.color),t.vertexAttribPointer(s.attributes.color,3,t.FLOAT,!1,0,0),t.drawArrays(t.POINTS,0,n.config.particleCount)}),requestAnimationFrame(p))}function m(e){let n=S(),r={...L,...e},i={id:n,config:r,buffers:{startPosition:t.createBuffer(),velocity:t.createBuffer(),startTime:t.createBuffer(),lifetime:t.createBuffer(),size:t.createBuffer(),baseOpacity:t.createBuffer(),color:t.createBuffer()},startTime:performance.now(),seed:Math.floor(Math.random()*1e6),centerX:r.width/2+r.centerShift[0],centerY:r.height/2+r.centerShift[1],avgDistance:(r.width/2+r.height/2)/2};return o.set(n,i),u(i),d(),r.selfDestroyTime&&(i.selfDestroyTimeout=window.setTimeout(()=>{h(n)},r.selfDestroyTime*1e3)),o.size===1&&(f(),l=w.subscribe(()=>{let e=!w();e&&!c?c=requestAnimationFrame(p):!e&&c&&(cancelAnimationFrame(c),c=void 0)}),c=requestAnimationFrame(p)),()=>h(n)}function h(e){let n=o.get(e);n&&(n.selfDestroyTimeout&&clearTimeout(n.selfDestroyTimeout),Object.values(n.buffers).forEach(e=>{e&&t.deleteBuffer(e)}),o.delete(e),o.size===0&&g())}function g(){c!==void 0&&(cancelAnimationFrame(c),c=void 0),l?.(),o.clear(),t.deleteProgram(i),t.deleteShader(n),t.deleteShader(r),V.delete(e)}return{addSystem:m}}var ne=`
    attribute vec2 a_startPosition;
    attribute vec2 a_velocity;
    attribute float a_startTime;
    attribute float a_lifetime;
    attribute float a_size;
    attribute float a_baseOpacity;
    attribute vec3 a_color;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_canvasWidth;
    uniform float u_canvasHeight;
    uniform float u_accelerationFactor;
    uniform float u_fadeInTime;
    uniform float u_fadeOutTime;
    uniform float u_edgeFadeZone;
    uniform mat2 u_rotationMatrices[18];
    uniform vec2 u_spawnCenter;

    varying float v_opacity;
    varying vec3 v_color;

    void main() {
        float totalAge = u_time - a_startTime;
        float age = mod(totalAge, a_lifetime);

        // For the initial animation, fade in all particles
        float globalFadeIn = min(u_time / u_fadeInTime, 1.0);

        float lifeRatio = age / a_lifetime;

        // Calculate rotation based on completed lifecycles
        float lifecycleCount = floor(totalAge / a_lifetime);
        int rotationIndex = int(mod(lifecycleCount, 18.0));

        // Get rotation matrix
        mat2 rotationMatrix = u_rotationMatrices[rotationIndex];

        // Rotate start position around spawn center
        vec2 startOffset = a_startPosition - u_spawnCenter;
        vec2 rotatedStartOffset = rotationMatrix * startOffset;
        vec2 rotatedStartPosition = u_spawnCenter + rotatedStartOffset;

        // Apply rotation matrix to velocity
        vec2 rotatedVelocity = rotationMatrix * a_velocity;

        // Apply shoot-out effect: fast initial speed that slows down
        float speedMultiplier = 1.0 + u_accelerationFactor * exp(-3.0 * lifeRatio);

        vec2 position = rotatedStartPosition + rotatedVelocity * age * speedMultiplier;

        float opacity = 1.0;
        if (lifeRatio < u_fadeInTime / a_lifetime) {
            opacity = (lifeRatio * a_lifetime) / u_fadeInTime;
        } else if (lifeRatio > 1.0 - u_fadeOutTime / a_lifetime) {
            opacity = (1.0 - lifeRatio) * a_lifetime / u_fadeOutTime;
        }
        opacity *= a_baseOpacity * globalFadeIn;

        float distToLeft = position.x;
        float distToRight = u_canvasWidth - position.x;
        float distToTop = position.y;
        float distToBottom = u_canvasHeight - position.y;
        float distToEdge = min(min(distToLeft, distToRight), min(distToTop, distToBottom));

        if (distToEdge < u_edgeFadeZone) {
            opacity *= distToEdge / u_edgeFadeZone;
        }

        vec2 clipSpace = ((position / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
        gl_Position = vec4(clipSpace, 0, 1);
        gl_PointSize = a_size;
        v_opacity = opacity;
        v_color = a_color;
    }
`,re=`
    precision mediump float;

    varying float v_opacity;
    varying vec3 v_color;

    void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);

        // Create a four-pointed star
        float absX = abs(coord.x);
        float absY = abs(coord.y);

        // Star parameters
        float innerSize = 0.12;    // Size of center square
        float armLength = 0.45;    // Length of star arms
        float armWidth = 0.08;     // Half-width of star arms at base

        float dist = 1.0; // Default to outside

        // Center square
        if (absX <= innerSize && absY <= innerSize) {
            dist = max(absX, absY) - innerSize;
        }
        // Horizontal arms (left and right points)
        else if (absY <= armWidth && absX <= armLength) {
            // Taper the arms - they get narrower toward the tips
            float normalizedX = (absX - innerSize) / (armLength - innerSize);
            float taperFactor = 1.0 - normalizedX * 0.8; // Taper to 20% of original width
            float currentArmWidth = armWidth * taperFactor;
            dist = absY - currentArmWidth;
        }
        // Vertical arms (top and bottom points)
        else if (absX <= armWidth && absY <= armLength) {
            // Taper the arms - they get narrower toward the tips
            float normalizedY = (absY - innerSize) / (armLength - innerSize);
            float taperFactor = 1.0 - normalizedY * 0.8; // Taper to 20% of original width
            float currentArmWidth = armWidth * taperFactor;
            dist = absX - currentArmWidth;
        }

        // Use smoothstep for anti-aliasing to reduce subpixel artifacts
        float alpha = 1.0 - smoothstep(-0.01, 0.01, dist);

        if (alpha <= 0.0) {
            discard;
        }

        gl_FragColor = vec4(v_color * v_opacity * alpha, v_opacity * alpha);
    }
`;function U(e,t,n){let r=e.createShader(t);if(r){if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))e.deleteShader(r);else return r}}function ie(e,t,n){let r=e.createProgram();if(r){if(e.attachShader(r,t),e.attachShader(r,n),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS))e.deleteProgram(r);else return r}}var ae=class{seed;constructor(e){this.seed=e}next(){return this.seed=(this.seed*9301+49297)%233280,this.seed/233280}nextBetween(e,t){return e+(t-e)*this.next()}},W;function oe(){if(!W){W=new Float32Array(72);for(let e=0;e<18;e++){let t=220*Math.PI/180*e,n=Math.cos(t),r=Math.sin(t);W[e*4]=n,W[e*4+1]=r,W[e*4+2]=-r,W[e*4+3]=n}}return W}function se(e,t){if(`coords`in e)return e;let[n,r]=e,[i,a,o]=n.coords,[s,c,l]=r.coords;return x({space:`srgb`,coords:[t.nextBetween(i||0,s||0),t.nextBetween(a||0,c||0),t.nextBetween(o||0,l||0)]})}var ce={sparkles:`JxY8hVTW`},le={centerShift:[0,-36]},ue=15,G=y(({color:e=`purple`,centerShift:t=le.centerShift,isDisabled:n,className:i,onRequestAnimation:a})=>{let o=_(),s=_(0);return b(()=>{if(!n)return H(o.current,{color:F[`${e}Gradient`],centerShift:t})},[t,e,n]),v(()=>{a&&a(()=>{if(n)return;let r=Date.now();r-s.current<ue||(s.current=r,H(o.current,{color:F[`${e}Gradient`],centerShift:t,...I}))})},[t,e,n,a]),r(`canvas`,{ref:o,className:f(ce.sparkles,i)})}),K={root:`woZWPU7X`,preview:`-moeQylm`,previewHidden:`mGT1XdIL`,canvas:`fDA6MU2y`,ready:`UbJiz6U-`},q=y(({size:a})=>{let s=_(),c=t(i),[u,d]=n(),[p,m]=n(),h=c&&!p;if(v(()=>{if(!h)return;let e=s.current,t,n=!1;return T(async()=>{let{setupDiamond:e}=await import(`./diamond-aWBKikoG.js`);return{setupDiamond:e}},__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35]),import.meta.url).then(({setupDiamond:r})=>{n||(t=r(e,d,m))},m),()=>{n=!0,t?.()}},[h]),!h)return r(E,{tgsUrl:o.BlueDiamond,previewUrl:l.BlueDiamond,size:a,play:c,nonInteractive:!c});let g=Math.round(a*(window.devicePixelRatio||1));return e(`div`,{className:K.root,style:`width: ${a}px; height: ${a}px`,children:[r(`img`,{src:l.BlueDiamond3d,alt:``,draggable:!1,className:f(K.preview,u&&K.previewHidden)}),r(`canvas`,{ref:s,className:f(K.canvas,u&&K.ready),width:g,height:g,style:`width: ${a}px; height: ${a}px`})]})}),J={root:`QcfrGLdX`,star:`nDPg-zs5`,star_purple:`-f2S1Tk6`,starPurple:`-f2S1Tk6`},Y=50;function de({className:e,color:t,centerShift:n,onMouseMove:i}){let o=a(),s=_(),c=C(e=>{let t=e.currentTarget.getBoundingClientRect(),r=t.left+t.width/2+n[0],a=t.top+t.height/2+n[1],o=e.clientX-r,c=e.clientY-a,l=Math.max(-1,Math.min(1,o/Y)),u=Math.max(-1,Math.min(1,c/Y)),d=l*40,f=-u*40;h(()=>{s.current.style.transform=`scale(1.1) rotateX(${f}deg) rotateY(${d}deg)`}),i()}),l=C(()=>{h(()=>{s.current.style.transform=``})});return r(`div`,{className:f(J.root,e),onMouseMove:c,onMouseLeave:l,children:r(`div`,{ref:s,className:f(J.star,J[`star_${t}`]),role:`img`,"aria-label":o(`TelegramStars`)})})}var fe=y(de),X={root:`cK6KQXnQ`,"ai-egg":`ZP86O9Hy`,aiEgg:`ZP86O9Hy`,title:`xRm-Im3m`,description:`IQdQ9MU9`,particles:`_8ooQ3s8b`,stickerWrapper:`hHs2sTV-`,diamond3d:`tPAJ2-tU`,diamond3D:`tPAJ2-tU`,cocoon:`Rlhm9gZk`},pe=new URL(`cocoon-BF0OzgfP.avif`,import.meta.url).href,Z=8*D,me=130,he={centerShift:[0,-36]};function ge({model:t,sticker:n,color:i,title:a,description:o,isDisabled:s,className:c,modelClassName:l,titleClassName:u}){let d=_(),p=_(),m=C(()=>{p.current?.()}),h=C(e=>{p.current=e});return e(`div`,{className:f(X.root,X[t],c),children:[r(G,{color:i,centerShift:he.centerShift,isDisabled:s,className:X.particles,onRequestAnimation:h}),t===`swaying-star`?r(fe,{className:l,color:i,centerShift:he.centerShift,onMouseMove:m}):t===`ai-egg`?r(`img`,{src:pe,alt:``,role:`presentation`,"aria-hidden":`true`,className:f(X.cocoon,l),draggable:!1,onMouseMove:m}):t===`diamond-3d`?r(`div`,{className:f(X.diamond3d,l),onMouseMove:m,children:r(q,{size:me})}):t===`sticker`&&n&&r(`div`,{ref:d,className:f(X.stickerWrapper,l),style:`width: ${Z}px; height: ${Z}px`,onMouseMove:m,children:r(O,{containerRef:d,sticker:n,size:Z,shouldPreloadPreview:!0,shouldLoop:!0})}),r(`h2`,{className:f(X.title,u),children:a}),r(`div`,{className:X.description,children:o})]})}var _e=y(ge),Q={table:`RMEi5Sgb`,cell:`AEl8NMjg`,title:`IypKoG1m`,value:`ZO-KCUSl`,fullWidth:`_1WIqSuNB`,chatItem:`J6it2-iy`},ve=y(({tableData:t,className:n,onChatClick:i})=>{let{openChat:a}=s(),o=C(e=>{i?i(e):a({id:e})});if(t?.length)return r(`div`,{className:f(Q.table,n),children:t.map(([t,n])=>e(p,{children:[!!t&&r(`div`,{className:f(Q.cell,Q.title),children:t}),r(`div`,{className:f(Q.cell,Q.value,!t&&Q.fullWidth),children:typeof n==`object`&&`chatId`in n?r(j,{peerId:n.chatId,className:Q.chatItem,forceShowSelf:!0,withEmojiStatus:n.withEmojiStatus,clickArg:n.chatId,onClick:o}):n})]}))})}),$={root:`FEEwg5rl`,secondary:`_51eeI1vd`,topIcon:`_0fVPMdEi`,premiumGradient:`oEaPoig5`,content:`_7xJ2IMc7`,listItems:`_4Smlf3-h`,listItemTitle:`lPVHA-w3`,separator:`V6iMhrLh`},ye=y(({className:t,isOpen:n,listItemData:i,headerIconName:a,headerIconPremiumGradient:o,header:s,footer:c,buttonText:l,hasBackdrop:p,absoluteCloseButtonColor:m,withSeparator:h,isNativeDialog:g,contentClassName:_,onClose:v,onButtonClick:y})=>e(k,{isOpen:n,className:f($.root,t),contentClassName:f($.content,_),hasAbsoluteCloseButton:!0,isNativeDialog:g,absoluteCloseButtonColor:m||(p?`translucent-white`:void 0),onClose:v,children:[a&&r(`div`,{className:f($.topIcon,o&&$.premiumGradient),children:r(u,{name:a})}),s,r(`div`,{className:$.listItems,children:i?.map(([t,n,i])=>e(A,{isStatic:!0,multiline:!0,icon:t,className:$.listItem,children:[r(`span`,{className:f(`title`,$.listItemTitle),children:n}),r(`span`,{className:`subtitle`,children:i})]}))}),h&&r(M,{className:$.separator}),c,!!l&&r(d,{onClick:y||v,children:l})]}));export{G as a,q as i,ve as n,N as o,_e as r,ye as t};
//# sourceMappingURL=TableAboutModal-D9ssTWof.js.map