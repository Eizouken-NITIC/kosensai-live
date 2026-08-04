import{G as c,n as X,M as P,h as m,D as J,i as K,j as Q}from"./C2UIz1tz.js";import{o as Z,u as j}from"./BQM12isa.js";var I=(t,e,i)=>{if(!e.has(t))throw TypeError("Cannot "+i)},a=(t,e,i)=>(I(t,e,"read from private field"),i?i.call(t):e.get(t)),n=(t,e,i)=>{if(e.has(t))throw TypeError("Cannot add the same private member more than once");e instanceof WeakSet?e.add(t):e.set(t,i)},v=(t,e,i,r)=>(I(t,e,"write to private field"),e.set(t,i),i),o=(t,e,i)=>(I(t,e,"access private method"),i),l,L,b,w,d,R,f,k,y,O,B,_,S,x,T,E,H,A,q,C,D,$,N,W,z;function V(t){return`
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
  `}function ee(t){return""}class M extends c.HTMLElement{constructor(){if(super(),n(this,O),n(this,_),n(this,x),n(this,E),n(this,A),n(this,C),n(this,$),n(this,W),n(this,l,void 0),n(this,L,void 0),n(this,b,void 0),n(this,w,void 0),n(this,d,{}),n(this,R,[]),n(this,f,()=>{if(this.range.matches(":focus-visible")){const{style:e}=m(this.shadowRoot,":host");e.setProperty("--_focus-visible-box-shadow","var(--_focus-box-shadow)")}}),n(this,k,()=>{const{style:e}=m(this.shadowRoot,":host");e.removeProperty("--_focus-visible-box-shadow")}),n(this,y,()=>{const e=this.shadowRoot.querySelector("#segments-clipping");e&&e.parentNode.append(e)}),!this.shadowRoot){this.attachShadow(this.constructor.shadowRootOptions);const e=X(this.attributes),i=this.constructor.getTemplateHTML(e);this.shadowRoot.setHTMLUnsafe?this.shadowRoot.setHTMLUnsafe(i):this.shadowRoot.innerHTML=i}this.container=this.shadowRoot.querySelector("#container"),v(this,b,this.shadowRoot.querySelector("#startpoint")),v(this,w,this.shadowRoot.querySelector("#endpoint")),this.range=this.shadowRoot.querySelector("#range"),this.appearance=this.shadowRoot.querySelector("#appearance")}static get observedAttributes(){return["disabled","aria-disabled",P.MEDIA_CONTROLLER]}attributeChangedCallback(e,i,r){var h,s,u,p,g;e===P.MEDIA_CONTROLLER?(i&&((s=(h=a(this,l))==null?void 0:h.unassociateElement)==null||s.call(h,this),v(this,l,null)),r&&this.isConnected&&(v(this,l,(u=this.getRootNode())==null?void 0:u.getElementById(r)),(g=(p=a(this,l))==null?void 0:p.associateElement)==null||g.call(p,this))):(e==="disabled"||e==="aria-disabled"&&i!==r)&&(r==null?(this.range.removeAttribute(e),o(this,_,S).call(this)):(this.range.setAttribute(e,r),o(this,x,T).call(this)))}connectedCallback(){var e,i,r;const{style:h}=m(this.shadowRoot,":host");h.setProperty("display",`var(--media-control-display, var(--${this.localName}-display, inline-flex))`),a(this,d).pointer=m(this.shadowRoot,"#pointer"),a(this,d).progress=m(this.shadowRoot,"#progress"),a(this,d).thumb=m(this.shadowRoot,'#thumb, ::slotted([slot="thumb"])'),a(this,d).activeSegment=m(this.shadowRoot,"#segments-clipping rect:nth-child(0)");const s=this.getAttribute(P.MEDIA_CONTROLLER);s&&(v(this,l,(e=this.getRootNode())==null?void 0:e.getElementById(s)),(r=(i=a(this,l))==null?void 0:i.associateElement)==null||r.call(i,this)),this.updateBar(),this.shadowRoot.addEventListener("focusin",a(this,f)),this.shadowRoot.addEventListener("focusout",a(this,k)),o(this,_,S).call(this),Z(this.container,a(this,y))}disconnectedCallback(){var e,i;o(this,x,T).call(this),(i=(e=a(this,l))==null?void 0:e.unassociateElement)==null||i.call(e,this),v(this,l,null),this.shadowRoot.removeEventListener("focusin",a(this,f)),this.shadowRoot.removeEventListener("focusout",a(this,k)),j(this.container,a(this,y))}updatePointerBar(e){var i;(i=a(this,d).pointer)==null||i.style.setProperty("width",`${this.getPointerRatio(e)*100}%`)}updateBar(){var e,i;const r=this.range.valueAsNumber*100;(e=a(this,d).progress)==null||e.style.setProperty("width",`${r}%`),(i=a(this,d).thumb)==null||i.style.setProperty("left",`${r}%`)}updateSegments(e){const i=this.shadowRoot.querySelector("#segments-clipping");if(i.textContent="",this.container.classList.toggle("segments",!!e?.length),!e?.length)return;const r=[...new Set([+this.range.min,...e.flatMap(s=>[s.start,s.end]),+this.range.max])];v(this,R,[...r]);const h=r.pop();for(const[s,u]of r.entries()){const[p,g]=[s===0,s===r.length-1],F=p?"calc(var(--segments-gap) / -1)":`${u*100}%`,G=`calc(${((g?h:r[s+1])-u)*100}%${p||g?"":" - var(--segments-gap)"})`,Y=J.createElementNS("http://www.w3.org/2000/svg","rect"),U=K(this.shadowRoot,`#segments-clipping rect:nth-child(${s+1})`);U.style.setProperty("x",F),U.style.setProperty("width",G),i.append(Y)}}getPointerRatio(e){return Q(e.clientX,e.clientY,a(this,b).getBoundingClientRect(),a(this,w).getBoundingClientRect())}get dragging(){return this.hasAttribute("dragging")}handleEvent(e){switch(e.type){case"pointermove":o(this,W,z).call(this,e);break;case"input":this.updateBar();break;case"pointerenter":o(this,A,q).call(this,e);break;case"pointerdown":o(this,E,H).call(this,e);break;case"pointerup":o(this,C,D).call(this);break;case"pointerleave":o(this,$,N).call(this);break}}get keysUsed(){return["ArrowUp","ArrowRight","ArrowDown","ArrowLeft"]}}l=new WeakMap;L=new WeakMap;b=new WeakMap;w=new WeakMap;d=new WeakMap;R=new WeakMap;f=new WeakMap;k=new WeakMap;y=new WeakMap;O=new WeakSet;B=function(t){const e=a(this,d).activeSegment;if(!e)return;const i=this.getPointerRatio(t),h=`#segments-clipping rect:nth-child(${a(this,R).findIndex((s,u,p)=>{const g=p[u+1];return g!=null&&i>=s&&i<=g})+1})`;(e.selectorText!=h||!e.style.transform)&&(e.selectorText=h,e.style.setProperty("transform","var(--media-range-segment-hover-transform, scaleY(2))"))};_=new WeakSet;S=function(){this.hasAttribute("disabled")||!this.isConnected||(this.addEventListener("input",this),this.addEventListener("pointerdown",this),this.addEventListener("pointerenter",this))};x=new WeakSet;T=function(){var t,e;this.removeEventListener("input",this),this.removeEventListener("pointerdown",this),this.removeEventListener("pointerenter",this),this.removeEventListener("pointerleave",this),(t=c.window)==null||t.removeEventListener("pointerup",this),(e=c.window)==null||e.removeEventListener("pointermove",this)};E=new WeakSet;H=function(t){var e;v(this,L,t.composedPath().includes(this.range)),(e=c.window)==null||e.addEventListener("pointerup",this,{once:!0})};A=new WeakSet;q=function(t){var e;t.pointerType!=="mouse"&&o(this,E,H).call(this,t),this.addEventListener("pointerleave",this,{once:!0}),(e=c.window)==null||e.addEventListener("pointermove",this)};C=new WeakSet;D=function(){var t;(t=c.window)==null||t.removeEventListener("pointerup",this),this.toggleAttribute("dragging",!1),this.range.disabled=this.hasAttribute("disabled")};$=new WeakSet;N=function(){var t,e;this.removeEventListener("pointerleave",this),(t=c.window)==null||t.removeEventListener("pointermove",this),this.toggleAttribute("dragging",!1),this.range.disabled=this.hasAttribute("disabled"),(e=a(this,d).activeSegment)==null||e.style.removeProperty("transform")};W=new WeakSet;z=function(t){t.pointerType==="pen"&&t.buttons===0||(this.toggleAttribute("dragging",t.buttons===1||t.pointerType!=="mouse"),this.updatePointerBar(t),o(this,O,B).call(this,t),this.dragging&&(t.pointerType!=="mouse"||!a(this,L))&&(this.range.disabled=!0,this.range.valueAsNumber=this.getPointerRatio(t),this.range.dispatchEvent(new Event("input",{bubbles:!0,composed:!0}))))};M.shadowRootOptions={mode:"open"};M.getTemplateHTML=V;M.getContainerTemplateHTML=ee;c.customElements.get("media-chrome-range")||c.customElements.define("media-chrome-range",M);export{M};
