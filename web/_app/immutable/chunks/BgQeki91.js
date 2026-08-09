import{M as m}from"./BDgEbnN0.js";import{a as t,c as u,d,g as c,s as P,b as s,G as n}from"./C2UIz1tz.js";import{t as o}from"./BvMjJdGg.js";const l=`<svg aria-hidden="true" viewBox="0 0 28 24">
  <path d="M24 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h20a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1Zm-1 16H5V5h18v14Zm-3-8h-7v5h7v-5Z"/>
</svg>`;function _(i){return`
    <style>
      :host([${t.MEDIA_IS_PIP}]) slot[name=icon] slot:not([name=exit]) {
        display: none !important;
      }

      :host(:not([${t.MEDIA_IS_PIP}])) slot[name=icon] slot:not([name=enter]) {
        display: none !important;
      }

      :host([${t.MEDIA_IS_PIP}]) slot[name=tooltip-enter],
      :host(:not([${t.MEDIA_IS_PIP}])) slot[name=tooltip-exit] {
        display: none;
      }
    </style>

    <slot name="icon">
      <slot name="enter">${l}</slot>
      <slot name="exit">${l}</slot>
    </slot>
  `}function A(){return`
    <slot name="tooltip-enter">${o("Enter picture in picture mode")}</slot>
    <slot name="tooltip-exit">${o("Exit picture in picture mode")}</slot>
  `}const r=i=>{const e=i.mediaIsPip?o("exit picture in picture mode"):o("enter picture in picture mode");i.setAttribute("aria-label",e)};class a extends m{static get observedAttributes(){return[...super.observedAttributes,t.MEDIA_IS_PIP,t.MEDIA_PIP_UNAVAILABLE]}connectedCallback(){super.connectedCallback(),r(this)}attributeChangedCallback(e,p,I){super.attributeChangedCallback(e,p,I),e===t.MEDIA_IS_PIP&&r(this)}get mediaPipUnavailable(){return u(this,t.MEDIA_PIP_UNAVAILABLE)}set mediaPipUnavailable(e){d(this,t.MEDIA_PIP_UNAVAILABLE,e)}get mediaIsPip(){return c(this,t.MEDIA_IS_PIP)}set mediaIsPip(e){P(this,t.MEDIA_IS_PIP,e)}handleClick(){const e=this.mediaIsPip?s.MEDIA_EXIT_PIP_REQUEST:s.MEDIA_ENTER_PIP_REQUEST;this.dispatchEvent(new n.CustomEvent(e,{composed:!0,bubbles:!0}))}}a.getSlotTemplateHTML=_;a.getTooltipContentHTML=A;n.customElements.get("media-pip-button")||n.customElements.define("media-pip-button",a);var M=a;export{M as default};
