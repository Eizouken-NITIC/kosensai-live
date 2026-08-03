import{M as L}from"./Bbah6Pvs.js";import{a as t,c as r,d,b as i,G as l}from"./DgoJgpDD.js";import{t as n}from"./BvMjJdGg.js";const M=`<svg aria-hidden="true" viewBox="0 0 24 24">
  <path d="M16.5 12A4.5 4.5 0 0 0 14 8v2.18l2.45 2.45a4.22 4.22 0 0 0 .05-.63Zm2.5 0a6.84 6.84 0 0 1-.54 2.64L20 16.15A8.8 8.8 0 0 0 21 12a9 9 0 0 0-7-8.77v2.06A7 7 0 0 1 19 12ZM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25A6.92 6.92 0 0 1 14 18.7v2.06A9 9 0 0 0 17.69 19l2 2.05L21 19.73l-9-9L4.27 3ZM12 4 9.91 6.09 12 8.18V4Z"/>
</svg>`,m=`<svg aria-hidden="true" viewBox="0 0 24 24">
  <path d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.47 4.47 0 0 0 2.5-4Z"/>
</svg>`,h=`<svg aria-hidden="true" viewBox="0 0 24 24">
  <path d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.47 4.47 0 0 0 2.5-4ZM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54Z"/>
</svg>`;function c(o){return`
    <style>
      :host(:not([${t.MEDIA_VOLUME_LEVEL}])) slot[name=icon] slot:not([name=high]),
      :host([${t.MEDIA_VOLUME_LEVEL}=high]) slot[name=icon] slot:not([name=high]) {
        display: none !important;
      }

      :host([${t.MEDIA_VOLUME_LEVEL}=off]) slot[name=icon] slot:not([name=off]) {
        display: none !important;
      }

      :host([${t.MEDIA_VOLUME_LEVEL}=low]) slot[name=icon] slot:not([name=low]) {
        display: none !important;
      }

      :host([${t.MEDIA_VOLUME_LEVEL}=medium]) slot[name=icon] slot:not([name=medium]) {
        display: none !important;
      }

      :host(:not([${t.MEDIA_VOLUME_LEVEL}=off])) slot[name=tooltip-unmute],
      :host([${t.MEDIA_VOLUME_LEVEL}=off]) slot[name=tooltip-mute] {
        display: none;
      }
    </style>

    <slot name="icon">
      <slot name="off">${M}</slot>
      <slot name="low">${m}</slot>
      <slot name="medium">${m}</slot>
      <slot name="high">${h}</slot>
    </slot>
  `}function v(){return`
    <slot name="tooltip-mute">${n("Mute")}</slot>
    <slot name="tooltip-unmute">${n("Unmute")}</slot>
  `}const E=o=>{const s=o.mediaVolumeLevel==="off"?n("unmute"):n("mute");o.setAttribute("aria-label",s)};class a extends L{static get observedAttributes(){return[...super.observedAttributes,t.MEDIA_VOLUME_LEVEL]}connectedCallback(){super.connectedCallback(),E(this)}attributeChangedCallback(e,s,u){super.attributeChangedCallback(e,s,u),e===t.MEDIA_VOLUME_LEVEL&&E(this)}get mediaVolumeLevel(){return r(this,t.MEDIA_VOLUME_LEVEL)}set mediaVolumeLevel(e){d(this,t.MEDIA_VOLUME_LEVEL,e)}handleClick(){const e=this.mediaVolumeLevel==="off"?i.MEDIA_UNMUTE_REQUEST:i.MEDIA_MUTE_REQUEST;this.dispatchEvent(new l.CustomEvent(e,{composed:!0,bubbles:!0}))}}a.getSlotTemplateHTML=c;a.getTooltipContentHTML=v;l.customElements.get("media-mute-button")||l.customElements.define("media-mute-button",a);var A=a;export{A as default};
