import{G as h,n as _,M as c}from"./C2UIz1tz.js";var p=(a,t,e)=>{if(!t.has(a))throw TypeError("Cannot "+e)},s=(a,t,e)=>(p(a,t,"read from private field"),e?e.call(a):t.get(a)),g=(a,t,e)=>{if(t.has(a))throw TypeError("Cannot add the same private member more than once");t instanceof WeakSet?t.add(a):t.set(a,e)},r=(a,t,e,o)=>(p(a,t,"write to private field"),t.set(a,e),e),i;function f(a){return`
    <style>
      :host {
        
        box-sizing: border-box;
        display: var(--media-control-display, var(--media-control-bar-display, inline-flex));
        color: var(--media-text-color, var(--media-primary-color, rgb(238 238 238)));
        --media-loading-indicator-icon-height: 44px;
      }

      ::slotted(media-time-range),
      ::slotted(media-volume-range) {
        min-height: 100%;
      }

      ::slotted(media-time-range),
      ::slotted(media-clip-selector) {
        flex-grow: 1;
      }

      ::slotted([role="menu"]) {
        position: absolute;
      }
    </style>

    <slot></slot>
  `}class n extends h.HTMLElement{constructor(){if(super(),g(this,i,void 0),!this.shadowRoot){this.attachShadow(this.constructor.shadowRootOptions);const t=_(this.attributes);this.shadowRoot.innerHTML=this.constructor.getTemplateHTML(t)}}static get observedAttributes(){return[c.MEDIA_CONTROLLER]}attributeChangedCallback(t,e,o){var l,m,u,d,v;t===c.MEDIA_CONTROLLER&&(e&&((m=(l=s(this,i))==null?void 0:l.unassociateElement)==null||m.call(l,this),r(this,i,null)),o&&this.isConnected&&(r(this,i,(u=this.getRootNode())==null?void 0:u.getElementById(o)),(v=(d=s(this,i))==null?void 0:d.associateElement)==null||v.call(d,this)))}connectedCallback(){var t,e,o;const l=this.getAttribute(c.MEDIA_CONTROLLER);l&&(r(this,i,(t=this.getRootNode())==null?void 0:t.getElementById(l)),(o=(e=s(this,i))==null?void 0:e.associateElement)==null||o.call(e,this))}disconnectedCallback(){var t,e;(e=(t=s(this,i))==null?void 0:t.unassociateElement)==null||e.call(t,this),r(this,i,null)}}i=new WeakMap;n.shadowRootOptions={mode:"open"};n.getTemplateHTML=f;h.customElements.get("media-control-bar")||h.customElements.define("media-control-bar",n);var T=n;export{T as default};
