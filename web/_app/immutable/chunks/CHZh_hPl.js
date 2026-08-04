import{M as d}from"./BDgEbnN0.js";import{a as s,c as h,d as v,g as _,s as m,G as r,b as E}from"./C2UIz1tz.js";import{t as l}from"./BvMjJdGg.js";var c=(e,t,n)=>{if(!t.has(e))throw TypeError("Cannot "+n)},L=(e,t,n)=>(c(e,t,"read from private field"),t.get(e)),p=(e,t,n)=>{if(t.has(e))throw TypeError("Cannot add the same private member more than once");t instanceof WeakSet?t.add(e):t.set(e,n)},A=(e,t,n,a)=>(c(e,t,"write to private field"),t.set(e,n),n),o;const I=`<svg aria-hidden="true" viewBox="0 0 26 24">
  <path d="M16 3v2.5h3.5V9H22V3h-6ZM4 9h2.5V5.5H10V3H4v6Zm15.5 9.5H16V21h6v-6h-2.5v3.5ZM6.5 15H4v6h6v-2.5H6.5V15Z"/>
</svg>`,M=`<svg aria-hidden="true" viewBox="0 0 26 24">
  <path d="M18.5 6.5V3H16v6h6V6.5h-3.5ZM16 21h2.5v-3.5H22V15h-6v6ZM4 17.5h3.5V21H10v-6H4v2.5Zm3.5-11H4V9h6V3H7.5v3.5Z"/>
</svg>`;function S(e){return`
    <style>
      :host([${s.MEDIA_IS_FULLSCREEN}]) slot[name=icon] slot:not([name=exit]) {
        display: none !important;
      }

      
      :host(:not([${s.MEDIA_IS_FULLSCREEN}])) slot[name=icon] slot:not([name=enter]) {
        display: none !important;
      }

      :host([${s.MEDIA_IS_FULLSCREEN}]) slot[name=tooltip-enter],
      :host(:not([${s.MEDIA_IS_FULLSCREEN}])) slot[name=tooltip-exit] {
        display: none;
      }
    </style>

    <slot name="icon">
      <slot name="enter">${I}</slot>
      <slot name="exit">${M}</slot>
    </slot>
  `}function C(){return`
    <slot name="tooltip-enter">${l("Enter fullscreen mode")}</slot>
    <slot name="tooltip-exit">${l("Exit fullscreen mode")}</slot>
  `}const u=e=>{const t=e.mediaIsFullscreen?l("exit fullscreen mode"):l("enter fullscreen mode");e.setAttribute("aria-label",t)};class i extends d{constructor(){super(...arguments),p(this,o,null)}static get observedAttributes(){return[...super.observedAttributes,s.MEDIA_IS_FULLSCREEN,s.MEDIA_FULLSCREEN_UNAVAILABLE]}connectedCallback(){super.connectedCallback(),u(this)}attributeChangedCallback(t,n,a){super.attributeChangedCallback(t,n,a),t===s.MEDIA_IS_FULLSCREEN&&u(this)}get mediaFullscreenUnavailable(){return h(this,s.MEDIA_FULLSCREEN_UNAVAILABLE)}set mediaFullscreenUnavailable(t){v(this,s.MEDIA_FULLSCREEN_UNAVAILABLE,t)}get mediaIsFullscreen(){return _(this,s.MEDIA_IS_FULLSCREEN)}set mediaIsFullscreen(t){m(this,s.MEDIA_IS_FULLSCREEN,t)}handleClick(t){A(this,o,t);const n=L(this,o)instanceof PointerEvent,a=this.mediaIsFullscreen?new r.CustomEvent(E.MEDIA_EXIT_FULLSCREEN_REQUEST,{composed:!0,bubbles:!0}):new r.CustomEvent(E.MEDIA_ENTER_FULLSCREEN_REQUEST,{composed:!0,bubbles:!0,detail:n});this.dispatchEvent(a)}}o=new WeakMap;i.getSlotTemplateHTML=S;i.getTooltipContentHTML=C;r.customElements.get("media-fullscreen-button")||r.customElements.define("media-fullscreen-button",i);var U=i;export{U as default};
