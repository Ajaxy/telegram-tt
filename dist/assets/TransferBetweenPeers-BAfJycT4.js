import{$g as e,Bg as t,Ca as n,Gg as r,Hc as i,Hn as a,In as o,Kf as s,Mg as c,Ng as l,Oa as u,On as d,Qg as f,St as p,Ug as m,Un as h,V as g,Vg as _,Vr as v,Wc as y,Y as b,Yg as x,Yl as S,Zg as C,a_ as ee,cp as w,cr as te,e_ as T,ir as ne,jr as re,ki as ie,lr as ae,m as oe,n_ as E,pc as se,pp as D,qg as O,qt as ce,rp as k,tp as le,u_ as A,ul as ue,wr as j,yt as M,zg as de,zn as fe}from"./shared-components-BsvtxSL0.js";import{g as pe}from"./folderManager-CtiSjF3z.js";import{n as me}from"./usePrevious-CVRPqsXU.js";import{n as he}from"./animatedAssets-DGakmVlt.js";import{Ct as ge,F as _e,_t as ve,rt as ye,xt as be}from"./ActionMessage-BoeKGigK.js";var N={root:`Kdv89j1l`,top:`_0EdTY2mJ`,badge:`TvB5YSlK`,text:`lZY9nXge`},xe=O(({peer:e,avatarWebPhoto:n,avatarSize:r,text:i,badgeText:a,badgeIcon:o,className:s,badgeClassName:c,badgeIconClassName:l,textClassName:u,onClick:f})=>{let p=d();return _(`div`,{className:D(N.root,f&&N.clickable,s),onClick:f,children:[_(`div`,{className:N.top,children:[t(M,{size:r,peer:e,webPhoto:n}),a&&_(`div`,{className:D(N.badge,c),dir:p.isRtl?`rtl`:`ltr`,children:[o&&t(k,{name:o,className:l}),a]})]}),i&&t(`p`,{className:D(N.text,u),children:i})]})}),Se=new j(`#0098EA`),P={blue:Se,blueGradient:[new j(`#0158AF`),new j(`#67D0FF`)],purple:new j(`#966FFE`),purpleGradient:[new j(`#6B93FF`),new j(`#E46ACE`)],gold:new j(`#FFBF0A`),goldGradient:[new j(`#FDEB32`),new j(`#D75902`)]},Ce={particleCount:5,distanceLimit:1,fadeInTime:.05,minLifetime:3,maxLifetime:3,maxStartTimeDelay:0,selfDestroyTime:3,minSpawnRadius:5,maxSpawnRadius:50},F={width:350,height:230,particleCount:100,color:Se,speed:18,baseSize:6,minSpawnRadius:35,maxSpawnRadius:70,distanceLimit:.7,fadeInTime:.25,fadeOutTime:1,minLifetime:4,maxLifetime:6,maxStartTimeDelay:3,edgeFadeZone:50,centerShift:[0,0],accelerationFactor:3,selfDestroyTime:0},we=.67,Te=1.33,Ee=2.2,I=new Map;function L(e,t){let n=I.get(e);return n||(n=De(e),I.set(e,n)),n.addSystem(t)}function De(e){let t=e.getContext(`webgl`,{alpha:!0,antialias:!1,preserveDrawingBuffer:!1});if(!t)throw Error(`WebGL not supported`);let n=R(t,t.VERTEX_SHADER,Oe),r=R(t,t.FRAGMENT_SHADER,ke);if(!n||!r)throw Error(`Failed to create shaders`);let i=Ae(t,n,r);if(!i)throw Error(`Failed to create shader program`);let a=window.devicePixelRatio||1,o=new Map,s={attributes:{startPosition:t.getAttribLocation(i,`a_startPosition`),velocity:t.getAttribLocation(i,`a_velocity`),startTime:t.getAttribLocation(i,`a_startTime`),lifetime:t.getAttribLocation(i,`a_lifetime`),size:t.getAttribLocation(i,`a_size`),baseOpacity:t.getAttribLocation(i,`a_baseOpacity`),color:t.getAttribLocation(i,`a_color`)},uniforms:{resolution:t.getUniformLocation(i,`u_resolution`),time:t.getUniformLocation(i,`u_time`),canvasWidth:t.getUniformLocation(i,`u_canvasWidth`),canvasHeight:t.getUniformLocation(i,`u_canvasHeight`),accelerationFactor:t.getUniformLocation(i,`u_accelerationFactor`),fadeInTime:t.getUniformLocation(i,`u_fadeInTime`),fadeOutTime:t.getUniformLocation(i,`u_fadeOutTime`),edgeFadeZone:t.getUniformLocation(i,`u_edgeFadeZone`),rotationMatrices:t.getUniformLocation(i,`u_rotationMatrices`),spawnCenter:t.getUniformLocation(i,`u_spawnCenter`)}},c,l;function u(e){let n=new je(e.seed),{config:r}=e,i=new Float32Array(r.particleCount*2),o=new Float32Array(r.particleCount*2),s=new Float32Array(r.particleCount),c=new Float32Array(r.particleCount),l=new Float32Array(r.particleCount),u=new Float32Array(r.particleCount),d=new Float32Array(r.particleCount*3);for(let t=0;t<r.particleCount;t++){let f=n.next()*Math.PI*2,p=n.nextBetween(r.minSpawnRadius,r.maxSpawnRadius),m=Math.cos(f),h=Math.sin(f),g=e.centerX+m*p,_=e.centerY+h*p;i[t*2]=g*a,i[t*2+1]=_*a,c[t]=n.nextBetween(r.minLifetime,r.maxLifetime),s[t]=n.next()*r.maxStartTimeDelay;let v=n.nextBetween(e.avgDistance*r.distanceLimit*.5,e.avgDistance*r.distanceLimit)/c[t]*a;o[t*2]=m*v,o[t*2+1]=h*v;let y=n.next();y<.3?l[t]=r.baseSize*we*a:y<.7?l[t]=r.baseSize*Te*a:l[t]=r.baseSize*Ee*a,u[t]=n.nextBetween(.3,.8);let[b,x,S]=Ne(r.color,n).coords;d[t*3]=b||0,d[t*3+1]=x||0,d[t*3+2]=S||0}t.bindBuffer(t.ARRAY_BUFFER,e.buffers.startPosition),t.bufferData(t.ARRAY_BUFFER,i,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.velocity),t.bufferData(t.ARRAY_BUFFER,o,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.startTime),t.bufferData(t.ARRAY_BUFFER,s,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.lifetime),t.bufferData(t.ARRAY_BUFFER,c,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.size),t.bufferData(t.ARRAY_BUFFER,l,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.baseOpacity),t.bufferData(t.ARRAY_BUFFER,u,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.color),t.bufferData(t.ARRAY_BUFFER,d,t.STATIC_DRAW)}function d(){let n=0,r=0;o.forEach(e=>{n=Math.max(n,e.config.width),r=Math.max(r,e.config.height)}),o.size===0&&(n=F.width,r=F.height),(e.width!==n*a||e.height!==r*a)&&(e.width=n*a,e.height=r*a,e.style.width=n+`px`,e.style.height=r+`px`),t.viewport(0,0,e.width,e.height)}function f(){t.useProgram(i),t.uniform2f(s.uniforms.resolution,e.width,e.height),t.uniformMatrix2fv(s.uniforms.rotationMatrices,!1,Me()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.clearColor(0,0,0,0)}function p(e){c&&=(t.clear(t.COLOR_BUFFER_BIT),o.forEach(n=>{let r=(e-n.startTime)/1e3;t.uniform1f(s.uniforms.time,r),t.uniform1f(s.uniforms.canvasWidth,n.config.width*a),t.uniform1f(s.uniforms.canvasHeight,n.config.height*a),t.uniform1f(s.uniforms.accelerationFactor,n.config.accelerationFactor),t.uniform1f(s.uniforms.fadeInTime,n.config.fadeInTime),t.uniform1f(s.uniforms.fadeOutTime,n.config.fadeOutTime),t.uniform1f(s.uniforms.edgeFadeZone,n.config.edgeFadeZone*a),t.uniform2f(s.uniforms.spawnCenter,n.centerX*a,n.centerY*a),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.startPosition),t.enableVertexAttribArray(s.attributes.startPosition),t.vertexAttribPointer(s.attributes.startPosition,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.velocity),t.enableVertexAttribArray(s.attributes.velocity),t.vertexAttribPointer(s.attributes.velocity,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.startTime),t.enableVertexAttribArray(s.attributes.startTime),t.vertexAttribPointer(s.attributes.startTime,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.lifetime),t.enableVertexAttribArray(s.attributes.lifetime),t.vertexAttribPointer(s.attributes.lifetime,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.size),t.enableVertexAttribArray(s.attributes.size),t.vertexAttribPointer(s.attributes.size,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.baseOpacity),t.enableVertexAttribArray(s.attributes.baseOpacity),t.vertexAttribPointer(s.attributes.baseOpacity,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.color),t.enableVertexAttribArray(s.attributes.color),t.vertexAttribPointer(s.attributes.color,3,t.FLOAT,!1,0,0),t.drawArrays(t.POINTS,0,n.config.particleCount)}),requestAnimationFrame(p))}function g(e){let n=m(),r={...F,...e},i={id:n,config:r,buffers:{startPosition:t.createBuffer(),velocity:t.createBuffer(),startTime:t.createBuffer(),lifetime:t.createBuffer(),size:t.createBuffer(),baseOpacity:t.createBuffer(),color:t.createBuffer()},startTime:performance.now(),seed:Math.floor(Math.random()*1e6),centerX:r.width/2+r.centerShift[0],centerY:r.height/2+r.centerShift[1],avgDistance:(r.width/2+r.height/2)/2};return o.set(n,i),u(i),d(),r.selfDestroyTime&&(i.selfDestroyTimeout=window.setTimeout(()=>{_(n)},r.selfDestroyTime*1e3)),o.size===1&&(f(),l=h.subscribe(()=>{let e=!h();e&&!c?c=requestAnimationFrame(p):!e&&c&&(cancelAnimationFrame(c),c=void 0)}),c=requestAnimationFrame(p)),()=>_(n)}function _(e){let n=o.get(e);n&&(n.selfDestroyTimeout&&clearTimeout(n.selfDestroyTimeout),Object.values(n.buffers).forEach(e=>{e&&t.deleteBuffer(e)}),o.delete(e),o.size===0&&v())}function v(){c!==void 0&&(cancelAnimationFrame(c),c=void 0),l?.(),o.clear(),t.deleteProgram(i),t.deleteShader(n),t.deleteShader(r),I.delete(e)}return{addSystem:g}}var Oe=`
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
`;function R(e,t,n){let r=e.createShader(t);if(r){if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){e.deleteShader(r);return}return r}}function Ae(e,t,n){let r=e.createProgram();if(r){if(e.attachShader(r,t),e.attachShader(r,n),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS)){e.deleteProgram(r);return}return r}}var je=class{seed;constructor(e){this.seed=e}next(){return this.seed=(this.seed*9301+49297)%233280,this.seed/233280}nextBetween(e,t){return e+(t-e)*this.next()}},z;function Me(){if(!z){z=new Float32Array(72);for(let e=0;e<18;e++){let t=220*Math.PI/180*e,n=Math.cos(t),r=Math.sin(t);z[e*4]=n,z[e*4+1]=r,z[e*4+2]=-r,z[e*4+3]=n}}return z}function Ne(e,t){if(e instanceof j)return e;let[n,r]=e,[i,a,o]=n.coords,[s,c,l]=r.coords;return new j(`srgb`,[t.nextBetween(i||0,s||0),t.nextBetween(a||0,c||0),t.nextBetween(o||0,l||0)])}var Pe={sparkles:`JxY8hVTW`},Fe={centerShift:[0,-36]},Ie=8,B=O(({color:e=`purple`,centerShift:n=Fe.centerShift,isDisabled:r,className:i,onRequestAnimation:a})=>{let o=T(),s=T(0);return f(()=>{if(!r)return L(o.current,{color:P[`${e}Gradient`],centerShift:n})},[n,e,r]),C(()=>{a&&a(()=>{if(r)return;let t=Date.now();t-s.current<Ie||(s.current=t,L(o.current,{color:P[`${e}Gradient`],centerShift:n,...Ce}))})},[n,e,r,a]),t(`canvas`,{ref:o,className:D(Pe.sparkles,i)})}),V={root:`CHDf16MJ`,diamond:`UM7C8oRj`},Le=``+new URL(`diamond-57JalFxA.png`,import.meta.url).href,H=5,Re=1,ze=300,Be=1500,U,W=!0,Ve={isCancelled:!1};function He({className:e,onMouseMove:n}){let[r,i]=E(Re),a=y(()=>{U&&=(clearTimeout(U),void 0),U=window.setTimeout(()=>{let e=Date.now();W=!0,ce(()=>{if(!W)return!1;let t=Math.min((Date.now()-e)/Be,1),n=(H-Re)*(1-We(t));return i(n),W=t<1&&n>1,W},A,Ve)},ze),W=!1,i(H),n()});return t(`div`,{className:D(V.root,e),children:t(`div`,{className:V.diamond,onMouseMove:a,children:t(me,{speed:r,size:130,tgsUrl:he.Diamond,previewUrl:Le,nonInteractive:!0,noLoop:!1})})})}var Ue=O(He);function We(e){return 1-(1-e)**2}var G={root:`QcfrGLdX`,star:`nDPg-zs5`,star_purple:`-f2S1Tk6`,starPurple:`-f2S1Tk6`},Ge=50;function Ke({className:e,color:n,centerShift:r,onMouseMove:i}){let a=T(),o=y(e=>{let t=e.currentTarget.getBoundingClientRect(),n=t.left+t.width/2+r[0],o=t.top+t.height/2+r[1],s=e.clientX-n,c=e.clientY-o,l=Math.max(-1,Math.min(1,s/Ge)),u=Math.max(-1,Math.min(1,c/Ge)),d=l*40,f=-u*40;A(()=>{a.current.style.transform=`scale(1.1) rotateX(${f}deg) rotateY(${d}deg)`}),i()}),s=y(()=>{A(()=>{a.current.style.transform=``})});return t(`div`,{className:D(G.root,e),onMouseMove:o,onMouseLeave:s,children:t(`div`,{ref:a,className:D(G.star,G[`star_${n}`]),role:`img`,"aria-label":`Telegram Stars`})})}var qe=O(Ke),K={root:`cK6KQXnQ`,"ai-egg":`ZP86O9Hy`,aiEgg:`ZP86O9Hy`,title:`xRm-Im3m`,description:`IQdQ9MU9`,particles:`_8ooQ3s8b`,stickerWrapper:`hHs2sTV-`,cocoon:`Rlhm9gZk`},Je=``+new URL(`cocoon-DzgJltGQ.webp`,import.meta.url).href,q=8*v,Ye={centerShift:[0,-36]};function Xe({model:e,sticker:n,color:r,title:i,description:a,isDisabled:o,className:s,modelClassName:c}){let l=T(),u=T(),d=y(()=>{u.current?.()}),f=y(e=>{u.current=e});return _(`div`,{className:D(K.root,K[e],s),children:[t(B,{color:r,centerShift:Ye.centerShift,isDisabled:o,className:K.particles,onRequestAnimation:f}),e===`swaying-star`?t(qe,{className:c,color:r,centerShift:Ye.centerShift,onMouseMove:d}):e===`ai-egg`?t(`img`,{src:Je,alt:``,role:`presentation`,"aria-hidden":`true`,className:D(K.cocoon,c),draggable:!1,onMouseMove:d}):e===`speeding-diamond`?t(Ue,{className:c,onMouseMove:d}):e===`sticker`&&n&&t(`div`,{ref:l,className:D(K.stickerWrapper,c),style:`width: ${q}px; height: ${q}px`,onMouseMove:d,children:t(fe,{containerRef:l,sticker:n,size:q,shouldPreloadPreview:!0,shouldLoop:!0})}),t(`h2`,{className:K.title,children:i}),t(`div`,{className:K.description,children:a})]})}var Ze=O(Xe),J={root:`_7NV36hp3`,wrapper:`_32sWnI-2`,down:`DkDmNeYG`,frame:`M0hUT4cv`,video:`eWi57MWV`,placeholder:`A38HRiXg`},Qe=``+new URL(`DeviceFrame-Dqm_t18H.svg`,import.meta.url).href,$e=O(({videoId:e,videoThumbnail:n,isActive:r,isReverseAnimation:i,isDown:o,index:s,className:c,wrapperClassName:l})=>{let u=ne(e?`document${e}`:void 0),d=ve(n?.dataUri),f=pe(u);return t(`div`,{className:D(J.root,c),children:_(`div`,{className:D(J.wrapper,i&&J.reverse,o&&J.down,l),id:s===void 0?void 0:`premium_feature_preview_video_${s}`,children:[t(`img`,{src:Qe,alt:``,className:J.frame,draggable:!1}),!e&&t(`div`,{className:J.placeholder}),n&&t(`canvas`,{ref:d,className:J.video}),e&&t(a,{canPlay:!!r,className:D(J.video,f),src:u,disablePictureInPicture:!0,playsInline:!0,muted:!0,loop:!0})]})})}),Y={options:`Upert7zo`,option:`_2X6-9ciP`,active:`zpGahRpW`,wideOption:`dI8-J8yI`,optionTop:`wgA5YkCl`,stackedStars:`TZ71sXrE`,stackedStar:`_6CGkOJue`,optionBottom:`GRPtw1Lm`,moreOptions:`cY6CHTaj`,iconDown:`qdRs-uv4`},et=6,tt=O(({isActive:n,className:r,options:a,selectedStarOption:c,selectedStarCount:l,starsNeeded:u,onClick:f})=>{let m=o(),h=d(),[g,v,y]=ae();C(()=>{n||y()},[n]);let[b,x]=e(()=>{if(!a)return[void 0,!1];let e=a.reduce((e,t)=>e.stars>t.stars?e:t),t=u&&e.stars<u,n=[],r=0,i=!1;return a.forEach((e,o)=>{if(e.isExtended||r++,!(u&&!t&&e.stars<u)){if(!g&&e.isExtended){i=!0;return}n.push({option:e,starsCount:Math.min(r,et),isWide:o===a.length-1})}}),[n,i]},[g,a,u]);return _(`div`,{className:D(Y.options,r),children:[b?.map(({option:e,starsCount:n,isWide:r})=>{let a=b?.length%2==0,o=e===c,u;return e&&`winners`in e&&(u=(e.winners.find(e=>e.users===l)||e.winners.reduce((e,t)=>t.users>e.users?t:e,e.winners[0]))?.perUserStars),_(`div`,{className:D(Y.option,!a&&r&&Y.wideOption,o&&Y.active),onClick:()=>f?.(e),children:[_(`div`,{className:Y.optionTop,children:[`+`,se(e.stars),t(`div`,{className:Y.stackedStars,dir:h.isRtl?`ltr`:`rtl`,children:Array.from({length:n}).map(()=>t(le,{className:Y.stackedStar,type:`gold`,size:`big`}))})]}),t(`div`,{className:Y.optionBottom,children:s(h,e.amount,e.currency)}),(o||c&&`winners`in c)&&!!u&&t(`div`,{className:Y.optionBottom,children:t(`div`,{className:Y.perUserStars,children:i(m(`BoostGift.Stars.PerUser`,se(u)))})})]},e.stars)}),!g&&x&&_(p,{className:Y.moreOptions,isText:!0,noForcedUpperCase:!0,onClick:v,children:[m(`Stars.Purchase.ShowMore`),t(k,{className:Y.iconDown,name:`down`})]})]})}),X={content:`j63Xdo6p`,fixedHeight:`E-xx83T0`,withSearch:`sT1YPCzK`,header:`RwB3BKcO`,buttonWrapper:`Z-xvJZEk`},nt=`.${be.pickerList}`,rt=O(({confirmButtonText:e,isConfirmDisabled:n,shouldAdaptToSearch:r,withFixedHeight:i,onConfirm:a,withPremiumGradient:s,itemsContainerSelector:c=nt,...l})=>{let u=o(),d=!!(e||a),f=T();return _e({containerRef:f,selector:`.modal-content ${c}`,isBottomNotch:d,shouldHideTopNotch:!0},[l.isOpen]),_(b,{...l,dialogRef:f,isSlim:!0,className:D(r&&X.withSearch,i&&X.fixedHeight,l.className),contentClassName:D(X.content,l.contentClassName),headerClassName:D(X.header,l.headerClassName),isCondensedHeader:!0,children:[l.children,d&&t(`div`,{className:X.buttonWrapper,children:t(p,{withPremiumGradient:s,onClick:a||l.onClose,color:`primary`,disabled:n,children:e||u(`Confirm`)})})]})}),Z={table:`RMEi5Sgb`,cell:`AEl8NMjg`,title:`IypKoG1m`,value:`ZO-KCUSl`,fullWidth:`_1WIqSuNB`,chatItem:`J6it2-iy`},it=O(({tableData:e,className:n,onChatClick:r})=>{let{openChat:i}=c(),a=y(e=>{r?r(e):i({id:e})});if(e?.length)return t(`div`,{className:D(Z.table,n),children:e.map(([e,n])=>_(de,{children:[!!e&&t(`div`,{className:D(Z.cell,Z.title),children:e}),t(`div`,{className:D(Z.cell,Z.value,!e&&Z.fullWidth),children:typeof n==`object`&&`chatId`in n?t(ge,{peerId:n.chatId,className:Z.chatItem,forceShowSelf:!0,withEmojiStatus:n.withEmojiStatus,clickArg:n.chatId,onClick:a}):n})]}))})}),Q={content:`rIjOLQyf`,noFooter:`ssGgYoZw`,avatar:`IdvEatvm`},at=O(({isOpen:e,title:n,tableData:r,headerAvatarPeer:i,header:a,modalHeader:o,footer:s,buttonText:l,className:u,contentClassName:d,tableClassName:f,hasBackdrop:m,closeButtonColor:h,moreMenuItems:g,headerRightToolBar:v,onClose:x,onButtonClick:S,withBalanceBar:C,isLowStackPriority:ee,currencyInBalanceBar:w})=>{let{openChat:te}=c(),T=y(e=>{te({id:e}),x()});return _(b,{isOpen:e,hasCloseButton:!!n,hasAbsoluteCloseButton:!n,absoluteCloseButtonColor:h||(m?`translucent-white`:void 0),isSlim:!0,header:o,title:n,className:u,contentClassName:D(Q.content,d),moreMenuItems:g,headerRightToolBar:v,onClose:x,withBalanceBar:C,currencyInBalanceBar:w,isLowStackPriority:ee,children:[i&&t(M,{peer:i,size:`jumbo`,className:Q.avatar}),a,t(it,{tableData:r,className:f,onChatClick:T}),s,l&&t(p,{className:s?void 0:Q.noFooter,onClick:S||x,children:l})]})}),$={root:`FEEwg5rl`,secondary:`_51eeI1vd`,topIcon:`_0fVPMdEi`,premiumGradient:`oEaPoig5`,content:`_7xJ2IMc7`,listItems:`_4Smlf3-h`,listItemTitle:`lPVHA-w3`,separator:`V6iMhrLh`},ot=O(({className:e,isOpen:n,listItemData:r,headerIconName:i,headerIconPremiumGradient:a,header:o,footer:s,buttonText:c,hasBackdrop:l,absoluteCloseButtonColor:u,withSeparator:d,contentClassName:f,onClose:m,onButtonClick:h})=>_(b,{isOpen:n,className:D($.root,e),contentClassName:D($.content,f),hasAbsoluteCloseButton:!0,absoluteCloseButtonColor:u||(l?`translucent-white`:void 0),onClose:m,children:[i&&t(`div`,{className:D($.topIcon,a&&$.premiumGradient),children:t(k,{name:i})}),o,t(`div`,{className:$.listItems,children:r?.map(([e,n,r])=>_(g,{isStatic:!0,multiline:!0,icon:e,className:$.listItem,children:[t(`span`,{className:D(`title`,$.listItemTitle),children:n}),t(`span`,{className:`subtitle`,children:r})]}))}),d&&t(oe,{className:$.separator}),s,!!c&&t(p,{onClick:h||m,children:c})]}));function st(e,t,n){let[r,i]=E(),{isFrozen:a,updateWhenUnfrozen:o}=ct(),s=ye(t,!0);return w(()=>{if(a){o();return}s(()=>{i(e())})},[...n,a]),r}function ct(){let e=T(!1),t=x(()=>{e.current=!0},[]),n=r();return te(lt,x(()=>{e.current&&(e.current=!1,n())},[n])),{isFrozen:ee(),updateWhenUnfrozen:t}}function lt(){}var ut=300;async function dt(e){let t=await ue(`searchChats`,{query:e});if(t)return[...t.accountResultIds,...t.globalResultIds]}function ft(e){return async t=>{let r=t.trim();if(n(e)){let t=S(l(),e.id)?.members?.map(e=>e.userId)||[];return r?ie({ids:t,query:r,type:`user`}):t}let i=(await ue(`fetchMembers`,{chat:e,memberFilter:r?`search`:`recent`,query:r}))?.members?.map(e=>e.userId)||[];if(!u(e))return i;if(!r)return[...i,e.id];let a=ie({ids:[e.id],query:r,type:`chat`});return[...i,...a]}}function pt({query:e,queryFn:t=dt,defaultValue:n,debounceTimeout:r=ut,isDisabled:i}){let a=st(()=>e,r,[e]),[o,s]=E(``),c=e&&a,l=y(t);return{...re(async()=>{if(!c||i)return s(``),Promise.resolve(n);let e=await l(c);return s(c),e},[c,n,l,i],n),currentResultsQuery:o}}var mt={root:`JaXKxj2K`,arrow:`_-7ow-ETi`},ht=4*v,gt=O(({fromPeer:e,toPeer:n,avatarSize:r=ht})=>_(`div`,{className:mt.root,children:[t(M,{peer:e,size:r}),t(k,{name:`next`,className:mt.arrow}),t(M,{peer:n,size:r})]}));export{at as a,tt as c,B as d,xe as f,ot as i,$e as l,ft as n,it as o,pt as r,rt as s,gt as t,Ze as u};
//# sourceMappingURL=TransferBetweenPeers-BAfJycT4.js.map