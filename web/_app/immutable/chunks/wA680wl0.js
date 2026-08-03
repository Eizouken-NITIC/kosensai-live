import{G as o,n as K,M as S,e as b,D as Z,i as j,f as ee,a as d,h as te,j as ie,g as ae,s as re,c as ne,d as se,b as oe}from"./DgoJgpDD.js";import{o as de,u as he}from"./CvoaEA5Z.js";import{t as le}from"./BvMjJdGg.js";var O=(t,e,i)=>{if(!e.has(t))throw TypeError("Cannot "+i)},a=(t,e,i)=>(O(t,e,"read from private field"),i?i.call(t):e.get(t)),n=(t,e,i)=>{if(e.has(t))throw TypeError("Cannot add the same private member more than once");e instanceof WeakSet?e.add(t):e.set(t,i)},v=(t,e,i,r)=>(O(t,e,"write to private field"),e.set(t,i),i),h=(t,e,i)=>(O(t,e,"access private method"),i),g,T,w,_,l,L,k,E,y,W,H,x,C,M,P,R,B,U,q,I,z,D,F,$,G;function ce(t){return`
    <style>
      :host {
        --_focus-box-shadow: var(--media-focus-box-shadow, inset 0 0 0 2px rgb(27 127 204 / .9));
        --_media-range-padding: var(--media-range-padding, var(--media-control-padding, 10px));

        box-shadow: var(--_focus-visible-box-shadow, none);
        background: var(--media-control-background, var(--media-secondary-color, rgb(20 20 30 / .7)));
        height: calc(var(--media-control-height, 24px) + 2 * var(--_media-range-padding));
        display: inline-flex;
        align-items: center;
        
        vertical-align: middle;
        box-sizing: border-box;
        position: relative;
        width: 100px;
        transition: background .15s linear;
        cursor: var(--media-cursor, pointer);
        pointer-events: auto;
        touch-action: none; 
      }

      
      input[type=range]:focus {
        outline: 0;
      }
      input[type=range]:focus::-webkit-slider-runnable-track {
        outline: 0;
      }

      :host(:hover) {
        background: var(--media-control-hover-background, rgb(50 50 70 / .7));
      }

      #leftgap {
        padding-left: var(--media-range-padding-left, var(--_media-range-padding));
      }

      #rightgap {
        padding-right: var(--media-range-padding-right, var(--_media-range-padding));
      }

      #startpoint,
      #endpoint {
        position: absolute;
      }

      #endpoint {
        right: 0;
      }

      #container {
        
        width: var(--media-range-track-width, 100%);
        transform: translate(var(--media-range-track-translate-x, 0px), var(--media-range-track-translate-y, 0px));
        position: relative;
        height: 100%;
        display: flex;
        align-items: center;
        min-width: 40px;
      }

      #range {
        
        display: var(--media-time-range-hover-display, block);
        bottom: var(--media-time-range-hover-bottom, 0);
        height: var(--media-time-range-hover-height, max(100% , 25px));
        width: 100%;
        position: absolute;
        cursor: var(--media-cursor, pointer);

        -webkit-appearance: none; 
        -webkit-tap-highlight-color: transparent;
        background: transparent; 
        margin: 0;
        z-index: 1;
      }

      @media (hover: hover) {
        #range {
          bottom: var(--media-time-range-hover-bottom, 0);
          height: var(--media-time-range-hover-height, max(100%, 20px));
        }
      }

      
      
      #range::-webkit-slider-thumb {
        -webkit-appearance: none;
        background: transparent;
        width: .1px;
        height: .1px;
      }

      
      #range::-moz-range-thumb {
        background: transparent;
        border: transparent;
        width: .1px;
        height: .1px;
      }

      #appearance {
        height: var(--media-range-track-height, 4px);
        display: flex;
        flex-direction: column;
        justify-content: center;
        width: 100%;
        position: absolute;
        
        will-change: transform;
      }

      #track {
        background: var(--media-range-track-background, rgb(255 255 255 / .2));
        border-radius: var(--media-range-track-border-radius, 1px);
        border: var(--media-range-track-border, none);
        outline: var(--media-range-track-outline);
        outline-offset: var(--media-range-track-outline-offset);
        backdrop-filter: var(--media-range-track-backdrop-filter);
        -webkit-backdrop-filter: var(--media-range-track-backdrop-filter);
        box-shadow: var(--media-range-track-box-shadow, none);
        position: absolute;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      #progress,
      #pointer {
        position: absolute;
        height: 100%;
        will-change: width;
      }

      #progress {
        background: var(--media-range-bar-color, var(--media-primary-color, rgb(238 238 238)));
        transition: var(--media-range-track-transition);
      }

      #pointer {
        background: var(--media-range-track-pointer-background);
        border-right: var(--media-range-track-pointer-border-right);
        transition: visibility .25s, opacity .25s;
        visibility: hidden;
        opacity: 0;
      }

      @media (hover: hover) {
        :host(:hover) #pointer {
          transition: visibility .5s, opacity .5s;
          visibility: visible;
          opacity: 1;
        }
      }

      #thumb,
      ::slotted([slot=thumb]) {
        width: var(--media-range-thumb-width, 10px);
        height: var(--media-range-thumb-height, 10px);
        transition: var(--media-range-thumb-transition);
        transform: var(--media-range-thumb-transform, none);
        opacity: var(--media-range-thumb-opacity, 1);
        translate: -50%;
        position: absolute;
        left: 0;
        cursor: var(--media-cursor, pointer);
      }

      #thumb {
        border-radius: var(--media-range-thumb-border-radius, 10px);
        background: var(--media-range-thumb-background, var(--media-primary-color, rgb(238 238 238)));
        box-shadow: var(--media-range-thumb-box-shadow, 1px 1px 1px transparent);
        border: var(--media-range-thumb-border, none);
      }

      :host([disabled]) #thumb {
        background-color: #777;
      }

      .segments #appearance {
        height: var(--media-range-segment-hover-height, 7px);
      }

      #track {
        clip-path: url(#segments-clipping);
      }

      #segments {
        --segments-gap: var(--media-range-segments-gap, 2px);
        position: absolute;
        width: 100%;
        height: 100%;
      }

      #segments-clipping {
        transform: translateX(calc(var(--segments-gap) / 2));
      }

      #segments-clipping:empty {
        display: none;
      }

      #segments-clipping rect {
        height: var(--media-range-track-height, 4px);
        y: calc((var(--media-range-segment-hover-height, 7px) - var(--media-range-track-height, 4px)) / 2);
        transition: var(--media-range-segment-transition, transform .1s ease-in-out);
        transform: var(--media-range-segment-transform, scaleY(1));
        transform-origin: center;
      }

      /* Visible label for accessibility - positioned off-screen but technically visible (Firefox requires visible labels) */
      #range-label {
        position: absolute;
        left: -10000px;
        background: var(--media-control-background, var(--media-secondary-color, rgb(20 20 30 / .7)));
        pointer-events: none;
      }
    </style>
    <div id="leftgap"></div>
    <div id="container">
      <div id="startpoint"></div>
      <div id="endpoint"></div>
      <div id="appearance">
        <div id="track" part="track">
          <div id="pointer"></div>
          <div id="progress" part="progress"></div>
        </div>
        <slot name="thumb">
          <div id="thumb" part="thumb"></div>
        </slot>
        <svg id="segments" aria-hidden="true"><clipPath id="segments-clipping"></clipPath></svg>
      </div>
        <input id="range" type="range" min="0" max="1" step="any" value="0">
        <label for="range" id="range-label"></label>

      ${this.getContainerTemplateHTML(t)}
    </div>
    <div id="rightgap"></div>
  `}function ge(t){return""}class f extends o.HTMLElement{constructor(){if(super(),n(this,W),n(this,x),n(this,M),n(this,R),n(this,U),n(this,I),n(this,D),n(this,$),n(this,g,void 0),n(this,T,void 0),n(this,w,void 0),n(this,_,void 0),n(this,l,{}),n(this,L,[]),n(this,k,()=>{if(this.range.matches(":focus-visible")){const{style:e}=b(this.shadowRoot,":host");e.setProperty("--_focus-visible-box-shadow","var(--_focus-box-shadow)")}}),n(this,E,()=>{const{style:e}=b(this.shadowRoot,":host");e.removeProperty("--_focus-visible-box-shadow")}),n(this,y,()=>{const e=this.shadowRoot.querySelector("#segments-clipping");e&&e.parentNode.append(e)}),!this.shadowRoot){this.attachShadow(this.constructor.shadowRootOptions);const e=K(this.attributes),i=this.constructor.getTemplateHTML(e);this.shadowRoot.setHTMLUnsafe?this.shadowRoot.setHTMLUnsafe(i):this.shadowRoot.innerHTML=i}this.container=this.shadowRoot.querySelector("#container"),v(this,w,this.shadowRoot.querySelector("#startpoint")),v(this,_,this.shadowRoot.querySelector("#endpoint")),this.range=this.shadowRoot.querySelector("#range"),this.appearance=this.shadowRoot.querySelector("#appearance")}static get observedAttributes(){return["disabled","aria-disabled",S.MEDIA_CONTROLLER]}attributeChangedCallback(e,i,r){var c,s,m,p,u;e===S.MEDIA_CONTROLLER?(i&&((s=(c=a(this,g))==null?void 0:c.unassociateElement)==null||s.call(c,this),v(this,g,null)),r&&this.isConnected&&(v(this,g,(m=this.getRootNode())==null?void 0:m.getElementById(r)),(u=(p=a(this,g))==null?void 0:p.associateElement)==null||u.call(p,this))):(e==="disabled"||e==="aria-disabled"&&i!==r)&&(r==null?(this.range.removeAttribute(e),h(this,x,C).call(this)):(this.range.setAttribute(e,r),h(this,M,P).call(this)))}connectedCallback(){var e,i,r;const{style:c}=b(this.shadowRoot,":host");c.setProperty("display",`var(--media-control-display, var(--${this.localName}-display, inline-flex))`),a(this,l).pointer=b(this.shadowRoot,"#pointer"),a(this,l).progress=b(this.shadowRoot,"#progress"),a(this,l).thumb=b(this.shadowRoot,'#thumb, ::slotted([slot="thumb"])'),a(this,l).activeSegment=b(this.shadowRoot,"#segments-clipping rect:nth-child(0)");const s=this.getAttribute(S.MEDIA_CONTROLLER);s&&(v(this,g,(e=this.getRootNode())==null?void 0:e.getElementById(s)),(r=(i=a(this,g))==null?void 0:i.associateElement)==null||r.call(i,this)),this.updateBar(),this.shadowRoot.addEventListener("focusin",a(this,k)),this.shadowRoot.addEventListener("focusout",a(this,E)),h(this,x,C).call(this),de(this.container,a(this,y))}disconnectedCallback(){var e,i;h(this,M,P).call(this),(i=(e=a(this,g))==null?void 0:e.unassociateElement)==null||i.call(e,this),v(this,g,null),this.shadowRoot.removeEventListener("focusin",a(this,k)),this.shadowRoot.removeEventListener("focusout",a(this,E)),he(this.container,a(this,y))}updatePointerBar(e){var i;(i=a(this,l).pointer)==null||i.style.setProperty("width",`${this.getPointerRatio(e)*100}%`)}updateBar(){var e,i;const r=this.range.valueAsNumber*100;(e=a(this,l).progress)==null||e.style.setProperty("width",`${r}%`),(i=a(this,l).thumb)==null||i.style.setProperty("left",`${r}%`)}updateSegments(e){const i=this.shadowRoot.querySelector("#segments-clipping");if(i.textContent="",this.container.classList.toggle("segments",!!e?.length),!e?.length)return;const r=[...new Set([+this.range.min,...e.flatMap(s=>[s.start,s.end]),+this.range.max])];v(this,L,[...r]);const c=r.pop();for(const[s,m]of r.entries()){const[p,u]=[s===0,s===r.length-1],X=p?"calc(var(--segments-gap) / -1)":`${m*100}%`,Q=`calc(${((u?c:r[s+1])-m)*100}%${p||u?"":" - var(--segments-gap)"})`,J=Z.createElementNS("http://www.w3.org/2000/svg","rect"),V=j(this.shadowRoot,`#segments-clipping rect:nth-child(${s+1})`);V.style.setProperty("x",X),V.style.setProperty("width",Q),i.append(J)}}getPointerRatio(e){return ee(e.clientX,e.clientY,a(this,w).getBoundingClientRect(),a(this,_).getBoundingClientRect())}get dragging(){return this.hasAttribute("dragging")}handleEvent(e){switch(e.type){case"pointermove":h(this,$,G).call(this,e);break;case"input":this.updateBar();break;case"pointerenter":h(this,U,q).call(this,e);break;case"pointerdown":h(this,R,B).call(this,e);break;case"pointerup":h(this,I,z).call(this);break;case"pointerleave":h(this,D,F).call(this);break}}get keysUsed(){return["ArrowUp","ArrowRight","ArrowDown","ArrowLeft"]}}g=new WeakMap;T=new WeakMap;w=new WeakMap;_=new WeakMap;l=new WeakMap;L=new WeakMap;k=new WeakMap;E=new WeakMap;y=new WeakMap;W=new WeakSet;H=function(t){const e=a(this,l).activeSegment;if(!e)return;const i=this.getPointerRatio(t),c=`#segments-clipping rect:nth-child(${a(this,L).findIndex((s,m,p)=>{const u=p[m+1];return u!=null&&i>=s&&i<=u})+1})`;(e.selectorText!=c||!e.style.transform)&&(e.selectorText=c,e.style.setProperty("transform","var(--media-range-segment-hover-transform, scaleY(2))"))};x=new WeakSet;C=function(){this.hasAttribute("disabled")||!this.isConnected||(this.addEventListener("input",this),this.addEventListener("pointerdown",this),this.addEventListener("pointerenter",this))};M=new WeakSet;P=function(){var t,e;this.removeEventListener("input",this),this.removeEventListener("pointerdown",this),this.removeEventListener("pointerenter",this),this.removeEventListener("pointerleave",this),(t=o.window)==null||t.removeEventListener("pointerup",this),(e=o.window)==null||e.removeEventListener("pointermove",this)};R=new WeakSet;B=function(t){var e;v(this,T,t.composedPath().includes(this.range)),(e=o.window)==null||e.addEventListener("pointerup",this,{once:!0})};U=new WeakSet;q=function(t){var e;t.pointerType!=="mouse"&&h(this,R,B).call(this,t),this.addEventListener("pointerleave",this,{once:!0}),(e=o.window)==null||e.addEventListener("pointermove",this)};I=new WeakSet;z=function(){var t;(t=o.window)==null||t.removeEventListener("pointerup",this),this.toggleAttribute("dragging",!1),this.range.disabled=this.hasAttribute("disabled")};D=new WeakSet;F=function(){var t,e;this.removeEventListener("pointerleave",this),(t=o.window)==null||t.removeEventListener("pointermove",this),this.toggleAttribute("dragging",!1),this.range.disabled=this.hasAttribute("disabled"),(e=a(this,l).activeSegment)==null||e.style.removeProperty("transform")};$=new WeakSet;G=function(t){t.pointerType==="pen"&&t.buttons===0||(this.toggleAttribute("dragging",t.buttons===1||t.pointerType!=="mouse"),this.updatePointerBar(t),h(this,W,H).call(this,t),this.dragging&&(t.pointerType!=="mouse"||!a(this,T))&&(this.range.disabled=!0,this.range.valueAsNumber=this.getPointerRatio(t),this.range.dispatchEvent(new Event("input",{bubbles:!0,composed:!0}))))};f.shadowRootOptions={mode:"open"};f.getTemplateHTML=ce;f.getContainerTemplateHTML=ge;o.customElements.get("media-chrome-range")||o.customElements.define("media-chrome-range",f);var pe=(t,e,i)=>{if(!e.has(t))throw TypeError("Cannot "+i)},N=(t,e,i)=>(pe(t,e,"read from private field"),i?i.call(t):e.get(t)),ue=(t,e,i)=>{if(e.has(t))throw TypeError("Cannot add the same private member more than once");e instanceof WeakSet?e.add(t):e.set(t,i)},A;const ve=1,me=t=>t.mediaMuted?0:t.mediaVolume,be=t=>`${Math.round(t*100)}%`;class Y extends f{constructor(){super(...arguments),ue(this,A,()=>{const e=this.range.value,i=new o.CustomEvent(oe.MEDIA_VOLUME_REQUEST,{composed:!0,bubbles:!0,detail:e});this.dispatchEvent(i)})}static get observedAttributes(){return[...super.observedAttributes,d.MEDIA_VOLUME,d.MEDIA_MUTED,d.MEDIA_VOLUME_UNAVAILABLE]}connectedCallback(){super.connectedCallback(),this.range.setAttribute("aria-label",le("volume")),this.range.addEventListener("input",N(this,A))}disconnectedCallback(){this.range.removeEventListener("input",N(this,A)),super.disconnectedCallback()}attributeChangedCallback(e,i,r){super.attributeChangedCallback(e,i,r),(e===d.MEDIA_VOLUME||e===d.MEDIA_MUTED)&&(this.range.valueAsNumber=me(this),this.range.setAttribute("aria-valuetext",be(this.range.valueAsNumber)),this.updateBar())}get mediaVolume(){return te(this,d.MEDIA_VOLUME,ve)}set mediaVolume(e){ie(this,d.MEDIA_VOLUME,e)}get mediaMuted(){return ae(this,d.MEDIA_MUTED)}set mediaMuted(e){re(this,d.MEDIA_MUTED,e)}get mediaVolumeUnavailable(){return ne(this,d.MEDIA_VOLUME_UNAVAILABLE)}set mediaVolumeUnavailable(e){se(this,d.MEDIA_VOLUME_UNAVAILABLE,e)}}A=new WeakMap;o.customElements.get("media-volume-range")||o.customElements.define("media-volume-range",Y);var Ee=Y;export{Ee as default};
