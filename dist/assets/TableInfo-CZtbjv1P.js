const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./diamond-C8RcQkhZ.js","./teact-CXBxIhl2.js","./fasterdom-CI0oHoFk.js","./core-wqAUrhUS.js","./rolldown-runtime-hePW80VL.js","./useBackgroundMode-BWXepHuf.js","./animation-CO37eWCF.js","./Modal-DT1tZZ7d.js","./InputText-DyPeAYiC.js","./colors-BNb52y7_.js","./buffer-Bxh69E6y.js","./base64-_GGUqvD_.js","./preload-helper-uBIymjUX.js","./usePriorityPlaybackCheck-D-dNtLKd.js","./InputText-Cj69WUze.css","./Modal-Dg5JqZy5.css","./WalletAppIcon-ClwfB4Ch.js","./Transition-DfMFthc3.js","./Transition-giLYO1y3.css","./WalletAppIcon-CMXQZ1iA.css","./scene-BzBtNGhI.js"])))=>i.map(i=>d[i]);
import{$t as e,A as t,Y as n,cm as r,f as i,fr as a,gp as o,lm as s,n as c,p as l,tm as u,um as d,z as f}from"./InputText-DyPeAYiC.js";import{on as p,r as m,t as h}from"./fasterdom-CI0oHoFk.js";import{S as g,_,b as v,h as y,u as b,v as x}from"./teact-CXBxIhl2.js";import{ut as S,x as C}from"./colors-BNb52y7_.js";import{i as w,t as T}from"./useBackgroundMode-BWXepHuf.js";import{t as E}from"./preload-helper-uBIymjUX.js";import{D}from"./Transition-DfMFthc3.js";import{n as O}from"./DropdownMenu-BaI03ZIx.js";import{r as ee}from"./animation-CO37eWCF.js";import{o as k}from"./resolveTransitionName-CzigyTCE.js";var A=b(({ref:e,id:n,className:r,value:i,label:a,error:l,success:u,disabled:f,readOnly:g,placeholder:_,autoComplete:b,inputMode:S,maxLength:C,maxLengthIndicator:T,hasLengthIndicator:E,tabIndex:D,onChange:O,onInput:ee,onKeyPress:k,onKeyDown:A,onBlur:j,onPaste:M,noReplaceNewlines:N})=>{let P=v();e&&(P=e);let F=t(),I=l||u||a,L=o(`input-group`,i&&`touched`,l?`error`:u&&`success`,f&&`disabled`,g&&`disabled`,I&&`with-label`,r),R=v(),z=w(e=>{R.current=e.value,m(()=>{e.style.height=`0`,h(()=>{let t=e.scrollHeight;return()=>{e.style.height=`${t}px`}})})});x(()=>{let e=P.current;e&&e.value!==R.current&&z(e)},[i]);let B=y(e=>{let t=e.currentTarget;if(!N){let e=t.selectionEnd;t.value=t.value.replace(/\n/g,` `),t.selectionEnd=e}z(t),O?.(e)},[N,O]);return d(`div`,{className:L,dir:F.isRtl?`rtl`:void 0,children:[s(`textarea`,{ref:P,className:`form-control`,id:n,dir:`auto`,value:i||``,tabIndex:D,placeholder:_,maxLength:C,autoComplete:b,spellCheck:!p&&void 0,inputMode:S,disabled:f,readOnly:g,onChange:B,onInput:ee,onKeyPress:k,onKeyDown:A,onBlur:j,onPaste:M,"aria-label":I}),I&&s(`label`,{htmlFor:n,children:I}),(T||E&&C!==void 0)&&s(`div`,{className:`max-length-indicator`,children:s(c,{text:T||Math.max(0,C-(i||``).length).toString()})})]})}),j=C(`#0098EA`),M={blue:j,blueGradient:[C(`#0158AF`),C(`#67D0FF`)],purple:C(`#966FFE`),purpleGradient:[C(`#6B93FF`),C(`#E46ACE`)],gold:C(`#FFBF0A`),goldGradient:[C(`#FDEB32`),C(`#D75902`)]},N={particleCount:5,distanceLimit:1,fadeInTime:.05,minLifetime:3,maxLifetime:3,maxStartTimeDelay:0,selfDestroyTime:3,minSpawnRadius:5,maxSpawnRadius:50},P={width:350,height:230,particleCount:100,color:j,speed:18,baseSize:6,minSpawnRadius:35,maxSpawnRadius:70,distanceLimit:.7,fadeInTime:.25,fadeOutTime:1,minLifetime:4,maxLifetime:6,maxStartTimeDelay:3,edgeFadeZone:50,centerShift:[0,0],accelerationFactor:3,selfDestroyTime:0},F=.67,I=1.33,L=2.2,R=new Map;function z(e,t){let n=R.get(e);return n||(n=B(e),R.set(e,n)),n.addSystem(t)}function B(e){let t=e.getContext(`webgl`,{alpha:!0,antialias:!1,preserveDrawingBuffer:!1});if(!t)throw Error(`WebGL not supported`);let n=V(t,t.VERTEX_SHADER,te),r=V(t,t.FRAGMENT_SHADER,ne);if(!n||!r)throw Error(`Failed to create shaders`);let i=re(t,n,r);if(!i)throw Error(`Failed to create shader program`);let a=window.devicePixelRatio||1,o=new Map,s={attributes:{startPosition:t.getAttribLocation(i,`a_startPosition`),velocity:t.getAttribLocation(i,`a_velocity`),startTime:t.getAttribLocation(i,`a_startTime`),lifetime:t.getAttribLocation(i,`a_lifetime`),size:t.getAttribLocation(i,`a_size`),baseOpacity:t.getAttribLocation(i,`a_baseOpacity`),color:t.getAttribLocation(i,`a_color`)},uniforms:{resolution:t.getUniformLocation(i,`u_resolution`),time:t.getUniformLocation(i,`u_time`),canvasWidth:t.getUniformLocation(i,`u_canvasWidth`),canvasHeight:t.getUniformLocation(i,`u_canvasHeight`),accelerationFactor:t.getUniformLocation(i,`u_accelerationFactor`),fadeInTime:t.getUniformLocation(i,`u_fadeInTime`),fadeOutTime:t.getUniformLocation(i,`u_fadeOutTime`),edgeFadeZone:t.getUniformLocation(i,`u_edgeFadeZone`),rotationMatrices:t.getUniformLocation(i,`u_rotationMatrices`),spawnCenter:t.getUniformLocation(i,`u_spawnCenter`)}},c,l;function u(e){let n=new ie(e.seed),{config:r}=e,i=new Float32Array(r.particleCount*2),o=new Float32Array(r.particleCount*2),s=new Float32Array(r.particleCount),c=new Float32Array(r.particleCount),l=new Float32Array(r.particleCount),u=new Float32Array(r.particleCount),d=new Float32Array(r.particleCount*3);for(let t=0;t<r.particleCount;t++){let f=n.next()*Math.PI*2,p=n.nextBetween(r.minSpawnRadius,r.maxSpawnRadius),m=Math.cos(f),h=Math.sin(f),g=e.centerX+m*p,_=e.centerY+h*p;i[t*2]=g*a,i[t*2+1]=_*a,c[t]=n.nextBetween(r.minLifetime,r.maxLifetime),s[t]=n.next()*r.maxStartTimeDelay;let v=n.nextBetween(e.avgDistance*r.distanceLimit*.5,e.avgDistance*r.distanceLimit)/c[t]*a;o[t*2]=m*v,o[t*2+1]=h*v;let y=n.next();y<.3?l[t]=r.baseSize*F*a:y<.7?l[t]=r.baseSize*I*a:l[t]=r.baseSize*L*a,u[t]=n.nextBetween(.3,.8);let[b,x,S]=oe(r.color,n).coords;d[t*3]=b||0,d[t*3+1]=x||0,d[t*3+2]=S||0}t.bindBuffer(t.ARRAY_BUFFER,e.buffers.startPosition),t.bufferData(t.ARRAY_BUFFER,i,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.velocity),t.bufferData(t.ARRAY_BUFFER,o,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.startTime),t.bufferData(t.ARRAY_BUFFER,s,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.lifetime),t.bufferData(t.ARRAY_BUFFER,c,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.size),t.bufferData(t.ARRAY_BUFFER,l,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.baseOpacity),t.bufferData(t.ARRAY_BUFFER,u,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.color),t.bufferData(t.ARRAY_BUFFER,d,t.STATIC_DRAW)}function d(){let n=0,r=0;o.forEach(e=>{n=Math.max(n,e.config.width),r=Math.max(r,e.config.height)}),o.size===0&&(n=P.width,r=P.height),(e.width!==n*a||e.height!==r*a)&&(e.width=n*a,e.height=r*a,e.style.width=n+`px`,e.style.height=r+`px`),t.viewport(0,0,e.width,e.height)}function f(){t.useProgram(i),t.uniform2f(s.uniforms.resolution,e.width,e.height),t.uniformMatrix2fv(s.uniforms.rotationMatrices,!1,ae()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.clearColor(0,0,0,0)}function p(e){c&&=(t.clear(t.COLOR_BUFFER_BIT),o.forEach(n=>{let r=(e-n.startTime)/1e3;t.uniform1f(s.uniforms.time,r),t.uniform1f(s.uniforms.canvasWidth,n.config.width*a),t.uniform1f(s.uniforms.canvasHeight,n.config.height*a),t.uniform1f(s.uniforms.accelerationFactor,n.config.accelerationFactor),t.uniform1f(s.uniforms.fadeInTime,n.config.fadeInTime),t.uniform1f(s.uniforms.fadeOutTime,n.config.fadeOutTime),t.uniform1f(s.uniforms.edgeFadeZone,n.config.edgeFadeZone*a),t.uniform2f(s.uniforms.spawnCenter,n.centerX*a,n.centerY*a),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.startPosition),t.enableVertexAttribArray(s.attributes.startPosition),t.vertexAttribPointer(s.attributes.startPosition,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.velocity),t.enableVertexAttribArray(s.attributes.velocity),t.vertexAttribPointer(s.attributes.velocity,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.startTime),t.enableVertexAttribArray(s.attributes.startTime),t.vertexAttribPointer(s.attributes.startTime,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.lifetime),t.enableVertexAttribArray(s.attributes.lifetime),t.vertexAttribPointer(s.attributes.lifetime,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.size),t.enableVertexAttribArray(s.attributes.size),t.vertexAttribPointer(s.attributes.size,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.baseOpacity),t.enableVertexAttribArray(s.attributes.baseOpacity),t.vertexAttribPointer(s.attributes.baseOpacity,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.color),t.enableVertexAttribArray(s.attributes.color),t.vertexAttribPointer(s.attributes.color,3,t.FLOAT,!1,0,0),t.drawArrays(t.POINTS,0,n.config.particleCount)}),requestAnimationFrame(p))}function m(e){let n=S(),r={...P,...e},i={id:n,config:r,buffers:{startPosition:t.createBuffer(),velocity:t.createBuffer(),startTime:t.createBuffer(),lifetime:t.createBuffer(),size:t.createBuffer(),baseOpacity:t.createBuffer(),color:t.createBuffer()},startTime:performance.now(),seed:Math.floor(Math.random()*1e6),centerX:r.width/2+r.centerShift[0],centerY:r.height/2+r.centerShift[1],avgDistance:(r.width/2+r.height/2)/2};return o.set(n,i),u(i),d(),r.selfDestroyTime&&(i.selfDestroyTimeout=window.setTimeout(()=>{h(n)},r.selfDestroyTime*1e3)),o.size===1&&(f(),l=T.subscribe(()=>{let e=!T();e&&!c?c=requestAnimationFrame(p):!e&&c&&(cancelAnimationFrame(c),c=void 0)}),c=requestAnimationFrame(p)),()=>h(n)}function h(e){let n=o.get(e);n&&(n.selfDestroyTimeout&&clearTimeout(n.selfDestroyTimeout),Object.values(n.buffers).forEach(e=>{e&&t.deleteBuffer(e)}),o.delete(e),o.size===0&&g())}function g(){c!==void 0&&(cancelAnimationFrame(c),c=void 0),l?.(),o.clear(),t.deleteProgram(i),t.deleteShader(n),t.deleteShader(r),R.delete(e)}return{addSystem:m}}var te=`
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
`,ne=`
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
`;function V(e,t,n){let r=e.createShader(t);if(r){if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){e.deleteShader(r);return}return r}}function re(e,t,n){let r=e.createProgram();if(r){if(e.attachShader(r,t),e.attachShader(r,n),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS)){e.deleteProgram(r);return}return r}}var ie=class{seed;constructor(e){this.seed=e}next(){return this.seed=(this.seed*9301+49297)%233280,this.seed/233280}nextBetween(e,t){return e+(t-e)*this.next()}},H;function ae(){if(!H){H=new Float32Array(72);for(let e=0;e<18;e++){let t=220*Math.PI/180*e,n=Math.cos(t),r=Math.sin(t);H[e*4]=n,H[e*4+1]=r,H[e*4+2]=-r,H[e*4+3]=n}}return H}function oe(e,t){if(`coords`in e)return e;let[n,r]=e,[i,a,o]=n.coords,[s,c,l]=r.coords;return C({space:`srgb`,coords:[t.nextBetween(i||0,s||0),t.nextBetween(a||0,c||0),t.nextBetween(o||0,l||0)]})}var se={sparkles:`JxY8hVTW`},ce={centerShift:[0,-36]},le=8,U=b(({color:e=`purple`,centerShift:t=ce.centerShift,isDisabled:n,className:r,onRequestAnimation:i})=>{let a=v(),c=v(0);return x(()=>{if(!n)return z(a.current,{color:M[`${e}Gradient`],centerShift:t})},[t,e,n]),_(()=>{i&&i(()=>{if(n)return;let r=Date.now();r-c.current<le||(c.current=r,z(a.current,{color:M[`${e}Gradient`],centerShift:t,...N}))})},[t,e,n,i]),s(`canvas`,{ref:a,className:o(se.sparkles,r)})}),W={root:`woZWPU7X`,preview:`-moeQylm`,previewHidden:`mGT1XdIL`,canvas:`fDA6MU2y`,ready:`UbJiz6U-`},G=b(({size:t})=>{let n=v(),r=e(a),[c,u]=f(),[p,m]=f(),h=r&&!p;if(_(()=>{if(!h)return;let e=n.current,t,r=!1;return E(async()=>{let{setupDiamond:e}=await import(`./diamond-C8RcQkhZ.js`);return{setupDiamond:e}},__vite__mapDeps([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]),import.meta.url).then(({setupDiamond:n})=>{r||(t=n(e,u,m))},m),()=>{r=!0,t?.()}},[h]),!h)return s(O,{tgsUrl:l.BlueDiamond,previewUrl:i.BlueDiamond,size:t});let g=Math.round(t*(window.devicePixelRatio||1));return d(`div`,{className:W.root,style:`width: ${t}px; height: ${t}px`,children:[s(`img`,{src:i.BlueDiamond3d,alt:``,draggable:!1,className:o(W.preview,c&&W.previewHidden)}),s(`canvas`,{ref:n,className:o(W.canvas,c&&W.ready),width:g,height:g,style:`width: ${t}px; height: ${t}px`})]})}),K={root:`CHDf16MJ`,diamond:`UM7C8oRj`},ue=new URL(`diamond-57JalFxA.png`,import.meta.url).href,de=5,fe=1,pe=300,me=1500,q,J=!0,he={isCancelled:!1};function ge({className:e,onMouseMove:t}){let[n,r]=g(fe),i=w(()=>{q&&=(clearTimeout(q),void 0),q=window.setTimeout(()=>{let e=Date.now();J=!0,ee(()=>{if(!J)return!1;let t=Math.min((Date.now()-e)/me,1),n=4*(1-ve(t));return r(n),J=t<1&&n>1,J},m,he)},pe),J=!1,r(de),t()});return s(`div`,{className:o(K.root,e),children:s(`div`,{className:K.diamond,onMouseMove:i,children:s(O,{speed:n,size:130,tgsUrl:l.Diamond,previewUrl:ue,nonInteractive:!0,noLoop:!1})})})}var _e=b(ge);function ve(e){return 1-(1-e)**2}var Y={root:`QcfrGLdX`,star:`nDPg-zs5`,star_purple:`-f2S1Tk6`,starPurple:`-f2S1Tk6`},X=50;function ye({className:e,color:t,centerShift:n,onMouseMove:r}){let i=v(),a=w(e=>{let t=e.currentTarget.getBoundingClientRect(),a=t.left+t.width/2+n[0],o=t.top+t.height/2+n[1],s=e.clientX-a,c=e.clientY-o,l=Math.max(-1,Math.min(1,s/X)),u=Math.max(-1,Math.min(1,c/X)),d=l*40,f=-u*40;m(()=>{i.current.style.transform=`scale(1.1) rotateX(${f}deg) rotateY(${d}deg)`}),r()}),c=w(()=>{m(()=>{i.current.style.transform=``})});return s(`div`,{className:o(Y.root,e),onMouseMove:a,onMouseLeave:c,children:s(`div`,{ref:i,className:o(Y.star,Y[`star_${t}`]),role:`img`,"aria-label":`Telegram Stars`})})}var be=b(ye),Z={root:`cK6KQXnQ`,"ai-egg":`ZP86O9Hy`,aiEgg:`ZP86O9Hy`,title:`xRm-Im3m`,description:`IQdQ9MU9`,particles:`_8ooQ3s8b`,stickerWrapper:`hHs2sTV-`,diamond3d:`tPAJ2-tU`,diamond3D:`tPAJ2-tU`,cocoon:`Rlhm9gZk`},xe=new URL(`cocoon-DzgJltGQ.webp`,import.meta.url).href,Q=8*n,Se=130,Ce={centerShift:[0,-36]};function we({model:e,sticker:t,color:n,title:r,description:i,isDisabled:a,className:c,modelClassName:l}){let u=v(),f=v(),p=w(()=>{f.current?.()}),m=w(e=>{f.current=e});return d(`div`,{className:o(Z.root,Z[e],c),children:[s(U,{color:n,centerShift:Ce.centerShift,isDisabled:a,className:Z.particles,onRequestAnimation:m}),e===`swaying-star`?s(be,{className:l,color:n,centerShift:Ce.centerShift,onMouseMove:p}):e===`ai-egg`?s(`img`,{src:xe,alt:``,role:`presentation`,"aria-hidden":`true`,className:o(Z.cocoon,l),draggable:!1,onMouseMove:p}):e===`speeding-diamond`?s(_e,{className:l,onMouseMove:p}):e===`diamond-3d`?s(`div`,{className:o(Z.diamond3d,l),onMouseMove:p,children:s(G,{size:Se})}):e===`sticker`&&t&&s(`div`,{ref:u,className:o(Z.stickerWrapper,l),style:`width: ${Q}px; height: ${Q}px`,onMouseMove:p,children:s(D,{containerRef:u,sticker:t,size:Q,shouldPreloadPreview:!0,shouldLoop:!0})}),s(`h2`,{className:Z.title,children:r}),s(`div`,{className:Z.description,children:i})]})}var Te=b(we),$={table:`RMEi5Sgb`,cell:`AEl8NMjg`,title:`IypKoG1m`,value:`ZO-KCUSl`,fullWidth:`_1WIqSuNB`,chatItem:`J6it2-iy`},Ee=b(({tableData:e,className:t,onChatClick:n})=>{let{openChat:i}=u(),a=w(e=>{n?n(e):i({id:e})});if(e?.length)return s(`div`,{className:o($.table,t),children:e.map(([e,t])=>d(r,{children:[!!e&&s(`div`,{className:o($.cell,$.title),children:e}),s(`div`,{className:o($.cell,$.value,!e&&$.fullWidth),children:typeof t==`object`&&`chatId`in t?s(k,{peerId:t.chatId,className:$.chatItem,forceShowSelf:!0,withEmojiStatus:t.withEmojiStatus,clickArg:t.chatId,onClick:a}):t})]}))})});export{A as a,U as i,Te as n,G as r,Ee as t};
//# sourceMappingURL=TableInfo-CZtbjv1P.js.map