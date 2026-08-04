import{G as u,n as Oe,M as $,a as r,c as Ie,d as xe,h as f,e as B,f as O,g as be,s as ge,o as Ze,k as je,l as et,b as Ve}from"./C2UIz1tz.js";import{M as tt}from"./HJPntRs0.js";import{i as Ge}from"./DWpwpGX1.js";import{t as M}from"./BvMjJdGg.js";var He=(t,e,i)=>{if(!e.has(t))throw TypeError("Cannot "+i)},J=(t,e,i)=>(He(t,e,"read from private field"),i?i.call(t):e.get(t)),it=(t,e,i)=>{if(e.has(t))throw TypeError("Cannot add the same private member more than once");e instanceof WeakSet?e.add(t):e.set(t,i)},Z=(t,e,i,a)=>(He(t,e,"write to private field"),e.set(t,i),i),b;function at(t){return`
    <style>
      :host {
        box-sizing: border-box;
        display: var(--media-control-display, var(--media-preview-thumbnail-display, inline-block));
        overflow: hidden;
      }

      img {
        display: none;
        position: relative;
      }
    </style>
    <img crossorigin loading="eager" decoding="async">
  `}class ve extends u.HTMLElement{constructor(){if(super(),it(this,b,void 0),!this.shadowRoot){this.attachShadow(this.constructor.shadowRootOptions);const e=Oe(this.attributes);this.shadowRoot.innerHTML=this.constructor.getTemplateHTML(e)}}static get observedAttributes(){return[$.MEDIA_CONTROLLER,r.MEDIA_PREVIEW_IMAGE,r.MEDIA_PREVIEW_COORDS]}connectedCallback(){var e,i,a;const s=this.getAttribute($.MEDIA_CONTROLLER);s&&(Z(this,b,(e=this.getRootNode())==null?void 0:e.getElementById(s)),(a=(i=J(this,b))==null?void 0:i.associateElement)==null||a.call(i,this))}disconnectedCallback(){var e,i;(i=(e=J(this,b))==null?void 0:e.unassociateElement)==null||i.call(e,this),Z(this,b,null)}attributeChangedCallback(e,i,a){var s,n,o,d,m;[r.MEDIA_PREVIEW_IMAGE,r.MEDIA_PREVIEW_COORDS].includes(e)&&this.update(),e===$.MEDIA_CONTROLLER&&(i&&((n=(s=J(this,b))==null?void 0:s.unassociateElement)==null||n.call(s,this),Z(this,b,null)),a&&this.isConnected&&(Z(this,b,(o=this.getRootNode())==null?void 0:o.getElementById(a)),(m=(d=J(this,b))==null?void 0:d.associateElement)==null||m.call(d,this)))}get mediaPreviewImage(){return Ie(this,r.MEDIA_PREVIEW_IMAGE)}set mediaPreviewImage(e){xe(this,r.MEDIA_PREVIEW_IMAGE,e)}get mediaPreviewCoords(){const e=this.getAttribute(r.MEDIA_PREVIEW_COORDS);if(e)return e.split(/\s+/).map(i=>+i)}set mediaPreviewCoords(e){if(!e){this.removeAttribute(r.MEDIA_PREVIEW_COORDS);return}this.setAttribute(r.MEDIA_PREVIEW_COORDS,e.join(" "))}update(){const e=this.mediaPreviewCoords,i=this.mediaPreviewImage;if(!(e&&i))return;const[a,s,n,o]=e,d=i.split("#")[0],m=getComputedStyle(this),{maxWidth:N,maxHeight:X,minWidth:Te,minHeight:Pe}=m,Je=m.getPropertyValue("--media-preview-thumbnail-object-fit").trim()||"contain";let I,x;if(Je==="fill"){const R=parseInt(N)/n,D=parseInt(X)/o,Se=parseInt(Te)/n,Q=parseInt(Pe)/o;I=R<1?R:Math.max(R,Se),x=D<1?D:Math.max(D,Q)}else{const R=Math.min(parseInt(N)/n,parseInt(X)/o),D=Math.max(parseInt(Te)/n,parseInt(Pe)/o),Q=R<1?R:D>1?D:1;I=Q,x=Q}const{style:z}=f(this.shadowRoot,":host"),Y=f(this.shadowRoot,"img").style,y=this.shadowRoot.querySelector("img"),Ce=Math.min(I,x)<1?"min":"max";z.setProperty(`${Ce}-width`,"initial","important"),z.setProperty(`${Ce}-height`,"initial","important"),z.width=`${n*I}px`,z.height=`${o*x}px`;const _e=()=>{Y.width=`${this.imgWidth*I}px`,Y.height=`${this.imgHeight*x}px`,Y.display="block"};y.src!==d&&(y.onload=()=>{this.imgWidth=y.naturalWidth,this.imgHeight=y.naturalHeight,_e(),y.onload=null},y.src=d,_e()),_e(),Y.transform=`translate(-${a*I}px, -${s*x}px)`}}b=new WeakMap;ve.shadowRootOptions={mode:"open"};ve.getTemplateHTML=at;u.customElements.get("media-preview-thumbnail")||u.customElements.define("media-preview-thumbnail",ve);var We=ve,Ue=(t,e,i)=>{if(!e.has(t))throw TypeError("Cannot "+i)},j=(t,e,i)=>(Ue(t,e,"read from private field"),i?i.call(t):e.get(t)),rt=(t,e,i)=>{if(e.has(t))throw TypeError("Cannot add the same private member more than once");e instanceof WeakSet?e.add(t):e.set(t,i)},ee=(t,e,i,a)=>(Ue(t,e,"write to private field"),e.set(t,i),i),g;function st(t,e={}){return`
    <style>
      :host {
        font: var(--media-font,
          var(--media-font-weight, normal)
          var(--media-font-size, 14px) /
          var(--media-text-content-height, var(--media-control-height, 24px))
          var(--media-font-family, helvetica neue, segoe ui, roboto, arial, sans-serif));
        color: var(--media-text-color, var(--media-primary-color, rgb(238 238 238)));
        background: var(--media-text-background, var(--media-control-background, var(--media-secondary-color, rgb(20 20 30 / .7))));
        padding: var(--media-control-padding, 10px);
        display: inline-flex;
        justify-content: center;
        align-items: center;
        vertical-align: middle;
        box-sizing: border-box;
        text-align: center;
        pointer-events: auto;
      }

      
      :host(:focus-visible) {
        box-shadow: var(--media-focus-box-shadow, inset 0 0 0 2px rgb(27 127 204 / .9));
        outline: 0;
      }

      
      :host(:where(:focus)) {
        box-shadow: none;
        outline: 0;
      }
    </style>

    ${this.getSlotTemplateHTML(t,e)}
  `}function nt(t,e){return`
    <slot></slot>
  `}class L extends u.HTMLElement{constructor(){if(super(),rt(this,g,void 0),!this.shadowRoot){this.attachShadow(this.constructor.shadowRootOptions);const e=Oe(this.attributes);this.shadowRoot.innerHTML=this.constructor.getTemplateHTML(e)}}static get observedAttributes(){return[$.MEDIA_CONTROLLER]}attributeChangedCallback(e,i,a){var s,n,o,d,m;e===$.MEDIA_CONTROLLER&&(i&&((n=(s=j(this,g))==null?void 0:s.unassociateElement)==null||n.call(s,this),ee(this,g,null)),a&&this.isConnected&&(ee(this,g,(o=this.getRootNode())==null?void 0:o.getElementById(a)),(m=(d=j(this,g))==null?void 0:d.associateElement)==null||m.call(d,this)))}connectedCallback(){var e,i,a;const{style:s}=f(this.shadowRoot,":host");s.setProperty("display",`var(--media-control-display, var(--${this.localName}-display, inline-flex))`);const n=this.getAttribute($.MEDIA_CONTROLLER);n&&(ee(this,g,(e=this.getRootNode())==null?void 0:e.getElementById(n)),(a=(i=j(this,g))==null?void 0:i.associateElement)==null||a.call(i,this))}disconnectedCallback(){var e,i;(i=(e=j(this,g))==null?void 0:e.unassociateElement)==null||i.call(e,this),ee(this,g,null)}}g=new WeakMap;L.shadowRootOptions={mode:"open"};L.getTemplateHTML=st;L.getSlotTemplateHTML=nt;u.customElements.get("media-text-display")||u.customElements.define("media-text-display",L);const $e=[{singular:"hour",plural:"hours"},{singular:"minute",plural:"minutes"},{singular:"second",plural:"seconds"}],ot=(t,e)=>{const i=t===1?M($e[e].singular):M($e[e].plural);return`${t} ${i}`},Le=t=>{if(!Ge(t))return"";const e=Math.abs(t),i=e!==t,a=new Date(0,0,0,0,0,e,0),n=[a.getHours(),a.getMinutes(),a.getSeconds()].map((o,d)=>o&&ot(o,d)).filter(o=>o).join(", ");return i?M("{time} remaining",{time:n}):n};function Ne(t,e){let i=!1;t<0&&(i=!0,t=0-t),t=t<0?0:t;let a=Math.floor(t%60),s=Math.floor(t/60%60),n=Math.floor(t/3600);const o=Math.floor(e/60%60),d=Math.floor(e/3600);return(isNaN(t)||t===1/0)&&(n=s=a="0"),n=n>0||d>0?n+":":"",s=((n||o>=10)&&s<10?"0"+s:s)+":",a=a<10?"0"+a:a,(i?"-":"")+n+s+a}var Fe=(t,e,i)=>{if(!e.has(t))throw TypeError("Cannot "+i)},Be=(t,e,i)=>(Fe(t,e,"read from private field"),i?i.call(t):e.get(t)),dt=(t,e,i)=>{if(e.has(t))throw TypeError("Cannot add the same private member more than once");e instanceof WeakSet?e.add(t):e.set(t,i)},lt=(t,e,i,a)=>(Fe(t,e,"write to private field"),e.set(t,i),i),V;class ht extends L{constructor(){super(),dt(this,V,void 0),lt(this,V,this.shadowRoot.querySelector("slot")),Be(this,V).textContent=Ne(0)}static get observedAttributes(){return[...super.observedAttributes,r.MEDIA_PREVIEW_TIME]}attributeChangedCallback(e,i,a){super.attributeChangedCallback(e,i,a),e===r.MEDIA_PREVIEW_TIME&&a!=null&&(Be(this,V).textContent=Ne(parseFloat(a)))}get mediaPreviewTime(){return B(this,r.MEDIA_PREVIEW_TIME)}set mediaPreviewTime(e){O(this,r.MEDIA_PREVIEW_TIME,e)}}V=new WeakMap;u.customElements.get("media-preview-time-display")||u.customElements.define("media-preview-time-display",ht);var qe=(t,e,i)=>{if(!e.has(t))throw TypeError("Cannot "+i)},pt=(t,e,i)=>(qe(t,e,"read from private field"),i?i.call(t):e.get(t)),mt=(t,e,i)=>{if(e.has(t))throw TypeError("Cannot add the same private member more than once");e instanceof WeakSet?e.add(t):e.set(t,i)},ut=(t,e,i,a)=>(qe(t,e,"write to private field"),e.set(t,i),i),ie;class ct extends L{constructor(){super(),mt(this,ie,void 0),ut(this,ie,this.shadowRoot.querySelector("slot"))}static get observedAttributes(){return[...super.observedAttributes,r.MEDIA_PREVIEW_CHAPTER,r.MEDIA_LANG]}attributeChangedCallback(e,i,a){if(super.attributeChangedCallback(e,i,a),(e===r.MEDIA_PREVIEW_CHAPTER||e===r.MEDIA_LANG)&&a!==i&&a!=null)if(pt(this,ie).textContent=a,a!==""){const s=M("chapter: {chapterName}",{chapterName:a});this.setAttribute("aria-valuetext",s)}else this.removeAttribute("aria-valuetext")}get mediaPreviewChapter(){return Ie(this,r.MEDIA_PREVIEW_CHAPTER)}set mediaPreviewChapter(e){xe(this,r.MEDIA_PREVIEW_CHAPTER,e)}}ie=new WeakMap;u.customElements.get("media-preview-chapter-display")||u.customElements.define("media-preview-chapter-display",ct);var Ke=(t,e,i)=>{if(!e.has(t))throw TypeError("Cannot "+i)},p=(t,e,i)=>(Ke(t,e,"read from private field"),e.get(t)),_=(t,e,i)=>{if(e.has(t))throw TypeError("Cannot add the same private member more than once");e instanceof WeakSet?e.add(t):e.set(t,i)},c=(t,e,i,a)=>(Ke(t,e,"write to private field"),e.set(t,i),i),vt=(t,e,i,a)=>({set _(s){c(t,e,s)},get _(){return p(t,e)}}),k,ae,T,G,re,se,ne,P,A,oe;class Et{constructor(e,i,a){_(this,k,void 0),_(this,ae,void 0),_(this,T,void 0),_(this,G,void 0),_(this,re,void 0),_(this,se,void 0),_(this,ne,void 0),_(this,P,void 0),_(this,A,0),_(this,oe,(s=performance.now())=>{c(this,A,requestAnimationFrame(p(this,oe))),c(this,G,performance.now()-p(this,T));const n=1e3/this.fps;if(p(this,G)>n){c(this,T,s-p(this,G)%n);const o=1e3/((s-p(this,ae))/++vt(this,re)._),d=(s-p(this,se))/1e3/this.duration;let m=p(this,ne)+d*this.playbackRate;m-p(this,k).valueAsNumber>0?c(this,P,this.playbackRate/this.duration/o):(c(this,P,.995*p(this,P)),m=p(this,k).valueAsNumber+p(this,P)),this.callback(m)}}),c(this,k,e),this.callback=i,this.fps=a}start(){p(this,A)===0&&(c(this,T,performance.now()),c(this,ae,p(this,T)),c(this,re,0),p(this,oe).call(this))}stop(){p(this,A)!==0&&(cancelAnimationFrame(p(this,A)),c(this,A,0))}update({start:e,duration:i,playbackRate:a}){const s=e-p(this,k).valueAsNumber,n=Math.abs(i-this.duration);(s>0||s<-.03||n>=.5)&&this.callback(e),c(this,ne,e),c(this,se,performance.now()),this.duration=i,this.playbackRate=a}}k=new WeakMap;ae=new WeakMap;T=new WeakMap;G=new WeakMap;re=new WeakMap;se=new WeakMap;ne=new WeakMap;P=new WeakMap;A=new WeakMap;oe=new WeakMap;var ye=(t,e,i)=>{if(!e.has(t))throw TypeError("Cannot "+i)},l=(t,e,i)=>(ye(t,e,"read from private field"),i?i.call(t):e.get(t)),h=(t,e,i)=>{if(e.has(t))throw TypeError("Cannot add the same private member more than once");e instanceof WeakSet?e.add(t):e.set(t,i)},v=(t,e,i,a)=>(ye(t,e,"write to private field"),e.set(t,i),i),E=(t,e,i)=>(ye(t,e,"access private method"),i),C,w,le,U,he,de,F,q,S,W,H,we,Xe,fe,pe,Re,me,De,ue,ke,Ae,ze,K,ce,Me,Ye;const _t=t=>{const e=t.range,i=Le(+Qe(t)),a=Le(+t.mediaSeekableEnd),s=i&&a?M("{currentTime} of {totalTime}",{currentTime:i,totalTime:a}):M("video not loaded, unknown time.");e.setAttribute("aria-valuetext",s)};function bt(t){return`
    <style>
      :host {
        --media-box-border-radius: 4px;
        --media-box-padding-left: 10px;
        --media-box-padding-right: 10px;
        --media-preview-border-radius: var(--media-box-border-radius);
        --media-box-arrow-offset: var(--media-box-border-radius);
        --_control-background: var(--media-control-background, var(--media-secondary-color, rgb(20 20 30 / .7)));
        --_preview-background: var(--media-preview-background, var(--_control-background));

        
        contain: layout;
      }

      #buffered {
        background: var(--media-time-range-buffered-color, rgb(255 255 255 / .4));
        position: absolute;
        height: 100%;
        will-change: width;
      }

      #preview-rail,
      #current-rail {
        width: 100%;
        position: absolute;
        left: 0;
        bottom: 100%;
        pointer-events: none;
        will-change: transform;
      }

      [part~="box"] {
        width: min-content;
        
        position: absolute;
        bottom: 100%;
        flex-direction: column;
        align-items: center;
        transform: translateX(-50%);
      }

      [part~="current-box"] {
        display: var(--media-current-box-display, var(--media-box-display, flex));
        margin: var(--media-current-box-margin, var(--media-box-margin, 0 0 5px));
        visibility: hidden;
      }

      [part~="preview-box"] {
        display: var(--media-preview-box-display, var(--media-box-display, flex));
        margin: var(--media-preview-box-margin, var(--media-box-margin, 0 0 5px));
        transition-property: var(--media-preview-transition-property, visibility, opacity);
        transition-duration: var(--media-preview-transition-duration-out, .25s);
        transition-delay: var(--media-preview-transition-delay-out, 0s);
        visibility: hidden;
        opacity: 0;
      }

      :host(:is([${r.MEDIA_PREVIEW_IMAGE}], [${r.MEDIA_PREVIEW_TIME}])[dragging]) [part~="preview-box"] {
        transition-duration: var(--media-preview-transition-duration-in, .5s);
        transition-delay: var(--media-preview-transition-delay-in, .25s);
        visibility: visible;
        opacity: 1;
      }

      @media (hover: hover) {
        :host(:is([${r.MEDIA_PREVIEW_IMAGE}], [${r.MEDIA_PREVIEW_TIME}]):hover) [part~="preview-box"] {
          transition-duration: var(--media-preview-transition-duration-in, .5s);
          transition-delay: var(--media-preview-transition-delay-in, .25s);
          visibility: visible;
          opacity: 1;
        }
      }

      media-preview-thumbnail,
      ::slotted(media-preview-thumbnail) {
        visibility: hidden;
        
        transition: visibility 0s .25s;
        transition-delay: calc(var(--media-preview-transition-delay-out, 0s) + var(--media-preview-transition-duration-out, .25s));
        background: var(--media-preview-thumbnail-background, var(--_preview-background));
        box-shadow: var(--media-preview-thumbnail-box-shadow, 0 0 4px rgb(0 0 0 / .2));
        max-width: var(--media-preview-thumbnail-max-width, 180px);
        max-height: var(--media-preview-thumbnail-max-height, 160px);
        min-width: var(--media-preview-thumbnail-min-width, 120px);
        min-height: var(--media-preview-thumbnail-min-height, 80px);
        border: var(--media-preview-thumbnail-border);
        border-radius: var(--media-preview-thumbnail-border-radius,
          var(--media-preview-border-radius) var(--media-preview-border-radius) 0 0);
      }

      :host([${r.MEDIA_PREVIEW_IMAGE}][dragging]) media-preview-thumbnail,
      :host([${r.MEDIA_PREVIEW_IMAGE}][dragging]) ::slotted(media-preview-thumbnail) {
        transition-delay: var(--media-preview-transition-delay-in, .25s);
        visibility: visible;
      }

      @media (hover: hover) {
        :host([${r.MEDIA_PREVIEW_IMAGE}]:hover) media-preview-thumbnail,
        :host([${r.MEDIA_PREVIEW_IMAGE}]:hover) ::slotted(media-preview-thumbnail) {
          transition-delay: var(--media-preview-transition-delay-in, .25s);
          visibility: visible;
        }

        :host([${r.MEDIA_PREVIEW_TIME}]:hover) {
          --media-time-range-hover-display: block;
        }
      }

      media-preview-chapter-display,
      ::slotted(media-preview-chapter-display) {
        font-size: var(--media-font-size, 13px);
        line-height: 17px;
        min-width: 0;
        visibility: hidden;
        
        transition: min-width 0s, border-radius 0s, margin 0s, padding 0s, visibility 0s;
        transition-delay: calc(var(--media-preview-transition-delay-out, 0s) + var(--media-preview-transition-duration-out, .25s));
        background: var(--media-preview-chapter-background, var(--_preview-background));
        border-radius: var(--media-preview-chapter-border-radius,
          var(--media-preview-border-radius) var(--media-preview-border-radius)
          var(--media-preview-border-radius) var(--media-preview-border-radius));
        padding: var(--media-preview-chapter-padding, 3.5px 9px);
        margin: var(--media-preview-chapter-margin, 0 0 5px);
        text-shadow: var(--media-preview-chapter-text-shadow, 0 0 4px rgb(0 0 0 / .75));
      }

      :host([${r.MEDIA_PREVIEW_IMAGE}]) media-preview-chapter-display,
      :host([${r.MEDIA_PREVIEW_IMAGE}]) ::slotted(media-preview-chapter-display) {
        transition-delay: var(--media-preview-transition-delay-in, .25s);
        border-radius: var(--media-preview-chapter-border-radius, 0);
        padding: var(--media-preview-chapter-padding, 3.5px 9px 0);
        margin: var(--media-preview-chapter-margin, 0);
        min-width: 100%;
      }

      media-preview-chapter-display[${r.MEDIA_PREVIEW_CHAPTER}],
      ::slotted(media-preview-chapter-display[${r.MEDIA_PREVIEW_CHAPTER}]) {
        visibility: visible;
      }

      media-preview-chapter-display:not([aria-valuetext]),
      ::slotted(media-preview-chapter-display:not([aria-valuetext])) {
        display: none;
      }

      media-preview-time-display,
      ::slotted(media-preview-time-display),
      media-time-display,
      ::slotted(media-time-display) {
        font-size: var(--media-font-size, 13px);
        line-height: 17px;
        min-width: 0;
        
        transition: min-width 0s, border-radius 0s;
        transition-delay: calc(var(--media-preview-transition-delay-out, 0s) + var(--media-preview-transition-duration-out, .25s));
        background: var(--media-preview-time-background, var(--_preview-background));
        border-radius: var(--media-preview-time-border-radius,
          var(--media-preview-border-radius) var(--media-preview-border-radius)
          var(--media-preview-border-radius) var(--media-preview-border-radius));
        padding: var(--media-preview-time-padding, 3.5px 9px);
        margin: var(--media-preview-time-margin, 0);
        text-shadow: var(--media-preview-time-text-shadow, 0 0 4px rgb(0 0 0 / .75));
        transform: translateX(min(
          max(calc(50% - var(--_box-width) / 2),
          calc(var(--_box-shift, 0))),
          calc(var(--_box-width) / 2 - 50%)
        ));
      }

      :host([${r.MEDIA_PREVIEW_IMAGE}]) media-preview-time-display,
      :host([${r.MEDIA_PREVIEW_IMAGE}]) ::slotted(media-preview-time-display) {
        transition-delay: var(--media-preview-transition-delay-in, .25s);
        border-radius: var(--media-preview-time-border-radius,
          0 0 var(--media-preview-border-radius) var(--media-preview-border-radius));
        min-width: 100%;
      }

      :host([${r.MEDIA_PREVIEW_TIME}]:hover) {
        --media-time-range-hover-display: block;
      }

      [part~="arrow"],
      ::slotted([part~="arrow"]) {
        display: var(--media-box-arrow-display, inline-block);
        transform: translateX(min(
          max(calc(50% - var(--_box-width) / 2 + var(--media-box-arrow-offset)),
          calc(var(--_box-shift, 0))),
          calc(var(--_box-width) / 2 - 50% - var(--media-box-arrow-offset))
        ));
        
        border-color: transparent;
        border-top-color: var(--media-box-arrow-background, var(--_control-background));
        border-width: var(--media-box-arrow-border-width,
          var(--media-box-arrow-height, 5px) var(--media-box-arrow-width, 6px) 0);
        border-style: solid;
        justify-content: center;
        height: 0;
      }
    </style>
    <div id="preview-rail">
      <slot name="preview" part="box preview-box">
        <media-preview-thumbnail>
          <template shadowrootmode="${We.shadowRootOptions.mode}">
            ${We.getTemplateHTML({})}
          </template>
        </media-preview-thumbnail>
        <media-preview-chapter-display></media-preview-chapter-display>
        <media-preview-time-display></media-preview-time-display>
        <slot name="preview-arrow"><div part="arrow"></div></slot>
      </slot>
    </div>
    <div id="current-rail">
      <slot name="current" part="box current-box">
        
      </slot>
    </div>
  `}const te=(t,e=t.mediaCurrentTime)=>{const i=Number.isFinite(t.mediaSeekableStart)?t.mediaSeekableStart:0,a=Number.isFinite(t.mediaDuration)?t.mediaDuration:t.mediaSeekableEnd;if(Number.isNaN(a))return 0;const s=(e-i)/(a-i);return Math.max(0,Math.min(s,1))},Qe=(t,e=t.range.valueAsNumber)=>{const i=Number.isFinite(t.mediaSeekableStart)?t.mediaSeekableStart:0,a=Number.isFinite(t.mediaDuration)?t.mediaDuration:t.mediaSeekableEnd;return Number.isNaN(a)?0:e*(a-i)+i};class Ee extends tt{constructor(){super(),h(this,we),h(this,pe),h(this,me),h(this,ue),h(this,Ae),h(this,K),h(this,Me),h(this,C,null),h(this,w,void 0),h(this,le,void 0),h(this,U,void 0),h(this,he,void 0),h(this,de,void 0),h(this,F,void 0),h(this,q,void 0),h(this,S,void 0),h(this,W,void 0),h(this,H,()=>{E(this,we,Xe).call(this)?l(this,w).start():l(this,w).stop()}),h(this,fe,a=>{this.dragging||(Ge(a)&&(this.range.valueAsNumber=a),l(this,W)||this.updateBar())}),this.shadowRoot.querySelector("#track").insertAdjacentHTML("afterbegin",'<div id="buffered" part="buffered"></div>'),v(this,le,this.shadowRoot.querySelectorAll('[part~="box"]')),v(this,he,this.shadowRoot.querySelector('[part~="preview-box"]')),v(this,de,this.shadowRoot.querySelector('[part~="current-box"]'));const i=getComputedStyle(this);v(this,F,parseInt(i.getPropertyValue("--media-box-padding-left"))),v(this,q,parseInt(i.getPropertyValue("--media-box-padding-right"))),v(this,w,new Et(this.range,l(this,fe),60))}static get observedAttributes(){return[...super.observedAttributes,r.MEDIA_PAUSED,r.MEDIA_DURATION,r.MEDIA_SEEKABLE,r.MEDIA_CURRENT_TIME,r.MEDIA_PREVIEW_IMAGE,r.MEDIA_PREVIEW_TIME,r.MEDIA_PREVIEW_CHAPTER,r.MEDIA_BUFFERED,r.MEDIA_PLAYBACK_RATE,r.MEDIA_LOADING,r.MEDIA_ENDED]}connectedCallback(){var e;super.connectedCallback(),this.range.setAttribute("aria-label",M("seek")),l(this,H).call(this),v(this,C,this.getRootNode()),(e=l(this,C))==null||e.addEventListener("transitionstart",this)}disconnectedCallback(){var e;super.disconnectedCallback(),l(this,w).stop(),(e=l(this,C))==null||e.removeEventListener("transitionstart",this),v(this,C,null)}attributeChangedCallback(e,i,a){super.attributeChangedCallback(e,i,a),i!=a&&(e===r.MEDIA_CURRENT_TIME||e===r.MEDIA_PAUSED||e===r.MEDIA_ENDED||e===r.MEDIA_LOADING||e===r.MEDIA_DURATION||e===r.MEDIA_SEEKABLE?(l(this,w).update({start:te(this),duration:this.mediaSeekableEnd-this.mediaSeekableStart,playbackRate:this.mediaPlaybackRate}),l(this,H).call(this),_t(this)):e===r.MEDIA_BUFFERED&&this.updateBufferedBar(),(e===r.MEDIA_DURATION||e===r.MEDIA_SEEKABLE)&&(this.mediaChaptersCues=l(this,S),this.updateBar()))}get mediaChaptersCues(){return l(this,S)}set mediaChaptersCues(e){var i;v(this,S,e),this.updateSegments((i=l(this,S))==null?void 0:i.map(a=>({start:te(this,a.startTime),end:te(this,a.endTime)})))}get mediaPaused(){return be(this,r.MEDIA_PAUSED)}set mediaPaused(e){ge(this,r.MEDIA_PAUSED,e)}get mediaLoading(){return be(this,r.MEDIA_LOADING)}set mediaLoading(e){ge(this,r.MEDIA_LOADING,e)}get mediaDuration(){return B(this,r.MEDIA_DURATION)}set mediaDuration(e){O(this,r.MEDIA_DURATION,e)}get mediaCurrentTime(){return B(this,r.MEDIA_CURRENT_TIME)}set mediaCurrentTime(e){O(this,r.MEDIA_CURRENT_TIME,e)}get mediaPlaybackRate(){return B(this,r.MEDIA_PLAYBACK_RATE,1)}set mediaPlaybackRate(e){O(this,r.MEDIA_PLAYBACK_RATE,e)}get mediaBuffered(){const e=this.getAttribute(r.MEDIA_BUFFERED);return e?e.split(" ").map(i=>i.split(":").map(a=>+a)):[]}set mediaBuffered(e){if(!e){this.removeAttribute(r.MEDIA_BUFFERED);return}const i=e.map(a=>a.join(":")).join(" ");this.setAttribute(r.MEDIA_BUFFERED,i)}get mediaSeekable(){const e=this.getAttribute(r.MEDIA_SEEKABLE);if(e)return e.split(":").map(i=>+i)}set mediaSeekable(e){if(e==null){this.removeAttribute(r.MEDIA_SEEKABLE);return}this.setAttribute(r.MEDIA_SEEKABLE,e.join(":"))}get mediaSeekableEnd(){var e;const[,i=this.mediaDuration]=(e=this.mediaSeekable)!=null?e:[];return i}get mediaSeekableStart(){var e;const[i=0]=(e=this.mediaSeekable)!=null?e:[];return i}get mediaPreviewImage(){return Ie(this,r.MEDIA_PREVIEW_IMAGE)}set mediaPreviewImage(e){xe(this,r.MEDIA_PREVIEW_IMAGE,e)}get mediaPreviewTime(){return B(this,r.MEDIA_PREVIEW_TIME)}set mediaPreviewTime(e){O(this,r.MEDIA_PREVIEW_TIME,e)}get mediaEnded(){return be(this,r.MEDIA_ENDED)}set mediaEnded(e){ge(this,r.MEDIA_ENDED,e)}updateBar(){super.updateBar(),this.updateBufferedBar(),this.updateCurrentBox()}updateBufferedBar(){var e;const i=this.mediaBuffered;if(!i.length)return;let a;if(this.mediaEnded)a=1;else{const n=this.mediaCurrentTime,[,o=this.mediaSeekableStart]=(e=i.find(([d,m])=>d<=n&&n<=m))!=null?e:[];a=te(this,o)}const{style:s}=f(this.shadowRoot,"#buffered");s.setProperty("width",`${a*100}%`)}updateCurrentBox(){if(!this.shadowRoot.querySelector('slot[name="current"]').assignedElements().length)return;const i=f(this.shadowRoot,"#current-rail"),a=f(this.shadowRoot,'[part~="current-box"]'),s=E(this,pe,Re).call(this,l(this,de)),n=E(this,me,De).call(this,s,this.range.valueAsNumber),o=E(this,ue,ke).call(this,s,this.range.valueAsNumber);i.style.transform=`translateX(${n})`,i.style.setProperty("--_range-width",`${s.range.width}`),a.style.setProperty("--_box-shift",`${o}`),a.style.setProperty("--_box-width",`${s.box.width}px`),a.style.setProperty("visibility","initial")}handleEvent(e){switch(super.handleEvent(e),e.type){case"input":E(this,Me,Ye).call(this);break;case"pointermove":E(this,Ae,ze).call(this,e);break;case"pointerup":l(this,W)&&v(this,W,!1);break;case"pointerdown":v(this,W,!0);break;case"pointerleave":E(this,K,ce).call(this,null);break;case"transitionstart":Ze(e.target,this)&&setTimeout(()=>l(this,H).call(this),0);break}}}C=new WeakMap;w=new WeakMap;le=new WeakMap;U=new WeakMap;he=new WeakMap;de=new WeakMap;F=new WeakMap;q=new WeakMap;S=new WeakMap;W=new WeakMap;H=new WeakMap;we=new WeakSet;Xe=function(){return this.isConnected&&!this.mediaPaused&&!this.mediaLoading&&!this.mediaEnded&&this.mediaSeekableEnd>0&&je(this)};fe=new WeakMap;pe=new WeakSet;Re=function(t){var e;const a=((e=this.getAttribute("bounds")?et(this,`#${this.getAttribute("bounds")}`):this.parentElement)!=null?e:this).getBoundingClientRect(),s=this.range.getBoundingClientRect(),n=t.offsetWidth,o=-(s.left-a.left-n/2),d=a.right-s.left-n/2;return{box:{width:n,min:o,max:d},bounds:a,range:s}};me=new WeakSet;De=function(t,e){let i=`${e*100}%`;const{width:a,min:s,max:n}=t.box;if(!a)return i;if(Number.isNaN(s)||(i=`max(${`calc(1 / var(--_range-width) * 100 * ${s}% + var(--media-box-padding-left))`}, ${i})`),!Number.isNaN(n)){const d=`calc(1 / var(--_range-width) * 100 * ${n}% - var(--media-box-padding-right))`;i=`min(${i}, ${d})`}return i};ue=new WeakSet;ke=function(t,e){const{width:i,min:a,max:s}=t.box,n=e*t.range.width;if(n<a+l(this,F)){const o=t.range.left-t.bounds.left-l(this,F);return`${n-i/2+o}px`}if(n>s-l(this,q)){const o=t.bounds.right-t.range.right-l(this,q);return`${n+i/2-o-t.range.width}px`}return 0};Ae=new WeakSet;ze=function(t){const e=[...l(this,le)].some(X=>t.composedPath().includes(X));if(!this.dragging&&(e||!t.composedPath().includes(this))){E(this,K,ce).call(this,null);return}const i=this.mediaSeekableEnd;if(!i)return;const a=f(this.shadowRoot,"#preview-rail"),s=f(this.shadowRoot,'[part~="preview-box"]'),n=E(this,pe,Re).call(this,l(this,he));let o=(t.clientX-n.range.left)/n.range.width;o=Math.max(0,Math.min(1,o));const d=E(this,me,De).call(this,n,o),m=E(this,ue,ke).call(this,n,o);a.style.transform=`translateX(${d})`,a.style.setProperty("--_range-width",`${n.range.width}`),s.style.setProperty("--_box-shift",`${m}`),s.style.setProperty("--_box-width",`${n.box.width}px`);const N=Math.round(l(this,U))-Math.round(o*i);Math.abs(N)<1&&o>.01&&o<.99||(v(this,U,o*i),E(this,K,ce).call(this,l(this,U)))};K=new WeakSet;ce=function(t){this.dispatchEvent(new u.CustomEvent(Ve.MEDIA_PREVIEW_REQUEST,{composed:!0,bubbles:!0,detail:t}))};Me=new WeakSet;Ye=function(){l(this,w).stop();const t=Qe(this);this.dispatchEvent(new u.CustomEvent(Ve.MEDIA_SEEK_REQUEST,{composed:!0,bubbles:!0,detail:t}))};Ee.shadowRootOptions={mode:"open"};Ee.getContainerTemplateHTML=bt;u.customElements.get("media-time-range")||u.customElements.define("media-time-range",Ee);var It=Ee;export{It as default};
