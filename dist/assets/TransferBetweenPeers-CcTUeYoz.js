import{A as e,Fp as t,G as n,Ip as r,Lp as i,Mc as a,N as o,Nl as s,O as c,Op as l,Qa as u,fl as d,lo as f,n as p,p as m,r as h,so as g,tt as _,ul as v}from"./InputText-d6wpTfI6.js";import{Qt as y,r as b,t as x}from"./fasterdom-iiZ3asHO.js";import{S,_ as C,b as w,h as T,u as E,v as D,y as O}from"./teact-Edufp9xP.js";import{m as k,ut as ee}from"./colors-CVfO2rs5.js";import{g as te,m as ne}from"./PickerItem-DCLKWuLN.js";import{H as re,N as A,V as j,X as ie,r as M}from"./Checkbox-BDM8Og8l.js";import{r as N}from"./DropdownMenu-D13GyKFp.js";import{r as P}from"./animation-BmKftN8_.js";import{t as F}from"./Modal-DIWLbg0V.js";import{n as ae}from"./Skeleton-CAhFjLFU.js";import{J as oe,W as se,jt as ce}from"./ActionMessage-DGBlt2da.js";var le=E(({ref:t,id:n,className:a,value:o,label:c,error:l,success:u,disabled:f,readOnly:m,placeholder:h,autoComplete:g,inputMode:_,maxLength:v,maxLengthIndicator:S,hasLengthIndicator:C,tabIndex:E,onChange:O,onInput:k,onKeyPress:ee,onKeyDown:te,onBlur:ne,onPaste:re,noReplaceNewlines:A})=>{let j=w();t&&(j=t);let ie=e(),M=l||u||c,N=s(`input-group`,o&&`touched`,l?`error`:u&&`success`,f&&`disabled`,m&&`disabled`,M&&`with-label`,a),P=d(e=>{b(()=>{e.style.height=`0`,x(()=>{let t=e.scrollHeight;return()=>{e.style.height=`${t}px`}})})});D(()=>{let e=j.current;e&&P(e)},[]);let F=T(e=>{let t=e.currentTarget;if(!A){let e=t.selectionEnd;t.value=t.value.replace(/\n/g,` `),t.selectionEnd=e}P(t),O?.(e)},[A,O]);return i(`div`,{className:N,dir:ie.isRtl?`rtl`:void 0,children:[r(`textarea`,{ref:j,className:`form-control`,id:n,dir:`auto`,value:o||``,tabIndex:E,placeholder:h,maxLength:v,autoComplete:g,spellCheck:!y&&void 0,inputMode:_,disabled:f,readOnly:m,onChange:F,onInput:k,onKeyPress:ee,onKeyDown:te,onBlur:ne,onPaste:re,"aria-label":M}),M&&r(`label`,{htmlFor:n,children:M}),(S||C&&v!==void 0)&&r(`div`,{className:`max-length-indicator`,children:r(p,{text:S||Math.max(0,v-(o||``).length).toString()})})]})}),I={root:`Kdv89j1l`,top:`_0EdTY2mJ`,badge:`TvB5YSlK`,text:`lZY9nXge`},ue=E(({peer:e,avatarWebPhoto:t,avatarSize:n,text:a,badgeText:o,badgeIcon:l,className:u,badgeClassName:d,badgeIconClassName:p,textClassName:m,onClick:h})=>{let g=c();return i(`div`,{className:s(I.root,h&&I.clickable,u),onClick:h,children:[i(`div`,{className:I.top,children:[r(M,{size:n,peer:e,webPhoto:t}),o&&i(`div`,{className:s(I.badge,d),dir:g.isRtl?`rtl`:`ltr`,children:[l&&r(f,{name:l,className:p}),o]})]}),a&&r(`p`,{className:s(I.text,m),children:a})]})}),de=k(`#0098EA`),fe={blue:de,blueGradient:[k(`#0158AF`),k(`#67D0FF`)],purple:k(`#966FFE`),purpleGradient:[k(`#6B93FF`),k(`#E46ACE`)],gold:k(`#FFBF0A`),goldGradient:[k(`#FDEB32`),k(`#D75902`)]},pe={particleCount:5,distanceLimit:1,fadeInTime:.05,minLifetime:3,maxLifetime:3,maxStartTimeDelay:0,selfDestroyTime:3,minSpawnRadius:5,maxSpawnRadius:50},L={width:350,height:230,particleCount:100,color:de,speed:18,baseSize:6,minSpawnRadius:35,maxSpawnRadius:70,distanceLimit:.7,fadeInTime:.25,fadeOutTime:1,minLifetime:4,maxLifetime:6,maxStartTimeDelay:3,edgeFadeZone:50,centerShift:[0,0],accelerationFactor:3,selfDestroyTime:0},me=.67,he=1.33,ge=2.2,R=new Map;function z(e,t){let n=R.get(e);return n||(n=_e(e),R.set(e,n)),n.addSystem(t)}function _e(e){let t=e.getContext(`webgl`,{alpha:!0,antialias:!1,preserveDrawingBuffer:!1});if(!t)throw Error(`WebGL not supported`);let n=B(t,t.VERTEX_SHADER,ve),r=B(t,t.FRAGMENT_SHADER,ye);if(!n||!r)throw Error(`Failed to create shaders`);let i=be(t,n,r);if(!i)throw Error(`Failed to create shader program`);let a=window.devicePixelRatio||1,s=new Map,c={attributes:{startPosition:t.getAttribLocation(i,`a_startPosition`),velocity:t.getAttribLocation(i,`a_velocity`),startTime:t.getAttribLocation(i,`a_startTime`),lifetime:t.getAttribLocation(i,`a_lifetime`),size:t.getAttribLocation(i,`a_size`),baseOpacity:t.getAttribLocation(i,`a_baseOpacity`),color:t.getAttribLocation(i,`a_color`)},uniforms:{resolution:t.getUniformLocation(i,`u_resolution`),time:t.getUniformLocation(i,`u_time`),canvasWidth:t.getUniformLocation(i,`u_canvasWidth`),canvasHeight:t.getUniformLocation(i,`u_canvasHeight`),accelerationFactor:t.getUniformLocation(i,`u_accelerationFactor`),fadeInTime:t.getUniformLocation(i,`u_fadeInTime`),fadeOutTime:t.getUniformLocation(i,`u_fadeOutTime`),edgeFadeZone:t.getUniformLocation(i,`u_edgeFadeZone`),rotationMatrices:t.getUniformLocation(i,`u_rotationMatrices`),spawnCenter:t.getUniformLocation(i,`u_spawnCenter`)}},l,u;function d(e){let n=new xe(e.seed),{config:r}=e,i=new Float32Array(r.particleCount*2),o=new Float32Array(r.particleCount*2),s=new Float32Array(r.particleCount),c=new Float32Array(r.particleCount),l=new Float32Array(r.particleCount),u=new Float32Array(r.particleCount),d=new Float32Array(r.particleCount*3);for(let t=0;t<r.particleCount;t++){let f=n.next()*Math.PI*2,p=n.nextBetween(r.minSpawnRadius,r.maxSpawnRadius),m=Math.cos(f),h=Math.sin(f),g=e.centerX+m*p,_=e.centerY+h*p;i[t*2]=g*a,i[t*2+1]=_*a,c[t]=n.nextBetween(r.minLifetime,r.maxLifetime),s[t]=n.next()*r.maxStartTimeDelay;let v=n.nextBetween(e.avgDistance*r.distanceLimit*.5,e.avgDistance*r.distanceLimit)/c[t]*a;o[t*2]=m*v,o[t*2+1]=h*v;let y=n.next();y<.3?l[t]=r.baseSize*me*a:y<.7?l[t]=r.baseSize*he*a:l[t]=r.baseSize*ge*a,u[t]=n.nextBetween(.3,.8);let[b,x,S]=Ce(r.color,n).coords;d[t*3]=b||0,d[t*3+1]=x||0,d[t*3+2]=S||0}t.bindBuffer(t.ARRAY_BUFFER,e.buffers.startPosition),t.bufferData(t.ARRAY_BUFFER,i,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.velocity),t.bufferData(t.ARRAY_BUFFER,o,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.startTime),t.bufferData(t.ARRAY_BUFFER,s,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.lifetime),t.bufferData(t.ARRAY_BUFFER,c,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.size),t.bufferData(t.ARRAY_BUFFER,l,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.baseOpacity),t.bufferData(t.ARRAY_BUFFER,u,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.color),t.bufferData(t.ARRAY_BUFFER,d,t.STATIC_DRAW)}function f(){let n=0,r=0;s.forEach(e=>{n=Math.max(n,e.config.width),r=Math.max(r,e.config.height)}),s.size===0&&(n=L.width,r=L.height),(e.width!==n*a||e.height!==r*a)&&(e.width=n*a,e.height=r*a,e.style.width=n+`px`,e.style.height=r+`px`),t.viewport(0,0,e.width,e.height)}function p(){t.useProgram(i),t.uniform2f(c.uniforms.resolution,e.width,e.height),t.uniformMatrix2fv(c.uniforms.rotationMatrices,!1,Se()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.clearColor(0,0,0,0)}function m(e){l&&=(t.clear(t.COLOR_BUFFER_BIT),s.forEach(n=>{let r=(e-n.startTime)/1e3;t.uniform1f(c.uniforms.time,r),t.uniform1f(c.uniforms.canvasWidth,n.config.width*a),t.uniform1f(c.uniforms.canvasHeight,n.config.height*a),t.uniform1f(c.uniforms.accelerationFactor,n.config.accelerationFactor),t.uniform1f(c.uniforms.fadeInTime,n.config.fadeInTime),t.uniform1f(c.uniforms.fadeOutTime,n.config.fadeOutTime),t.uniform1f(c.uniforms.edgeFadeZone,n.config.edgeFadeZone*a),t.uniform2f(c.uniforms.spawnCenter,n.centerX*a,n.centerY*a),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.startPosition),t.enableVertexAttribArray(c.attributes.startPosition),t.vertexAttribPointer(c.attributes.startPosition,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.velocity),t.enableVertexAttribArray(c.attributes.velocity),t.vertexAttribPointer(c.attributes.velocity,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.startTime),t.enableVertexAttribArray(c.attributes.startTime),t.vertexAttribPointer(c.attributes.startTime,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.lifetime),t.enableVertexAttribArray(c.attributes.lifetime),t.vertexAttribPointer(c.attributes.lifetime,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.size),t.enableVertexAttribArray(c.attributes.size),t.vertexAttribPointer(c.attributes.size,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.baseOpacity),t.enableVertexAttribArray(c.attributes.baseOpacity),t.vertexAttribPointer(c.attributes.baseOpacity,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.color),t.enableVertexAttribArray(c.attributes.color),t.vertexAttribPointer(c.attributes.color,3,t.FLOAT,!1,0,0),t.drawArrays(t.POINTS,0,n.config.particleCount)}),requestAnimationFrame(m))}function h(e){let n=ee(),r={...L,...e},i={id:n,config:r,buffers:{startPosition:t.createBuffer(),velocity:t.createBuffer(),startTime:t.createBuffer(),lifetime:t.createBuffer(),size:t.createBuffer(),baseOpacity:t.createBuffer(),color:t.createBuffer()},startTime:performance.now(),seed:Math.floor(Math.random()*1e6),centerX:r.width/2+r.centerShift[0],centerY:r.height/2+r.centerShift[1],avgDistance:(r.width/2+r.height/2)/2};return s.set(n,i),d(i),f(),r.selfDestroyTime&&(i.selfDestroyTimeout=window.setTimeout(()=>{g(n)},r.selfDestroyTime*1e3)),s.size===1&&(p(),u=o.subscribe(()=>{let e=!o();e&&!l?l=requestAnimationFrame(m):!e&&l&&(cancelAnimationFrame(l),l=void 0)}),l=requestAnimationFrame(m)),()=>g(n)}function g(e){let n=s.get(e);n&&(n.selfDestroyTimeout&&clearTimeout(n.selfDestroyTimeout),Object.values(n.buffers).forEach(e=>{e&&t.deleteBuffer(e)}),s.delete(e),s.size===0&&_())}function _(){l!==void 0&&(cancelAnimationFrame(l),l=void 0),u?.(),s.clear(),t.deleteProgram(i),t.deleteShader(n),t.deleteShader(r),R.delete(e)}return{addSystem:h}}var ve=`
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
`,ye=`
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
`;function B(e,t,n){let r=e.createShader(t);if(r){if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){e.deleteShader(r);return}return r}}function be(e,t,n){let r=e.createProgram();if(r){if(e.attachShader(r,t),e.attachShader(r,n),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS)){e.deleteProgram(r);return}return r}}var xe=class{seed;constructor(e){this.seed=e}next(){return this.seed=(this.seed*9301+49297)%233280,this.seed/233280}nextBetween(e,t){return e+(t-e)*this.next()}},V;function Se(){if(!V){V=new Float32Array(72);for(let e=0;e<18;e++){let t=220*Math.PI/180*e,n=Math.cos(t),r=Math.sin(t);V[e*4]=n,V[e*4+1]=r,V[e*4+2]=-r,V[e*4+3]=n}}return V}function Ce(e,t){if(`coords`in e)return e;let[n,r]=e,[i,a,o]=n.coords,[s,c,l]=r.coords;return k({space:`srgb`,coords:[t.nextBetween(i||0,s||0),t.nextBetween(a||0,c||0),t.nextBetween(o||0,l||0)]})}var we={sparkles:`JxY8hVTW`},Te={centerShift:[0,-36]},Ee=8,De=E(({color:e=`purple`,centerShift:t=Te.centerShift,isDisabled:n,className:i,onRequestAnimation:a})=>{let o=w(),c=w(0);return D(()=>{if(!n)return z(o.current,{color:fe[`${e}Gradient`],centerShift:t})},[t,e,n]),C(()=>{a&&a(()=>{if(n)return;let r=Date.now();r-c.current<Ee||(c.current=r,z(o.current,{color:fe[`${e}Gradient`],centerShift:t,...pe}))})},[t,e,n,a]),r(`canvas`,{ref:o,className:s(we.sparkles,i)})}),Oe={root:`CHDf16MJ`,diamond:`UM7C8oRj`},ke=new URL(`diamond-57JalFxA.png`,import.meta.url).href,Ae=5,je=1,Me=300,Ne=1500,H,U=!0,Pe={isCancelled:!1};function Fe({className:e,onMouseMove:t}){let[n,i]=S(je),a=d(()=>{H&&=(clearTimeout(H),void 0),H=window.setTimeout(()=>{let e=Date.now();U=!0,P(()=>{if(!U)return!1;let t=Math.min((Date.now()-e)/Ne,1),n=4*(1-Le(t));return i(n),U=t<1&&n>1,U},b,Pe)},Me),U=!1,i(Ae),t()});return r(`div`,{className:s(Oe.root,e),children:r(`div`,{className:Oe.diamond,onMouseMove:a,children:r(N,{speed:n,size:130,tgsUrl:m.Diamond,previewUrl:ke,nonInteractive:!0,noLoop:!1})})})}var Ie=E(Fe);function Le(e){return 1-(1-e)**2}var W={root:`QcfrGLdX`,star:`nDPg-zs5`,star_purple:`-f2S1Tk6`,starPurple:`-f2S1Tk6`},Re=50;function ze({className:e,color:t,centerShift:n,onMouseMove:i}){let a=w(),o=d(e=>{let t=e.currentTarget.getBoundingClientRect(),r=t.left+t.width/2+n[0],o=t.top+t.height/2+n[1],s=e.clientX-r,c=e.clientY-o,l=Math.max(-1,Math.min(1,s/Re)),u=Math.max(-1,Math.min(1,c/Re)),d=l*40,f=-u*40;b(()=>{a.current.style.transform=`scale(1.1) rotateX(${f}deg) rotateY(${d}deg)`}),i()}),c=d(()=>{b(()=>{a.current.style.transform=``})});return r(`div`,{className:s(W.root,e),onMouseMove:o,onMouseLeave:c,children:r(`div`,{ref:a,className:s(W.star,W[`star_${t}`]),role:`img`,"aria-label":`Telegram Stars`})})}var Be=E(ze),G={root:`cK6KQXnQ`,"ai-egg":`ZP86O9Hy`,aiEgg:`ZP86O9Hy`,title:`xRm-Im3m`,description:`IQdQ9MU9`,particles:`_8ooQ3s8b`,stickerWrapper:`hHs2sTV-`,cocoon:`Rlhm9gZk`},Ve=new URL(`cocoon-DzgJltGQ.webp`,import.meta.url).href,K=8*_,He={centerShift:[0,-36]};function Ue({model:e,sticker:t,color:n,title:a,description:o,isDisabled:c,className:l,modelClassName:u}){let f=w(),p=w(),m=d(()=>{p.current?.()}),h=d(e=>{p.current=e});return i(`div`,{className:s(G.root,G[e],l),children:[r(De,{color:n,centerShift:He.centerShift,isDisabled:c,className:G.particles,onRequestAnimation:h}),e===`swaying-star`?r(Be,{className:u,color:n,centerShift:He.centerShift,onMouseMove:m}):e===`ai-egg`?r(`img`,{src:Ve,alt:``,role:`presentation`,"aria-hidden":`true`,className:s(G.cocoon,u),draggable:!1,onMouseMove:m}):e===`speeding-diamond`?r(Ie,{className:u,onMouseMove:m}):e===`sticker`&&t&&r(`div`,{ref:f,className:s(G.stickerWrapper,u),style:`width: ${K}px; height: ${K}px`,onMouseMove:m,children:r(j,{containerRef:f,sticker:t,size:K,shouldPreloadPreview:!0,shouldLoop:!0})}),r(`h2`,{className:G.title,children:a}),r(`div`,{className:G.description,children:o})]})}var We=E(Ue),q={root:`_7NV36hp3`,wrapper:`_32sWnI-2`,down:`DkDmNeYG`,frame:`M0hUT4cv`,video:`eWi57MWV`,placeholder:`A38HRiXg`},Ge=new URL(`DeviceFrame-Dqm_t18H.svg`,import.meta.url).href,Ke=E(({videoId:e,videoThumbnail:t,isActive:n,isReverseAnimation:a,isDown:o,index:c,className:l,wrapperClassName:u})=>{let d=ie(e?`document${e}`:void 0),f=te(t?.dataUri),p=A(d);return r(`div`,{className:s(q.root,l),children:i(`div`,{className:s(q.wrapper,a&&q.reverse,o&&q.down,u),id:c===void 0?void 0:`premium_feature_preview_video_${c}`,children:[r(`img`,{src:Ge,alt:``,className:q.frame,draggable:!1}),!e&&r(`div`,{className:q.placeholder}),t&&r(`canvas`,{ref:f,className:q.video}),e&&r(re,{canPlay:!!n,className:s(q.video,p),src:d,disablePictureInPicture:!0,playsInline:!0,muted:!0,loop:!0})]})})}),J={options:`Upert7zo`,option:`_2X6-9ciP`,active:`zpGahRpW`,wideOption:`dI8-J8yI`,optionTop:`wgA5YkCl`,stackedStars:`TZ71sXrE`,stackedStar:`_6CGkOJue`,optionBottom:`GRPtw1Lm`,moreOptions:`cY6CHTaj`,iconDown:`qdRs-uv4`},qe=6,Je=E(({isActive:t,className:o,options:l,selectedStarOption:d,selectedStarCount:p,starsNeeded:m,onClick:_})=>{let y=e(),b=c(),[x,S,w]=n();C(()=>{t||w()},[t]);let[T,E]=O(()=>{if(!l)return[void 0,!1];let e=l.reduce((e,t)=>e.stars>t.stars?e:t),t=m&&e.stars<m,n=[],r=0,i=!1;return l.forEach((e,a)=>{if(e.isExtended||r++,!(m&&!t&&e.stars<m)){if(!x&&e.isExtended){i=!0;return}n.push({option:e,starsCount:Math.min(r,qe),isWide:a===l.length-1})}}),[n,i]},[x,l,m]);return i(`div`,{className:s(J.options,o),children:[T?.map(({option:e,starsCount:t,isWide:n})=>{let o=T?.length%2==0,c=e===d,l;return e&&`winners`in e&&(l=(e.winners.find(e=>e.users===p)||e.winners.reduce((e,t)=>t.users>e.users?t:e,e.winners[0]))?.perUserStars),i(`div`,{className:s(J.option,!o&&n&&J.wideOption,c&&J.active),onClick:()=>_?.(e),children:[i(`div`,{className:J.optionTop,children:[`+`,a(e.stars),r(`div`,{className:J.stackedStars,dir:b.isRtl?`ltr`:`rtl`,children:Array.from({length:t}).map(()=>r(g,{className:J.stackedStar,type:`gold`,size:`big`}))})]}),r(`div`,{className:J.optionBottom,children:u(b,e.amount,e.currency)}),(c||d&&`winners`in d)&&!!l&&r(`div`,{className:J.optionBottom,children:r(`div`,{className:J.perUserStars,children:v(y(`BoostGift.Stars.PerUser`,a(l)))})})]},e.stars)}),!x&&E&&i(h,{className:J.moreOptions,isText:!0,noForcedUpperCase:!0,onClick:S,children:[y(`Stars.Purchase.ShowMore`),r(f,{className:J.iconDown,name:`down`})]})]})}),Y={content:`j63Xdo6p`,fixedHeight:`E-xx83T0`,withSearch:`sT1YPCzK`,header:`RwB3BKcO`,buttonWrapper:`Z-xvJZEk`},Ye=`.${ce.pickerList}`,Xe=E(({confirmButtonText:t,isConfirmDisabled:n,shouldAdaptToSearch:a,withFixedHeight:o,onConfirm:c,withPremiumGradient:l,itemsContainerSelector:u=Ye,...d})=>{let f=e(),p=!!(t||c),m=w();return oe({containerRef:m,selector:`.modal-content ${u}`,isBottomNotch:p,shouldHideTopNotch:!0},[d.isOpen]),i(F,{...d,dialogRef:m,isSlim:!0,className:s(a&&Y.withSearch,o&&Y.fixedHeight,d.className),contentClassName:s(Y.content,d.contentClassName),headerClassName:s(Y.header,d.headerClassName),isCondensedHeader:!0,children:[d.children,p&&r(`div`,{className:Y.buttonWrapper,children:r(h,{withPremiumGradient:l,onClick:c||d.onClose,color:`primary`,disabled:n,children:t||f(`Confirm`)})})]})}),X={table:`RMEi5Sgb`,cell:`AEl8NMjg`,title:`IypKoG1m`,value:`ZO-KCUSl`,fullWidth:`_1WIqSuNB`,chatItem:`J6it2-iy`},Ze=E(({tableData:e,className:n,onChatClick:a})=>{let{openChat:o}=l(),c=d(e=>{a?a(e):o({id:e})});if(e?.length)return r(`div`,{className:s(X.table,n),children:e.map(([e,n])=>i(t,{children:[!!e&&r(`div`,{className:s(X.cell,X.title),children:e}),r(`div`,{className:s(X.cell,X.value,!e&&X.fullWidth),children:typeof n==`object`&&`chatId`in n?r(ne,{peerId:n.chatId,className:X.chatItem,forceShowSelf:!0,withEmojiStatus:n.withEmojiStatus,clickArg:n.chatId,onClick:c}):n})]}))})}),Z={content:`rIjOLQyf`,noFooter:`ssGgYoZw`,avatar:`IdvEatvm`},Qe=E(({isOpen:e,title:t,tableData:n,headerAvatarPeer:a,header:o,modalHeader:c,footer:u,buttonText:f,className:p,contentClassName:m,tableClassName:g,hasBackdrop:_,closeButtonColor:v,moreMenuItems:y,headerRightToolBar:b,onClose:x,onButtonClick:S,withBalanceBar:C,isLowStackPriority:w,currencyInBalanceBar:T})=>{let{openChat:E}=l(),D=d(e=>{E({id:e}),x()});return i(F,{isOpen:e,hasCloseButton:!!t,hasAbsoluteCloseButton:!t,absoluteCloseButtonColor:v||(_?`translucent-white`:void 0),isSlim:!0,header:c,title:t,className:p,contentClassName:s(Z.content,m),moreMenuItems:y,headerRightToolBar:b,onClose:x,withBalanceBar:C,currencyInBalanceBar:T,isLowStackPriority:w,children:[a&&r(M,{peer:a,size:`jumbo`,className:Z.avatar}),o,r(Ze,{tableData:n,className:g,onChatClick:D}),u,f&&r(h,{className:u?void 0:Z.noFooter,onClick:S||x,children:f})]})}),Q={root:`FEEwg5rl`,secondary:`_51eeI1vd`,topIcon:`_0fVPMdEi`,premiumGradient:`oEaPoig5`,content:`_7xJ2IMc7`,listItems:`_4Smlf3-h`,listItemTitle:`lPVHA-w3`,separator:`V6iMhrLh`},$e=E(({className:e,isOpen:t,listItemData:n,headerIconName:a,headerIconPremiumGradient:o,header:c,footer:l,buttonText:u,hasBackdrop:d,absoluteCloseButtonColor:p,withSeparator:m,contentClassName:g,onClose:_,onButtonClick:v})=>i(F,{isOpen:t,className:s(Q.root,e),contentClassName:s(Q.content,g),hasAbsoluteCloseButton:!0,absoluteCloseButtonColor:p||(d?`translucent-white`:void 0),onClose:_,children:[a&&r(`div`,{className:s(Q.topIcon,o&&Q.premiumGradient),children:r(f,{name:a})}),c,r(`div`,{className:Q.listItems,children:n?.map(([e,t,n])=>i(ae,{isStatic:!0,multiline:!0,icon:e,className:Q.listItem,children:[r(`span`,{className:s(`title`,Q.listItemTitle),children:t}),r(`span`,{className:`subtitle`,children:n})]}))}),m&&r(se,{className:Q.separator}),l,!!u&&r(h,{onClick:v||_,children:u})]})),$={root:`JaXKxj2K`,arrow:`_-7ow-ETi`},et=4*_,tt=E(({fromPeer:e,toPeer:t,avatarSize:n=et})=>i(`div`,{className:$.root,children:[r(M,{peer:e,size:n}),r(f,{name:`next`,className:$.arrow}),r(M,{peer:t,size:n})]}));export{Xe as a,We as c,le as d,Ze as i,De as l,$e as n,Je as o,Qe as r,Ke as s,tt as t,ue as u};
//# sourceMappingURL=TransferBetweenPeers-CcTUeYoz.js.map