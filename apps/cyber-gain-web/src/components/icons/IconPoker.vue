<template>
  <svg v-bind="$attrs" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="poker-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F6FF92"/>
        <stop offset="100%" stop-color="#FDC700"/>
      </linearGradient>
    </defs>
    <path d="M2.196 12.3684C1.426 12.9253 0.499 13.2226 -0.45 13.2173C-2.78 13.2173 -4.668 11.5004 -4.668 9.3834C-4.668 6.6629 -1.965 4.7145 0.427 2.99C1.405 2.2846 2.332 1.6175 3 0.9489C3.668 1.6167 4.595 2.2846 5.573 2.99C7.966 4.7145 10.668 6.6629 10.668 9.3834C10.668 11.5004 8.78 13.2173 6.45 13.2173C5.501 13.2226 4.574 12.9253 3.804 12.3684C4.022 13.6305 4.578 14.5307 5.18 15.5061L5.463 15.9677C5.757 16.4553 5.396 17.0511 4.826 17.0511H1.174C0.604 17.0511 0.243 16.4553 0.537 15.9677L0.82 15.5061C1.422 14.5307 1.978 13.6305 2.196 12.3684Z" transform="translate(4.332 -0.9489)" :fill="isActive ? 'url(#poker-gradient)' : '#8A8CA6'"/>
  </svg>
</template>

<script setup>
defineProps({
  isActive: {
    type: Boolean,
    default: false
  }
})
</script>
