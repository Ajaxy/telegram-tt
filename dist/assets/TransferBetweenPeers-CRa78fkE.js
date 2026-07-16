import{$g as e,Ag as t,An as n,Bg as r,Ha as i,Hg as a,Ig as o,In as s,Jg as c,K as l,Kg as u,Lg as d,Ln as f,Mn as p,Or as m,Qn as h,R as g,Rg as _,Ti as v,Ui as y,Ur as b,Wg as x,Wt as S,Xg as ee,Yc as te,Yg as ne,Zc as C,Zf as re,Zg as w,_l as T,_r as E,cp as D,gt as O,h as ie,jr as ae,kg as oe,n_ as se,nr as ce,op as le,qa as ue,rr as de,s_ as k,tu as fe,up as A,wn as pe,yt as j}from"./shared-components-B7m46VYl.js";import{g as me}from"./folderManager-C8-QQMoW.js";import{n as he}from"./usePrevious-DMS8JSJi.js";import{n as ge}from"./animatedAssets-DGakmVlt.js";import{P as _e,St as ve,nt as ye,vt as be,wt as xe}from"./ActionMessage-D0rF9y6G.js";var M={root:`Kdv89j1l`,top:`_0EdTY2mJ`,badge:`TvB5YSlK`,text:`lZY9nXge`},Se=x(({peer:e,avatarWebPhoto:t,avatarSize:n,text:r,badgeText:i,badgeIcon:a,className:o,badgeClassName:s,badgeIconClassName:c,textClassName:l,onClick:u})=>{let f=pe();return _(`div`,{className:A(M.root,u&&M.clickable,o),onClick:u,children:[_(`div`,{className:M.top,children:[d(O,{size:n,peer:e,webPhoto:t}),i&&_(`div`,{className:A(M.badge,s),dir:f.isRtl?`rtl`:`ltr`,children:[a&&d(D,{name:a,className:c}),i]})]}),r&&d(`p`,{className:A(M.text,l),children:r})]})}),N=new E(`#0098EA`),P={blue:N,blueGradient:[new E(`#0158AF`),new E(`#67D0FF`)],purple:new E(`#966FFE`),purpleGradient:[new E(`#6B93FF`),new E(`#E46ACE`)],gold:new E(`#FFBF0A`),goldGradient:[new E(`#FDEB32`),new E(`#D75902`)]},Ce={particleCount:5,distanceLimit:1,fadeInTime:.05,minLifetime:3,maxLifetime:3,maxStartTimeDelay:0,selfDestroyTime:3,minSpawnRadius:5,maxSpawnRadius:50},F={width:350,height:230,particleCount:100,color:N,speed:18,baseSize:6,minSpawnRadius:35,maxSpawnRadius:70,distanceLimit:.7,fadeInTime:.25,fadeOutTime:1,minLifetime:4,maxLifetime:6,maxStartTimeDelay:3,edgeFadeZone:50,centerShift:[0,0],accelerationFactor:3,selfDestroyTime:0},we=.67,Te=1.33,Ee=2.2,I=new Map;function L(e,t){let n=I.get(e);return n||(n=De(e),I.set(e,n)),n.addSystem(t)}function De(e){let t=e.getContext(`webgl`,{alpha:!0,antialias:!1,preserveDrawingBuffer:!1});if(!t)throw Error(`WebGL not supported`);let n=R(t,t.VERTEX_SHADER,Oe),i=R(t,t.FRAGMENT_SHADER,ke);if(!n||!i)throw Error(`Failed to create shaders`);let a=Ae(t,n,i);if(!a)throw Error(`Failed to create shader program`);let o=window.devicePixelRatio||1,s=new Map,c={attributes:{startPosition:t.getAttribLocation(a,`a_startPosition`),velocity:t.getAttribLocation(a,`a_velocity`),startTime:t.getAttribLocation(a,`a_startTime`),lifetime:t.getAttribLocation(a,`a_lifetime`),size:t.getAttribLocation(a,`a_size`),baseOpacity:t.getAttribLocation(a,`a_baseOpacity`),color:t.getAttribLocation(a,`a_color`)},uniforms:{resolution:t.getUniformLocation(a,`u_resolution`),time:t.getUniformLocation(a,`u_time`),canvasWidth:t.getUniformLocation(a,`u_canvasWidth`),canvasHeight:t.getUniformLocation(a,`u_canvasHeight`),accelerationFactor:t.getUniformLocation(a,`u_accelerationFactor`),fadeInTime:t.getUniformLocation(a,`u_fadeInTime`),fadeOutTime:t.getUniformLocation(a,`u_fadeOutTime`),edgeFadeZone:t.getUniformLocation(a,`u_edgeFadeZone`),rotationMatrices:t.getUniformLocation(a,`u_rotationMatrices`),spawnCenter:t.getUniformLocation(a,`u_spawnCenter`)}},l,u;function d(e){let n=new je(e.seed),{config:r}=e,i=new Float32Array(r.particleCount*2),a=new Float32Array(r.particleCount*2),s=new Float32Array(r.particleCount),c=new Float32Array(r.particleCount),l=new Float32Array(r.particleCount),u=new Float32Array(r.particleCount),d=new Float32Array(r.particleCount*3);for(let t=0;t<r.particleCount;t++){let f=n.next()*Math.PI*2,p=n.nextBetween(r.minSpawnRadius,r.maxSpawnRadius),m=Math.cos(f),h=Math.sin(f),g=e.centerX+m*p,_=e.centerY+h*p;i[t*2]=g*o,i[t*2+1]=_*o,c[t]=n.nextBetween(r.minLifetime,r.maxLifetime),s[t]=n.next()*r.maxStartTimeDelay;let v=n.nextBetween(e.avgDistance*r.distanceLimit*.5,e.avgDistance*r.distanceLimit)/c[t]*o;a[t*2]=m*v,a[t*2+1]=h*v;let y=n.next();y<.3?l[t]=r.baseSize*we*o:y<.7?l[t]=r.baseSize*Te*o:l[t]=r.baseSize*Ee*o,u[t]=n.nextBetween(.3,.8);let[b,x,S]=Ne(r.color,n).coords;d[t*3]=b||0,d[t*3+1]=x||0,d[t*3+2]=S||0}t.bindBuffer(t.ARRAY_BUFFER,e.buffers.startPosition),t.bufferData(t.ARRAY_BUFFER,i,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.velocity),t.bufferData(t.ARRAY_BUFFER,a,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.startTime),t.bufferData(t.ARRAY_BUFFER,s,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.lifetime),t.bufferData(t.ARRAY_BUFFER,c,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.size),t.bufferData(t.ARRAY_BUFFER,l,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.baseOpacity),t.bufferData(t.ARRAY_BUFFER,u,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.color),t.bufferData(t.ARRAY_BUFFER,d,t.STATIC_DRAW)}function p(){let n=0,r=0;s.forEach(e=>{n=Math.max(n,e.config.width),r=Math.max(r,e.config.height)}),s.size===0&&(n=F.width,r=F.height),(e.width!==n*o||e.height!==r*o)&&(e.width=n*o,e.height=r*o,e.style.width=n+`px`,e.style.height=r+`px`),t.viewport(0,0,e.width,e.height)}function m(){t.useProgram(a),t.uniform2f(c.uniforms.resolution,e.width,e.height),t.uniformMatrix2fv(c.uniforms.rotationMatrices,!1,Me()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.clearColor(0,0,0,0)}function h(e){l&&=(t.clear(t.COLOR_BUFFER_BIT),s.forEach(n=>{let r=(e-n.startTime)/1e3;t.uniform1f(c.uniforms.time,r),t.uniform1f(c.uniforms.canvasWidth,n.config.width*o),t.uniform1f(c.uniforms.canvasHeight,n.config.height*o),t.uniform1f(c.uniforms.accelerationFactor,n.config.accelerationFactor),t.uniform1f(c.uniforms.fadeInTime,n.config.fadeInTime),t.uniform1f(c.uniforms.fadeOutTime,n.config.fadeOutTime),t.uniform1f(c.uniforms.edgeFadeZone,n.config.edgeFadeZone*o),t.uniform2f(c.uniforms.spawnCenter,n.centerX*o,n.centerY*o),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.startPosition),t.enableVertexAttribArray(c.attributes.startPosition),t.vertexAttribPointer(c.attributes.startPosition,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.velocity),t.enableVertexAttribArray(c.attributes.velocity),t.vertexAttribPointer(c.attributes.velocity,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.startTime),t.enableVertexAttribArray(c.attributes.startTime),t.vertexAttribPointer(c.attributes.startTime,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.lifetime),t.enableVertexAttribArray(c.attributes.lifetime),t.vertexAttribPointer(c.attributes.lifetime,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.size),t.enableVertexAttribArray(c.attributes.size),t.vertexAttribPointer(c.attributes.size,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.baseOpacity),t.enableVertexAttribArray(c.attributes.baseOpacity),t.vertexAttribPointer(c.attributes.baseOpacity,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.color),t.enableVertexAttribArray(c.attributes.color),t.vertexAttribPointer(c.attributes.color,3,t.FLOAT,!1,0,0),t.drawArrays(t.POINTS,0,n.config.particleCount)}),requestAnimationFrame(h))}function g(e){let n=r(),i={...F,...e},a={id:n,config:i,buffers:{startPosition:t.createBuffer(),velocity:t.createBuffer(),startTime:t.createBuffer(),lifetime:t.createBuffer(),size:t.createBuffer(),baseOpacity:t.createBuffer(),color:t.createBuffer()},startTime:performance.now(),seed:Math.floor(Math.random()*1e6),centerX:i.width/2+i.centerShift[0],centerY:i.height/2+i.centerShift[1],avgDistance:(i.width/2+i.height/2)/2};return s.set(n,a),d(a),p(),i.selfDestroyTime&&(a.selfDestroyTimeout=window.setTimeout(()=>{_(n)},i.selfDestroyTime*1e3)),s.size===1&&(m(),u=f.subscribe(()=>{let e=!f();e&&!l?l=requestAnimationFrame(h):!e&&l&&(cancelAnimationFrame(l),l=void 0)}),l=requestAnimationFrame(h)),()=>_(n)}function _(e){let n=s.get(e);n&&(n.selfDestroyTimeout&&clearTimeout(n.selfDestroyTimeout),Object.values(n.buffers).forEach(e=>{e&&t.deleteBuffer(e)}),s.delete(e),s.size===0&&v())}function v(){l!==void 0&&(cancelAnimationFrame(l),l=void 0),u?.(),s.clear(),t.deleteProgram(a),t.deleteShader(n),t.deleteShader(i),I.delete(e)}return{addSystem:g}}var Oe=`
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
`,ke=`
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
`;function R(e,t,n){let r=e.createShader(t);if(r){if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){e.deleteShader(r);return}return r}}function Ae(e,t,n){let r=e.createProgram();if(r){if(e.attachShader(r,t),e.attachShader(r,n),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS)){e.deleteProgram(r);return}return r}}var je=class{seed;constructor(e){this.seed=e}next(){return this.seed=(this.seed*9301+49297)%233280,this.seed/233280}nextBetween(e,t){return e+(t-e)*this.next()}},z;function Me(){if(!z){z=new Float32Array(72);for(let e=0;e<18;e++){let t=220*Math.PI/180*e,n=Math.cos(t),r=Math.sin(t);z[e*4]=n,z[e*4+1]=r,z[e*4+2]=-r,z[e*4+3]=n}}return z}function Ne(e,t){if(e instanceof E)return e;let[n,r]=e,[i,a,o]=n.coords,[s,c,l]=r.coords;return new E(`srgb`,[t.nextBetween(i||0,s||0),t.nextBetween(a||0,c||0),t.nextBetween(o||0,l||0)])}var Pe={sparkles:`JxY8hVTW`},Fe={centerShift:[0,-36]},Ie=8,B=x(({color:e=`purple`,centerShift:t=Fe.centerShift,isDisabled:n,className:r,onRequestAnimation:i})=>{let a=w(),o=w(0);return ne(()=>{if(!n)return L(a.current,{color:P[`${e}Gradient`],centerShift:t})},[t,e,n]),c(()=>{i&&i(()=>{if(n)return;let r=Date.now();r-o.current<Ie||(o.current=r,L(a.current,{color:P[`${e}Gradient`],centerShift:t,...Ce}))})},[t,e,n,i]),d(`canvas`,{ref:a,className:A(Pe.sparkles,r)})}),V={root:`CHDf16MJ`,diamond:`UM7C8oRj`},Le=``+new URL(`diamond-57JalFxA.png`,import.meta.url).href,H=5,Re=1,ze=300,Be=1500,U,W=!0,Ve={isCancelled:!1};function He({className:t,onMouseMove:n}){let[r,i]=e(Re),a=C(()=>{U&&=(clearTimeout(U),void 0),U=window.setTimeout(()=>{let e=Date.now();W=!0,S(()=>{if(!W)return!1;let t=Math.min((Date.now()-e)/Be,1),n=(H-Re)*(1-We(t));return i(n),W=t<1&&n>1,W},k,Ve)},ze),W=!1,i(H),n()});return d(`div`,{className:A(V.root,t),children:d(`div`,{className:V.diamond,onMouseMove:a,children:d(he,{speed:r,size:130,tgsUrl:ge.Diamond,previewUrl:Le,nonInteractive:!0,noLoop:!1})})})}var Ue=x(He);function We(e){return 1-(1-e)**2}var G={root:`QcfrGLdX`,star:`nDPg-zs5`,star_purple:`-f2S1Tk6`,starPurple:`-f2S1Tk6`},Ge=50;function Ke({className:e,color:t,centerShift:n,onMouseMove:r}){let i=w(),a=C(e=>{let t=e.currentTarget.getBoundingClientRect(),a=t.left+t.width/2+n[0],o=t.top+t.height/2+n[1],s=e.clientX-a,c=e.clientY-o,l=Math.max(-1,Math.min(1,s/Ge)),u=Math.max(-1,Math.min(1,c/Ge)),d=l*40,f=-u*40;k(()=>{i.current.style.transform=`scale(1.1) rotateX(${f}deg) rotateY(${d}deg)`}),r()}),o=C(()=>{k(()=>{i.current.style.transform=``})});return d(`div`,{className:A(G.root,e),onMouseMove:a,onMouseLeave:o,children:d(`div`,{ref:i,className:A(G.star,G[`star_${t}`]),role:`img`,"aria-label":`Telegram Stars`})})}var qe=x(Ke),K={root:`cK6KQXnQ`,"ai-egg":`ZP86O9Hy`,aiEgg:`ZP86O9Hy`,title:`xRm-Im3m`,description:`IQdQ9MU9`,particles:`_8ooQ3s8b`,stickerWrapper:`hHs2sTV-`,cocoon:`Rlhm9gZk`},Je=``+new URL(`cocoon-DzgJltGQ.webp`,import.meta.url).href,q=8*b,Ye={centerShift:[0,-36]};function Xe({model:e,sticker:t,color:n,title:r,description:i,isDisabled:a,className:o,modelClassName:s}){let c=w(),l=w(),u=C(()=>{l.current?.()}),f=C(e=>{l.current=e});return _(`div`,{className:A(K.root,K[e],o),children:[d(B,{color:n,centerShift:Ye.centerShift,isDisabled:a,className:K.particles,onRequestAnimation:f}),e===`swaying-star`?d(qe,{className:s,color:n,centerShift:Ye.centerShift,onMouseMove:u}):e===`ai-egg`?d(`img`,{src:Je,alt:``,role:`presentation`,"aria-hidden":`true`,className:A(K.cocoon,s),draggable:!1,onMouseMove:u}):e===`speeding-diamond`?d(Ue,{className:s,onMouseMove:u}):e===`sticker`&&t&&d(`div`,{ref:c,className:A(K.stickerWrapper,s),style:`width: ${q}px; height: ${q}px`,onMouseMove:u,children:d(p,{containerRef:c,sticker:t,size:q,shouldPreloadPreview:!0,shouldLoop:!0})}),d(`h2`,{className:K.title,children:r}),d(`div`,{className:K.description,children:i})]})}var Ze=x(Xe),J={root:`_7NV36hp3`,wrapper:`_32sWnI-2`,down:`DkDmNeYG`,frame:`M0hUT4cv`,video:`eWi57MWV`,placeholder:`A38HRiXg`},Qe=``+new URL(`DeviceFrame-Dqm_t18H.svg`,import.meta.url).href,$e=x(({videoId:e,videoThumbnail:t,isActive:n,isReverseAnimation:r,isDown:i,index:a,className:o,wrapperClassName:c})=>{let l=h(e?`document${e}`:void 0),u=be(t?.dataUri),f=me(l);return d(`div`,{className:A(J.root,o),children:_(`div`,{className:A(J.wrapper,r&&J.reverse,i&&J.down,c),id:a===void 0?void 0:`premium_feature_preview_video_${a}`,children:[d(`img`,{src:Qe,alt:``,className:J.frame,draggable:!1}),!e&&d(`div`,{className:J.placeholder}),t&&d(`canvas`,{ref:u,className:J.video}),e&&d(s,{canPlay:!!n,className:A(J.video,f),src:l,disablePictureInPicture:!0,playsInline:!0,muted:!0,loop:!0})]})})}),Y={options:`Upert7zo`,option:`_2X6-9ciP`,active:`zpGahRpW`,wideOption:`dI8-J8yI`,optionTop:`wgA5YkCl`,stackedStars:`TZ71sXrE`,stackedStar:`_6CGkOJue`,optionBottom:`GRPtw1Lm`,moreOptions:`cY6CHTaj`,iconDown:`qdRs-uv4`},et=6,tt=x(({isActive:e,className:t,options:r,selectedStarOption:i,selectedStarCount:a,starsNeeded:o,onClick:s})=>{let l=n(),u=pe(),[f,p,m]=de();c(()=>{e||m()},[e]);let[h,g]=ee(()=>{if(!r)return[void 0,!1];let e=r.reduce((e,t)=>e.stars>t.stars?e:t),t=o&&e.stars<o,n=[],i=0,a=!1;return r.forEach((e,s)=>{if(e.isExtended||i++,!(o&&!t&&e.stars<o)){if(!f&&e.isExtended){a=!0;return}n.push({option:e,starsCount:Math.min(i,et),isWide:s===r.length-1})}}),[n,a]},[f,r,o]);return _(`div`,{className:A(Y.options,t),children:[h?.map(({option:e,starsCount:t,isWide:n})=>{let r=h?.length%2==0,o=e===i,c;return e&&`winners`in e&&(c=(e.winners.find(e=>e.users===a)||e.winners.reduce((e,t)=>t.users>e.users?t:e,e.winners[0]))?.perUserStars),_(`div`,{className:A(Y.option,!r&&n&&Y.wideOption,o&&Y.active),onClick:()=>s?.(e),children:[_(`div`,{className:Y.optionTop,children:[`+`,v(e.stars),d(`div`,{className:Y.stackedStars,dir:u.isRtl?`ltr`:`rtl`,children:Array.from({length:t}).map(()=>d(le,{className:Y.stackedStar,type:`gold`,size:`big`}))})]}),d(`div`,{className:Y.optionBottom,children:re(u,e.amount,e.currency)}),(o||i&&`winners`in i)&&!!c&&d(`div`,{className:Y.optionBottom,children:d(`div`,{className:Y.perUserStars,children:te(l(`BoostGift.Stars.PerUser`,v(c)))})})]},e.stars)}),!f&&g&&_(j,{className:Y.moreOptions,isText:!0,noForcedUpperCase:!0,onClick:p,children:[l(`Stars.Purchase.ShowMore`),d(D,{className:Y.iconDown,name:`down`})]})]})}),X={content:`j63Xdo6p`,fixedHeight:`E-xx83T0`,withSearch:`sT1YPCzK`,header:`RwB3BKcO`,buttonWrapper:`Z-xvJZEk`},nt=`.${ve.pickerList}`,rt=x(({confirmButtonText:e,isConfirmDisabled:t,shouldAdaptToSearch:r,withFixedHeight:i,onConfirm:a,withPremiumGradient:o,itemsContainerSelector:s=nt,...c})=>{let u=n(),f=!!(e||a),p=w();return _e({containerRef:p,selector:`.modal-content ${s}`,isBottomNotch:f,shouldHideTopNotch:!0},[c.isOpen]),_(l,{...c,dialogRef:p,isSlim:!0,className:A(r&&X.withSearch,i&&X.fixedHeight,c.className),contentClassName:A(X.content,c.contentClassName),headerClassName:A(X.header,c.headerClassName),isCondensedHeader:!0,children:[c.children,f&&d(`div`,{className:X.buttonWrapper,children:d(j,{withPremiumGradient:o,onClick:a||c.onClose,color:`primary`,disabled:t,children:e||u(`Confirm`)})})]})}),Z={table:`RMEi5Sgb`,cell:`AEl8NMjg`,title:`IypKoG1m`,value:`ZO-KCUSl`,fullWidth:`_1WIqSuNB`,chatItem:`J6it2-iy`},it=x(({tableData:e,className:t,onChatClick:n})=>{let{openChat:r}=oe(),i=C(e=>{n?n(e):r({id:e})});if(e?.length)return d(`div`,{className:A(Z.table,t),children:e.map(([e,t])=>_(o,{children:[!!e&&d(`div`,{className:A(Z.cell,Z.title),children:e}),d(`div`,{className:A(Z.cell,Z.value,!e&&Z.fullWidth),children:typeof t==`object`&&`chatId`in t?d(xe,{peerId:t.chatId,className:Z.chatItem,forceShowSelf:!0,withEmojiStatus:t.withEmojiStatus,clickArg:t.chatId,onClick:i}):t})]}))})}),Q={content:`rIjOLQyf`,noFooter:`ssGgYoZw`,avatar:`IdvEatvm`},at=x(({isOpen:e,title:t,tableData:n,headerAvatarPeer:r,header:i,modalHeader:a,footer:o,buttonText:s,className:c,contentClassName:u,tableClassName:f,hasBackdrop:p,closeButtonColor:m,moreMenuItems:h,headerRightToolBar:g,onClose:v,onButtonClick:y,withBalanceBar:b,isLowStackPriority:x,currencyInBalanceBar:S})=>{let{openChat:ee}=oe(),te=C(e=>{ee({id:e}),v()});return _(l,{isOpen:e,hasCloseButton:!!t,hasAbsoluteCloseButton:!t,absoluteCloseButtonColor:m||(p?`translucent-white`:void 0),isSlim:!0,header:a,title:t,className:c,contentClassName:A(Q.content,u),moreMenuItems:h,headerRightToolBar:g,onClose:v,withBalanceBar:b,currencyInBalanceBar:S,isLowStackPriority:x,children:[r&&d(O,{peer:r,size:`jumbo`,className:Q.avatar}),i,d(it,{tableData:n,className:f,onChatClick:te}),o,s&&d(j,{className:o?void 0:Q.noFooter,onClick:y||v,children:s})]})}),$={root:`FEEwg5rl`,secondary:`_51eeI1vd`,topIcon:`_0fVPMdEi`,premiumGradient:`oEaPoig5`,content:`_7xJ2IMc7`,listItems:`_4Smlf3-h`,listItemTitle:`lPVHA-w3`,separator:`V6iMhrLh`},ot=x(({className:e,isOpen:t,listItemData:n,headerIconName:r,headerIconPremiumGradient:i,header:a,footer:o,buttonText:s,hasBackdrop:c,absoluteCloseButtonColor:u,withSeparator:f,contentClassName:p,onClose:m,onButtonClick:h})=>_(l,{isOpen:t,className:A($.root,e),contentClassName:A($.content,p),hasAbsoluteCloseButton:!0,absoluteCloseButtonColor:u||(c?`translucent-white`:void 0),onClose:m,children:[r&&d(`div`,{className:A($.topIcon,i&&$.premiumGradient),children:d(D,{name:r})}),a,d(`div`,{className:$.listItems,children:n?.map(([e,t,n])=>_(g,{isStatic:!0,multiline:!0,icon:e,className:$.listItem,children:[d(`span`,{className:A(`title`,$.listItemTitle),children:t}),d(`span`,{className:`subtitle`,children:n})]}))}),f&&d(ie,{className:$.separator}),o,!!s&&d(j,{onClick:h||m,children:s})]}));function st(t,n,r){let[i,a]=e(),{isFrozen:o,updateWhenUnfrozen:s}=ct(),c=ye(n,!0);return m(()=>{if(o){s();return}c(()=>{a(t())})},[...r,o]),i}function ct(){let e=w(!1),t=u(()=>{e.current=!0},[]),n=a();return ce(lt,u(()=>{e.current&&(e.current=!1,n())},[n])),{isFrozen:se(),updateWhenUnfrozen:t}}function lt(){}var ut=300;async function dt(e){let t=await T(`searchChats`,{query:e});if(t)return[...t.accountResultIds,...t.globalResultIds]}function ft(e){return async n=>{let r=n.trim();if(i(e)){let n=fe(t(),e.id)?.members?.map(e=>e.userId)||[];return r?y({ids:n,query:r,type:`user`}):n}let a=(await T(`fetchMembers`,{chat:e,memberFilter:r?`search`:`recent`,query:r}))?.members?.map(e=>e.userId)||[];if(!ue(e))return a;if(!r)return[...a,e.id];let o=y({ids:[e.id],query:r,type:`chat`});return[...a,...o]}}function pt({query:t,queryFn:n=dt,defaultValue:r,debounceTimeout:i=ut,isDisabled:a}){let o=st(()=>t,i,[t]),[s,c]=e(``),l=t&&o,u=C(n);return{...ae(async()=>{if(!l||a)return c(``),Promise.resolve(r);let e=await u(l);return c(l),e},[l,r,u,a],r),currentResultsQuery:s}}var mt={root:`JaXKxj2K`,arrow:`_-7ow-ETi`},ht=4*b,gt=x(({fromPeer:e,toPeer:t,avatarSize:n=ht})=>_(`div`,{className:mt.root,children:[d(O,{peer:e,size:n}),d(D,{name:`next`,className:mt.arrow}),d(O,{peer:t,size:n})]}));export{at as a,tt as c,B as d,Se as f,ot as i,$e as l,ft as n,it as o,pt as r,rt as s,gt as t,Ze as u};
//# sourceMappingURL=TransferBetweenPeers-CRa78fkE.js.map