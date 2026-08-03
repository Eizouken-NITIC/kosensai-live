import{G as h,k as W,l as z,m as X,n as D,c as E,d as y,M as f,a as S,e as G,g as I,s as N}from"./DgoJgpDD.js";const c={PLACEMENT:"placement",BOUNDS:"bounds"};function q(o){return`
    <style>
      :host {
        --_tooltip-background-color: var(--media-tooltip-background-color, var(--media-secondary-color, rgba(20, 20, 30, .7)));
        --_tooltip-background: var(--media-tooltip-background, var(--_tooltip-background-color));
        --_tooltip-arrow-half-width: calc(var(--media-tooltip-arrow-width, 12px) / 2);
        --_tooltip-arrow-height: var(--media-tooltip-arrow-height, 5px);
        --_tooltip-arrow-background: var(--media-tooltip-arrow-color, var(--_tooltip-background-color));
        position: relative;
        pointer-events: none;
        display: var(--media-tooltip-display, inline-flex);
        justify-content: center;
        align-items: center;
        box-sizing: border-box;
        z-index: var(--media-tooltip-z-index, 1);
        background: var(--_tooltip-background);
        color: var(--media-text-color, var(--media-primary-color, rgb(238 238 238)));
        font: var(--media-font,
          var(--media-font-weight, 400)
          var(--media-font-size, 13px) /
          var(--media-text-content-height, var(--media-control-height, 18px))
          var(--media-font-family, helvetica neue, segoe ui, roboto, arial, sans-serif));
        padding: var(--media-tooltip-padding, .35em .7em);
        border: var(--media-tooltip-border, none);
        border-radius: var(--media-tooltip-border-radius, 5px);
        filter: var(--media-tooltip-filter, drop-shadow(0 0 4px rgba(0, 0, 0, .2)));
        white-space: var(--media-tooltip-white-space, nowrap);
      }

      :host([hidden]) {
        display: none;
      }

      img, svg {
        display: inline-block;
      }

      #arrow {
        position: absolute;
        width: 0px;
        height: 0px;
        border-style: solid;
        display: var(--media-tooltip-arrow-display, block);
      }

      :host(:not([placement])),
      :host([placement="top"]) {
        position: absolute;
        bottom: calc(100% + var(--media-tooltip-distance, 12px));
        left: 50%;
        transform: translate(calc(-50% - var(--media-tooltip-offset-x, 0px)), 0);
      }
      :host(:not([placement])) #arrow,
      :host([placement="top"]) #arrow {
        top: 100%;
        left: 50%;
        border-width: var(--_tooltip-arrow-height) var(--_tooltip-arrow-half-width) 0 var(--_tooltip-arrow-half-width);
        border-color: var(--_tooltip-arrow-background) transparent transparent transparent;
        transform: translate(calc(-50% + var(--media-tooltip-offset-x, 0px)), 0);
      }

      :host([placement="right"]) {
        position: absolute;
        left: calc(100% + var(--media-tooltip-distance, 12px));
        top: 50%;
        transform: translate(0, -50%);
      }
      :host([placement="right"]) #arrow {
        top: 50%;
        right: 100%;
        border-width: var(--_tooltip-arrow-half-width) var(--_tooltip-arrow-height) var(--_tooltip-arrow-half-width) 0;
        border-color: transparent var(--_tooltip-arrow-background) transparent transparent;
        transform: translate(0, -50%);
      }

      :host([placement="bottom"]) {
        position: absolute;
        top: calc(100% + var(--media-tooltip-distance, 12px));
        left: 50%;
        transform: translate(calc(-50% - var(--media-tooltip-offset-x, 0px)), 0);
      }
      :host([placement="bottom"]) #arrow {
        bottom: 100%;
        left: 50%;
        border-width: 0 var(--_tooltip-arrow-half-width) var(--_tooltip-arrow-height) var(--_tooltip-arrow-half-width);
        border-color: transparent transparent var(--_tooltip-arrow-background) transparent;
        transform: translate(calc(-50% + var(--media-tooltip-offset-x, 0px)), 0);
      }

      :host([placement="left"]) {
        position: absolute;
        right: calc(100% + var(--media-tooltip-distance, 12px));
        top: 50%;
        transform: translate(0, -50%);
      }
      :host([placement="left"]) #arrow {
        top: 50%;
        left: 100%;
        border-width: var(--_tooltip-arrow-half-width) 0 var(--_tooltip-arrow-half-width) var(--_tooltip-arrow-height);
        border-color: transparent transparent transparent var(--_tooltip-arrow-background);
        transform: translate(0, -50%);
      }
      
      :host([placement="none"]) #arrow {
        display: none;
      }
    </style>
    <slot></slot>
    <div id="arrow"></div>
  `}class L extends h.HTMLElement{constructor(){if(super(),this.updateXOffset=()=>{var t;if(!W(this,{checkOpacity:!1,checkVisibilityCSS:!1}))return;const e=this.placement;if(e==="left"||e==="right"){this.style.removeProperty("--media-tooltip-offset-x");return}const a=getComputedStyle(this),r=(t=z(this,"#"+this.bounds))!=null?t:X(this);if(!r)return;const{x:n,width:b}=r.getBoundingClientRect(),{x:p,width:w}=this.getBoundingClientRect(),$=p+w,U=n+b,M=a.getPropertyValue("--media-tooltip-offset-x"),O=M?parseFloat(M.replace("px","")):0,C=a.getPropertyValue("--media-tooltip-container-margin"),A=C?parseFloat(C.replace("px","")):0,R=p-n+O-A,P=$-U+O+A;if(R<0){this.style.setProperty("--media-tooltip-offset-x",`${R}px`);return}if(P>0){this.style.setProperty("--media-tooltip-offset-x",`${P}px`);return}this.style.removeProperty("--media-tooltip-offset-x")},!this.shadowRoot){this.attachShadow(this.constructor.shadowRootOptions);const t=D(this.attributes);this.shadowRoot.innerHTML=this.constructor.getTemplateHTML(t)}if(this.arrowEl=this.shadowRoot.querySelector("#arrow"),Object.prototype.hasOwnProperty.call(this,"placement")){const t=this.placement;delete this.placement,this.placement=t}}static get observedAttributes(){return[c.PLACEMENT,c.BOUNDS]}get placement(){return E(this,c.PLACEMENT)}set placement(t){y(this,c.PLACEMENT,t)}get bounds(){return E(this,c.BOUNDS)}set bounds(t){y(this,c.BOUNDS,t)}}L.shadowRootOptions={mode:"open"};L.getTemplateHTML=q;h.customElements.get("media-tooltip")||h.customElements.define("media-tooltip",L);var H=L,k=(o,t,e)=>{if(!t.has(o))throw TypeError("Cannot "+e)},i=(o,t,e)=>(k(o,t,"read from private field"),e?e.call(o):t.get(o)),m=(o,t,e)=>{if(t.has(o))throw TypeError("Cannot add the same private member more than once");t instanceof WeakSet?t.add(o):t.set(o,e)},T=(o,t,e,a)=>(k(o,t,"write to private field"),t.set(o,e),e),F=(o,t,e)=>(k(o,t,"access private method"),e),s,u,d,v,_,x,B;const l={TOOLTIP_PLACEMENT:"tooltipplacement",DISABLED:"disabled",NO_TOOLTIP:"notooltip"};function K(o,t={}){return`
    <style>
      :host {
        position: relative;
        font: var(--media-font,
          var(--media-font-weight, bold)
          var(--media-font-size, 14px) /
          var(--media-text-content-height, var(--media-control-height, 24px))
          var(--media-font-family, helvetica neue, segoe ui, roboto, arial, sans-serif));
        color: var(--media-text-color, var(--media-primary-color, rgb(238 238 238)));
        background: var(--media-control-background, var(--media-secondary-color, rgb(20 20 30 / .7)));
        padding: var(--media-button-padding, var(--media-control-padding, 10px));
        justify-content: var(--media-button-justify-content, center);
        display: inline-flex;
        align-items: center;
        vertical-align: middle;
        box-sizing: border-box;
        transition: background .15s linear;
        pointer-events: auto;
        cursor: var(--media-cursor, pointer);
        -webkit-tap-highlight-color: transparent;
      }

      
      :host(:focus-visible) {
        box-shadow: var(--media-focus-box-shadow, inset 0 0 0 2px rgb(27 127 204 / .9));
        outline: 0;
      }
      
      :host(:where(:focus)) {
        box-shadow: none;
        outline: 0;
      }

      :host(:hover) {
        background: var(--media-control-hover-background, rgba(50 50 70 / .7));
      }

      slot[name="icon"] {
        display: inline-flex;
        align-items: center;
      }

      svg, img, ::slotted(svg), ::slotted(img) {
        width: var(--media-button-icon-width);
        height: var(--media-button-icon-height, var(--media-control-height, 24px));
        transform: var(--media-button-icon-transform);
        transition: var(--media-button-icon-transition);
        fill: var(--media-icon-color, var(--media-primary-color, rgb(238 238 238)));
        vertical-align: middle;
        max-width: 100%;
        max-height: 100%;
        min-width: 100%;
      }

      media-tooltip {
        
        max-width: 0;
        overflow-x: clip;
        opacity: 0;
        transition: opacity .3s, max-width 0s 9s;
      }

      :host(:hover) media-tooltip,
      :host(:focus-visible) media-tooltip {
        max-width: 100vw;
        opacity: 1;
        transition: opacity .3s;
      }

      :host([notooltip]) slot[name="tooltip"] {
        display: none;
      }
    </style>

    ${this.getSlotTemplateHTML(o,t)}

    <slot name="tooltip">
      <media-tooltip part="tooltip" aria-hidden="true">
        <template shadowrootmode="${H.shadowRootOptions.mode}">
          ${H.getTemplateHTML({})}
        </template>
        <slot name="tooltip-content">
          ${this.getTooltipContentHTML(o)}
        </slot>
      </media-tooltip>
    </slot>
  `}function j(o,t){return`
    <slot></slot>
  `}function J(){return""}class g extends h.HTMLElement{constructor(){if(super(),m(this,x),m(this,s,void 0),this.preventClick=!1,this.tooltipEl=null,m(this,u,t=>{this.preventClick||this.handleClick(t),setTimeout(i(this,d),0)}),m(this,d,()=>{var t,e;(e=(t=this.tooltipEl)==null?void 0:t.updateXOffset)==null||e.call(t)}),m(this,v,t=>{const{key:e}=t;if(!this.keysUsed.includes(e)){this.removeEventListener("keyup",i(this,v));return}this.preventClick||this.handleClick(t)}),m(this,_,t=>{const{metaKey:e,altKey:a,key:r}=t;if(e||a||!this.keysUsed.includes(r)){this.removeEventListener("keyup",i(this,v));return}this.addEventListener("keyup",i(this,v),{once:!0})}),!this.shadowRoot){this.attachShadow(this.constructor.shadowRootOptions);const t=D(this.attributes),e=this.constructor.getTemplateHTML(t);this.shadowRoot.setHTMLUnsafe?this.shadowRoot.setHTMLUnsafe(e):this.shadowRoot.innerHTML=e}this.tooltipEl=this.shadowRoot.querySelector("media-tooltip")}static get observedAttributes(){return["disabled",l.TOOLTIP_PLACEMENT,f.MEDIA_CONTROLLER,S.MEDIA_LANG]}enable(){this.addEventListener("click",i(this,u)),this.addEventListener("keydown",i(this,_)),this.tabIndex=0}disable(){this.removeEventListener("click",i(this,u)),this.removeEventListener("keydown",i(this,_)),this.removeEventListener("keyup",i(this,v)),this.tabIndex=-1}attributeChangedCallback(t,e,a){var r,n,b,p,w;t===f.MEDIA_CONTROLLER?(e&&((n=(r=i(this,s))==null?void 0:r.unassociateElement)==null||n.call(r,this),T(this,s,null)),a&&this.isConnected&&(T(this,s,(b=this.getRootNode())==null?void 0:b.getElementById(a)),(w=(p=i(this,s))==null?void 0:p.associateElement)==null||w.call(p,this))):t==="disabled"&&a!==e?a==null?this.enable():this.disable():t===l.TOOLTIP_PLACEMENT&&this.tooltipEl&&a!==e?this.tooltipEl.placement=a:t===S.MEDIA_LANG&&(this.shadowRoot.querySelector('slot[name="tooltip-content"]').innerHTML=this.constructor.getTooltipContentHTML()),i(this,d).call(this)}connectedCallback(){var t,e,a;const{style:r}=G(this.shadowRoot,":host");r.setProperty("display",`var(--media-control-display, var(--${this.localName}-display, inline-flex))`),this.hasAttribute("disabled")?this.disable():this.enable(),this.setAttribute("role","button");const n=this.getAttribute(f.MEDIA_CONTROLLER);n&&(T(this,s,(t=this.getRootNode())==null?void 0:t.getElementById(n)),(a=(e=i(this,s))==null?void 0:e.associateElement)==null||a.call(e,this)),h.customElements.whenDefined("media-tooltip").then(()=>F(this,x,B).call(this))}disconnectedCallback(){var t,e;this.disable(),(e=(t=i(this,s))==null?void 0:t.unassociateElement)==null||e.call(t,this),T(this,s,null),this.removeEventListener("mouseenter",i(this,d)),this.removeEventListener("focus",i(this,d)),this.removeEventListener("click",i(this,u))}get keysUsed(){return["Enter"," "]}get tooltipPlacement(){return E(this,l.TOOLTIP_PLACEMENT)}set tooltipPlacement(t){y(this,l.TOOLTIP_PLACEMENT,t)}get mediaController(){return E(this,f.MEDIA_CONTROLLER)}set mediaController(t){y(this,f.MEDIA_CONTROLLER,t)}get disabled(){return I(this,l.DISABLED)}set disabled(t){N(this,l.DISABLED,t)}get noTooltip(){return I(this,l.NO_TOOLTIP)}set noTooltip(t){N(this,l.NO_TOOLTIP,t)}handleClick(t){}}s=new WeakMap;u=new WeakMap;d=new WeakMap;v=new WeakMap;_=new WeakMap;x=new WeakSet;B=function(){this.addEventListener("mouseenter",i(this,d)),this.addEventListener("focus",i(this,d)),this.addEventListener("click",i(this,u));const o=this.tooltipPlacement;o&&this.tooltipEl&&(this.tooltipEl.placement=o)};g.shadowRootOptions={mode:"open"};g.getTemplateHTML=K;g.getSlotTemplateHTML=j;g.getTooltipContentHTML=J;h.customElements.get("media-chrome-button")||h.customElements.define("media-chrome-button",g);export{g as M};
