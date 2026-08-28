import{nt as e,r as t,t as n}from"./fasterdom-B7KaxOq2.js";import{S as r,_ as i,b as a,h as o,u as s,v as c,y as l}from"./teact-CWCKIlB_.js";import{E as u,Kl as d,La as f,V as p,Z as m,_p as h,aa as g,cp as _,gp as v,hp as y,k as b,n as x,pu as S,r as C,ru as w,tu as T,w as E,za as D}from"./InputText-DwjdkcHa.js";import{at as O,u as k}from"./colors-D5vlkVuG.js";import{u as ee}from"./usePrevious-DDm0zLJ1.js";import{w as te}from"./Transition-C05xHVct.js";import{S as ne,m as re,p as A,r as j}from"./Checkbox-BKspudWO.js";import{n as ie}from"./animatedAssets-Bsv7ZybF.js";import{r as M}from"./animation-BLPhs3Ce.js";import{t as N}from"./Modal-BDxS95nS.js";import{r as P}from"./Skeleton-C4qhEhTw.js";import{Bt as ae,Ht as oe,It as se,J as ce,W as le}from"./ActionMessage-oEwz9vQt.js";var ue=s(({ref:r,id:i,className:s,value:l,label:d,error:f,success:p,disabled:m,readOnly:g,placeholder:_,autoComplete:y,inputMode:b,maxLength:C,maxLengthIndicator:w,hasLengthIndicator:T,tabIndex:E,onChange:O,onInput:k,onKeyPress:ee,onKeyDown:te,onBlur:ne,onPaste:re,noReplaceNewlines:A})=>{let j=a();r&&(j=r);let ie=u(),M=f||p||d,N=S(`input-group`,l&&`touched`,f?`error`:p&&`success`,m&&`disabled`,g&&`disabled`,M&&`with-label`,s),P=D(e=>{t(()=>{e.style.height=`0`,n(()=>{let t=e.scrollHeight;return()=>{e.style.height=`${t}px`}})})});c(()=>{let e=j.current;e&&P(e)},[]);let ae=o(e=>{let t=e.currentTarget;if(!A){let e=t.selectionEnd;t.value=t.value.replace(/\n/g,` `),t.selectionEnd=e}P(t),O?.(e)},[A,O]);return h(`div`,{className:N,dir:ie.isRtl?`rtl`:void 0,children:[v(`textarea`,{ref:j,className:`form-control`,id:i,dir:`auto`,value:l||``,tabIndex:E,placeholder:_,maxLength:C,autoComplete:y,spellCheck:!e&&void 0,inputMode:b,disabled:m,readOnly:g,onChange:ae,onInput:k,onKeyPress:ee,onKeyDown:te,onBlur:ne,onPaste:re,"aria-label":M}),M&&v(`label`,{htmlFor:i,children:M}),(w||T&&C!==void 0)&&v(`div`,{className:`max-length-indicator`,children:v(x,{text:w||Math.max(0,C-(l||``).length).toString()})})]})}),F={root:`Kdv89j1l`,top:`_0EdTY2mJ`,badge:`TvB5YSlK`,text:`lZY9nXge`},de=s(({peer:e,avatarWebPhoto:t,avatarSize:n,text:r,badgeText:i,badgeIcon:a,className:o,badgeClassName:s,badgeIconClassName:c,textClassName:l,onClick:u})=>{let d=E();return h(`div`,{className:S(F.root,u&&F.clickable,o),onClick:u,children:[h(`div`,{className:F.top,children:[v(j,{size:n,peer:e,webPhoto:t}),i&&h(`div`,{className:S(F.badge,s),dir:d.isRtl?`rtl`:`ltr`,children:[a&&v(w,{name:a,className:c}),i]})]}),r&&v(`p`,{className:S(F.text,l),children:r})]})}),fe=new k(`#0098EA`),pe={blue:fe,blueGradient:[new k(`#0158AF`),new k(`#67D0FF`)],purple:new k(`#966FFE`),purpleGradient:[new k(`#6B93FF`),new k(`#E46ACE`)],gold:new k(`#FFBF0A`),goldGradient:[new k(`#FDEB32`),new k(`#D75902`)]},me={particleCount:5,distanceLimit:1,fadeInTime:.05,minLifetime:3,maxLifetime:3,maxStartTimeDelay:0,selfDestroyTime:3,minSpawnRadius:5,maxSpawnRadius:50},I={width:350,height:230,particleCount:100,color:fe,speed:18,baseSize:6,minSpawnRadius:35,maxSpawnRadius:70,distanceLimit:.7,fadeInTime:.25,fadeOutTime:1,minLifetime:4,maxLifetime:6,maxStartTimeDelay:3,edgeFadeZone:50,centerShift:[0,0],accelerationFactor:3,selfDestroyTime:0},he=.67,ge=1.33,_e=2.2,L=new Map;function R(e,t){let n=L.get(e);return n||(n=ve(e),L.set(e,n)),n.addSystem(t)}function ve(e){let t=e.getContext(`webgl`,{alpha:!0,antialias:!1,preserveDrawingBuffer:!1});if(!t)throw Error(`WebGL not supported`);let n=z(t,t.VERTEX_SHADER,ye),r=z(t,t.FRAGMENT_SHADER,be);if(!n||!r)throw Error(`Failed to create shaders`);let i=xe(t,n,r);if(!i)throw Error(`Failed to create shader program`);let a=window.devicePixelRatio||1,o=new Map,s={attributes:{startPosition:t.getAttribLocation(i,`a_startPosition`),velocity:t.getAttribLocation(i,`a_velocity`),startTime:t.getAttribLocation(i,`a_startTime`),lifetime:t.getAttribLocation(i,`a_lifetime`),size:t.getAttribLocation(i,`a_size`),baseOpacity:t.getAttribLocation(i,`a_baseOpacity`),color:t.getAttribLocation(i,`a_color`)},uniforms:{resolution:t.getUniformLocation(i,`u_resolution`),time:t.getUniformLocation(i,`u_time`),canvasWidth:t.getUniformLocation(i,`u_canvasWidth`),canvasHeight:t.getUniformLocation(i,`u_canvasHeight`),accelerationFactor:t.getUniformLocation(i,`u_accelerationFactor`),fadeInTime:t.getUniformLocation(i,`u_fadeInTime`),fadeOutTime:t.getUniformLocation(i,`u_fadeOutTime`),edgeFadeZone:t.getUniformLocation(i,`u_edgeFadeZone`),rotationMatrices:t.getUniformLocation(i,`u_rotationMatrices`),spawnCenter:t.getUniformLocation(i,`u_spawnCenter`)}},c,l;function u(e){let n=new Se(e.seed),{config:r}=e,i=new Float32Array(r.particleCount*2),o=new Float32Array(r.particleCount*2),s=new Float32Array(r.particleCount),c=new Float32Array(r.particleCount),l=new Float32Array(r.particleCount),u=new Float32Array(r.particleCount),d=new Float32Array(r.particleCount*3);for(let t=0;t<r.particleCount;t++){let f=n.next()*Math.PI*2,p=n.nextBetween(r.minSpawnRadius,r.maxSpawnRadius),m=Math.cos(f),h=Math.sin(f),g=e.centerX+m*p,_=e.centerY+h*p;i[t*2]=g*a,i[t*2+1]=_*a,c[t]=n.nextBetween(r.minLifetime,r.maxLifetime),s[t]=n.next()*r.maxStartTimeDelay;let v=n.nextBetween(e.avgDistance*r.distanceLimit*.5,e.avgDistance*r.distanceLimit)/c[t]*a;o[t*2]=m*v,o[t*2+1]=h*v;let y=n.next();y<.3?l[t]=r.baseSize*he*a:y<.7?l[t]=r.baseSize*ge*a:l[t]=r.baseSize*_e*a,u[t]=n.nextBetween(.3,.8);let[b,x,S]=we(r.color,n).coords;d[t*3]=b||0,d[t*3+1]=x||0,d[t*3+2]=S||0}t.bindBuffer(t.ARRAY_BUFFER,e.buffers.startPosition),t.bufferData(t.ARRAY_BUFFER,i,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.velocity),t.bufferData(t.ARRAY_BUFFER,o,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.startTime),t.bufferData(t.ARRAY_BUFFER,s,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.lifetime),t.bufferData(t.ARRAY_BUFFER,c,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.size),t.bufferData(t.ARRAY_BUFFER,l,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.baseOpacity),t.bufferData(t.ARRAY_BUFFER,u,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.color),t.bufferData(t.ARRAY_BUFFER,d,t.STATIC_DRAW)}function d(){let n=0,r=0;o.forEach(e=>{n=Math.max(n,e.config.width),r=Math.max(r,e.config.height)}),o.size===0&&(n=I.width,r=I.height),(e.width!==n*a||e.height!==r*a)&&(e.width=n*a,e.height=r*a,e.style.width=n+`px`,e.style.height=r+`px`),t.viewport(0,0,e.width,e.height)}function f(){t.useProgram(i),t.uniform2f(s.uniforms.resolution,e.width,e.height),t.uniformMatrix2fv(s.uniforms.rotationMatrices,!1,Ce()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.clearColor(0,0,0,0)}function p(e){c&&=(t.clear(t.COLOR_BUFFER_BIT),o.forEach(n=>{let r=(e-n.startTime)/1e3;t.uniform1f(s.uniforms.time,r),t.uniform1f(s.uniforms.canvasWidth,n.config.width*a),t.uniform1f(s.uniforms.canvasHeight,n.config.height*a),t.uniform1f(s.uniforms.accelerationFactor,n.config.accelerationFactor),t.uniform1f(s.uniforms.fadeInTime,n.config.fadeInTime),t.uniform1f(s.uniforms.fadeOutTime,n.config.fadeOutTime),t.uniform1f(s.uniforms.edgeFadeZone,n.config.edgeFadeZone*a),t.uniform2f(s.uniforms.spawnCenter,n.centerX*a,n.centerY*a),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.startPosition),t.enableVertexAttribArray(s.attributes.startPosition),t.vertexAttribPointer(s.attributes.startPosition,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.velocity),t.enableVertexAttribArray(s.attributes.velocity),t.vertexAttribPointer(s.attributes.velocity,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.startTime),t.enableVertexAttribArray(s.attributes.startTime),t.vertexAttribPointer(s.attributes.startTime,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.lifetime),t.enableVertexAttribArray(s.attributes.lifetime),t.vertexAttribPointer(s.attributes.lifetime,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.size),t.enableVertexAttribArray(s.attributes.size),t.vertexAttribPointer(s.attributes.size,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.baseOpacity),t.enableVertexAttribArray(s.attributes.baseOpacity),t.vertexAttribPointer(s.attributes.baseOpacity,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.color),t.enableVertexAttribArray(s.attributes.color),t.vertexAttribPointer(s.attributes.color,3,t.FLOAT,!1,0,0),t.drawArrays(t.POINTS,0,n.config.particleCount)}),requestAnimationFrame(p))}function m(e){let n=O(),r={...I,...e},i={id:n,config:r,buffers:{startPosition:t.createBuffer(),velocity:t.createBuffer(),startTime:t.createBuffer(),lifetime:t.createBuffer(),size:t.createBuffer(),baseOpacity:t.createBuffer(),color:t.createBuffer()},startTime:performance.now(),seed:Math.floor(Math.random()*1e6),centerX:r.width/2+r.centerShift[0],centerY:r.height/2+r.centerShift[1],avgDistance:(r.width/2+r.height/2)/2};return o.set(n,i),u(i),d(),r.selfDestroyTime&&(i.selfDestroyTimeout=window.setTimeout(()=>{h(n)},r.selfDestroyTime*1e3)),o.size===1&&(f(),l=b.subscribe(()=>{let e=!b();e&&!c?c=requestAnimationFrame(p):!e&&c&&(cancelAnimationFrame(c),c=void 0)}),c=requestAnimationFrame(p)),()=>h(n)}function h(e){let n=o.get(e);n&&(n.selfDestroyTimeout&&clearTimeout(n.selfDestroyTimeout),Object.values(n.buffers).forEach(e=>{e&&t.deleteBuffer(e)}),o.delete(e),o.size===0&&g())}function g(){c!==void 0&&(cancelAnimationFrame(c),c=void 0),l?.(),o.clear(),t.deleteProgram(i),t.deleteShader(n),t.deleteShader(r),L.delete(e)}return{addSystem:m}}var ye=`
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
`,be=`
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
`;function z(e,t,n){let r=e.createShader(t);if(r){if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){e.deleteShader(r);return}return r}}function xe(e,t,n){let r=e.createProgram();if(r){if(e.attachShader(r,t),e.attachShader(r,n),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS)){e.deleteProgram(r);return}return r}}var Se=class{seed;constructor(e){this.seed=e}next(){return this.seed=(this.seed*9301+49297)%233280,this.seed/233280}nextBetween(e,t){return e+(t-e)*this.next()}},B;function Ce(){if(!B){B=new Float32Array(72);for(let e=0;e<18;e++){let t=220*Math.PI/180*e,n=Math.cos(t),r=Math.sin(t);B[e*4]=n,B[e*4+1]=r,B[e*4+2]=-r,B[e*4+3]=n}}return B}function we(e,t){if(e instanceof k)return e;let[n,r]=e,[i,a,o]=n.coords,[s,c,l]=r.coords;return new k(`srgb`,[t.nextBetween(i||0,s||0),t.nextBetween(a||0,c||0),t.nextBetween(o||0,l||0)])}var Te={sparkles:`JxY8hVTW`},Ee={centerShift:[0,-36]},De=8,Oe=s(({color:e=`purple`,centerShift:t=Ee.centerShift,isDisabled:n,className:r,onRequestAnimation:o})=>{let s=a(),l=a(0);return c(()=>{if(!n)return R(s.current,{color:pe[`${e}Gradient`],centerShift:t})},[t,e,n]),i(()=>{o&&o(()=>{if(n)return;let r=Date.now();r-l.current<De||(l.current=r,R(s.current,{color:pe[`${e}Gradient`],centerShift:t,...me}))})},[t,e,n,o]),v(`canvas`,{ref:s,className:S(Te.sparkles,r)})}),V={root:`CHDf16MJ`,diamond:`UM7C8oRj`},ke=``+new URL(`diamond-57JalFxA.png`,import.meta.url).href,Ae=5,je=1,Me=300,Ne=1500,H,U=!0,Pe={isCancelled:!1};function Fe({className:e,onMouseMove:n}){let[i,a]=r(je),o=D(()=>{H&&=(clearTimeout(H),void 0),H=window.setTimeout(()=>{let e=Date.now();U=!0,M(()=>{if(!U)return!1;let t=Math.min((Date.now()-e)/Ne,1),n=4*(1-Le(t));return a(n),U=t<1&&n>1,U},t,Pe)},Me),U=!1,a(Ae),n()});return v(`div`,{className:S(V.root,e),children:v(`div`,{className:V.diamond,onMouseMove:o,children:v(ee,{speed:i,size:130,tgsUrl:ie.Diamond,previewUrl:ke,nonInteractive:!0,noLoop:!1})})})}var Ie=s(Fe);function Le(e){return 1-(1-e)**2}var W={root:`QcfrGLdX`,star:`nDPg-zs5`,star_purple:`-f2S1Tk6`,starPurple:`-f2S1Tk6`},Re=50;function ze({className:e,color:n,centerShift:r,onMouseMove:i}){let o=a(),s=D(e=>{let n=e.currentTarget.getBoundingClientRect(),a=n.left+n.width/2+r[0],s=n.top+n.height/2+r[1],c=e.clientX-a,l=e.clientY-s,u=Math.max(-1,Math.min(1,c/Re)),d=Math.max(-1,Math.min(1,l/Re)),f=u*40,p=-d*40;t(()=>{o.current.style.transform=`scale(1.1) rotateX(${p}deg) rotateY(${f}deg)`}),i()}),c=D(()=>{t(()=>{o.current.style.transform=``})});return v(`div`,{className:S(W.root,e),onMouseMove:s,onMouseLeave:c,children:v(`div`,{ref:o,className:S(W.star,W[`star_${n}`]),role:`img`,"aria-label":`Telegram Stars`})})}var Be=s(ze),G={root:`cK6KQXnQ`,"ai-egg":`ZP86O9Hy`,aiEgg:`ZP86O9Hy`,title:`xRm-Im3m`,description:`IQdQ9MU9`,particles:`_8ooQ3s8b`,stickerWrapper:`hHs2sTV-`,cocoon:`Rlhm9gZk`},Ve=``+new URL(`cocoon-DzgJltGQ.webp`,import.meta.url).href,K=8*m,He={centerShift:[0,-36]};function Ue({model:e,sticker:t,color:n,title:r,description:i,isDisabled:o,className:s,modelClassName:c}){let l=a(),u=a(),d=D(()=>{u.current?.()}),f=D(e=>{u.current=e});return h(`div`,{className:S(G.root,G[e],s),children:[v(Oe,{color:n,centerShift:He.centerShift,isDisabled:o,className:G.particles,onRequestAnimation:f}),e===`swaying-star`?v(Be,{className:c,color:n,centerShift:He.centerShift,onMouseMove:d}):e===`ai-egg`?v(`img`,{src:Ve,alt:``,role:`presentation`,"aria-hidden":`true`,className:S(G.cocoon,c),draggable:!1,onMouseMove:d}):e===`speeding-diamond`?v(Ie,{className:c,onMouseMove:d}):e===`sticker`&&t&&v(`div`,{ref:l,className:S(G.stickerWrapper,c),style:`width: ${K}px; height: ${K}px`,onMouseMove:d,children:v(A,{containerRef:l,sticker:t,size:K,shouldPreloadPreview:!0,shouldLoop:!0})}),v(`h2`,{className:G.title,children:r}),v(`div`,{className:G.description,children:i})]})}var We=s(Ue),q={root:`_7NV36hp3`,wrapper:`_32sWnI-2`,down:`DkDmNeYG`,frame:`M0hUT4cv`,video:`eWi57MWV`,placeholder:`A38HRiXg`},Ge=``+new URL(`DeviceFrame-Dqm_t18H.svg`,import.meta.url).href,Ke=s(({videoId:e,videoThumbnail:t,isActive:n,isReverseAnimation:r,isDown:i,index:a,className:o,wrapperClassName:s})=>{let c=ne(e?`document${e}`:void 0),l=se(t?.dataUri),u=te(c);return v(`div`,{className:S(q.root,o),children:h(`div`,{className:S(q.wrapper,r&&q.reverse,i&&q.down,s),id:a===void 0?void 0:`premium_feature_preview_video_${a}`,children:[v(`img`,{src:Ge,alt:``,className:q.frame,draggable:!1}),!e&&v(`div`,{className:q.placeholder}),t&&v(`canvas`,{ref:l,className:q.video}),e&&v(re,{canPlay:!!n,className:S(q.video,u),src:c,disablePictureInPicture:!0,playsInline:!0,muted:!0,loop:!0})]})})}),J={options:`Upert7zo`,option:`_2X6-9ciP`,active:`zpGahRpW`,wideOption:`dI8-J8yI`,optionTop:`wgA5YkCl`,stackedStars:`TZ71sXrE`,stackedStar:`_6CGkOJue`,optionBottom:`GRPtw1Lm`,moreOptions:`cY6CHTaj`,iconDown:`qdRs-uv4`},qe=6,Je=s(({isActive:e,className:t,options:n,selectedStarOption:r,selectedStarCount:a,starsNeeded:o,onClick:s})=>{let c=u(),m=E(),[_,y,b]=p();i(()=>{e||b()},[e]);let[x,D]=l(()=>{if(!n)return[void 0,!1];let e=n.reduce((e,t)=>e.stars>t.stars?e:t),t=o&&e.stars<o,r=[],i=0,a=!1;return n.forEach((e,s)=>{if(e.isExtended||i++,!(o&&!t&&e.stars<o)){if(!_&&e.isExtended){a=!0;return}r.push({option:e,starsCount:Math.min(i,qe),isWide:s===n.length-1})}}),[r,a]},[_,n,o]);return h(`div`,{className:S(J.options,t),children:[x?.map(({option:e,starsCount:t,isWide:n})=>{let i=x?.length%2==0,o=e===r,l;return e&&`winners`in e&&(l=(e.winners.find(e=>e.users===a)||e.winners.reduce((e,t)=>t.users>e.users?t:e,e.winners[0]))?.perUserStars),h(`div`,{className:S(J.option,!i&&n&&J.wideOption,o&&J.active),onClick:()=>s?.(e),children:[h(`div`,{className:J.optionTop,children:[`+`,g(e.stars),v(`div`,{className:J.stackedStars,dir:m.isRtl?`ltr`:`rtl`,children:Array.from({length:t}).map(()=>v(T,{className:J.stackedStar,type:`gold`,size:`big`}))})]}),v(`div`,{className:J.optionBottom,children:d(m,e.amount,e.currency)}),(o||r&&`winners`in r)&&!!l&&v(`div`,{className:J.optionBottom,children:v(`div`,{className:J.perUserStars,children:f(c(`BoostGift.Stars.PerUser`,g(l)))})})]},e.stars)}),!_&&D&&h(C,{className:J.moreOptions,isText:!0,noForcedUpperCase:!0,onClick:y,children:[c(`Stars.Purchase.ShowMore`),v(w,{className:J.iconDown,name:`down`})]})]})}),Y={content:`j63Xdo6p`,fixedHeight:`E-xx83T0`,withSearch:`sT1YPCzK`,header:`RwB3BKcO`,buttonWrapper:`Z-xvJZEk`},Ye=`.${ae.pickerList}`,Xe=s(({confirmButtonText:e,isConfirmDisabled:t,shouldAdaptToSearch:n,withFixedHeight:r,onConfirm:i,withPremiumGradient:o,itemsContainerSelector:s=Ye,...c})=>{let l=u(),d=!!(e||i),f=a();return ce({containerRef:f,selector:`.modal-content ${s}`,isBottomNotch:d,shouldHideTopNotch:!0},[c.isOpen]),h(N,{...c,dialogRef:f,isSlim:!0,className:S(n&&Y.withSearch,r&&Y.fixedHeight,c.className),contentClassName:S(Y.content,c.contentClassName),headerClassName:S(Y.header,c.headerClassName),isCondensedHeader:!0,children:[c.children,d&&v(`div`,{className:Y.buttonWrapper,children:v(C,{withPremiumGradient:o,onClick:i||c.onClose,color:`primary`,disabled:t,children:e||l(`Confirm`)})})]})}),X={table:`RMEi5Sgb`,cell:`AEl8NMjg`,title:`IypKoG1m`,value:`ZO-KCUSl`,fullWidth:`_1WIqSuNB`,chatItem:`J6it2-iy`},Ze=s(({tableData:e,className:t,onChatClick:n})=>{let{openChat:r}=_(),i=D(e=>{n?n(e):r({id:e})});if(e?.length)return v(`div`,{className:S(X.table,t),children:e.map(([e,t])=>h(y,{children:[!!e&&v(`div`,{className:S(X.cell,X.title),children:e}),v(`div`,{className:S(X.cell,X.value,!e&&X.fullWidth),children:typeof t==`object`&&`chatId`in t?v(oe,{peerId:t.chatId,className:X.chatItem,forceShowSelf:!0,withEmojiStatus:t.withEmojiStatus,clickArg:t.chatId,onClick:i}):t})]}))})}),Z={content:`rIjOLQyf`,noFooter:`ssGgYoZw`,avatar:`IdvEatvm`},Qe=s(({isOpen:e,title:t,tableData:n,headerAvatarPeer:r,header:i,modalHeader:a,footer:o,buttonText:s,className:c,contentClassName:l,tableClassName:u,hasBackdrop:d,closeButtonColor:f,moreMenuItems:p,headerRightToolBar:m,onClose:g,onButtonClick:y,withBalanceBar:b,isLowStackPriority:x,currencyInBalanceBar:w})=>{let{openChat:T}=_(),E=D(e=>{T({id:e}),g()});return h(N,{isOpen:e,hasCloseButton:!!t,hasAbsoluteCloseButton:!t,absoluteCloseButtonColor:f||(d?`translucent-white`:void 0),isSlim:!0,header:a,title:t,className:c,contentClassName:S(Z.content,l),moreMenuItems:p,headerRightToolBar:m,onClose:g,withBalanceBar:b,currencyInBalanceBar:w,isLowStackPriority:x,children:[r&&v(j,{peer:r,size:`jumbo`,className:Z.avatar}),i,v(Ze,{tableData:n,className:u,onChatClick:E}),o,s&&v(C,{className:o?void 0:Z.noFooter,onClick:y||g,children:s})]})}),Q={root:`FEEwg5rl`,secondary:`_51eeI1vd`,topIcon:`_0fVPMdEi`,premiumGradient:`oEaPoig5`,content:`_7xJ2IMc7`,listItems:`_4Smlf3-h`,listItemTitle:`lPVHA-w3`,separator:`V6iMhrLh`},$e=s(({className:e,isOpen:t,listItemData:n,headerIconName:r,headerIconPremiumGradient:i,header:a,footer:o,buttonText:s,hasBackdrop:c,absoluteCloseButtonColor:l,withSeparator:u,contentClassName:d,onClose:f,onButtonClick:p})=>h(N,{isOpen:t,className:S(Q.root,e),contentClassName:S(Q.content,d),hasAbsoluteCloseButton:!0,absoluteCloseButtonColor:l||(c?`translucent-white`:void 0),onClose:f,children:[r&&v(`div`,{className:S(Q.topIcon,i&&Q.premiumGradient),children:v(w,{name:r})}),a,v(`div`,{className:Q.listItems,children:n?.map(([e,t,n])=>h(P,{isStatic:!0,multiline:!0,icon:e,className:Q.listItem,children:[v(`span`,{className:S(`title`,Q.listItemTitle),children:t}),v(`span`,{className:`subtitle`,children:n})]}))}),u&&v(le,{className:Q.separator}),o,!!s&&v(C,{onClick:p||f,children:s})]})),$={root:`JaXKxj2K`,arrow:`_-7ow-ETi`},et=4*m,tt=s(({fromPeer:e,toPeer:t,avatarSize:n=et})=>h(`div`,{className:$.root,children:[v(j,{peer:e,size:n}),v(w,{name:`next`,className:$.arrow}),v(j,{peer:t,size:n})]}));export{Xe as a,We as c,ue as d,Ze as i,Oe as l,$e as n,Je as o,Qe as r,Ke as s,tt as t,de as u};
//# sourceMappingURL=TransferBetweenPeers-B1Gzjrr3.js.map