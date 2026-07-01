import{$c as e,$f as t,An as n,Ar as r,Ba as i,Bg as a,Dg as o,Dr as s,Fg as c,Ga as l,Hg as u,Hr as d,In as f,K as p,Lg as m,Ln as h,Mn as g,Ng as _,Og as v,Qg as y,Qn as b,R as x,Vg as S,Vi as C,Wg as w,Wt as ee,Zc as te,bg as ne,cp as re,fp as T,gr as E,gt as D,h as ie,jg as ae,kg as O,nr as oe,qg as se,rr as ce,ru as le,up as k,wi as A,wn as ue,xg as de,yl as fe,yt as j,zg as M}from"./shared-components-C_ybLBTv.js";import{g as pe}from"./folderManager-l7sJqiUA.js";import{n as me}from"./usePrevious-DjnYR7J6.js";import{n as he}from"./animatedAssets-DGakmVlt.js";import{W as ge,ft as _e,ht as ve,xt as ye,yt as be}from"./ActionMessage-ZwjmwQtq.js";var N={root:`Kdv89j1l`,top:`_0EdTY2mJ`,badge:`TvB5YSlK`,text:`lZY9nXge`},xe=c(({peer:e,avatarWebPhoto:t,avatarSize:n,text:r,badgeText:i,badgeIcon:a,className:o,badgeClassName:s,badgeIconClassName:c,textClassName:l,onClick:u})=>{let d=ue();return O(`div`,{className:T(N.root,u&&N.clickable,o),onClick:u,children:[O(`div`,{className:N.top,children:[v(D,{size:n,peer:e,webPhoto:t}),i&&O(`div`,{className:T(N.badge,s),dir:d.isRtl?`rtl`:`ltr`,children:[a&&v(k,{name:a,className:c}),i]})]}),r&&v(`p`,{className:T(N.text,l),children:r})]})}),P=new E(`#0098EA`),F={blue:P,blueGradient:[new E(`#0158AF`),new E(`#67D0FF`)],purple:new E(`#966FFE`),purpleGradient:[new E(`#6B93FF`),new E(`#E46ACE`)],gold:new E(`#FFBF0A`),goldGradient:[new E(`#FDEB32`),new E(`#D75902`)]},Se={particleCount:5,distanceLimit:1,fadeInTime:.05,minLifetime:3,maxLifetime:3,maxStartTimeDelay:0,selfDestroyTime:3,minSpawnRadius:5,maxSpawnRadius:50},I={width:350,height:230,particleCount:100,color:P,speed:18,baseSize:6,minSpawnRadius:35,maxSpawnRadius:70,distanceLimit:.7,fadeInTime:.25,fadeOutTime:1,minLifetime:4,maxLifetime:6,maxStartTimeDelay:3,edgeFadeZone:50,centerShift:[0,0],accelerationFactor:3,selfDestroyTime:0},Ce=.67,we=1.33,Te=2.2,L=new Map;function R(e,t){let n=L.get(e);return n||(n=Ee(e),L.set(e,n)),n.addSystem(t)}function Ee(e){let t=e.getContext(`webgl`,{alpha:!0,antialias:!1,preserveDrawingBuffer:!1});if(!t)throw Error(`WebGL not supported`);let n=z(t,t.VERTEX_SHADER,De),r=z(t,t.FRAGMENT_SHADER,Oe);if(!n||!r)throw Error(`Failed to create shaders`);let i=ke(t,n,r);if(!i)throw Error(`Failed to create shader program`);let a=window.devicePixelRatio||1,o=new Map,s={attributes:{startPosition:t.getAttribLocation(i,`a_startPosition`),velocity:t.getAttribLocation(i,`a_velocity`),startTime:t.getAttribLocation(i,`a_startTime`),lifetime:t.getAttribLocation(i,`a_lifetime`),size:t.getAttribLocation(i,`a_size`),baseOpacity:t.getAttribLocation(i,`a_baseOpacity`),color:t.getAttribLocation(i,`a_color`)},uniforms:{resolution:t.getUniformLocation(i,`u_resolution`),time:t.getUniformLocation(i,`u_time`),canvasWidth:t.getUniformLocation(i,`u_canvasWidth`),canvasHeight:t.getUniformLocation(i,`u_canvasHeight`),accelerationFactor:t.getUniformLocation(i,`u_accelerationFactor`),fadeInTime:t.getUniformLocation(i,`u_fadeInTime`),fadeOutTime:t.getUniformLocation(i,`u_fadeOutTime`),edgeFadeZone:t.getUniformLocation(i,`u_edgeFadeZone`),rotationMatrices:t.getUniformLocation(i,`u_rotationMatrices`),spawnCenter:t.getUniformLocation(i,`u_spawnCenter`)}},c,l;function u(e){let n=new Ae(e.seed),{config:r}=e,i=new Float32Array(r.particleCount*2),o=new Float32Array(r.particleCount*2),s=new Float32Array(r.particleCount),c=new Float32Array(r.particleCount),l=new Float32Array(r.particleCount),u=new Float32Array(r.particleCount),d=new Float32Array(r.particleCount*3);for(let t=0;t<r.particleCount;t++){let f=n.next()*Math.PI*2,p=n.nextBetween(r.minSpawnRadius,r.maxSpawnRadius),m=Math.cos(f),h=Math.sin(f),g=e.centerX+m*p,_=e.centerY+h*p;i[t*2]=g*a,i[t*2+1]=_*a,c[t]=n.nextBetween(r.minLifetime,r.maxLifetime),s[t]=n.next()*r.maxStartTimeDelay;let v=n.nextBetween(e.avgDistance*r.distanceLimit*.5,e.avgDistance*r.distanceLimit)/c[t]*a;o[t*2]=m*v,o[t*2+1]=h*v;let y=n.next();y<.3?l[t]=r.baseSize*Ce*a:y<.7?l[t]=r.baseSize*we*a:l[t]=r.baseSize*Te*a,u[t]=n.nextBetween(.3,.8);let[b,x,S]=Me(r.color,n).coords;d[t*3]=b||0,d[t*3+1]=x||0,d[t*3+2]=S||0}t.bindBuffer(t.ARRAY_BUFFER,e.buffers.startPosition),t.bufferData(t.ARRAY_BUFFER,i,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.velocity),t.bufferData(t.ARRAY_BUFFER,o,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.startTime),t.bufferData(t.ARRAY_BUFFER,s,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.lifetime),t.bufferData(t.ARRAY_BUFFER,c,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.size),t.bufferData(t.ARRAY_BUFFER,l,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.baseOpacity),t.bufferData(t.ARRAY_BUFFER,u,t.STATIC_DRAW),t.bindBuffer(t.ARRAY_BUFFER,e.buffers.color),t.bufferData(t.ARRAY_BUFFER,d,t.STATIC_DRAW)}function d(){let n=0,r=0;o.forEach(e=>{n=Math.max(n,e.config.width),r=Math.max(r,e.config.height)}),o.size===0&&(n=I.width,r=I.height),(e.width!==n*a||e.height!==r*a)&&(e.width=n*a,e.height=r*a,e.style.width=n+`px`,e.style.height=r+`px`),t.viewport(0,0,e.width,e.height)}function f(){t.useProgram(i),t.uniform2f(s.uniforms.resolution,e.width,e.height),t.uniformMatrix2fv(s.uniforms.rotationMatrices,!1,je()),t.enable(t.BLEND),t.blendFunc(t.ONE,t.ONE_MINUS_SRC_ALPHA),t.clearColor(0,0,0,0)}function p(e){c&&=(t.clear(t.COLOR_BUFFER_BIT),o.forEach(n=>{let r=(e-n.startTime)/1e3;t.uniform1f(s.uniforms.time,r),t.uniform1f(s.uniforms.canvasWidth,n.config.width*a),t.uniform1f(s.uniforms.canvasHeight,n.config.height*a),t.uniform1f(s.uniforms.accelerationFactor,n.config.accelerationFactor),t.uniform1f(s.uniforms.fadeInTime,n.config.fadeInTime),t.uniform1f(s.uniforms.fadeOutTime,n.config.fadeOutTime),t.uniform1f(s.uniforms.edgeFadeZone,n.config.edgeFadeZone*a),t.uniform2f(s.uniforms.spawnCenter,n.centerX*a,n.centerY*a),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.startPosition),t.enableVertexAttribArray(s.attributes.startPosition),t.vertexAttribPointer(s.attributes.startPosition,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.velocity),t.enableVertexAttribArray(s.attributes.velocity),t.vertexAttribPointer(s.attributes.velocity,2,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.startTime),t.enableVertexAttribArray(s.attributes.startTime),t.vertexAttribPointer(s.attributes.startTime,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.lifetime),t.enableVertexAttribArray(s.attributes.lifetime),t.vertexAttribPointer(s.attributes.lifetime,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.size),t.enableVertexAttribArray(s.attributes.size),t.vertexAttribPointer(s.attributes.size,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.baseOpacity),t.enableVertexAttribArray(s.attributes.baseOpacity),t.vertexAttribPointer(s.attributes.baseOpacity,1,t.FLOAT,!1,0,0),t.bindBuffer(t.ARRAY_BUFFER,n.buffers.color),t.enableVertexAttribArray(s.attributes.color),t.vertexAttribPointer(s.attributes.color,3,t.FLOAT,!1,0,0),t.drawArrays(t.POINTS,0,n.config.particleCount)}),requestAnimationFrame(p))}function m(e){let n=ae(),r={...I,...e},i={id:n,config:r,buffers:{startPosition:t.createBuffer(),velocity:t.createBuffer(),startTime:t.createBuffer(),lifetime:t.createBuffer(),size:t.createBuffer(),baseOpacity:t.createBuffer(),color:t.createBuffer()},startTime:performance.now(),seed:Math.floor(Math.random()*1e6),centerX:r.width/2+r.centerShift[0],centerY:r.height/2+r.centerShift[1],avgDistance:(r.width/2+r.height/2)/2};return o.set(n,i),u(i),d(),r.selfDestroyTime&&(i.selfDestroyTimeout=window.setTimeout(()=>{g(n)},r.selfDestroyTime*1e3)),o.size===1&&(f(),l=h.subscribe(()=>{let e=!h();e&&!c?c=requestAnimationFrame(p):!e&&c&&(cancelAnimationFrame(c),c=void 0)}),c=requestAnimationFrame(p)),()=>g(n)}function g(e){let n=o.get(e);n&&(n.selfDestroyTimeout&&clearTimeout(n.selfDestroyTimeout),Object.values(n.buffers).forEach(e=>{e&&t.deleteBuffer(e)}),o.delete(e),o.size===0&&_())}function _(){c!==void 0&&(cancelAnimationFrame(c),c=void 0),l?.(),o.clear(),t.deleteProgram(i),t.deleteShader(n),t.deleteShader(r),L.delete(e)}return{addSystem:m}}var De=`
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
`,Oe=`
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
`;function z(e,t,n){let r=e.createShader(t);if(r){if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){e.deleteShader(r);return}return r}}function ke(e,t,n){let r=e.createProgram();if(r){if(e.attachShader(r,t),e.attachShader(r,n),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS)){e.deleteProgram(r);return}return r}}var Ae=class{seed;constructor(e){this.seed=e}next(){return this.seed=(this.seed*9301+49297)%233280,this.seed/233280}nextBetween(e,t){return e+(t-e)*this.next()}},B;function je(){if(!B){B=new Float32Array(72);for(let e=0;e<18;e++){let t=220*Math.PI/180*e,n=Math.cos(t),r=Math.sin(t);B[e*4]=n,B[e*4+1]=r,B[e*4+2]=-r,B[e*4+3]=n}}return B}function Me(e,t){if(e instanceof E)return e;let[n,r]=e,[i,a,o]=n.coords,[s,c,l]=r.coords;return new E(`srgb`,[t.nextBetween(i||0,s||0),t.nextBetween(a||0,c||0),t.nextBetween(o||0,l||0)])}var Ne={sparkles:`JxY8hVTW`},Pe={centerShift:[0,-36]},Fe=8,V=c(({color:e=`purple`,centerShift:t=Pe.centerShift,isDisabled:n,className:r,onRequestAnimation:i})=>{let o=u(),s=u(0);return a(()=>{if(!n)return R(o.current,{color:F[`${e}Gradient`],centerShift:t})},[t,e,n]),M(()=>{i&&i(()=>{if(n)return;let r=Date.now();r-s.current<Fe||(s.current=r,R(o.current,{color:F[`${e}Gradient`],centerShift:t,...Se}))})},[t,e,n,i]),v(`canvas`,{ref:o,className:T(Ne.sparkles,r)})}),H={root:`CHDf16MJ`,diamond:`UM7C8oRj`},Ie=``+new URL(`diamond-57JalFxA.png`,import.meta.url).href,Le=5,Re=1,ze=300,Be=1500,U,W=!0;function Ve({className:t,onMouseMove:n}){let[r,i]=w(Re),a=e(()=>{U&&=(clearTimeout(U),void 0),U=window.setTimeout(()=>{let e=Date.now();W=!0,ee(()=>{if(!W)return!1;let t=Math.min((Date.now()-e)/Be,1),n=(Le-Re)*(1-Ue(t));return i(n),W=t<1&&n>1,W},y)},ze),W=!1,i(Le),n()});return v(`div`,{className:T(H.root,t),children:v(`div`,{className:H.diamond,onMouseMove:a,children:v(me,{speed:r,size:130,tgsUrl:he.Diamond,previewUrl:Ie,nonInteractive:!0,noLoop:!1})})})}var He=c(Ve);function Ue(e){return 1-(1-e)**2}var G={root:`QcfrGLdX`,star:`nDPg-zs5`,star_purple:`-f2S1Tk6`,starPurple:`-f2S1Tk6`},We=50;function Ge({className:t,color:n,centerShift:r,onMouseMove:i}){let a=u(),o=e(e=>{let t=e.currentTarget.getBoundingClientRect(),n=t.left+t.width/2+r[0],o=t.top+t.height/2+r[1],s=e.clientX-n,c=e.clientY-o,l=Math.max(-1,Math.min(1,s/We)),u=Math.max(-1,Math.min(1,c/We)),d=l*40,f=-u*40;y(()=>{a.current.style.transform=`scale(1.1) rotateX(${f}deg) rotateY(${d}deg)`}),i()}),s=e(()=>{y(()=>{a.current.style.transform=``})});return v(`div`,{className:T(G.root,t),onMouseMove:o,onMouseLeave:s,children:v(`div`,{ref:a,className:T(G.star,G[`star_${n}`]),role:`img`,"aria-label":`Telegram Stars`})})}var Ke=c(Ge),K={root:`cK6KQXnQ`,"ai-egg":`ZP86O9Hy`,aiEgg:`ZP86O9Hy`,title:`xRm-Im3m`,description:`IQdQ9MU9`,particles:`_8ooQ3s8b`,stickerWrapper:`hHs2sTV-`,cocoon:`Rlhm9gZk`},qe=``+new URL(`cocoon-DzgJltGQ.webp`,import.meta.url).href,q=8*d,Je={centerShift:[0,-36]};function Ye({model:t,sticker:n,color:r,title:i,description:a,isDisabled:o,className:s,modelClassName:c}){let l=u(),d=u(),f=e(()=>{d.current?.()}),p=e(e=>{d.current=e});return O(`div`,{className:T(K.root,K[t],s),children:[v(V,{color:r,centerShift:Je.centerShift,isDisabled:o,className:K.particles,onRequestAnimation:p}),t===`swaying-star`?v(Ke,{className:c,color:r,centerShift:Je.centerShift,onMouseMove:f}):t===`ai-egg`?v(`img`,{src:qe,alt:``,role:`presentation`,"aria-hidden":`true`,className:T(K.cocoon,c),draggable:!1,onMouseMove:f}):t===`speeding-diamond`?v(He,{className:c,onMouseMove:f}):t===`sticker`&&n&&v(`div`,{ref:l,className:T(K.stickerWrapper,c),style:`width: ${q}px; height: ${q}px`,onMouseMove:f,children:v(g,{containerRef:l,sticker:n,size:q,shouldPreloadPreview:!0,shouldLoop:!0})}),v(`h2`,{className:K.title,children:i}),v(`div`,{className:K.description,children:a})]})}var Xe=c(Ye),J={root:`_7NV36hp3`,wrapper:`_32sWnI-2`,down:`DkDmNeYG`,frame:`M0hUT4cv`,video:`eWi57MWV`,placeholder:`A38HRiXg`},Ze=``+new URL(`DeviceFrame-Dqm_t18H.svg`,import.meta.url).href,Qe=c(({videoId:e,videoThumbnail:t,isActive:n,isReverseAnimation:r,isDown:i,index:a,className:o,wrapperClassName:s})=>{let c=b(e?`document${e}`:void 0),l=ve(t?.dataUri),u=pe(c);return v(`div`,{className:T(J.root,o),children:O(`div`,{className:T(J.wrapper,r&&J.reverse,i&&J.down,s),id:a===void 0?void 0:`premium_feature_preview_video_${a}`,children:[v(`img`,{src:Ze,alt:``,className:J.frame,draggable:!1}),!e&&v(`div`,{className:J.placeholder}),t&&v(`canvas`,{ref:l,className:J.video}),e&&v(f,{canPlay:!!n,className:T(J.video,u),src:c,disablePictureInPicture:!0,playsInline:!0,muted:!0,loop:!0})]})})}),Y={options:`Upert7zo`,option:`_2X6-9ciP`,active:`zpGahRpW`,wideOption:`dI8-J8yI`,optionTop:`wgA5YkCl`,stackedStars:`TZ71sXrE`,stackedStar:`_6CGkOJue`,optionBottom:`GRPtw1Lm`,moreOptions:`cY6CHTaj`,iconDown:`qdRs-uv4`},$e=6,et=c(({isActive:e,className:r,options:i,selectedStarOption:a,selectedStarCount:o,starsNeeded:s,onClick:c})=>{let l=n(),u=ue(),[d,f,p]=ce();M(()=>{e||p()},[e]);let[m,h]=S(()=>{if(!i)return[void 0,!1];let e=i.reduce((e,t)=>e.stars>t.stars?e:t),t=s&&e.stars<s,n=[],r=0,a=!1;return i.forEach((e,o)=>{if(e.isExtended||r++,!(s&&!t&&e.stars<s)){if(!d&&e.isExtended){a=!0;return}n.push({option:e,starsCount:Math.min(r,$e),isWide:o===i.length-1})}}),[n,a]},[d,i,s]);return O(`div`,{className:T(Y.options,r),children:[m?.map(({option:e,starsCount:n,isWide:r})=>{let i=m?.length%2==0,s=e===a,d;return e&&`winners`in e&&(d=(e.winners.find(e=>e.users===o)||e.winners.reduce((e,t)=>t.users>e.users?t:e,e.winners[0]))?.perUserStars),O(`div`,{className:T(Y.option,!i&&r&&Y.wideOption,s&&Y.active),onClick:()=>c?.(e),children:[O(`div`,{className:Y.optionTop,children:[`+`,A(e.stars),v(`div`,{className:Y.stackedStars,dir:u.isRtl?`ltr`:`rtl`,children:Array.from({length:n}).map(()=>v(re,{className:Y.stackedStar,type:`gold`,size:`big`}))})]}),v(`div`,{className:Y.optionBottom,children:t(u,e.amount,e.currency)}),(s||a&&`winners`in a)&&!!d&&v(`div`,{className:Y.optionBottom,children:v(`div`,{className:Y.perUserStars,children:te(l(`BoostGift.Stars.PerUser`,A(d)))})})]},e.stars)}),!d&&h&&O(j,{className:Y.moreOptions,isText:!0,noForcedUpperCase:!0,onClick:f,children:[l(`Stars.Purchase.ShowMore`),v(k,{className:Y.iconDown,name:`down`})]})]})}),X={content:`j63Xdo6p`,fixedHeight:`E-xx83T0`,withSearch:`sT1YPCzK`,header:`RwB3BKcO`,buttonWrapper:`Z-xvJZEk`},tt=`.${be.pickerList}`,nt=c(({confirmButtonText:e,isConfirmDisabled:t,shouldAdaptToSearch:r,withFixedHeight:i,onConfirm:a,withPremiumGradient:o,itemsContainerSelector:s=tt,...c})=>{let l=n(),d=!!(e||a),f=u();return ge({containerRef:f,selector:`.modal-content ${s}`,isBottomNotch:d,shouldHideTopNotch:!0},[c.isOpen]),O(p,{...c,dialogRef:f,isSlim:!0,className:T(r&&X.withSearch,i&&X.fixedHeight,c.className),contentClassName:T(X.content,c.contentClassName),headerClassName:T(X.header,c.headerClassName),isCondensedHeader:!0,children:[c.children,d&&v(`div`,{className:X.buttonWrapper,children:v(j,{withPremiumGradient:o,onClick:a||c.onClose,color:`primary`,disabled:t,children:e||l(`Confirm`)})})]})}),Z={table:`RMEi5Sgb`,cell:`AEl8NMjg`,title:`IypKoG1m`,value:`ZO-KCUSl`,fullWidth:`_1WIqSuNB`,chatItem:`J6it2-iy`},rt=c(({tableData:t,className:n,onChatClick:r})=>{let{openChat:i}=ne(),a=e(e=>{r?r(e):i({id:e})});if(t?.length)return v(`div`,{className:T(Z.table,n),children:t.map(([e,t])=>O(o,{children:[!!e&&v(`div`,{className:T(Z.cell,Z.title),children:e}),v(`div`,{className:T(Z.cell,Z.value,!e&&Z.fullWidth),children:typeof t==`object`&&`chatId`in t?v(ye,{peerId:t.chatId,className:Z.chatItem,forceShowSelf:!0,withEmojiStatus:t.withEmojiStatus,clickArg:t.chatId,onClick:a}):t})]}))})}),Q={content:`rIjOLQyf`,noFooter:`ssGgYoZw`,avatar:`IdvEatvm`},it=c(({isOpen:t,title:n,tableData:r,headerAvatarPeer:i,header:a,modalHeader:o,footer:s,buttonText:c,className:l,contentClassName:u,tableClassName:d,hasBackdrop:f,closeButtonColor:m,moreMenuItems:h,headerRightToolBar:g,onClose:_,onButtonClick:y,withBalanceBar:b,isLowStackPriority:x,currencyInBalanceBar:S})=>{let{openChat:C}=ne(),w=e(e=>{C({id:e}),_()});return O(p,{isOpen:t,hasCloseButton:!!n,hasAbsoluteCloseButton:!n,absoluteCloseButtonColor:m||(f?`translucent-white`:void 0),isSlim:!0,header:o,title:n,className:l,contentClassName:T(Q.content,u),moreMenuItems:h,headerRightToolBar:g,onClose:_,withBalanceBar:b,currencyInBalanceBar:S,isLowStackPriority:x,children:[i&&v(D,{peer:i,size:`jumbo`,className:Q.avatar}),a,v(rt,{tableData:r,className:d,onChatClick:w}),s,c&&v(j,{className:s?void 0:Q.noFooter,onClick:y||_,children:c})]})}),$={root:`FEEwg5rl`,secondary:`_51eeI1vd`,topIcon:`_0fVPMdEi`,premiumGradient:`oEaPoig5`,content:`_7xJ2IMc7`,listItems:`_4Smlf3-h`,listItemTitle:`lPVHA-w3`,separator:`V6iMhrLh`},at=c(({className:e,isOpen:t,listItemData:n,headerIconName:r,headerIconPremiumGradient:i,header:a,footer:o,buttonText:s,hasBackdrop:c,absoluteCloseButtonColor:l,withSeparator:u,contentClassName:d,onClose:f,onButtonClick:m})=>O(p,{isOpen:t,className:T($.root,e),contentClassName:T($.content,d),hasAbsoluteCloseButton:!0,absoluteCloseButtonColor:l||(c?`translucent-white`:void 0),onClose:f,children:[r&&v(`div`,{className:T($.topIcon,i&&$.premiumGradient),children:v(k,{name:r})}),a,v(`div`,{className:$.listItems,children:n?.map(([e,t,n])=>O(x,{isStatic:!0,multiline:!0,icon:e,className:$.listItem,children:[v(`span`,{className:T(`title`,$.listItemTitle),children:t}),v(`span`,{className:`subtitle`,children:n})]}))}),u&&v(ie,{className:$.separator}),o,!!s&&v(j,{onClick:m||f,children:s})]}));function ot(e,t,n){let[r,i]=w(),{isFrozen:a,updateWhenUnfrozen:o}=st(),c=_e(t,!0);return s(()=>{if(a){o();return}c(()=>{i(e())})},[...n,a]),r}function st(){let e=u(!1),t=m(()=>{e.current=!0},[]),n=_();return oe(ct,m(()=>{e.current&&(e.current=!1,n())},[n])),{isFrozen:se(),updateWhenUnfrozen:t}}function ct(){}var lt=300;async function ut(e){let t=await fe(`searchChats`,{query:e});if(t)return[...t.accountResultIds,...t.globalResultIds]}function dt(e){return async t=>{let n=t.trim();if(i(e)){let t=le(de(),e.id)?.members?.map(e=>e.userId)||[];return n?C({ids:t,query:n,type:`user`}):t}let r=(await fe(`fetchMembers`,{chat:e,memberFilter:n?`search`:`recent`,query:n}))?.members?.map(e=>e.userId)||[];if(!l(e))return r;if(!n)return[...r,e.id];let a=C({ids:[e.id],query:n,type:`chat`});return[...r,...a]}}function ft({query:t,queryFn:n=ut,defaultValue:i,debounceTimeout:a=lt,isDisabled:o}){let s=ot(()=>t,a,[t]),[c,l]=w(``),u=t&&s,d=e(n);return{...r(async()=>{if(!u||o)return l(``),Promise.resolve(i);let e=await d(u);return l(u),e},[u,i,d,o],i),currentResultsQuery:c}}var pt={root:`JaXKxj2K`,arrow:`_-7ow-ETi`},mt=4*d,ht=c(({fromPeer:e,toPeer:t,avatarSize:n=mt})=>O(`div`,{className:pt.root,children:[v(D,{peer:e,size:n}),v(k,{name:`next`,className:pt.arrow}),v(D,{peer:t,size:n})]}));export{it as a,et as c,V as d,xe as f,at as i,Qe as l,dt as n,rt as o,ft as r,nt as s,ht as t,Xe as u};
//# sourceMappingURL=TransferBetweenPeers-BL8Rq7AF.js.map